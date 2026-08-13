use std::sync::LazyLock;

use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::{
    AdminAuditEvent, ClaimEvidence, ContentRecord, ControlPlaneDocument, DiagnosticValue,
    FutureAuthorityCommand, HardwareEvidenceDocument, HostToRendererShellEvent, NoChangeReceipt,
    ReleaseArtifactEvidence, ReleaseRecord, RendererToHostShellCommand, ScreenshotProvenance,
    ShellNavigationIntent, TransactionalRecoveryDocument, WebRouteRecord,
};

pub const CONTROL_PLANE_DOCUMENT_SCHEMA_ID: &str =
    "https://schemas.liiiraa.dev/control-plane/v1/control-plane-document.schema.json";
pub const DIAGNOSTIC_VALUE_SCHEMA_ID: &str = "desktop.diagnostic-value.v1";
pub const HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID: &str = "desktop.shell.host-to-renderer.v1";
pub const HARDWARE_EVIDENCE_DOCUMENT_SCHEMA_ID: &str =
    "https://schemas.liiiraa.dev/desktop/v1/hardware-evidence.schema.json";
pub const TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA_ID: &str =
    "https://schemas.liiiraa.dev/desktop/v1/transactional-recovery.schema.json";
pub const RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID: &str = "desktop.shell.renderer-to-host.v1";
pub const WEB_DOCUMENT_SCHEMA_ID: &str =
    "https://schemas.liiiraa.dev/web/v1/web-document.schema.json";

const MAX_ISSUES: usize = 8;
const MAX_PATH_LENGTH: usize = 256;
const MAX_KEYWORD_LENGTH: usize = 64;

const DIAGNOSTIC_VALUE_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/diagnostic-value.schema.json");
const HARDWARE_EVIDENCE_DOCUMENT_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/hardware-evidence.schema.json");
const TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/transactional-recovery.schema.json");
const CONTROL_PLANE_DOCUMENT_SCHEMA: &str = include_str!(
    "../../../contracts/generated/control-plane/v1/control-plane-document.schema.json"
);
const SHELL_MESSAGE_SCHEMA: &str =
    include_str!("../../../contracts/generated/desktop/v1/shell-message.schema.json");
const WEB_DOCUMENT_SCHEMA: &str =
    include_str!("../../../contracts/generated/web/v1/web-document.schema.json");

static DIAGNOSTIC_VALUE_VALIDATOR: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value =
        serde_json::from_str(DIAGNOSTIC_VALUE_SCHEMA).expect("generated diagnostic JSON schema");
    jsonschema::validator_for(&schema).expect("valid generated diagnostic JSON schema")
});
static HARDWARE_EVIDENCE_DOCUMENT_VALIDATOR: LazyLock<jsonschema::Validator> =
    LazyLock::new(|| {
        let schema: Value = serde_json::from_str(HARDWARE_EVIDENCE_DOCUMENT_SCHEMA)
            .expect("generated hardware evidence JSON schema");
        jsonschema::validator_for(&schema).expect("valid generated hardware evidence JSON schema")
    });
static TRANSACTIONAL_RECOVERY_DOCUMENT_VALIDATOR: LazyLock<jsonschema::Validator> =
    LazyLock::new(|| {
        let schema: Value = serde_json::from_str(TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA)
            .expect("generated transactional recovery JSON schema");
        jsonschema::validator_for(&schema)
            .expect("valid generated transactional recovery JSON schema")
    });
static CONTROL_PLANE_DOCUMENT_VALIDATOR: LazyLock<jsonschema::Validator> = LazyLock::new(|| {
    let schema: Value = serde_json::from_str(CONTROL_PLANE_DOCUMENT_SCHEMA)
        .expect("generated control-plane JSON schema");
    jsonschema::validator_for(&schema).expect("valid generated control-plane JSON schema")
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

fn deserialization_error(schema_id: &'static str) -> ContractValidationError {
    ContractValidationError {
        code: ContractValidationCode::DeserializationFailed,
        schema_id: Some(schema_id),
        issues: vec![ContractValidationIssue {
            path: "$".to_owned(),
            keyword: "deserialize".to_owned(),
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

    serde_json::from_value(input.clone()).map_err(|_| deserialization_error(expected_schema_id))
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

    Err(deserialization_error(WEB_DOCUMENT_SCHEMA_ID))
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

pub fn validate_hardware_evidence_document(
    input: &Value,
) -> Result<HardwareEvidenceDocument, ContractValidationError> {
    validate_and_deserialize(
        HARDWARE_EVIDENCE_DOCUMENT_SCHEMA_ID,
        HARDWARE_EVIDENCE_DOCUMENT_SCHEMA_ID,
        input,
        &HARDWARE_EVIDENCE_DOCUMENT_VALIDATOR,
    )
}

pub fn validate_transactional_recovery_document(
    input: &Value,
) -> Result<TransactionalRecoveryDocument, ContractValidationError> {
    let document = validate_and_deserialize(
        TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA_ID,
        TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA_ID,
        input,
        &TRANSACTIONAL_RECOVERY_DOCUMENT_VALIDATOR,
    )?;

    if input.get("kind").and_then(Value::as_str) == Some("progress-event") {
        let sequence = input.get("sequence").and_then(Value::as_u64);
        let previous_sequence = input.get("previousSequence").and_then(Value::as_u64);
        let contiguous = match sequence {
            Some(0) => previous_sequence.is_none(),
            Some(sequence) => previous_sequence == Some(sequence - 1),
            None => false,
        };

        if !contiguous {
            return Err(invalid_semantic_payload(
                TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA_ID,
                "$/sequence",
                "contiguousSequence",
            ));
        }
    }

    if input.get("kind").and_then(Value::as_str) == Some("friends-roster") {
        let participants = input
            .get("participants")
            .and_then(Value::as_array)
            .ok_or_else(|| {
                invalid_semantic_payload(
                    TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA_ID,
                    "$/participants",
                    "uniqueRosterBindings",
                )
            })?;
        let mut participant_ids = std::collections::BTreeSet::new();
        let mut machine_slots = std::collections::BTreeSet::new();
        for (index, participant) in participants.iter().enumerate() {
            let participant_id = participant.get("participantId").and_then(Value::as_str);
            let machine_slot = participant.get("machineSlot").and_then(Value::as_str);
            if participant_id.is_none()
                || machine_slot.is_none()
                || !participant_ids.insert(participant_id.expect("checked participant id"))
                || !machine_slots.insert(machine_slot.expect("checked machine slot"))
            {
                return Err(invalid_semantic_payload(
                    TRANSACTIONAL_RECOVERY_DOCUMENT_SCHEMA_ID,
                    &format!("$/participants/{index}"),
                    "uniqueRosterBindings",
                ));
            }
        }
    }

    Ok(document)
}

pub fn validate_control_plane_document(
    input: &Value,
) -> Result<ControlPlaneDocument, ContractValidationError> {
    validate_and_deserialize(
        CONTROL_PLANE_DOCUMENT_SCHEMA_ID,
        CONTROL_PLANE_DOCUMENT_SCHEMA_ID,
        input,
        &CONTROL_PLANE_DOCUMENT_VALIDATOR,
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

    use super::{
        ContractValidationCode, WEB_DOCUMENT_SCHEMA_ID, validate_control_plane_document,
        validate_web_document,
    };

    fn account_projection() -> Value {
        json!({
            "schemaVersion": "1.0",
            "kind": "account-projection",
            "aggregateVersion": "7",
            "etag": "account-etag-7",
            "correlationId": "control-plane-correlation",
            "provenance": "postgres-authority",
            "accountId": "account-0001",
            "state": "active",
            "displayName": "Synthetic account",
            "emailRedacted": "s***@example.invalid",
            "locale": "pt-BR",
            "createdAt": "2026-08-04T00:00:00Z",
            "updatedAt": "2026-08-04T00:00:00Z"
        })
    }

    fn account_command() -> Value {
        json!({
            "schemaVersion": "1.0",
            "kind": "account-command",
            "commandId": "command-0001",
            "accountId": "account-0001",
            "action": "update-profile",
            "expectedVersion": "7",
            "correlationId": "control-plane-correlation",
            "requestedAt": "2026-08-04T00:00:00Z"
        })
    }

    fn diagnostic_consent() -> Value {
        json!({
            "schemaVersion": "1.0",
            "kind": "diagnostic-consent",
            "aggregateVersion": "2",
            "etag": "consent-etag-2",
            "correlationId": "control-plane-correlation",
            "provenance": "postgres-authority",
            "consentId": "consent-0001",
            "accountId": "account-0001",
            "state": "active",
            "scopes": ["support-diagnostics"],
            "purpose": "Synthetic support diagnosis",
            "grantedAt": "2026-08-04T00:00:00Z",
            "expiresAt": "2026-08-04T01:00:00Z"
        })
    }

    fn offline_entitlement() -> Value {
        json!({
            "schemaVersion": "1.0",
            "kind": "offline-entitlement-envelope",
            "payloadBytes": "c3ludGhldGljLW9wYXF1ZS1ieXRlcw==",
            "signature": "a".repeat(64),
            "algorithm": "Ed25519",
            "keyId": "development-key-0001",
            "audience": "liiiraa-desktop",
            "deviceBinding": "synthetic-device-binding",
            "issuedAt": "2026-08-04T00:00:00Z",
            "expiresAt": "2026-08-11T00:00:00Z",
            "validitySeconds": 604800
        })
    }

    fn admin_document(kind: &str, fields: Value) -> Value {
        let mut document = json!({
            "schemaVersion": "1.0",
            "aggregateVersion": "7",
            "etag": "admin-etag-0007",
            "correlationId": "admin-correlation-0007",
            "provenance": "postgres-authority",
            "environment": {
                "environmentId": "staging-brasil",
                "kind": "staging",
                "label": "Staging Brasil"
            },
            "freshness": {
                "state": "live",
                "source": "admin-api",
                "sequence": "42",
                "observedAt": "2026-08-06T20:00:00.000Z"
            },
            "kind": kind
        });
        document
            .as_object_mut()
            .expect("admin document object")
            .extend(fields.as_object().expect("admin fields object").clone());
        document
    }

    fn valid_admin_documents() -> Vec<Value> {
        vec![
            admin_document(
                "admin-access-context-projection",
                json!({
                    "actorId": "administrator-0001",
                    "activeFunction": "security",
                    "domains": ["overview", "people", "security", "system"],
                    "capabilities": ["incident.review", "access.recertify"],
                    "scopes": ["environment:staging", "region:brasil"],
                    "authenticationStrength": "passkey"
                }),
            ),
            admin_document(
                "admin-saved-view-projection",
                json!({
                    "savedViewId": "saved-view-0001",
                    "domain": "people",
                    "name": "Convites expirando",
                    "visibility": "official",
                    "state": {
                        "filters": ["state:active", "expiry:soon"],
                        "sort": ["expiresAt:asc"],
                        "tab": "active",
                        "density": "compact"
                    }
                }),
            ),
            admin_document(
                "admin-inbox-item-projection",
                json!({
                    "inboxItemId": "inbox-0001",
                    "severity": "warning",
                    "state": "open",
                    "title": "Revisar capacidade de convites",
                    "ownerReference": "administrator-0001",
                    "relatedRecordReference": "invitation-capacity-staging",
                    "deadlineAt": "2026-08-07T20:00:00.000Z",
                    "updatedAt": "2026-08-06T20:00:00.000Z"
                }),
            ),
            admin_document(
                "admin-invitation-projection",
                json!({
                    "invitationId": "invitation-0001",
                    "lifecycleState": "active",
                    "recipientMasked": "wa***@example.test",
                    "campaignReference": "private-beta-01",
                    "locale": "pt-BR",
                    "deliveryState": "delivered",
                    "reminderCount": 1,
                    "ownerReference": "administrator-0001",
                    "expiresAt": "2026-08-20T20:00:00.000Z",
                    "lastEventAt": "2026-08-06T20:00:00.000Z"
                }),
            ),
            admin_document(
                "admin-invitation-capacity-projection",
                json!({
                    "capacityId": "invitation-capacity-staging",
                    "activeCount": 18,
                    "activeLimit": 25,
                    "queuedCount": 4,
                    "forecastExhaustionAt": "2026-08-12T20:00:00.000Z"
                }),
            ),
            admin_document(
                "admin-governance-projection",
                json!({
                    "governanceRecordId": "approval-0001",
                    "governanceKind": "approval",
                    "state": "pending",
                    "risk": "critical",
                    "authorReference": "administrator-0001",
                    "beneficiaryReference": "administrator-0002",
                    "eligibleApproverReferences": ["administrator-0003"],
                    "impactedReferences": ["scope:production-security"],
                    "expiresAt": "2026-08-06T20:15:00.000Z"
                }),
            ),
            admin_document(
                "admin-job-projection",
                json!({
                    "jobId": "job-0001",
                    "jobType": "invitation-import",
                    "state": "running",
                    "progressPercent": 40,
                    "totalItems": 25,
                    "completedItems": 10,
                    "failedItems": 0,
                    "ownerReference": "administrator-0001",
                    "startedAt": "2026-08-06T19:59:00.000Z"
                }),
            ),
            admin_document(
                "admin-incident-projection",
                json!({
                    "incidentId": "incident-0001",
                    "severity": "critical",
                    "state": "contained",
                    "title": "Entrega de convites degradada",
                    "ownerReference": "administrator-0001",
                    "substituteReference": "administrator-0002",
                    "affectedCapabilities": ["invitation.delivery"],
                    "impactReferences": ["provider:email"],
                    "nextUpdateAt": "2026-08-06T20:30:00.000Z"
                }),
            ),
            admin_document(
                "admin-configuration-projection",
                json!({
                    "configurationId": "invitation-reminder-policy",
                    "state": "validated",
                    "version": "policy-v3",
                    "cohortReference": "private-beta",
                    "validationReference": "validation-0003",
                    "rollbackVersion": "policy-v2"
                }),
            ),
            admin_document(
                "admin-privacy-case-projection",
                json!({
                    "privacyCaseId": "privacy-case-0001",
                    "state": "verified",
                    "requestType": "access",
                    "subjectReference": "account-0001",
                    "legalBasisReference": "lgpd-access",
                    "dataCategoryReferences": ["identity", "billing"],
                    "retentionReferences": ["invoice-retention"],
                    "ownerReference": "administrator-0001"
                }),
            ),
            admin_document(
                "admin-conflict-projection",
                json!({
                    "conflictId": "conflict-0001",
                    "state": "review-required",
                    "recordReference": "configuration:invitation-reminder-policy",
                    "localVersion": "7",
                    "remoteVersion": "8",
                    "conflictingFieldReferences": ["reminder-window"],
                    "localDraftReference": "draft-0007"
                }),
            ),
            admin_document(
                "admin-partial-failure-projection",
                json!({
                    "operationId": "operation-0001",
                    "completedCount": 23,
                    "failedCount": 2,
                    "failures": [
                        {"recordReference": "invitation-0024", "code": "provider-unavailable"},
                        {"recordReference": "invitation-0025", "code": "conflict"}
                    ]
                }),
            ),
            admin_document(
                "admin-operation-receipt",
                json!({
                    "receiptId": "receipt-0001",
                    "commandId": "command-0001",
                    "outcome": "partial",
                    "affectedReferences": ["invitation-0024", "invitation-0025"],
                    "approvalReferences": ["approval-0001"],
                    "auditReference": "audit-0001",
                    "recordedAt": "2026-08-06T20:01:00.000Z"
                }),
            ),
            json!({
                "schemaVersion": "1.0",
                "kind": "admin-operation-command",
                "commandId": "command-0001",
                "actorId": "administrator-0001",
                "activeFunction": "security",
                "action": "revoke-invitations",
                "targetReferences": ["invitation-0024", "invitation-0025"],
                "reason": "Delivery risk confirmed during private beta.",
                "expectedVersion": "7",
                "expectedEtag": "admin-etag-0007",
                "approvalReferences": ["approval-0001"],
                "correlationId": "admin-correlation-0007",
                "requestedAt": "2026-08-06T20:00:30.000Z"
            }),
        ]
    }

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

    #[test]
    fn control_plane_validator_enforces_closed_authority_boundaries() {
        for input in [
            account_projection(),
            account_command(),
            diagnostic_consent(),
            offline_entitlement(),
        ]
        .into_iter()
        .chain(valid_admin_documents())
        {
            validate_control_plane_document(&input).expect("valid control-plane document");
        }

        let mut unknown_state = account_projection();
        unknown_state["state"] = json!("SENSITIVE_UNKNOWN_STATE");

        let mut fixture_provenance = account_projection();
        fixture_provenance["provenance"] = json!("fixture");

        let mut overlong_identifier = account_projection();
        overlong_identifier["accountId"] = json!("x".repeat(129));

        let mut missing_expected_version = account_command();
        missing_expected_version
            .as_object_mut()
            .expect("command object")
            .remove("expectedVersion");

        let mut duplicate_scopes = diagnostic_consent();
        duplicate_scopes["scopes"] = json!(["support-diagnostics", "support-diagnostics"]);

        let mut invalid_validity = offline_entitlement();
        invalid_validity["validitySeconds"] = json!(604799);

        let admin_documents = valid_admin_documents();
        let mut unknown_admin_state = admin_documents[3].clone();
        unknown_admin_state["lifecycleState"] = json!("mystery");

        let mut hidden_scope = admin_documents[5].clone();
        hidden_scope
            .as_object_mut()
            .expect("governance object")
            .insert("visibility".to_owned(), json!("hidden-scope"));

        let mut unmasked_recipient = admin_documents[3].clone();
        unmasked_recipient
            .as_object_mut()
            .expect("invitation object")
            .insert("email".to_owned(), json!("private@example.test"));

        let mut unbounded_capabilities = admin_documents[0].clone();
        unbounded_capabilities["capabilities"] =
            Value::Array((0..65).map(|index| json!(format!("c{index}"))).collect());

        let mut missing_admin_version = admin_documents[7].clone();
        missing_admin_version
            .as_object_mut()
            .expect("incident object")
            .remove("aggregateVersion");

        let mut secret_route_state = admin_documents[1].clone();
        secret_route_state["state"]
            .as_object_mut()
            .expect("route state object")
            .insert("token".to_owned(), json!("secret-token"));

        for input in [
            unknown_state,
            fixture_provenance,
            overlong_identifier,
            missing_expected_version,
            duplicate_scopes,
            invalid_validity,
            unknown_admin_state,
            hidden_scope,
            unmasked_recipient,
            unbounded_capabilities,
            missing_admin_version,
            secret_route_state,
        ] {
            validate_control_plane_document(&input).expect_err("invalid control-plane document");
        }
    }
}
