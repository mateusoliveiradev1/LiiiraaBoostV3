#[path = "../src/offline_entitlement.rs"]
mod offline_entitlement;
#[path = "../src/premium_authority.rs"]
mod premium_authority;

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use offline_entitlement::{
    OfflineEntitlementSigningKey, OfflineEntitlementSigningKeyStatus,
    OfflineEntitlementVerificationContext, TrustedTimeStore,
};
use premium_authority::{
    PremiumAuthenticatedContact, PremiumAuthority, PremiumAuthorityReason, PremiumCapabilityCode,
    PremiumCapabilityKind, PremiumRenewalDisposition, authorize_capability,
    renew_offline_entitlement,
};
use serde_json::Value;

const MANIFEST_BYTES: &[u8] = include_bytes!(
    "../../../../packages/contracts-ts/src/fixtures/offline-entitlement/manifest.json"
);
const VALID_BYTES: &[u8] =
    include_bytes!("../../../../packages/contracts-ts/src/fixtures/offline-entitlement/valid.json");
const INVALID_BYTES: &[u8] = include_bytes!(
    "../../../../packages/contracts-ts/src/fixtures/offline-entitlement/invalid.json"
);

#[derive(Debug)]
struct MemoryTrustedTimeStore(Option<i64>);

impl TrustedTimeStore for MemoryTrustedTimeStore {
    fn read_last_trusted_unix_seconds(&self) -> Option<i64> {
        self.0
    }

    fn write_last_trusted_unix_seconds(&mut self, value: i64) -> Result<(), ()> {
        self.0 = Some(value);
        Ok(())
    }
}

fn fixture_json(bytes: &[u8]) -> Value {
    serde_json::from_slice(bytes).expect("offline entitlement fixture must be valid JSON")
}

fn valid_fixture() -> Value {
    fixture_json(VALID_BYTES)
}

fn invalid_fixture(case_id: &str) -> Value {
    fixture_json(INVALID_BYTES)
        .as_array()
        .expect("invalid fixture array")
        .iter()
        .find(|fixture| fixture["id"].as_str() == Some(case_id))
        .cloned()
        .unwrap_or_else(|| panic!("missing fixture {case_id}"))
}

fn signing_key_status(status: &str) -> OfflineEntitlementSigningKeyStatus {
    match status {
        "current" => OfflineEntitlementSigningKeyStatus::Current,
        "previous" => OfflineEntitlementSigningKeyStatus::Previous,
        "retired" => OfflineEntitlementSigningKeyStatus::Retired,
        _ => panic!("unknown signing-key fixture status"),
    }
}

fn key_ring() -> Vec<OfflineEntitlementSigningKey> {
    fixture_json(MANIFEST_BYTES)["keyRing"]
        .as_array()
        .expect("fixture key ring")
        .iter()
        .map(|key| OfflineEntitlementSigningKey {
            key_id: key["keyId"].as_str().expect("key id").to_owned(),
            public_key_bytes: URL_SAFE_NO_PAD
                .decode(key["publicKeyBytes"].as_str().expect("public key bytes"))
                .expect("base64url public key")
                .try_into()
                .expect("32-byte Ed25519 public key"),
            status: signing_key_status(key["status"].as_str().expect("key status")),
            not_before_unix_seconds: key["notBeforeUnixSeconds"]
                .as_i64()
                .expect("key not-before"),
            not_after_unix_seconds: key["notAfterUnixSeconds"].as_i64().expect("key not-after"),
        })
        .collect()
}

fn context_at(now_unix_seconds: i64) -> OfflineEntitlementVerificationContext<'static> {
    OfflineEntitlementVerificationContext {
        account_id: "synthetic-account-0001",
        device_binding: "synthetic-device-binding",
        audience: "liiiraa-desktop",
        entitlement_version: 7,
        now_unix_seconds,
    }
}

fn envelope_bytes(fixture: &Value) -> Vec<u8> {
    serde_json::to_vec(&fixture["envelope"]).expect("fixture envelope bytes")
}

fn renew_valid(
    authority: &mut PremiumAuthority,
    now_unix_seconds: i64,
    store: &mut MemoryTrustedTimeStore,
) -> Vec<u8> {
    let bytes = envelope_bytes(&valid_fixture());
    assert_eq!(
        renew_offline_entitlement(
            authority,
            PremiumAuthenticatedContact::Renewed {
                envelope_bytes: &bytes,
            },
            &key_ring(),
            context_at(now_unix_seconds),
            store,
        ),
        PremiumRenewalDisposition::RenewedSilently
    );
    bytes
}

#[test]
fn premium_authority_silently_renews_and_retains_exact_received_envelope_bytes() {
    let mut authority = PremiumAuthority::default();
    let mut store = MemoryTrustedTimeStore(Some(1_785_931_200));
    let bytes = renew_valid(&mut authority, 1_785_931_200, &mut store);

    assert_eq!(authority.envelope_bytes(), Some(bytes.as_slice()));
    assert_eq!(
        authorize_capability(
            &mut authority,
            PremiumCapabilityKind::StartNewPaidAction,
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        )
        .code,
        PremiumCapabilityCode::Allowed
    );
}

#[test]
fn premium_authority_warns_only_as_verified_authority_approaches_expiry() {
    let mut authority = PremiumAuthority::default();
    let approaching_expiry = 1_786_446_000;
    let mut store = MemoryTrustedTimeStore(Some(1_786_359_600));
    renew_valid(&mut authority, approaching_expiry, &mut store);

    assert_eq!(
        authorize_capability(
            &mut authority,
            PremiumCapabilityKind::StartNewPaidAction,
            &key_ring(),
            context_at(approaching_expiry),
            &mut store,
        )
        .code,
        PremiumCapabilityCode::AllowedWithExpiryWarning
    );
}

#[test]
fn premium_authority_denies_the_next_start_after_expiry() {
    let mut authority = PremiumAuthority::default();
    let mut store = MemoryTrustedTimeStore(Some(1_785_931_200));
    renew_valid(&mut authority, 1_785_931_200, &mut store);

    let decision = authorize_capability(
        &mut authority,
        PremiumCapabilityKind::StartNewPaidAction,
        &key_ring(),
        context_at(1_786_449_601),
        &mut store,
    );
    assert!(!decision.allowed);
    assert_eq!(decision.reason, Some(PremiumAuthorityReason::Expired));
    assert!(decision.requires_online_verification);

    let continuation = authorize_capability(
        &mut authority,
        PremiumCapabilityKind::ContinueInFlightOperation,
        &key_ring(),
        context_at(1_786_449_601),
        &mut store,
    );
    assert!(continuation.allowed);
    assert_eq!(continuation.code, PremiumCapabilityCode::Continued);
}

#[test]
fn premium_authority_clock_rollback_blocks_only_the_next_start() {
    let mut authority = PremiumAuthority::default();
    let mut store = MemoryTrustedTimeStore(Some(1_785_931_200));
    renew_valid(&mut authority, 1_785_931_200, &mut store);

    let decision = authorize_capability(
        &mut authority,
        PremiumCapabilityKind::StartNewPaidAction,
        &key_ring(),
        context_at(1_785_844_800),
        &mut store,
    );
    assert!(!decision.allowed);
    assert_eq!(decision.reason, Some(PremiumAuthorityReason::Contradictory));
    assert!(decision.requires_online_verification);
}

#[test]
fn premium_authority_denies_revoked_and_contradictory_new_work() {
    let mut revoked = PremiumAuthority::default();
    let mut store = MemoryTrustedTimeStore(Some(1_785_931_200));
    assert_eq!(
        renew_offline_entitlement(
            &mut revoked,
            PremiumAuthenticatedContact::Revoked,
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        ),
        PremiumRenewalDisposition::Revoked
    );
    assert_eq!(
        authorize_capability(
            &mut revoked,
            PremiumCapabilityKind::StartNewPaidAction,
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        )
        .reason,
        Some(PremiumAuthorityReason::Revoked)
    );

    let tampered = invalid_fixture("one-byte payload tamper");
    let tampered_bytes = envelope_bytes(&tampered);
    let mut contradictory = PremiumAuthority::default();
    assert_eq!(
        renew_offline_entitlement(
            &mut contradictory,
            PremiumAuthenticatedContact::Renewed {
                envelope_bytes: &tampered_bytes,
            },
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        ),
        PremiumRenewalDisposition::VerificationRequired
    );
    assert_eq!(
        authorize_capability(
            &mut contradictory,
            PremiumCapabilityKind::StartNewPaidAction,
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        )
        .reason,
        Some(PremiumAuthorityReason::Contradictory)
    );
}

#[test]
fn premium_authority_unavailable_contact_retains_verified_offline_authority_without_a_notice() {
    let mut authority = PremiumAuthority::default();
    let mut store = MemoryTrustedTimeStore(Some(1_785_931_200));
    renew_valid(&mut authority, 1_785_931_200, &mut store);

    assert_eq!(
        renew_offline_entitlement(
            &mut authority,
            PremiumAuthenticatedContact::Unavailable,
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        ),
        PremiumRenewalDisposition::RetainedOfflineAuthority
    );
}

#[test]
fn premium_authority_loss_never_interrupts_active_or_in_flight_work() {
    let mut authority = PremiumAuthority::default();
    let mut store = MemoryTrustedTimeStore(Some(1_785_931_200));
    assert_eq!(
        renew_offline_entitlement(
            &mut authority,
            PremiumAuthenticatedContact::Revoked,
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        ),
        PremiumRenewalDisposition::Revoked
    );
    let capabilities = [
        PremiumCapabilityKind::ContinueActiveGame,
        PremiumCapabilityKind::ContinueInFlightOperation,
    ];

    for capability in capabilities {
        let decision = authorize_capability(
            &mut authority,
            capability,
            &key_ring(),
            context_at(1_786_449_601),
            &mut store,
        );
        assert!(decision.allowed);
        assert_eq!(decision.code, PremiumCapabilityCode::Continued);
        assert!(!decision.requires_online_verification);
    }
}

#[test]
fn premium_authority_safety_and_local_evidence_survive_every_authority_failure() {
    let mut authority = PremiumAuthority::default();
    let mut store = MemoryTrustedTimeStore(Some(1_785_931_200));
    assert_eq!(
        renew_offline_entitlement(
            &mut authority,
            PremiumAuthenticatedContact::Revoked,
            &key_ring(),
            context_at(1_785_931_200),
            &mut store,
        ),
        PremiumRenewalDisposition::Revoked
    );
    let capabilities = [
        PremiumCapabilityKind::AccountAccess,
        PremiumCapabilityKind::DiagnosticHistory,
        PremiumCapabilityKind::Diagnostics,
        PremiumCapabilityKind::ExistingChangeReview,
        PremiumCapabilityKind::Restoration,
        PremiumCapabilityKind::SecurityWarnings,
    ];

    for capability in capabilities {
        let decision = authorize_capability(
            &mut authority,
            capability,
            &key_ring(),
            context_at(1_786_449_601),
            &mut store,
        );
        assert!(decision.allowed);
        assert_eq!(decision.code, PremiumCapabilityCode::SafetyPreserved);
        assert!(!decision.requires_online_verification);
    }
}
