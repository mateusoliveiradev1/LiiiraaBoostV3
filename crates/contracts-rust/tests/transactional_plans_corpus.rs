use std::{fs, path::PathBuf};

use liiiraa_contracts_rust::validate_transactional_recovery_document;
use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
struct Corpus {
    cases: Vec<CorpusCase>,
}

#[derive(Debug, Deserialize)]
struct CorpusCase {
    id: String,
    document: Value,
}

fn fixture_path(name: &str) -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../packages/contracts-ts/src/fixtures/transactional-plans")
        .join(name)
}

fn read_fixture(name: &str) -> Corpus {
    let contents = fs::read_to_string(fixture_path(name)).expect("transaction corpus is readable");
    serde_json::from_str(&contents).expect("transaction corpus is valid JSON")
}

#[test]
fn rust_runtime_matches_the_typescript_transactional_corpus() {
    for case in read_fixture("valid.json").cases {
        let result = validate_transactional_recovery_document(&case.document);
        assert!(result.is_ok(), "valid case rejected: {}: {result:?}", case.id);
        assert_eq!(
            serde_json::to_value(result.expect("valid transport serializes"))
                .expect("generated transport serializes"),
            case.document,
            "validated transport changed {}",
            case.id,
        );
    }

    for case in read_fixture("invalid.json").cases {
        let result = validate_transactional_recovery_document(&case.document);
        assert!(result.is_err(), "invalid case admitted: {}", case.id);
    }
}

#[test]
fn invalid_authority_and_disclosure_cases_are_present() {
    let ids = read_fixture("invalid.json")
        .cases
        .into_iter()
        .map(|case| case.id)
        .collect::<Vec<_>>();

    for required in [
        "generic command authority",
        "PowerShell authority",
        "remote rollback authority",
        "executable Extremo",
        "raw secret in diagnostic",
        "raw hardware identifier in diagnostic",
        "invalid promotion skip",
        "incomplete receipt",
    ] {
        assert!(ids.iter().any(|id| id == required), "missing {required}");
    }
}
