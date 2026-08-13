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
    document: Option<Value>,
    #[serde(rename = "baseId")]
    base_id: Option<String>,
    mutation: Option<CorpusMutation>,
}

#[derive(Debug, Deserialize)]
struct CorpusMutation {
    op: String,
    path: String,
    value: Option<Value>,
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

fn decode_pointer_segment(segment: &str) -> String {
    segment.replace("~1", "/").replace("~0", "~")
}

fn materialize_case(case: &CorpusCase, valid_cases: &[CorpusCase]) -> Value {
    if let Some(document) = &case.document {
        return document.clone();
    }

    let base_id = case
        .base_id
        .as_deref()
        .expect("mutated corpus case has a baseId");
    let mutation = case
        .mutation
        .as_ref()
        .expect("mutated corpus case has a mutation");
    let mut document = valid_cases
        .iter()
        .find(|candidate| candidate.id == base_id)
        .and_then(|candidate| candidate.document.clone())
        .expect("mutated corpus base exists");
    let mut segments = mutation
        .path
        .strip_prefix('/')
        .expect("mutation path is a JSON pointer")
        .split('/')
        .map(decode_pointer_segment)
        .collect::<Vec<_>>();
    let leaf = segments.pop().expect("mutation path has a leaf");
    let parent_pointer = if segments.is_empty() {
        String::new()
    } else {
        format!("/{}", segments.join("/"))
    };
    let parent = document
        .pointer_mut(&parent_pointer)
        .expect("mutation parent exists");

    match (mutation.op.as_str(), parent) {
        ("append", Value::Object(object)) => object
            .get_mut(&leaf)
            .and_then(Value::as_array_mut)
            .expect("append target is an array")
            .push(mutation.value.clone().unwrap_or(Value::Null)),
        ("append", Value::Array(array)) => array
            .get_mut(leaf.parse::<usize>().expect("array index is numeric"))
            .and_then(Value::as_array_mut)
            .expect("append target is an array")
            .push(mutation.value.clone().unwrap_or(Value::Null)),
        ("set", Value::Object(object)) => {
            object.insert(leaf, mutation.value.clone().unwrap_or(Value::Null));
        }
        ("set", Value::Array(array)) => {
            array[leaf.parse::<usize>().expect("array index is numeric")] =
                mutation.value.clone().unwrap_or(Value::Null);
        }
        ("remove", Value::Object(object)) => {
            object.remove(&leaf).expect("removed property exists");
        }
        ("remove", Value::Array(array)) => {
            array.remove(leaf.parse::<usize>().expect("array index is numeric"));
        }
        (operation, _) => panic!("unsupported corpus mutation operation: {operation}"),
    }

    document
}

#[test]
fn rust_runtime_matches_the_typescript_transactional_corpus() {
    let valid_cases = read_fixture("valid.json").cases;
    for case in &valid_cases {
        let document = materialize_case(case, &valid_cases);
        let result = validate_transactional_recovery_document(&document);
        assert!(
            result.is_ok(),
            "valid case rejected: {}: {result:?}",
            case.id
        );
        assert_eq!(
            serde_json::to_value(result.expect("valid transport serializes"))
                .expect("generated transport serializes"),
            document,
            "validated transport changed {}",
            case.id,
        );
    }

    for case in read_fixture("invalid.json").cases {
        let document = materialize_case(&case, &valid_cases);
        let result = validate_transactional_recovery_document(&document);
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
        "installed driver role",
        "portable artifact missing tauri driver",
        "raw identity in friends roster",
        "friends config roster path override",
        "continuation skips observation",
    ] {
        assert!(ids.iter().any(|id| id == required), "missing {required}");
    }
}
