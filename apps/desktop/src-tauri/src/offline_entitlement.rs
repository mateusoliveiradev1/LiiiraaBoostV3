use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use ed25519_dalek::{Signature, VerifyingKey};
use liiiraa_contracts_rust::validate_control_plane_document;
use serde::Deserialize;
use serde_json::Value;

pub const OFFLINE_ENTITLEMENT_VALIDITY_SECONDS: i64 = 604_800;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OfflineEntitlementVerdict {
    Verified,
    OnlineVerificationRequired,
}

impl OfflineEntitlementVerdict {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Verified => "verified",
            Self::OnlineVerificationRequired => "online-verification-required",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OfflineEntitlementSigningKeyStatus {
    Current,
    Previous,
    Retired,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OfflineEntitlementSigningKey {
    pub key_id: String,
    pub public_key_bytes: [u8; 32],
    pub status: OfflineEntitlementSigningKeyStatus,
    pub not_before_unix_seconds: i64,
    pub not_after_unix_seconds: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct OfflineEntitlementVerificationContext<'a> {
    pub account_id: &'a str,
    pub device_binding: &'a str,
    pub audience: &'a str,
    pub entitlement_version: u64,
    pub now_unix_seconds: i64,
}

pub trait TrustedTimeStore {
    fn read_last_trusted_unix_seconds(&self) -> Option<i64>;
    fn write_last_trusted_unix_seconds(&mut self, value: i64) -> Result<(), ()>;
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OfflineEntitlementClaims {
    schema_version: String,
    account_id: String,
    device_binding: String,
    audience: String,
    entitlement_version: u64,
    issued_at: String,
    expires_at: String,
    validity_seconds: i64,
}

struct EnvelopeView<'a> {
    payload_bytes: &'a str,
    signature: &'a str,
    key_id: &'a str,
    audience: &'a str,
    device_binding: &'a str,
    issued_at: &'a str,
    expires_at: &'a str,
}

fn string_property<'a>(input: &'a Value, property: &str) -> Option<&'a str> {
    input.as_object()?.get(property)?.as_str()
}

fn envelope_view(input: &Value) -> Option<EnvelopeView<'_>> {
    Some(EnvelopeView {
        payload_bytes: string_property(input, "payloadBytes")?,
        signature: string_property(input, "signature")?,
        key_id: string_property(input, "keyId")?,
        audience: string_property(input, "audience")?,
        device_binding: string_property(input, "deviceBinding")?,
        issued_at: string_property(input, "issuedAt")?,
        expires_at: string_property(input, "expiresAt")?,
    })
}

fn decode_base64url(value: &str) -> Option<Vec<u8>> {
    if value.is_empty()
        || value.len() % 4 == 1
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
    {
        return None;
    }

    let decoded = URL_SAFE_NO_PAD.decode(value).ok()?;
    (URL_SAFE_NO_PAD.encode(&decoded) == value).then_some(decoded)
}

fn leap_year(year: i64) -> bool {
    year % 4 == 0 && (year % 100 != 0 || year % 400 == 0)
}

fn days_in_month(year: i64, month: i64) -> Option<i64> {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => Some(31),
        4 | 6 | 9 | 11 => Some(30),
        2 if leap_year(year) => Some(29),
        2 => Some(28),
        _ => None,
    }
}

fn decimal(input: &[u8]) -> Option<i64> {
    input.iter().try_fold(0_i64, |value, byte| {
        if byte.is_ascii_digit() {
            Some(value * 10 + i64::from(byte - b'0'))
        } else {
            None
        }
    })
}

pub(crate) fn parse_canonical_utc_seconds(value: &str) -> Option<i64> {
    let bytes = value.as_bytes();
    if bytes.len() != 24
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
        || &bytes[19..24] != b".000Z"
    {
        return None;
    }

    let year = decimal(&bytes[0..4])?;
    let month = decimal(&bytes[5..7])?;
    let day = decimal(&bytes[8..10])?;
    let hour = decimal(&bytes[11..13])?;
    let minute = decimal(&bytes[14..16])?;
    let second = decimal(&bytes[17..19])?;
    if year < 1970
        || day == 0
        || day > days_in_month(year, month)?
        || hour > 23
        || minute > 59
        || second > 59
    {
        return None;
    }

    let adjusted_year = year - i64::from(month <= 2);
    let era = adjusted_year.div_euclid(400);
    let year_of_era = adjusted_year - era * 400;
    let adjusted_month = month + if month > 2 { -3 } else { 9 };
    let day_of_year = (153 * adjusted_month + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    let days_since_epoch = era * 146_097 + day_of_era - 719_468;

    days_since_epoch
        .checked_mul(86_400)?
        .checked_add(hour * 3_600 + minute * 60 + second)
}

fn verification_required() -> OfflineEntitlementVerdict {
    OfflineEntitlementVerdict::OnlineVerificationRequired
}

fn verify_candidate(
    input: &Value,
    key_ring: &[OfflineEntitlementSigningKey],
    context: OfflineEntitlementVerificationContext<'_>,
    trusted_time_store: &mut impl TrustedTimeStore,
) -> Option<()> {
    let envelope = envelope_view(input)?;
    let signing_key = key_ring.iter().find(|key| key.key_id == envelope.key_id)?;
    if signing_key.status == OfflineEntitlementSigningKeyStatus::Retired {
        return None;
    }

    let payload_bytes = decode_base64url(envelope.payload_bytes)?;
    let signature_bytes: [u8; 64] = decode_base64url(envelope.signature)?.try_into().ok()?;
    let signature = Signature::from_bytes(&signature_bytes);
    let verifying_key = VerifyingKey::from_bytes(&signing_key.public_key_bytes).ok()?;
    verifying_key
        .verify_strict(&payload_bytes, &signature)
        .ok()?;

    validate_control_plane_document(input).ok()?;
    let claims: OfflineEntitlementClaims = serde_json::from_slice(&payload_bytes).ok()?;

    let issued_at = parse_canonical_utc_seconds(&claims.issued_at)?;
    let expires_at = parse_canonical_utc_seconds(&claims.expires_at)?;
    let envelope_issued_at = parse_canonical_utc_seconds(envelope.issued_at)?;
    let envelope_expires_at = parse_canonical_utc_seconds(envelope.expires_at)?;
    let last_trusted_time = trusted_time_store.read_last_trusted_unix_seconds();

    if last_trusted_time.is_some_and(|last| context.now_unix_seconds < last)
        || context.now_unix_seconds < issued_at
        || context.now_unix_seconds > expires_at
        || expires_at.checked_sub(issued_at)? != OFFLINE_ENTITLEMENT_VALIDITY_SECONDS
        || claims.validity_seconds != OFFLINE_ENTITLEMENT_VALIDITY_SECONDS
        || issued_at != envelope_issued_at
        || expires_at != envelope_expires_at
        || claims.schema_version != "1.0"
        || claims.account_id != context.account_id
        || claims.device_binding != context.device_binding
        || claims.device_binding != envelope.device_binding
        || claims.audience != context.audience
        || claims.audience != envelope.audience
        || claims.entitlement_version != context.entitlement_version
        || issued_at < signing_key.not_before_unix_seconds
        || issued_at > signing_key.not_after_unix_seconds
        || context.now_unix_seconds < signing_key.not_before_unix_seconds
        || context.now_unix_seconds > signing_key.not_after_unix_seconds
    {
        return None;
    }

    trusted_time_store
        .write_last_trusted_unix_seconds(context.now_unix_seconds)
        .ok()
}

pub fn verify_offline_entitlement(
    input: &Value,
    key_ring: &[OfflineEntitlementSigningKey],
    context: OfflineEntitlementVerificationContext<'_>,
    trusted_time_store: &mut impl TrustedTimeStore,
) -> OfflineEntitlementVerdict {
    if verify_candidate(input, key_ring, context, trusted_time_store).is_some() {
        OfflineEntitlementVerdict::Verified
    } else {
        verification_required()
    }
}

#[cfg(test)]
mod tests {
    use super::{OFFLINE_ENTITLEMENT_VALIDITY_SECONDS, parse_canonical_utc_seconds};

    #[test]
    fn canonical_utc_parser_preserves_exact_seven_day_math() {
        let issued = parse_canonical_utc_seconds("2026-08-04T12:00:00.000Z").expect("issued");
        let expires = parse_canonical_utc_seconds("2026-08-11T12:00:00.000Z").expect("expires");
        assert_eq!(expires - issued, OFFLINE_ENTITLEMENT_VALIDITY_SECONDS);
        assert!(parse_canonical_utc_seconds("2026-02-29T12:00:00.000Z").is_none());
        assert!(parse_canonical_utc_seconds("2026-08-04T12:00:00Z").is_none());
    }
}
