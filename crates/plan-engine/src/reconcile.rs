//! Observation-first reconciliation and recovery-only authorization.

use liiiraa_contracts_rust::{ExactOperationState, TransactionIdentifier};

use crate::dependency::RollbackDecision;
use crate::domain::{PlanEngineError, PlanEngineErrorCode, PlanEngineResult};

/// Whether durable intent belongs to an apply or restore transaction.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReconcileOperation {
    Apply,
    Restore,
}

/// Diagnostic dispatch evidence. It must never determine external-effect truth.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DispatchEvidence {
    NotDispatched,
    ReturnedSuccess,
    ReturnedFailure,
    TimedOut,
    ResponseLost,
    AbandonedMutex,
}

/// Exact persisted states needed to reconcile an uncertain external effect.
pub struct ReconcileInput<'a> {
    pub transaction_id: &'a TransactionIdentifier,
    pub operation_version_id: &'a TransactionIdentifier,
    pub exact_prior_state: &'a ExactOperationState,
    pub exact_requested_state: &'a ExactOperationState,
    pub exact_observed_state: &'a ExactOperationState,
    pub operation: ReconcileOperation,
    pub dispatch: DispatchEvidence,
}

/// Exact immutable evidence carried by every reconciliation decision.
#[derive(Clone, Debug)]
pub struct ReconcileEvidence {
    transaction_id: TransactionIdentifier,
    operation_version_id: TransactionIdentifier,
    operation: ReconcileOperation,
    dispatch: DispatchEvidence,
    exact_prior_state: ExactOperationState,
    exact_requested_state: ExactOperationState,
    exact_observed_state: ExactOperationState,
}

impl ReconcileEvidence {
    pub const fn transaction_id(&self) -> &TransactionIdentifier {
        &self.transaction_id
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn operation(&self) -> ReconcileOperation {
        self.operation
    }

    pub const fn dispatch(&self) -> DispatchEvidence {
        self.dispatch
    }

    pub const fn exact_prior_state(&self) -> &ExactOperationState {
        &self.exact_prior_state
    }

    pub const fn exact_requested_state(&self) -> &ExactOperationState {
        &self.exact_requested_state
    }

    pub const fn exact_observed_state(&self) -> &ExactOperationState {
        &self.exact_observed_state
    }
}

/// Closed observation-derived outcomes. No variant authorizes blind retry.
#[derive(Clone, Debug)]
pub enum ReconcileDecision {
    AppliedNeedsReceipt(ReconcileEvidence),
    RestoredNeedsReceipt(ReconcileEvidence),
    NotAppliedDoNotRetry(ReconcileEvidence),
    NotRestoredDoNotRetry(ReconcileEvidence),
    UnknownBlockMutations(ReconcileEvidence),
    DriftRequiresUserChoice(ReconcileEvidence),
    ConflictRequiresUserChoice(ReconcileEvidence),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReconcileDecisionKind {
    AppliedNeedsReceipt,
    RestoredNeedsReceipt,
    NotAppliedDoNotRetry,
    NotRestoredDoNotRetry,
    UnknownBlockMutations,
    DriftRequiresUserChoice,
    ConflictRequiresUserChoice,
}

impl ReconcileDecision {
    pub const fn kind(&self) -> ReconcileDecisionKind {
        match self {
            Self::AppliedNeedsReceipt(_) => ReconcileDecisionKind::AppliedNeedsReceipt,
            Self::RestoredNeedsReceipt(_) => ReconcileDecisionKind::RestoredNeedsReceipt,
            Self::NotAppliedDoNotRetry(_) => ReconcileDecisionKind::NotAppliedDoNotRetry,
            Self::NotRestoredDoNotRetry(_) => ReconcileDecisionKind::NotRestoredDoNotRetry,
            Self::UnknownBlockMutations(_) => ReconcileDecisionKind::UnknownBlockMutations,
            Self::DriftRequiresUserChoice(_) => ReconcileDecisionKind::DriftRequiresUserChoice,
            Self::ConflictRequiresUserChoice(_) => {
                ReconcileDecisionKind::ConflictRequiresUserChoice
            }
        }
    }

    pub const fn evidence(&self) -> &ReconcileEvidence {
        match self {
            Self::AppliedNeedsReceipt(evidence)
            | Self::RestoredNeedsReceipt(evidence)
            | Self::NotAppliedDoNotRetry(evidence)
            | Self::NotRestoredDoNotRetry(evidence)
            | Self::UnknownBlockMutations(evidence)
            | Self::DriftRequiresUserChoice(evidence)
            | Self::ConflictRequiresUserChoice(evidence) => evidence,
        }
    }

    pub const fn receipt_eligible(&self) -> bool {
        matches!(
            self,
            Self::AppliedNeedsReceipt(_) | Self::RestoredNeedsReceipt(_)
        )
    }

    pub const fn allows_automatic_retry(&self) -> bool {
        false
    }

    pub const fn requires_user_choice(&self) -> bool {
        matches!(
            self,
            Self::DriftRequiresUserChoice(_) | Self::ConflictRequiresUserChoice(_)
        )
    }
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

/// A new auditable intent derived from an explicit conflict resolution.
#[derive(Clone, Debug)]
pub struct ConflictResolutionIntent {
    transaction_id: TransactionIdentifier,
    parent_transaction_id: TransactionIdentifier,
    operation_version_id: TransactionIdentifier,
    choice: GuidedRecoveryChoice,
    exact_prior_state: ExactOperationState,
    exact_requested_state: ExactOperationState,
}

impl ConflictResolutionIntent {
    pub const fn transaction_id(&self) -> &TransactionIdentifier {
        &self.transaction_id
    }

    pub const fn parent_transaction_id(&self) -> &TransactionIdentifier {
        &self.parent_transaction_id
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn choice(&self) -> GuidedRecoveryChoice {
        self.choice
    }

    pub const fn exact_prior_state(&self) -> &ExactOperationState {
        &self.exact_prior_state
    }

    pub const fn exact_requested_state(&self) -> &ExactOperationState {
        &self.exact_requested_state
    }
}

/// Concrete pure reducer used by orchestration and recovery adapters.
#[derive(Clone, Copy, Debug, Default)]
pub struct ObservationFirstReconciliationPolicy;

impl ObservationFirstReconciliationPolicy {
    pub fn reconcile_apply(
        &self,
        input: ReconcileInput<'_>,
    ) -> PlanEngineResult<ReconcileDecision> {
        if input.operation != ReconcileOperation::Apply {
            return Err(invalid_reconcile_input(input.operation_version_id));
        }
        self.reconcile(input)
    }

    pub fn reconcile_restore(
        &self,
        input: ReconcileInput<'_>,
    ) -> PlanEngineResult<ReconcileDecision> {
        if input.operation != ReconcileOperation::Restore {
            return Err(invalid_reconcile_input(input.operation_version_id));
        }
        self.reconcile(input)
    }

    pub fn create_resolution_intent(
        &self,
        decision: &ReconcileDecision,
        choice: GuidedRecoveryChoice,
        transaction_id: TransactionIdentifier,
    ) -> PlanEngineResult<ConflictResolutionIntent> {
        let evidence = decision.evidence();
        if !decision.requires_user_choice() || transaction_id == evidence.transaction_id {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::RecoveryBlocked,
                Some(evidence.operation_version_id.clone()),
            ));
        }

        let exact_requested_state = match choice {
            GuidedRecoveryChoice::KeepCurrentState => evidence.exact_observed_state.clone(),
            GuidedRecoveryChoice::RestoreExactPriorState => match evidence.operation {
                ReconcileOperation::Apply => evidence.exact_prior_state.clone(),
                ReconcileOperation::Restore => evidence.exact_requested_state.clone(),
            },
            GuidedRecoveryChoice::ReapplyAfterFreshAdmission => {
                evidence.exact_requested_state.clone()
            }
        };

        Ok(ConflictResolutionIntent {
            transaction_id,
            parent_transaction_id: evidence.transaction_id.clone(),
            operation_version_id: evidence.operation_version_id.clone(),
            choice,
            exact_prior_state: evidence.exact_observed_state.clone(),
            exact_requested_state,
        })
    }
}

fn invalid_reconcile_input(operation_version_id: &TransactionIdentifier) -> PlanEngineError {
    PlanEngineError::new(
        PlanEngineErrorCode::InvalidGeneratedTransport,
        Some(operation_version_id.clone()),
    )
}

fn exact_known_states_match(
    left: &ExactOperationState,
    right: &ExactOperationState,
) -> Option<bool> {
    match (left, right) {
        (
            ExactOperationState::ExactPowerSchemeState(left),
            ExactOperationState::ExactPowerSchemeState(right),
        ) => Some(
            left.scheme_id == right.scheme_id
                && left.canonical_state_hash == right.canonical_state_hash,
        ),
        _ => None,
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ExactObservation {
    Requested,
    Prior,
    ThirdState,
    Unknown,
}

fn classify_exact_observation(
    prior: &ExactOperationState,
    requested: &ExactOperationState,
    observed: &ExactOperationState,
) -> ExactObservation {
    let observed_is_requested = exact_known_states_match(observed, requested);
    let observed_is_prior = exact_known_states_match(observed, prior);

    match (observed_is_requested, observed_is_prior) {
        (None, _) | (_, None) => ExactObservation::Unknown,
        (Some(true), _) => ExactObservation::Requested,
        (Some(false), Some(true)) => ExactObservation::Prior,
        (Some(false), Some(false)) => ExactObservation::ThirdState,
    }
}

fn evidence_from(input: ReconcileInput<'_>) -> ReconcileEvidence {
    ReconcileEvidence {
        transaction_id: input.transaction_id.clone(),
        operation_version_id: input.operation_version_id.clone(),
        operation: input.operation,
        dispatch: input.dispatch,
        exact_prior_state: input.exact_prior_state.clone(),
        exact_requested_state: input.exact_requested_state.clone(),
        exact_observed_state: input.exact_observed_state.clone(),
    }
}

pub trait ReconciliationPolicy {
    fn reconcile(&self, input: ReconcileInput<'_>) -> PlanEngineResult<ReconcileDecision>;

    fn authorize_local_recovery(
        &self,
        request: RecoveryRequest<'_>,
        choice: GuidedRecoveryChoice,
    ) -> PlanEngineResult<RollbackDecision>;
}

impl ReconciliationPolicy for ObservationFirstReconciliationPolicy {
    fn reconcile(&self, input: ReconcileInput<'_>) -> PlanEngineResult<ReconcileDecision> {
        let observation = classify_exact_observation(
            input.exact_prior_state,
            input.exact_requested_state,
            input.exact_observed_state,
        );
        let evidence = evidence_from(input);

        let decision = match (observation, evidence.operation) {
            (ExactObservation::Unknown, _) => ReconcileDecision::UnknownBlockMutations(evidence),
            (ExactObservation::Requested, ReconcileOperation::Apply) => {
                ReconcileDecision::AppliedNeedsReceipt(evidence)
            }
            (ExactObservation::Requested, ReconcileOperation::Restore) => {
                ReconcileDecision::RestoredNeedsReceipt(evidence)
            }
            (ExactObservation::Prior, ReconcileOperation::Apply) => {
                ReconcileDecision::NotAppliedDoNotRetry(evidence)
            }
            (ExactObservation::Prior, ReconcileOperation::Restore) => {
                ReconcileDecision::NotRestoredDoNotRetry(evidence)
            }
            (ExactObservation::ThirdState, ReconcileOperation::Apply) => {
                ReconcileDecision::DriftRequiresUserChoice(evidence)
            }
            (ExactObservation::ThirdState, ReconcileOperation::Restore) => {
                ReconcileDecision::ConflictRequiresUserChoice(evidence)
            }
        };

        Ok(decision)
    }

    fn authorize_local_recovery(
        &self,
        request: RecoveryRequest<'_>,
        _choice: GuidedRecoveryChoice,
    ) -> PlanEngineResult<RollbackDecision> {
        Err(PlanEngineError::new(
            PlanEngineErrorCode::RecoveryBlocked,
            Some(request.transaction_id.clone()),
        ))
    }
}
