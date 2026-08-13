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
    "restore_operation",
    "restore_plan",
    "restore_checkpoint",
    "read_execution",
    "create_restart_checkpoint",
    "preview_recovery_diagnostics",
    "export_recovery_diagnostics",
];

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
    CreateRestartCheckpoint,
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
            "restore_operation" => Ok(Self::RestoreOperation),
            "restore_plan" => Ok(Self::RestorePlan),
            "restore_checkpoint" => Ok(Self::RestoreCheckpoint),
            "read_execution" => Ok(Self::ReadExecution),
            "create_restart_checkpoint" => Ok(Self::CreateRestartCheckpoint),
            "preview_recovery_diagnostics" => Ok(Self::PreviewRecoveryDiagnostics),
            "export_recovery_diagnostics" => Ok(Self::ExportRecoveryDiagnostics),
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
    pub destination: String,
    pub preview_fingerprint: String,
    pub approved: bool,
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
        | (PlanCommand::Approve, TransactionalRecoveryDocument::PlanApprovalDocument(_))
        | (
            PlanCommand::CreateRestartCheckpoint,
            TransactionalRecoveryDocument::RecoveryCheckpointDocument(_),
        ) => true,
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
        ) => ("restore_operation", "plan-transaction"),
        (PlanCommand::RestorePlan, TransactionalRecoveryDocument::PlanTransactionDocument(_)) => {
            ("restore_plan", "plan-transaction")
        }
        (
            PlanCommand::RestoreCheckpoint,
            TransactionalRecoveryDocument::PlanTransactionDocument(_),
        ) => ("restore_checkpoint", "plan-transaction"),
        (
            PlanCommand::CreateRestartCheckpoint,
            TransactionalRecoveryDocument::RecoveryCheckpointDocument(_),
        ) => ("create_restart_checkpoint", "recovery-checkpoint"),
        _ => return None,
    };
    Some(AcceptedPlanIntent {
        command,
        document_kind,
    })
}
