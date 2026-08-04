use liiiraa_contracts_rust::validate_control_plane_document;
use serde_json::Value;
use sha2::{Digest, Sha256};

const OFFLINE_ENTITLEMENT_RED_OWNER: &str = "04-07-01";

const MANIFEST_BYTES: &[u8] = include_bytes!(
    "../../../../packages/contracts-ts/src/fixtures/offline-entitlement/manifest.json"
);
const VALID_BYTES: &[u8] =
    include_bytes!("../../../../packages/contracts-ts/src/fixtures/offline-entitlement/valid.json");
const INVALID_BYTES: &[u8] = include_bytes!(
    "../../../../packages/contracts-ts/src/fixtures/offline-entitlement/invalid.json"
);

fn fixture_json(bytes: &[u8]) -> Value {
    serde_json::from_slice(bytes).expect("offline entitlement fixture must be valid JSON")
}

fn assert_corpus_integrity() {
    let manifest = fixture_json(MANIFEST_BYTES);
    let valid = fixture_json(VALID_BYTES);
    let invalid = fixture_json(INVALID_BYTES);

    assert_eq!(manifest["totalCases"], 14);
    assert_eq!(invalid.as_array().expect("invalid fixture array").len(), 13);
    assert_eq!(
        manifest["files"]["valid.json"],
        format!("{:x}", Sha256::digest(VALID_BYTES))
    );
    assert_eq!(
        manifest["files"]["invalid.json"],
        format!("{:x}", Sha256::digest(INVALID_BYTES))
    );

    let mut ids = invalid
        .as_array()
        .expect("invalid fixture array")
        .iter()
        .map(|fixture| fixture["id"].as_str().expect("fixture id"))
        .collect::<Vec<_>>();
    ids.push(valid["id"].as_str().expect("valid fixture id"));
    ids.sort_unstable();
    ids.dedup();
    assert_eq!(ids.len(), 14);
}

fn assert_canonical_envelope_is_admissible() {
    let fixture = fixture_json(VALID_BYTES);

    validate_control_plane_document(&fixture["envelope"])
        .expect("canonical RED envelope must pass generated schema admission");
}

fn expected_offline_entitlement_red(case_id: &str, expected_verdict: &str) -> ! {
    panic!(
        "EXPECTED_RED[{OFFLINE_ENTITLEMENT_RED_OWNER}][{case_id}]: Rust exact-byte verifier must return {expected_verdict}"
    );
}

macro_rules! offline_entitlement_red_witness {
    ($name:ident, $case_id:literal, $expected_verdict:literal) => {
        #[test]
        fn $name() {
            assert_corpus_integrity();
            assert_canonical_envelope_is_admissible();
            expected_offline_entitlement_red($case_id, $expected_verdict);
        }
    };
}

offline_entitlement_red_witness!(
    canonical_exact_bytes_verify_through_seven_days,
    "canonical exact bytes through issuedAt plus seven days",
    "verified"
);
offline_entitlement_red_witness!(
    one_byte_payload_tamper_requires_online_verification,
    "one-byte payload tamper",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    reserialized_payload_requires_online_verification,
    "whitespace or JSON reserialization changes signed bytes",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    unknown_key_requires_online_verification,
    "unknown signing key",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    wrong_key_requires_online_verification,
    "wrong signing key",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    retired_key_requires_online_verification,
    "retired signing key",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    previous_key_outside_rotation_window_requires_online_verification,
    "previous key outside declared rotation window",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    wrong_account_binding_requires_online_verification,
    "wrong account binding",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    wrong_device_binding_requires_online_verification,
    "wrong device binding",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    wrong_audience_requires_online_verification,
    "wrong audience",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    wrong_schema_version_requires_online_verification,
    "wrong schema version",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    expired_envelope_requires_online_verification,
    "expired seven-day envelope",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    future_issued_at_requires_online_verification,
    "future issuedAt",
    "online-verification-required"
);
offline_entitlement_red_witness!(
    trusted_clock_rollback_requires_online_verification,
    "trusted-clock rollback",
    "online-verification-required"
);
