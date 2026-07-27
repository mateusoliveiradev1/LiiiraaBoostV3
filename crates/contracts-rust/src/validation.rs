use std::sync::LazyLock;

use serde_json::Value;

use crate::DiagnosticValue;

pub const DIAGNOSTIC_VALUE_SCHEMA_ID: &str = "desktop.diagnostic-value.v1";

const MAX_ISSUES: usize = 8;
const MAX_PATH_LENGTH: usize = 256;
const MAX_KEYWORD_LENGTH: usize = 64;
const DIAGNOSTIC_VALUE_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/diagnostic-value.schema.json");

static DIAGNOSTIC_VALUE_VALIDATOR: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(DIAGNOSTIC_VALUE_SCHEMA).expect("generated diagnostic schema is JSON");
    jsonschema::validator_for(&schema).expect("generated diagnostic schema compiles")
});

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ContractValidationCode {
    SchemaUnsupported,
    PayloadInvalid,
    DeserializationFailed,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractValidationIssue {
    pub path: String,
    pub keyword: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ContractValidationError {
    pub code: ContractValidationCode,
    pub schema_id: Option<&'static str>,
    pub issues: Vec<ContractValidationIssue>,
    pub truncated: bool,
}

fn bounded(value: &str, maximum: usize) -> String {
    value.chars().take(maximum).collect()
}

fn invalid_payload(input: &Value) -> ContractValidationError {
    let mut issues = DIAGNOSTIC_VALUE_VALIDATOR
        .iter_errors(input)
        .map(|error| ContractValidationIssue {
            path: if error.instance_path().as_str().is_empty() {
                "$".to_owned()
            } else {
                bounded(
                    &format!("${}", error.instance_path().as_str()),
                    MAX_PATH_LENGTH,
                )
            },
            keyword: bounded(error.kind().keyword(), MAX_KEYWORD_LENGTH),
        })
        .collect::<Vec<_>>();

    issues.sort_by(|left, right| {
        left.path
            .cmp(&right.path)
            .then_with(|| left.keyword.cmp(&right.keyword))
    });
    issues.dedup();
    let truncated = issues.len() > MAX_ISSUES;
    issues.truncate(MAX_ISSUES);

    ContractValidationError {
        code: ContractValidationCode::PayloadInvalid,
        schema_id: Some(DIAGNOSTIC_VALUE_SCHEMA_ID),
        issues,
        truncated,
    }
}

pub fn validate_diagnostic_value(
    schema_id: &str,
    input: &Value,
) -> Result<DiagnosticValue, ContractValidationError> {
    if schema_id != DIAGNOSTIC_VALUE_SCHEMA_ID {
        return Err(ContractValidationError {
            code: ContractValidationCode::SchemaUnsupported,
            schema_id: None,
            issues: vec![ContractValidationIssue {
                path: "$".to_owned(),
                keyword: "schema".to_owned(),
            }],
            truncated: false,
        });
    }

    if !DIAGNOSTIC_VALUE_VALIDATOR.is_valid(input) {
        return Err(invalid_payload(input));
    }

    serde_json::from_value(input.clone()).map_err(|_| ContractValidationError {
        code: ContractValidationCode::DeserializationFailed,
        schema_id: Some(DIAGNOSTIC_VALUE_SCHEMA_ID),
        issues: vec![ContractValidationIssue {
            path: "$".to_owned(),
            keyword: "deserialize".to_owned(),
        }],
        truncated: false,
    })
}
