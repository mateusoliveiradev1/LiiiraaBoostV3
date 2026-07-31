use std::sync::LazyLock;

use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::{
    AdminAuditEvent, ClaimEvidence, ContentRecord, DiagnosticValue, FutureAuthorityCommand,
    HostToRendererShellEvent, NoChangeReceipt, ReleaseArtifactEvidence, ReleaseRecord,
    RendererToHostShellCommand, ScreenshotProvenance, ShellNavigationIntent, WebRouteRecord,
};

pub const DIAGNOSTIC_VALUE_SCHEMA_ID: &str = "desktop.diagnostic-value.v1";
pub const HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID: &str = "desktop.shell.host-to-renderer.v1";
pub const RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID: &str = "desktop.shell.renderer-to-host.v1";
pub const WEB_DOCUMENT_SCHEMA_ID: &str =
    "https://schemas.liiiraa.dev/web/v1/web-document.schema.json";

const MAX_ISSUES: usize = 8;
const MAX_PATH_LENGTH: usize = 256;
const MAX_KEYWORD_LENGTH: usize = 64;

const DIAGNOSTIC_VALUE_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/diagnostic-value.schema.json");
const SHELL_MESSAGE_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/shell-message.schema.json");
const WEB_DOCUMENT_SCHEMA: &str =
    include_str!("../../../contracts/generated/web/v1/web-document.schema.json");

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
static WEB_DOCUMENT_VALIDATOR: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(WEB_DOCUMENT_SCHEMA).expect("generated web document JSON schema");
    jsonschema::validator_for(&schema).expect("valid generated web document JSON schema")
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

#[derive(Clone, Debug)]
pub enum ValidatedWebDocument {
    WebRouteRecord(WebRouteRecord),
    ClaimEvidence(ClaimEvidence),
    ContentRecord(ContentRecord),
    ScreenshotProvenance(ScreenshotProvenance),
    ReleaseArtifactEvidence(ReleaseArtifactEvidence),
    ReleaseRecord(ReleaseRecord),
    FutureAuthorityCommand(FutureAuthorityCommand),
    NoChangeReceipt(NoChangeReceipt),
    AdminAuditEvent(AdminAuditEvent),
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

fn deserialize_web_document(
    input: &Value,
) -> Result<ValidatedWebDocument, ContractValidationError> {
    if let Ok(document) = serde_json::from_value::<WebRouteRecord>(input.clone()) {
        return Ok(ValidatedWebDocument::WebRouteRecord(document));
    }
    if let Ok(document) = serde_json::from_value::<ClaimEvidence>(input.clone()) {
        return Ok(ValidatedWebDocument::ClaimEvidence(document));
    }
    if let Ok(document) = serde_json::from_value::<ContentRecord>(input.clone()) {
        return Ok(ValidatedWebDocument::ContentRecord(document));
    }
    if let Ok(document) = serde_json::from_value::<ScreenshotProvenance>(input.clone()) {
        return Ok(ValidatedWebDocument::ScreenshotProvenance(document));
    }
    if let Ok(document) = serde_json::from_value::<ReleaseArtifactEvidence>(input.clone()) {
        return Ok(ValidatedWebDocument::ReleaseArtifactEvidence(document));
    }
    if let Ok(document) = serde_json::from_value::<ReleaseRecord>(input.clone()) {
        return Ok(ValidatedWebDocument::ReleaseRecord(document));
    }
    if let Ok(document) = serde_json::from_value::<FutureAuthorityCommand>(input.clone()) {
        return Ok(ValidatedWebDocument::FutureAuthorityCommand(document));
    }
    if let Ok(document) = serde_json::from_value::<NoChangeReceipt>(input.clone()) {
        return Ok(ValidatedWebDocument::NoChangeReceipt(document));
    }
    if let Ok(document) = serde_json::from_value::<AdminAuditEvent>(input.clone()) {
        return Ok(ValidatedWebDocument::AdminAuditEvent(document));
    }

    Err(ContractValidationError {
        code: ContractValidationCode::DeserializationFailed,
        schema_id: Some(WEB_DOCUMENT_SCHEMA_ID),
        issues: vec![ContractValidationIssue {
            path: "$".to_owned(),
            keyword: "deserialize".to_owned(),
        }],
        truncated: false,
    })
}

fn is_safe_web_uri(input: &str) -> bool {
    if input.contains('\\') || input.chars().any(char::is_whitespace) {
        return false;
    }

    let Some(remainder) = input.strip_prefix("https://") else {
        return false;
    };
    let authority = remainder
        .split_once(['/', '?', '#'])
        .map_or(remainder, |(authority, _)| authority);

    !authority.is_empty()
        && !authority.contains('@')
        && !authority.starts_with('.')
        && !authority.ends_with('.')
}

fn unsafe_web_document_uri_path(document: &ValidatedWebDocument) -> Option<String> {
    match document {
        ValidatedWebDocument::ClaimEvidence(evidence) if !is_safe_web_uri(&evidence.source) => {
            Some("$/source".to_owned())
        }
        ValidatedWebDocument::ContentRecord(content) => content
            .evidence
            .iter()
            .position(|evidence| !is_safe_web_uri(&evidence.source))
            .map(|index| format!("$/evidence/{index}/source")),
        _ => None,
    }
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

pub fn validate_web_document(
    input: &Value,
) -> Result<ValidatedWebDocument, ContractValidationError> {
    if !WEB_DOCUMENT_VALIDATOR.is_valid(input) {
        return Err(invalid_payload(
            &WEB_DOCUMENT_VALIDATOR,
            WEB_DOCUMENT_SCHEMA_ID,
            input,
        ));
    }

    let document = deserialize_web_document(input)?;
    if let Some(path) = unsafe_web_document_uri_path(&document) {
        return Err(invalid_semantic_payload(
            WEB_DOCUMENT_SCHEMA_ID,
            &path,
            "safeUri",
        ));
    }

    Ok(document)
}

#[cfg(test)]
mod tests {
    use serde_json::{Value, json};

    use super::{ContractValidationCode, WEB_DOCUMENT_SCHEMA_ID, validate_web_document};

    fn fixture_provenance() -> Value {
        json!({
            "kind": "fixture",
            "value": "deterministic-preview",
            "scenarioId": "web-document-validation",
            "fixtureVersion": "1.0"
        })
    }

    fn claim_evidence() -> Value {
        json!({
            "source": "https://liiiraa.dev/docs/performance-methodology",
            "provenance": fixture_provenance(),
            "scope": "Published performance methodology",
            "applicableVersion": "1.0.0",
            "validationState": "validated",
            "unproven": false
        })
    }

    fn route_document() -> Value {
        json!({
            "id": "downloads",
            "surface": "public",
            "shell": "public",
            "pathnameTemplate": "/[locale]/downloads",
            "localePolicy": "required",
            "indexing": "index",
            "owner": "web",
            "scenarioRequirement": "available",
            "securityBoundary": "public-origin",
            "safeContextKeys": ["locale", "version", "channel"]
        })
    }

    fn release_document() -> Value {
        json!({
            "channel": "development",
            "version": "0.1.0",
            "compatibility": ["Windows 10", "Windows 11"],
            "manifest": "development-release-manifest",
            "availability": "unavailable",
            "publicDistributionApproved": false,
            "officialArtifact": "unavailable",
            "artifactEvidence": {
                "publisher": "Liiiraa Boost",
                "sha256": "a".repeat(64),
                "sizeBytes": "1024",
                "signatureState": "verified",
                "origin": "liiiraa-release-origin"
            }
        })
    }

    fn no_change_receipt() -> Value {
        json!({
            "receiptVersion": "1.0",
            "authority": {
                "phase": "Phase 4",
                "surface": "account",
                "command": "request-subscription-change",
                "description": "Phase 4 authority is required for this operation."
            },
            "requestedAction": "subscription-change",
            "reviewedInputs": ["plan", "account"],
            "reviewedAt": "2026-07-31T00:00:00.000Z",
            "provenance": fixture_provenance(),
            "remoteStateChanged": false,
            "nextPhase": "Phase 4",
            "correlationId": "web-receipt-correlation"
        })
    }

    fn valid_web_documents() -> Vec<Value> {
        vec![
            route_document(),
            json!({
                "id": "performance-methodology",
                "routeId": "performance",
                "locale": "pt-BR",
                "version": "1.0.0",
                "channel": "development",
                "owner": "web-content",
                "lastReviewedAt": "2026-07-31T00:00:00.000Z",
                "validationState": "validated",
                "evidence": [claim_evidence()],
                "indexing": "index",
                "staleTreatment": "Mark stale content before it can support a claim."
            }),
            release_document(),
            no_change_receipt(),
            json!({
                "version": "1.0",
                "locale": "en",
                "scenarioId": "downloads-default",
                "viewport": "1440x900",
                "captureCommand": "pnpm evidence:capture",
                "sourceCommit": "abcdef1",
                "checksum": "b".repeat(64),
                "crop": "full viewport",
                "reviewState": "approved"
            }),
            json!({
                "eventId": "audit-preview-0001",
                "actor": "fixture-admin",
                "role": "support-reviewer",
                "action": "review-subscription-change",
                "redactedTarget": "account:[redacted]",
                "reason": "Deterministic admin preview review.",
                "occurredAt": "2026-07-31T00:00:00.000Z",
                "result": "simulated-no-change",
                "correlationId": "web-receipt-correlation",
                "receipt": no_change_receipt()
            }),
        ]
    }

    fn invalid_web_documents() -> Vec<Value> {
        let mut missing_approval = release_document();
        missing_approval
            .as_object_mut()
            .expect("release object")
            .remove("publicDistributionApproved");

        vec![
            {
                let mut input = route_document();
                input
                    .as_object_mut()
                    .expect("route object")
                    .insert("unexpected".to_owned(), json!("SENSITIVE_UNKNOWN_VALUE"));
                input
            },
            {
                let mut input = route_document();
                input["surface"] = json!("marketing");
                input
            },
            missing_approval,
            json!({
                "publisher": "Liiiraa Boost",
                "sizeBytes": "1024",
                "signatureState": "verified",
                "origin": "liiiraa-release-origin"
            }),
            {
                let mut input = no_change_receipt();
                input["remoteStateChanged"] = json!(true);
                input
            },
            {
                let mut input = claim_evidence();
                input["source"] = json!("javascript:SENSITIVE_URL_VALUE");
                input
            },
            {
                let mut input = route_document();
                input["id"] = json!(format!("SENSITIVE_{}", "x".repeat(129)));
                input
            },
            {
                let mut input = claim_evidence();
                input["provenance"]["kind"] = json!("measured");
                input
            },
        ]
    }

    #[test]
    fn web_document_accepts_the_closed_valid_matrix() {
        for input in valid_web_documents() {
            validate_web_document(&input).expect("valid generated web document");
        }
    }

    #[test]
    fn web_document_rejects_the_closed_invalid_matrix() {
        for input in invalid_web_documents() {
            assert!(validate_web_document(&input).is_err());
        }
    }

    #[test]
    fn web_document_errors_are_stable_bounded_and_redacted() {
        let secret = "SENSITIVE_WEB_DOCUMENT_VALUE_MUST_NOT_LEAK";
        let mut input = route_document();
        input["id"] = json!(secret);
        input
            .as_object_mut()
            .expect("route object")
            .insert("unexpected".to_owned(), json!(secret));

        let first = validate_web_document(&input).expect_err("invalid document");
        let second = validate_web_document(&input).expect_err("invalid document");

        assert_eq!(first, second);
        assert_eq!(first.code, ContractValidationCode::PayloadInvalid);
        assert_eq!(first.schema_id, Some(WEB_DOCUMENT_SCHEMA_ID));
        assert!(!first.issues.is_empty());
        assert!(first.issues.len() <= 8);
        assert!(first.issues.iter().all(|issue| {
            issue.path.starts_with('$') && issue.path.len() <= 256 && issue.keyword.len() <= 64
        }));
        assert!(!format!("{first:?}").contains(secret));
    }
}
