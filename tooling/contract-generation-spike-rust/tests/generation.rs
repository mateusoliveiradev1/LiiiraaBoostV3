use serde_json::{Value, json};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
    sync::atomic::{AtomicU64, Ordering},
};

const GENERATOR: &str = env!("CARGO_BIN_EXE_contract-generation-spike-rust");
const SHARED_SCHEMA: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../contract-generation-spike/generated/spike.schema.json"
);
const VALID_VECTORS: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../contract-generation-spike/fixtures/valid.json"
);
const INVALID_VECTORS: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../contract-generation-spike/fixtures/invalid.json"
);
static TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn run_generator(schema: &Path) -> Output {
    Command::new(GENERATOR)
        .args(["--schema", schema.to_str().expect("schema path is UTF-8")])
        .output()
        .expect("generator process starts")
}

fn generated_source() -> String {
    let first = run_generator(Path::new(SHARED_SCHEMA));
    assert!(
        first.status.success(),
        "generator failed: {}",
        String::from_utf8_lossy(&first.stderr)
    );
    let second = run_generator(Path::new(SHARED_SCHEMA));
    assert!(
        second.status.success(),
        "second generator run failed: {}",
        String::from_utf8_lossy(&second.stderr)
    );
    assert_eq!(
        first.stdout, second.stdout,
        "Rust output must be byte-stable"
    );

    let source = String::from_utf8(first.stdout).expect("generated Rust is UTF-8");
    assert!(source.contains("pub struct SpikeEnvelope"));
    source
}

fn temporary_directory(label: &str) -> PathBuf {
    let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!(
        "liiiraa-contract-spike-{}-{label}-{sequence}",
        std::process::id()
    ))
}

#[test]
fn typify_emits_deterministic_rust_from_the_shared_schema() {
    let source = generated_source();
    assert!(
        source.ends_with('\n'),
        "rustfmt output must end with newline"
    );
}

#[test]
fn rust_runtime_validation_matches_the_shared_vector_matrix() {
    let mut schema: Value =
        serde_json::from_str(&fs::read_to_string(SHARED_SCHEMA).expect("shared schema read"))
            .expect("shared schema parses");
    schema
        .as_object_mut()
        .expect("shared schema is an object")
        .insert(
            "$ref".to_owned(),
            Value::String("SpikeEnvelope.json".to_owned()),
        );
    let validator = jsonschema::validator_for(&schema).expect("shared schema compiles");

    let valid: Value =
        serde_json::from_str(&fs::read_to_string(VALID_VECTORS).expect("valid vectors read"))
            .expect("valid vectors parse");
    for case in valid["cases"].as_array().expect("valid cases are an array") {
        assert!(
            validator.is_valid(&case["value"]),
            "valid case was rejected: {}",
            case["name"]
        );
    }

    let invalid: Value =
        serde_json::from_str(&fs::read_to_string(INVALID_VECTORS).expect("invalid vectors read"))
            .expect("invalid vectors parse");
    for case in invalid["cases"]
        .as_array()
        .expect("invalid cases are an array")
    {
        assert!(
            !validator.is_valid(&case["value"]),
            "invalid case was accepted: {}",
            case["name"]
        );
    }
}

#[test]
fn generated_rust_compiles_and_preserves_discriminators() {
    let source = generated_source();
    let project = temporary_directory("compile");
    let source_directory = project.join("src");
    fs::create_dir_all(&source_directory).expect("temporary source directory created");

    fs::write(
        project.join("Cargo.toml"),
        r#"[package]
name = "generated-contract-proof"
version = "0.0.0"
edition = "2024"
publish = false

[dependencies]
serde = { version = "=1.0.229", features = ["derive"] }
serde_json = "=1.0.151"
"#,
    )
    .expect("temporary Cargo manifest written");

    let proof = r#"
fn main() {
    let valid = serde_json::json!({
        "version": "1",
        "kind": "spike",
        "metadata": {
            "correlationId": "corr-ai",
            "createdAt": "2026-07-27T02:00:04Z",
            "provenance": {"kind": "ai", "modelId": "advisory-model"}
        },
        "payload": {"confidence": 100, "samples": [9, 8, 7]}
    });

    let decoded: SpikeEnvelope =
        serde_json::from_value(valid.clone()).expect("valid envelope deserializes");
    let encoded = serde_json::to_value(decoded).expect("envelope serializes");
    assert_eq!(encoded["version"], "1");
    assert_eq!(encoded["kind"], "spike");
    assert_eq!(encoded["metadata"]["provenance"]["kind"], "ai");

    let mut wrong_version = valid.clone();
    wrong_version["version"] = serde_json::json!("2");
    assert!(serde_json::from_value::<SpikeEnvelope>(wrong_version).is_err());

    let mut wrong_provenance = valid;
    wrong_provenance["metadata"]["provenance"]["kind"] = serde_json::json!("remote");
    assert!(serde_json::from_value::<SpikeEnvelope>(wrong_provenance).is_err());
}
"#;
    fs::write(
        source_directory.join("main.rs"),
        format!("{source}\n{proof}"),
    )
    .expect("temporary Rust proof written");

    let output = Command::new("cargo")
        .args([
            "run",
            "--quiet",
            "--offline",
            "--manifest-path",
            project
                .join("Cargo.toml")
                .to_str()
                .expect("manifest path is UTF-8"),
        ])
        .output()
        .expect("Cargo proof starts");

    if let Err(error) = fs::remove_dir_all(&project) {
        eprintln!(
            "warning: could not remove temporary proof {}: {error}",
            project.display()
        );
    }

    assert!(
        output.status.success(),
        "generated Rust failed to compile or run:\n{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

#[test]
fn unsupported_schema_constructs_fail_closed() {
    let project = temporary_directory("unsupported");
    fs::create_dir_all(&project).expect("temporary directory created");
    let schema_path = project.join("unsupported.schema.json");
    let mut schema: Value =
        serde_json::from_str(&fs::read_to_string(SHARED_SCHEMA).expect("shared schema read"))
            .expect("shared schema parses");
    schema
        .as_object_mut()
        .expect("schema is an object")
        .insert("anyOf".to_owned(), json!([]));
    fs::write(
        &schema_path,
        serde_json::to_string_pretty(&schema).expect("schema serializes"),
    )
    .expect("unsupported schema written");

    let output = run_generator(&schema_path);
    if let Err(error) = fs::remove_dir_all(&project) {
        eprintln!(
            "warning: could not remove temporary schema {}: {error}",
            project.display()
        );
    }

    assert!(!output.status.success());
    assert!(
        String::from_utf8_lossy(&output.stderr).contains("unsupported JSON Schema keyword 'anyOf'"),
        "unexpected failure: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}
