use std::sync::LazyLock;

use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::{
    DiagnosticValue, HostToRendererShellEvent, RendererToHostShellCommand, ShellNavigationIntent,
};

pub const DIAGNOSTIC_VALUE_SCHEMA_ID: &str = "desktop.diagnostic-value.v1";
pub const HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID: &str = "desktop.shell.host-to-renderer.v1";
pub const RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID: &str = "desktop.shell.renderer-to-host.v1";

const MAX_ISSUES: usize = 8;
const MAX_PATH_LENGTH: usize = 256;
const MAX_KEYWORD_LENGTH: usize = 64;

const DIAGNOSTIC_VALUE_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/diagnostic-value.schema.json");
const SHELL_MESSAGE_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/shell-message.schema.json");

static DIAGNOSTIC_VALUE_VALIDATOR: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(DIAGNOSTIC_VALUE_SCHEMA).expect("generated diagnostic JSON schema");
    jsonschema::validator_for(&schema).expect("valid generated diagnostic JSON schema")
});

static SHELL_MESSAGE_VALIDATOR: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(SHELL_MESSAGE_SCHEMA).expect("generated shell JSON schema");
    jsonschema::validator_for(&schema).expect("valid generated shell JSON schema")
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

fn unsupported_schema() -> ContractValidationError {
    ContractValidationError {
        code: ContractValidationCode::SchemaUnsupported,
        schema_id: None,
        issues: vec![ContractValidationIssue {
            path: "$".to_owned(),
            keyword: "schema".to_owned(),
        }],
        truncated: false,
    }
}

fn invalid_payload(
    validator: &jsonschema::Validator,
    schema_id: &'static str,
    input: &Value,
) -> ContractValidationError {
    let mut issues = validator
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
            .then(left.keyword.cmp(&right.keyword))
    });
    issues.dedup();
    let truncated = issues.len() > MAX_ISSUES;
    issues.truncate(MAX_ISSUES);

    ContractValidationError {
        code: ContractValidationCode::PayloadInvalid,
        schema_id: Some(schema_id),
        issues,
        truncated,
    }
}

fn invalid_semantic_payload(
    schema_id: &'static str,
    path: &str,
    keyword: &str,
) -> ContractValidationError {
    ContractValidationError {
        code: ContractValidationCode::PayloadInvalid,
        schema_id: Some(schema_id),
        issues: vec![ContractValidationIssue {
            path: bounded(path, MAX_PATH_LENGTH),
            keyword: bounded(keyword, MAX_KEYWORD_LENGTH),
        }],
        truncated: false,
    }
}

fn validate_and_deserialize<T: DeserializeOwned>(
    schema_id: &str,
    expected_schema_id: &'static str,
    input: &Value,
    validator: &jsonschema::Validator,
) -> Result<T, ContractValidationError> {
    if schema_id != expected_schema_id {
        return Err(unsupported_schema());
    }

    if !validator.is_valid(input) {
        return Err(invalid_payload(validator, expected_schema_id, input));
    }

    serde_json::from_value(input.clone()).map_err(|_| ContractValidationError {
        code: ContractValidationCode::DeserializationFailed,
        schema_id: Some(expected_schema_id),
        issues: vec![ContractValidationIssue {
            path: "$".to_owned(),
            keyword: "deserialize".to_owned(),
        }],
        truncated: false,
    })
}

fn is_safe_navigation_intent(intent: &ShellNavigationIntent) -> bool {
    let ShellNavigationIntent::DocumentationNavigationIntent(documentation) = intent else {
        return true;
    };

    let document_id = documentation.document_id.as_str();
    !document_id.contains("..")
        && !document_id.contains('\\')
        && !document_id.contains("://")
        && !document_id.starts_with('/')
}

fn host_event_has_safe_navigation(event: &HostToRendererShellEvent) -> bool {
    match event {
        HostToRendererShellEvent::NavigationRequestedEvent(event) => {
            is_safe_navigation_intent(&event.payload.intent)
        }
        _ => true,
    }
}

fn renderer_command_has_safe_navigation(command: &RendererToHostShellCommand) -> bool {
    match command {
        RendererToHostShellCommand::NavigateCommand(command) => {
            is_safe_navigation_intent(&command.payload.intent)
        }
        RendererToHostShellCommand::ShowNotificationCommand(command) => {
            is_safe_navigation_intent(&command.payload.action)
        }
        _ => true,
    }
}

pub fn validate_diagnostic_value(
    schema_id: &str,
    input: &Value,
) -> Result<DiagnosticValue, ContractValidationError> {
    validate_and_deserialize(
        schema_id,
        DIAGNOSTIC_VALUE_SCHEMA_ID,
        input,
        &DIAGNOSTIC_VALUE_VALIDATOR,
    )
}

pub fn validate_host_to_renderer_shell_event(
    schema_id: &str,
    input: &Value,
) -> Result<HostToRendererShellEvent, ContractValidationError> {
    let event = validate_and_deserialize(
        schema_id,
        HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
        input,
        &SHELL_MESSAGE_VALIDATOR,
    )?;

    if !host_event_has_safe_navigation(&event) {
        return Err(invalid_semantic_payload(
            HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
            "$/payload/intent/documentId",
            "safeNavigation",
        ));
    }

    Ok(event)
}

pub fn validate_renderer_to_host_shell_command(
    schema_id: &str,
    input: &Value,
) -> Result<RendererToHostShellCommand, ContractValidationError> {
    let command = validate_and_deserialize(
        schema_id,
        RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
        input,
        &SHELL_MESSAGE_VALIDATOR,
    )?;

    if !renderer_command_has_safe_navigation(&command) {
        return Err(invalid_semantic_payload(
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            "$/payload",
            "safeNavigation",
        ));
    }

    Ok(command)
}
