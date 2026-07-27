use std::{fs, path::PathBuf};

use liiiraa_contracts_rust::{
    DIAGNOSTIC_VALUE_SCHEMA_ID, validate_diagnostic_value,
};
use serde::Deserialize;
use serde_json::{Value, json};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Corpus {
    vectors: Vec<CorpusVector>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CorpusVector {
    id: String,
    schema: String,
    payload: Value,
    expected_verdict: String,
}

fn corpus_path(relative: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../contracts/corpus")
        .join(relative)
}

fn read_corpus(relative: &str) -> Corpus {
    let contents = fs::read_to_string(corpus_path(relative)).expect("shared corpus is readable");
    serde_json::from_str(&contents).expect("shared corpus is valid JSON")
}

#[test]
fn public_validator_matches_every_shared_corpus_verdict() {
    for relative in [
        "valid/provenance-vectors.json",
        "invalid/rejection-vectors.json",
    ] {
        for vector in read_corpus(relative).vectors {
            let result = validate_diagnostic_value(&vector.schema, &vector.payload);
            assert_eq!(
                result.is_ok(),
                vector.expected_verdict == "valid",
                "corpus verdict drifted for {}",
                vector.id
            );

            if let Ok(transport) = result {
                assert_eq!(
                    serde_json::to_value(transport).expect("transport serializes"),
                    vector.payload,
                    "validated transport changed {}",
                    vector.id
                );
            }
        }
    }
}

#[test]
fn public_validator_redacts_payload_values_and_bounds_issues() {
    let secret = "SENSITIVE_PAYLOAD_VALUE_MUST_NOT_LEAK";
    let error = validate_diagnostic_value(
        DIAGNOSTIC_VALUE_SCHEMA_ID,
        &json!({
            "kind": "unavailable",
            "reason": "SYNTHETIC reason",
            "unexpected": secret,
        }),
    )
    .expect_err("extra fields fail closed");

    assert!(!format!("{error:?}").contains(secret));
    assert!(!error.issues.is_empty());
    assert!(error.issues.len() <= 8);
    assert!(
        error
            .issues
            .iter()
            .all(|issue| issue.path.len() <= 256 && issue.keyword.len() <= 64)
    );
}
