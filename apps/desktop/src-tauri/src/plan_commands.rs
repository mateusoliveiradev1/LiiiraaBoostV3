use liiiraa_contracts_rust::{
    TransactionIntent, TransactionalRecoveryDocument, validate_transactional_recovery_document,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::plan_executor::PlanExecutorError;

pub const PLAN_COMMANDS: [&str; 11] = [
    "compose_plan",
    "revise_plan",
    "approve_plan",
    "apply_plan",
    "restore_plan_operation",
    "restore_plan",
    "restore_recovery_checkpoint",
    "read_plan_execution",
    "subscribe_plan_execution",
    "preview_plan_diagnostic",
    "export_plan_diagnostic",
];

pub const ADVANCED_PREFERENCE_COMMANDS: [&str; 3] = [
    "read_advanced_preference",
    "enable_advanced_preference",
    "revoke_advanced_preference",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceCommand {
    Read,
    Enable,
    Revoke,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AdvancedPreferenceCommandRequest {
    pub intent_id: String,
    pub authorization_context_id: String,
    pub proof_reference: String,
    pub expected_sequence: u32,
    pub requested_at: String,
}

pub fn validate_advanced_preference_request(
    command: AdvancedPreferenceCommand,
    value: &Value,
) -> Result<AdvancedPreferenceCommandRequest, PlanExecutorError> {
    if command == AdvancedPreferenceCommand::Read {
        return Err(PlanExecutorError::InvalidRequest);
    }
    let encoded = serde_json::to_vec(value).map_err(|_| PlanExecutorError::InvalidRequest)?;
    if encoded.len() > 4_096 {
        return Err(PlanExecutorError::MessageTooLarge);
    }
    let request: AdvancedPreferenceCommandRequest =
        serde_json::from_value(value.clone()).map_err(|_| PlanExecutorError::InvalidRequest)?;
    if !bounded_reference(&request.intent_id, 1, 128)
        || !bounded_reference(&request.authorization_context_id, 1, 128)
        || !bounded_reference(&request.proof_reference, 43, 256)
        || !(20..=64).contains(&request.requested_at.len())
        || !request.requested_at.ends_with('Z')
    {
        return Err(PlanExecutorError::InvalidRequest);
    }
    Ok(request)
}

fn bounded_reference(value: &str, minimum: usize, maximum: usize) -> bool {
    (minimum..=maximum).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b':' | b'-'))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlanCommand {
    Compose,
    Revise,
    Approve,
    Apply,
    RestoreOperation,
    RestorePlan,
    RestoreCheckpoint,
    ReadExecution,
    SubscribeExecution,
    PreviewRecoveryDiagnostics,
    ExportRecoveryDiagnostics,
}

impl TryFrom<&str> for PlanCommand {
    type Error = PlanExecutorError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "compose_plan" => Ok(Self::Compose),
            "revise_plan" => Ok(Self::Revise),
            "approve_plan" => Ok(Self::Approve),
            "apply_plan" => Ok(Self::Apply),
            "restore_plan_operation" => Ok(Self::RestoreOperation),
            "restore_plan" => Ok(Self::RestorePlan),
            "restore_recovery_checkpoint" => Ok(Self::RestoreCheckpoint),
            "read_plan_execution" => Ok(Self::ReadExecution),
            "subscribe_plan_execution" => Ok(Self::SubscribeExecution),
            "preview_plan_diagnostic" => Ok(Self::PreviewRecoveryDiagnostics),
            "export_plan_diagnostic" => Ok(Self::ExportRecoveryDiagnostics),
            _ => Err(PlanExecutorError::InvalidRequest),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanDocumentRequest {
    pub document: Value,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagnosticExportRequest {
    pub file_name: String,
    pub preview_fingerprint: String,
    pub approved: bool,
}

pub fn validate_export_file_name(value: &str) -> Result<(), PlanExecutorError> {
    if !(1..=128).contains(&value.len())
        || !value.ends_with(".json")
        || value.starts_with('.')
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(PlanExecutorError::InvalidRequest);
    }
    Ok(())
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptedPlanIntent {
    pub command: &'static str,
    pub document_kind: &'static str,
}

/// Validates the generated transport and then enforces command-to-document
/// identity. A generally valid transaction can never cross the wrong command.
pub fn validate_plan_document(
    command: PlanCommand,
    value: &Value,
) -> Result<TransactionalRecoveryDocument, PlanExecutorError> {
    if serde_json::to_vec(value)
        .map_err(|_| PlanExecutorError::InvalidRequest)?
        .len()
        > 65_536
    {
        return Err(PlanExecutorError::MessageTooLarge);
    }
    let document = validate_transactional_recovery_document(value)
        .map_err(|_| PlanExecutorError::InvalidRequest)?;
    let matches_command = match (&command, &document) {
        (
            PlanCommand::Compose | PlanCommand::Revise,
            TransactionalRecoveryDocument::TransactionalPlanDocument(_),
        )
        | (PlanCommand::Approve, TransactionalRecoveryDocument::PlanApprovalDocument(_)) => true,
        (
            PlanCommand::Apply,
            TransactionalRecoveryDocument::PlanTransactionDocument(transaction),
        ) => matches!(
            transaction.intent,
            TransactionIntent::Apply | TransactionIntent::RetryAfterObservation
        ),
        (
            PlanCommand::RestoreOperation,
            TransactionalRecoveryDocument::PlanTransactionDocument(transaction),
        ) => transaction.intent == TransactionIntent::RestoreOperation,
        (
            PlanCommand::RestorePlan,
            TransactionalRecoveryDocument::PlanTransactionDocument(transaction),
        ) => transaction.intent == TransactionIntent::RestorePlan,
        (
            PlanCommand::RestoreCheckpoint,
            TransactionalRecoveryDocument::PlanTransactionDocument(transaction),
        ) => transaction.intent == TransactionIntent::RestoreCheckpoint,
        _ => false,
    };
    matches_command
        .then_some(document)
        .ok_or(PlanExecutorError::InvalidRequest)
}

pub fn command_acceptance(
    command: PlanCommand,
    document: &TransactionalRecoveryDocument,
) -> Option<AcceptedPlanIntent> {
    let (command, document_kind) = match (command, document) {
        (PlanCommand::Compose, TransactionalRecoveryDocument::TransactionalPlanDocument(_)) => {
            ("compose_plan", "transactional-plan")
        }
        (PlanCommand::Revise, TransactionalRecoveryDocument::TransactionalPlanDocument(_)) => {
            ("revise_plan", "transactional-plan")
        }
        (PlanCommand::Approve, TransactionalRecoveryDocument::PlanApprovalDocument(_)) => {
            ("approve_plan", "plan-approval")
        }
        (PlanCommand::Apply, TransactionalRecoveryDocument::PlanTransactionDocument(_)) => {
            ("apply_plan", "plan-transaction")
        }
        (
            PlanCommand::RestoreOperation,
            TransactionalRecoveryDocument::PlanTransactionDocument(_),
        ) => ("restore_plan_operation", "plan-transaction"),
        (PlanCommand::RestorePlan, TransactionalRecoveryDocument::PlanTransactionDocument(_)) => {
            ("restore_plan", "plan-transaction")
        }
        (
            PlanCommand::RestoreCheckpoint,
            TransactionalRecoveryDocument::PlanTransactionDocument(_),
        ) => ("restore_recovery_checkpoint", "plan-transaction"),
        _ => return None,
    };
    Some(AcceptedPlanIntent {
        command,
        document_kind,
    })
}
