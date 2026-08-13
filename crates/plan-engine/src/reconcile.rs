//! Observation-first reconciliation and recovery-only authorization.

use liiiraa_contracts_rust::{ExactOperationState, TransactionIdentifier};

use crate::dependency::RollbackDecision;
use crate::domain::PlanEngineResult;

/// Exact persisted states needed to reconcile an uncertain external effect.
pub struct ReconcileInput<'a> {
    pub transaction_id: &'a TransactionIdentifier,
    pub operation_version_id: &'a TransactionIdentifier,
    pub exact_prior_state: &'a ExactOperationState,
    pub exact_requested_state: &'a ExactOperationState,
    pub exact_observed_state: &'a ExactOperationState,
}

/// Observation, never a dispatch return, determines the next safe action.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReconcileDecision {
    AppliedNeedsVerificationAndReceipt,
    NotAppliedDoNotRetry,
    UnknownBlockMutations,
    DriftRequiresUserChoice,
    ConflictRequiresUserChoice,
}

/// Recovery is local authority independent of online state or entitlement.
/// There is intentionally no account, subscription, license, or auth field.
pub struct RecoveryRequest<'a> {
    pub transaction_id: &'a TransactionIdentifier,
    pub exact_current_state: &'a ExactOperationState,
    pub rollback: &'a RollbackDecision,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GuidedRecoveryChoice {
    KeepCurrentState,
    RestoreExactPriorState,
    ReapplyAfterFreshAdmission,
}

pub trait ReconciliationPolicy {
    fn reconcile(&self, input: ReconcileInput<'_>) -> PlanEngineResult<ReconcileDecision>;

    fn authorize_local_recovery(
        &self,
        request: RecoveryRequest<'_>,
        choice: GuidedRecoveryChoice,
    ) -> PlanEngineResult<RollbackDecision>;
}
