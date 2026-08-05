#[path = "../src/offline_entitlement.rs"]
mod verifier;

use std::collections::BTreeSet;

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use serde_json::Value;
use sha2::{Digest, Sha256};
use verifier::{
    OfflineEntitlementSigningKey, OfflineEntitlementSigningKeyStatus, OfflineEntitlementVerdict,
    OfflineEntitlementVerificationContext, TrustedTimeStore, verify_offline_entitlement,
};

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

fn manifest() -> Value {
    fixture_json(MANIFEST_BYTES)
}

fn fixtures() -> Vec<Value> {
    let mut fixtures = vec![fixture_json(VALID_BYTES)];
    fixtures.extend(
        fixture_json(INVALID_BYTES)
            .as_array()
            .expect("invalid fixture array")
            .iter()
            .cloned(),
    );
    fixtures
}

fn fixture(case_id: &str) -> Value {
    fixtures()
        .into_iter()
        .find(|fixture| fixture["id"].as_str() == Some(case_id))
        .unwrap_or_else(|| panic!("missing offline entitlement fixture: {case_id}"))
}

fn assert_corpus_integrity() {
    let manifest = manifest();
    let fixtures = fixtures();
    assert_eq!(manifest["totalCases"], 14);
    assert_eq!(fixtures.len(), 14);
    assert_eq!(
        manifest["files"]["valid.json"],
        format!("{:x}", Sha256::digest(VALID_BYTES))
    );
    assert_eq!(
        manifest["files"]["invalid.json"],
        format!("{:x}", Sha256::digest(INVALID_BYTES))
    );
    assert_eq!(
        fixtures
            .iter()
            .map(|fixture| fixture["id"].as_str().expect("fixture id"))
            .collect::<BTreeSet<_>>()
            .len(),
        14
    );
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
    manifest()["keyRing"]
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

fn assert_fixture_verdict(case_id: &str, expected_verdict: &str) {
    assert_corpus_integrity();
    let fixture = fixture(case_id);
    assert_eq!(fixture["expectedVerdict"], expected_verdict);
    let context = &fixture["context"];
    let now = fixture["nowUnixSeconds"].as_i64().expect("fixture now");
    let initial_trusted_time = fixture["lastTrustedUnixSeconds"]
        .as_i64()
        .expect("last trusted time");
    let mut trusted_time_store = MemoryTrustedTimeStore(Some(initial_trusted_time));

    let verdict = verify_offline_entitlement(
        &fixture["envelope"],
        &key_ring(),
        OfflineEntitlementVerificationContext {
            account_id: context["accountId"].as_str().expect("account binding"),
            device_binding: context["deviceBinding"].as_str().expect("device binding"),
            audience: context["audience"].as_str().expect("audience"),
            entitlement_version: context["entitlementVersion"]
                .as_u64()
                .expect("entitlement version"),
            now_unix_seconds: now,
        },
        &mut trusted_time_store,
    );
    assert_eq!(verdict.as_str(), expected_verdict);

    if verdict == OfflineEntitlementVerdict::Verified {
        assert_eq!(trusted_time_store.0, Some(now));
    } else {
        assert_eq!(trusted_time_store.0, Some(initial_trusted_time));
    }

    if case_id == "previous key outside declared rotation window" {
        let keys = key_ring();
        let previous = keys
            .iter()
            .find(|key| key.status == OfflineEntitlementSigningKeyStatus::Previous)
            .expect("previous fixture key");
        let mut inside_window_store =
            MemoryTrustedTimeStore(Some(previous.not_after_unix_seconds - 86_400));
        assert_eq!(
            verify_offline_entitlement(
                &fixture["envelope"],
                &keys,
                OfflineEntitlementVerificationContext {
                    account_id: context["accountId"].as_str().expect("account binding"),
                    device_binding: context["deviceBinding"].as_str().expect("device binding"),
                    audience: context["audience"].as_str().expect("audience"),
                    entitlement_version: context["entitlementVersion"]
                        .as_u64()
                        .expect("entitlement version"),
                    now_unix_seconds: previous.not_after_unix_seconds,
                },
                &mut inside_window_store,
            ),
            OfflineEntitlementVerdict::Verified
        );
    }

    if case_id == "canonical exact bytes through issuedAt plus seven days" {
        let mut version_mismatch_store = MemoryTrustedTimeStore(Some(initial_trusted_time));
        assert_eq!(
            verify_offline_entitlement(
                &fixture["envelope"],
                &key_ring(),
                OfflineEntitlementVerificationContext {
                    account_id: context["accountId"].as_str().expect("account binding"),
                    device_binding: context["deviceBinding"].as_str().expect("device binding"),
                    audience: context["audience"].as_str().expect("audience"),
                    entitlement_version: context["entitlementVersion"]
                        .as_u64()
                        .expect("entitlement version")
                        + 1,
                    now_unix_seconds: now,
                },
                &mut version_mismatch_store,
            ),
            OfflineEntitlementVerdict::OnlineVerificationRequired
        );
    }
}

macro_rules! offline_entitlement_witness {
    ($name:ident, $case_id:literal, $expected_verdict:literal) => {
        #[test]
        fn $name() {
            assert_fixture_verdict($case_id, $expected_verdict);
        }
    };
}

offline_entitlement_witness!(
    offline_entitlement_canonical_exact_bytes_verify_through_seven_days,
    "canonical exact bytes through issuedAt plus seven days",
    "verified"
);
offline_entitlement_witness!(
    offline_entitlement_one_byte_payload_tamper_requires_online_verification,
    "one-byte payload tamper",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_reserialized_payload_requires_online_verification,
    "whitespace or JSON reserialization changes signed bytes",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_unknown_key_requires_online_verification,
    "unknown signing key",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_wrong_key_requires_online_verification,
    "wrong signing key",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_retired_key_requires_online_verification,
    "retired signing key",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_previous_key_outside_rotation_window_requires_online_verification,
    "previous key outside declared rotation window",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_wrong_account_binding_requires_online_verification,
    "wrong account binding",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_wrong_device_binding_requires_online_verification,
    "wrong device binding",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_wrong_audience_requires_online_verification,
    "wrong audience",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_wrong_schema_version_requires_online_verification,
    "wrong schema version",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_expired_envelope_requires_online_verification,
    "expired seven-day envelope",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_future_issued_at_requires_online_verification,
    "future issuedAt",
    "online-verification-required"
);
offline_entitlement_witness!(
    offline_entitlement_trusted_clock_rollback_requires_online_verification,
    "trusted-clock rollback",
    "online-verification-required"
);
