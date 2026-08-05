use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::Deserialize;
use serde_json::Value;

use crate::offline_entitlement::{
    OfflineEntitlementSigningKey, OfflineEntitlementVerdict, OfflineEntitlementVerificationContext,
    TrustedTimeStore, parse_canonical_utc_seconds, verify_offline_entitlement,
};

const APPROACHING_EXPIRY_SECONDS: i64 = 86_400;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumCapabilityKind {
    AccountAccess,
    ContinueActiveGame,
    ContinueInFlightOperation,
    DiagnosticHistory,
    Diagnostics,
    ExistingChangeReview,
    Restoration,
    SecurityWarnings,
    StartNewPaidAction,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumAuthorityReason {
    Contradictory,
    Expired,
    Revoked,
    Stale,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumCapabilityCode {
    Allowed,
    AllowedWithExpiryWarning,
    Continued,
    OnlineVerificationRequired,
    SafetyPreserved,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PremiumCapabilityDecision {
    pub allowed: bool,
    pub code: PremiumCapabilityCode,
    pub reason: Option<PremiumAuthorityReason>,
    pub requires_online_verification: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PremiumRenewalDisposition {
    RenewedSilently,
    RetainedOfflineAuthority,
    Revoked,
    VerificationRequired,
}

pub enum PremiumAuthenticatedContact<'a> {
    Renewed { envelope_bytes: &'a [u8] },
    Revoked,
    Unavailable,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct PremiumAuthority {
    envelope_bytes: Option<Vec<u8>>,
    reason: Option<PremiumAuthorityReason>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SignedClaimsTime {
    expires_at: String,
}

impl PremiumAuthority {
    pub fn envelope_bytes(&self) -> Option<&[u8]> {
        self.envelope_bytes.as_deref()
    }
}

fn capability_decision(
    allowed: bool,
    code: PremiumCapabilityCode,
    reason: Option<PremiumAuthorityReason>,
    requires_online_verification: bool,
) -> PremiumCapabilityDecision {
    PremiumCapabilityDecision {
        allowed,
        code,
        reason,
        requires_online_verification,
    }
}

fn signed_expiry_unix_seconds(document: &Value) -> Option<i64> {
    let payload_bytes = document
        .as_object()?
        .get("payloadBytes")?
        .as_str()
        .and_then(|encoded| URL_SAFE_NO_PAD.decode(encoded).ok())?;
    let claims: SignedClaimsTime = serde_json::from_slice(&payload_bytes).ok()?;
    parse_canonical_utc_seconds(&claims.expires_at)
}

fn deny_start(
    authority: &mut PremiumAuthority,
    reason: PremiumAuthorityReason,
) -> PremiumCapabilityDecision {
    authority.reason = Some(reason);
    capability_decision(
        false,
        PremiumCapabilityCode::OnlineVerificationRequired,
        Some(reason),
        true,
    )
}

pub fn renew_offline_entitlement(
    authority: &mut PremiumAuthority,
    contact: PremiumAuthenticatedContact<'_>,
    key_ring: &[OfflineEntitlementSigningKey],
    context: OfflineEntitlementVerificationContext<'_>,
    trusted_time_store: &mut impl TrustedTimeStore,
) -> PremiumRenewalDisposition {
    match contact {
        PremiumAuthenticatedContact::Unavailable => {
            if authority.envelope_bytes.is_some() {
                PremiumRenewalDisposition::RetainedOfflineAuthority
            } else {
                authority.reason = Some(PremiumAuthorityReason::Stale);
                PremiumRenewalDisposition::VerificationRequired
            }
        }
        PremiumAuthenticatedContact::Revoked => {
            authority.envelope_bytes = None;
            authority.reason = Some(PremiumAuthorityReason::Revoked);
            PremiumRenewalDisposition::Revoked
        }
        PremiumAuthenticatedContact::Renewed { envelope_bytes } => {
            let Ok(document) = serde_json::from_slice::<Value>(envelope_bytes) else {
                authority.envelope_bytes = None;
                authority.reason = Some(PremiumAuthorityReason::Contradictory);
                return PremiumRenewalDisposition::VerificationRequired;
            };
            if verify_offline_entitlement(&document, key_ring, context, trusted_time_store)
                != OfflineEntitlementVerdict::Verified
            {
                authority.envelope_bytes = None;
                authority.reason = Some(PremiumAuthorityReason::Contradictory);
                return PremiumRenewalDisposition::VerificationRequired;
            }

            authority.envelope_bytes = Some(envelope_bytes.to_vec());
            authority.reason = None;
            PremiumRenewalDisposition::RenewedSilently
        }
    }
}

pub fn authorize_capability(
    authority: &mut PremiumAuthority,
    capability: PremiumCapabilityKind,
    key_ring: &[OfflineEntitlementSigningKey],
    context: OfflineEntitlementVerificationContext<'_>,
    trusted_time_store: &mut impl TrustedTimeStore,
) -> PremiumCapabilityDecision {
    if matches!(
        capability,
        PremiumCapabilityKind::ContinueActiveGame
            | PremiumCapabilityKind::ContinueInFlightOperation
    ) {
        return capability_decision(true, PremiumCapabilityCode::Continued, None, false);
    }
    if !matches!(capability, PremiumCapabilityKind::StartNewPaidAction) {
        return capability_decision(true, PremiumCapabilityCode::SafetyPreserved, None, false);
    }

    if authority.reason == Some(PremiumAuthorityReason::Revoked) {
        return deny_start(authority, PremiumAuthorityReason::Revoked);
    }
    let Some(envelope_bytes) = authority.envelope_bytes.as_deref() else {
        return deny_start(
            authority,
            authority.reason.unwrap_or(PremiumAuthorityReason::Stale),
        );
    };
    let Ok(document) = serde_json::from_slice::<Value>(envelope_bytes) else {
        authority.envelope_bytes = None;
        return deny_start(authority, PremiumAuthorityReason::Contradictory);
    };
    let expiry = signed_expiry_unix_seconds(&document);
    if verify_offline_entitlement(&document, key_ring, context, trusted_time_store)
        != OfflineEntitlementVerdict::Verified
    {
        authority.envelope_bytes = None;
        let reason = if expiry.is_some_and(|value| context.now_unix_seconds > value) {
            PremiumAuthorityReason::Expired
        } else {
            PremiumAuthorityReason::Contradictory
        };
        return deny_start(authority, reason);
    }

    authority.reason = None;
    if expiry.is_some_and(|value| value - context.now_unix_seconds <= APPROACHING_EXPIRY_SECONDS) {
        capability_decision(
            true,
            PremiumCapabilityCode::AllowedWithExpiryWarning,
            None,
            false,
        )
    } else {
        capability_decision(true, PremiumCapabilityCode::Allowed, None, false)
    }
}
