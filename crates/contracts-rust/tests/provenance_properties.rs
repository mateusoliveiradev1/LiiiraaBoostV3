use liiiraa_contracts_rust::{
    DIAGNOSTIC_VALUE_SCHEMA_ID, validate_diagnostic_value,
};
use proptest::prelude::*;
use serde_json::{Value, json};

fn valid_diagnostic_value() -> impl Strategy<Value = Value> {
    prop_oneof![
        "[A-Z0-9_]{1,32}".prop_map(|value| json!({
            "kind": "fixture",
            "value": value,
            "scenarioId": "synthetic-scenario",
            "fixtureVersion": "synthetic-v1",
        })),
        (0.0_f64..=1.0_f64).prop_map(|confidence| json!({
            "kind": "modeled",
            "value": "SYNTHETIC_MODELED_VALUE",
            "modelId": "synthetic-model",
            "confidence": confidence,
            "assumptions": ["SYNTHETIC assumption"],
        })),
        Just(json!({
            "kind": "unavailable",
            "reason": "SYNTHETIC reason",
        })),
    ]
}

fn illegal_cross_kind_value() -> impl Strategy<Value = Value> {
    prop_oneof![
        "[A-Z0-9_]{1,32}".prop_map(|method| json!({
            "kind": "observed",
            "value": "SYNTHETIC_OBSERVED_VALUE",
            "source": "SYNTHETIC source",
            "observedAt": "2000-01-01T00:00:00.000Z",
            "method": method,
            "measuredAt": "2000-01-01T00:00:00.000Z",
            "quality": "valid",
        })),
        any::<i32>().prop_map(|value| json!({
            "kind": "unavailable",
            "reason": "SYNTHETIC reason",
            "value": value,
        })),
        (1.000_001_f64..1000.0_f64).prop_map(|confidence| json!({
            "kind": "modeled",
            "value": "SYNTHETIC_MODELED_VALUE",
            "modelId": "synthetic-model",
            "confidence": confidence,
            "assumptions": ["SYNTHETIC assumption"],
        })),
    ]
}

proptest! {
    #[test]
    fn illegal_provenance_combinations_fail_closed(payload in illegal_cross_kind_value()) {
        prop_assert!(
            validate_diagnostic_value(DIAGNOSTIC_VALUE_SCHEMA_ID, &payload).is_err()
        );
    }

    #[test]
    fn valid_transports_round_trip_through_the_public_validator(payload in valid_diagnostic_value()) {
        let transport = validate_diagnostic_value(DIAGNOSTIC_VALUE_SCHEMA_ID, &payload)
            .expect("generated valid transport validates");
        let serialized = serde_json::to_value(transport).expect("transport serializes");
        let reparsed = validate_diagnostic_value(DIAGNOSTIC_VALUE_SCHEMA_ID, &serialized)
            .expect("serialized transport validates again");

        prop_assert_eq!(
            serde_json::to_value(reparsed).expect("reparsed transport serializes"),
            payload
        );
    }
}
