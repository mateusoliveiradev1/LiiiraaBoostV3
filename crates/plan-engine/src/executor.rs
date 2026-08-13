//! Durable executor, narrow effect ports, and restart/cancellation boundaries.

use liiiraa_contracts_rust::{
    ActionProofReference, DurableJournalEvent, ExactOperationState, PlanApprovalDocument,
    PlanTransactionDocument, PrivilegedBrokerResponse, ProgressEventDocument,
    ProgressSnapshotDocument, RecoveryCheckpointDocument, TransactionHash, TransactionIdentifier,
    TransactionReceiptDocument,
};

use crate::dependency::RollbackDecision;
use crate::domain::{
    GeneratedTransport, PlanEngineError, PlanEngineErrorCode, PlanEngineResult, PreparedMutation,
    PreparedObservation, PreparedTransactionIdentity,
};
use crate::reconcile::{
    DispatchEvidence, ObservationFirstReconciliationPolicy, ReconcileDecision,
    ReconcileDecisionKind, ReconcileInput, ReconcileOperation,
};
use crate::revision::PlanRevision;

/// Append precondition for the durable journal hash chain.
pub struct JournalAppend<'a> {
    pub transaction: &'a PreparedTransactionIdentity,
    pub expected_head_hash: &'a TransactionHash,
    pub event: &'a DurableJournalEvent,
}

/// Authority loaded on startup before any new mutation may be admitted.
#[derive(Clone, Debug)]
pub enum RecoveryLoad {
    Clear,
    Pending {
        transaction: PlanTransactionDocument,
        latest_event: DurableJournalEvent,
    },
    CorruptOrUnavailable,
}

/// Append-oriented journal and immutable receipt/checkpoint authority.
pub trait DurableJournalPort {
    fn append_prepared(
        &mut self,
        transaction: &PlanTransactionDocument,
        prepared_event: &DurableJournalEvent,
    ) -> PlanEngineResult<()>;

    fn append(&mut self, append: JournalAppend<'_>) -> PlanEngineResult<TransactionHash>;

    fn store_checkpoint(
        &mut self,
        transaction: &PreparedTransactionIdentity,
        expected_prior_state: &ExactOperationState,
        checkpoint: &RecoveryCheckpointDocument,
    ) -> PlanEngineResult<()>;

    fn store_receipt(
        &mut self,
        transaction: &PreparedTransactionIdentity,
        expected_prior_state: &ExactOperationState,
        receipt: &TransactionReceiptDocument,
    ) -> PlanEngineResult<()>;

    /// Recovery lookup is deliberately independent of subscription and auth.
    fn load_recovery(&self) -> PlanEngineResult<RecoveryLoad>;
}

/// Narrow privileged effect boundary. Both operations carry durable transaction
/// identity and exact expected prior state through their prepared command types.
pub trait PrivilegedBrokerPort {
    fn observe(
        &self,
        observation: &PreparedObservation,
    ) -> PlanEngineResult<PrivilegedBrokerResponse>;

    fn mutate(&mut self, mutation: &PreparedMutation)
    -> PlanEngineResult<PrivilegedBrokerResponse>;
}

/// Strong-auth proof verification bound to the prepared transaction and exact
/// plan fingerprint. It is never represented as a renderer Boolean.
pub struct StrongAuthVerification<'a> {
    pub transaction: &'a PreparedTransactionIdentity,
    pub expected_prior_state: &'a ExactOperationState,
    pub revision: &'a PlanRevision,
    pub approval: &'a PlanApprovalDocument,
    pub proof: &'a ActionProofReference,
}

#[derive(Clone, Debug)]
pub struct VerifiedStrongAuth {
    proof: ActionProofReference,
}

impl VerifiedStrongAuth {
    pub(crate) const fn from_proof(proof: ActionProofReference) -> Self {
        Self { proof }
    }
}

impl GeneratedTransport<ActionProofReference> for VerifiedStrongAuth {
    fn transport(&self) -> &ActionProofReference {
        &self.proof
    }
}

pub trait StrongAuthVerifierPort {
    fn verify(&self, request: StrongAuthVerification<'_>) -> PlanEngineResult<VerifiedStrongAuth>;
}

/// Native progress reducer result. A sequence gap always requires a snapshot.
#[derive(Clone, Debug)]
pub enum EventReduction {
    Applied(ProgressSnapshotDocument),
    AuthoritativeSnapshotRequired {
        transaction_id: TransactionIdentifier,
        expected_sequence: u32,
        received_sequence: u32,
    },
}

pub trait ExecutorEventReducer {
    fn reduce(
        &self,
        snapshot: &ProgressSnapshotDocument,
        event: &ProgressEventDocument,
    ) -> PlanEngineResult<EventReduction>;
}

/// Cancellation can only stop admission between atomic mutation steps.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CancellationBoundary {
    SafeBeforeNextStep,
    AtomicMutationInFlight,
    ObservationOrVerificationInFlight,
    RecoveryInFlight,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CancellationDecision {
    StopBeforeNextStep,
    FinishBoundedStepThenStop,
    ReconcileUnknownOutcome,
}

/// Protected reboot checkpoint. It exposes no operation that can force reboot.
#[derive(Clone, Debug)]
pub struct RestartCheckpoint(RecoveryCheckpointDocument);

impl RestartCheckpoint {
    pub(crate) const fn from_transport(transport: RecoveryCheckpointDocument) -> Self {
        Self(transport)
    }
}

impl GeneratedTransport<RecoveryCheckpointDocument> for RestartCheckpoint {
    fn transport(&self) -> &RecoveryCheckpointDocument {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MutationGateState {
    Open,
    ClosedForRecovery,
    ClosedForUnknownState,
    ClosedForConflict,
    ClosedForJournalFailure,
    ClosedForRevocation,
    ClosedForRestartVerification,
}

/// Only an open gate can yield this token; recovery never requires one.
#[derive(Clone, Debug)]
pub struct MutationAdmission {
    transaction_id: TransactionIdentifier,
}

impl MutationAdmission {
    pub(crate) const fn new(transaction_id: TransactionIdentifier) -> Self {
        Self { transaction_id }
    }

    pub const fn transaction_id(&self) -> &TransactionIdentifier {
        &self.transaction_id
    }
}

pub trait MutationGate {
    fn state(&self) -> MutationGateState;

    fn admit_new_mutation(
        &self,
        transaction: &PreparedTransactionIdentity,
        expected_prior_state: &ExactOperationState,
        strong_auth: Option<&VerifiedStrongAuth>,
    ) -> PlanEngineResult<MutationAdmission>;
}

pub trait ExecutorPolicy {
    fn cancellation(
        &self,
        boundary: CancellationBoundary,
    ) -> PlanEngineResult<CancellationDecision>;

    fn restart_checkpoint(
        &self,
        transaction: &PreparedTransactionIdentity,
        expected_prior_state: &ExactOperationState,
        document: RecoveryCheckpointDocument,
    ) -> PlanEngineResult<RestartCheckpoint>;
}

/// Whether the prepared transaction applies or restores exact state.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExecutionOperation {
    Apply,
    Restore,
}

/// Closed durable result of one executor turn. No result authorizes an
/// automatic mutation retry.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExecutionVerdict {
    Verified,
    Restored,
    NotApplied,
    NotRestored,
    Unknown,
    Drift,
    Conflict,
    CancelledAtSafeBoundary,
    RecoveryPriority,
    RestartVerificationRequired,
    AdmissionBlocked,
    JournalFailure,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NextSafeAction {
    None,
    StopBeforeNextStage,
    ReconcilePendingTransaction,
    VerifyAfterRestart,
    ReviewDrift,
    ReviewConflict,
    GuidedRecovery,
}

/// Exact generated artifacts for a single operation. They are supplied by the
/// native document builder and validated against the reducer decision before
/// any append or receipt write.
#[derive(Clone, Debug)]
pub struct ExecutionArtifacts {
    pub prepared: DurableJournalEvent,
    pub dispatch_returned: Option<DurableJournalEvent>,
    pub observed: DurableJournalEvent,
    pub verified: DurableJournalEvent,
    pub not_applied: DurableJournalEvent,
    pub unknown: DurableJournalEvent,
    pub drift: DurableJournalEvent,
    pub conflict: DurableJournalEvent,
    pub restored: DurableJournalEvent,
    pub receipt: TransactionReceiptDocument,
    pub restart_checkpoint: Option<RecoveryCheckpointDocument>,
}

#[derive(Clone, Debug)]
pub struct ExecutionRequest {
    pub transaction: PlanTransactionDocument,
    pub operation_version_id: TransactionIdentifier,
    pub exact_prior_state: ExactOperationState,
    pub exact_requested_state: ExactOperationState,
    pub observation_command: crate::domain::BrokerObservationCommand,
    pub mutation_command: crate::domain::BrokerMutationCommand,
    pub operation: ExecutionOperation,
    pub expected_head_hash: TransactionHash,
    pub read_retry_limit: u8,
    pub cancel_before_dispatch: bool,
    pub restart_required: bool,
    pub artifacts: ExecutionArtifacts,
}

/// Native-owned admission is recomputed immediately before durable prepare.
/// Implementations bind current plan/evidence/risk/proof/revocation authority;
/// renderer state is not an input.
pub trait ExecutionAdmissionPort {
    fn recompute(&self, request: &ExecutionRequest) -> PlanEngineResult<()>;
}

/// Stable adapter errors without exposing a generic domain-error constructor.
pub fn journal_unavailable_error() -> crate::domain::PlanEngineError {
    crate::domain::PlanEngineError::new(
        crate::domain::PlanEngineErrorCode::JournalUnavailable,
        None,
    )
}

pub fn broker_unavailable_error() -> crate::domain::PlanEngineError {
    crate::domain::PlanEngineError::new(crate::domain::PlanEngineErrorCode::BrokerUnavailable, None)
}

pub fn admission_blocked_error(
    code: crate::domain::PlanEngineErrorCode,
) -> crate::domain::PlanEngineError {
    crate::domain::PlanEngineError::new(code, None)
}

#[derive(Clone, Debug)]
pub struct ExecutionOutcome {
    verdict: ExecutionVerdict,
    gate: MutationGateState,
    next_safe_action: NextSafeAction,
    durable_sequences: Vec<u32>,
    dispatch_count: u32,
    read_attempts: u32,
    receipt_stored: bool,
    observed_state: Option<ExactOperationState>,
}

#[derive(Clone, Debug)]
pub struct RollbackExecutionOutcome {
    steps: Vec<ExecutionOutcome>,
    preserved_operation_version_ids: Vec<TransactionIdentifier>,
    failed_restore_operation_version_id: Option<TransactionIdentifier>,
    gate: MutationGateState,
}

impl RollbackExecutionOutcome {
    pub fn steps(&self) -> &[ExecutionOutcome] {
        &self.steps
    }

    pub fn preserved_operation_version_ids(&self) -> &[TransactionIdentifier] {
        &self.preserved_operation_version_ids
    }

    pub const fn failed_restore_operation_version_id(&self) -> Option<&TransactionIdentifier> {
        self.failed_restore_operation_version_id.as_ref()
    }

    pub const fn gate(&self) -> MutationGateState {
        self.gate
    }
}

impl ExecutionOutcome {
    pub const fn verdict(&self) -> ExecutionVerdict {
        self.verdict
    }

    pub const fn gate(&self) -> MutationGateState {
        self.gate
    }

    pub const fn next_safe_action(&self) -> NextSafeAction {
        self.next_safe_action
    }

    pub fn durable_sequences(&self) -> &[u32] {
        &self.durable_sequences
    }

    pub const fn dispatch_count(&self) -> u32 {
        self.dispatch_count
    }

    pub const fn read_attempts(&self) -> u32 {
        self.read_attempts
    }

    pub const fn receipt_stored(&self) -> bool {
        self.receipt_stored
    }

    pub const fn observed_state(&self) -> Option<&ExactOperationState> {
        self.observed_state.as_ref()
    }

    pub const fn allows_automatic_mutation_retry(&self) -> bool {
        false
    }
}

/// Stateful only for the serialization guard; all verdicts derive from exact
/// journal and observation inputs.
#[derive(Debug, Default)]
pub struct DeterministicTransactionExecutor {
    mutation_in_flight: bool,
}

impl DeterministicTransactionExecutor {
    pub const fn new() -> Self {
        Self {
            mutation_in_flight: false,
        }
    }

    pub const fn mutation_in_flight(&self) -> bool {
        self.mutation_in_flight
    }

    pub fn execute<J, B, A>(
        &mut self,
        request: &ExecutionRequest,
        journal: &mut J,
        broker: &mut B,
        admission: &A,
    ) -> PlanEngineResult<ExecutionOutcome>
    where
        J: DurableJournalPort,
        B: PrivilegedBrokerPort,
        A: ExecutionAdmissionPort,
    {
        if self.mutation_in_flight {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::MutationGateClosed,
                Some(request.transaction.transaction_id.clone()),
            ));
        }

        match journal.load_recovery() {
            Ok(RecoveryLoad::Clear) => {}
            Ok(RecoveryLoad::Pending { .. }) => {
                return Ok(outcome(
                    ExecutionVerdict::RecoveryPriority,
                    MutationGateState::ClosedForRecovery,
                    NextSafeAction::ReconcilePendingTransaction,
                    Vec::new(),
                    0,
                    0,
                    false,
                    None,
                ));
            }
            Ok(RecoveryLoad::CorruptOrUnavailable) | Err(_) => {
                return Ok(journal_failure(Vec::new(), 0, 0, None));
            }
        }

        if request.operation == ExecutionOperation::Apply
            && let Err(error) = admission.recompute(request)
        {
            return Ok(outcome(
                ExecutionVerdict::AdmissionBlocked,
                gate_for_admission_error(error.code()),
                NextSafeAction::GuidedRecovery,
                Vec::new(),
                0,
                0,
                false,
                None,
            ));
        }

        let provisional_transaction =
            PreparedTransactionIdentity::from_transport(request.transaction.clone());
        let observation = PreparedObservation::from_parts(
            provisional_transaction,
            request.operation_version_id.clone(),
            request.exact_prior_state.clone(),
            request.observation_command.clone(),
        );
        let (prior_observation, prior_attempts) =
            observe_bounded(broker, &observation, request.read_retry_limit);
        let Some(prior_observation) = prior_observation else {
            return Ok(outcome(
                ExecutionVerdict::Unknown,
                MutationGateState::ClosedForUnknownState,
                NextSafeAction::GuidedRecovery,
                Vec::new(),
                0,
                prior_attempts,
                false,
                None,
            ));
        };

        if !exact_state_matches(&prior_observation, &request.exact_prior_state) {
            let (verdict, action) = if exact_state_is_known(&prior_observation) {
                match request.operation {
                    ExecutionOperation::Apply => {
                        (ExecutionVerdict::Drift, NextSafeAction::ReviewDrift)
                    }
                    ExecutionOperation::Restore => {
                        (ExecutionVerdict::Conflict, NextSafeAction::ReviewConflict)
                    }
                }
            } else {
                (ExecutionVerdict::Unknown, NextSafeAction::GuidedRecovery)
            };
            return Ok(outcome(
                verdict,
                if verdict == ExecutionVerdict::Unknown {
                    MutationGateState::ClosedForUnknownState
                } else {
                    MutationGateState::ClosedForConflict
                },
                action,
                Vec::new(),
                0,
                prior_attempts,
                false,
                Some(prior_observation),
            ));
        }

        validate_request_artifacts(request)?;

        if journal
            .append_prepared(&request.transaction, &request.artifacts.prepared)
            .is_err()
        {
            return Ok(journal_failure(
                Vec::new(),
                0,
                prior_attempts,
                Some(prior_observation),
            ));
        }

        let transaction = PreparedTransactionIdentity::from_transport(request.transaction.clone());
        let mut sequences = vec![0];
        let mut current_head = event_hash(&request.artifacts.prepared).clone();

        if request.cancel_before_dispatch {
            return Ok(outcome(
                ExecutionVerdict::CancelledAtSafeBoundary,
                MutationGateState::ClosedForRecovery,
                NextSafeAction::StopBeforeNextStage,
                sequences,
                0,
                prior_attempts,
                false,
                Some(prior_observation),
            ));
        }

        let mutation = PreparedMutation::from_parts(
            transaction.clone(),
            request.operation_version_id.clone(),
            request.exact_prior_state.clone(),
            request.exact_requested_state.clone(),
            request.mutation_command.clone(),
        );
        self.mutation_in_flight = true;
        let dispatch_result = broker.mutate(&mutation);
        self.mutation_in_flight = false;
        let dispatch_count = 1;
        let dispatch_evidence = match &dispatch_result {
            Ok(PrivilegedBrokerResponse::AcceptedResponse(_)) => DispatchEvidence::ReturnedSuccess,
            Ok(PrivilegedBrokerResponse::RejectedResponse(_))
            | Ok(PrivilegedBrokerResponse::UnavailableResponse(_))
            | Ok(PrivilegedBrokerResponse::ObservationResponse(_)) => {
                DispatchEvidence::ReturnedFailure
            }
            Err(_) => DispatchEvidence::TimedOut,
        };

        if dispatch_result.is_ok() {
            let Some(dispatch_event) = request.artifacts.dispatch_returned.as_ref() else {
                return Err(invalid_artifact(&request.operation_version_id));
            };
            match append_next(
                journal,
                &transaction,
                dispatch_event,
                &mut current_head,
                &mut sequences,
            ) {
                Ok(()) => {}
                Err(_) => {
                    return Ok(journal_failure(
                        sequences,
                        dispatch_count,
                        prior_attempts,
                        Some(prior_observation),
                    ));
                }
            }
        }

        let post_observation = PreparedObservation::from_parts(
            transaction.clone(),
            request.operation_version_id.clone(),
            request.exact_prior_state.clone(),
            request.observation_command.clone(),
        );
        let (observed, post_attempts) =
            observe_bounded(broker, &post_observation, request.read_retry_limit);
        let read_attempts = prior_attempts + post_attempts;
        let observed = observed.unwrap_or_else(|| {
            event_observed_state(&request.artifacts.observed)
                .expect("validated observed event")
                .clone()
        });

        if !exact_state_matches(
            event_observed_state(&request.artifacts.observed).expect("validated observed event"),
            &observed,
        ) {
            return Err(invalid_artifact(&request.operation_version_id));
        }
        if append_next(
            journal,
            &transaction,
            &request.artifacts.observed,
            &mut current_head,
            &mut sequences,
        )
        .is_err()
        {
            return Ok(journal_failure(
                sequences,
                dispatch_count,
                read_attempts,
                Some(observed),
            ));
        }

        let reconcile_operation = match request.operation {
            ExecutionOperation::Apply => ReconcileOperation::Apply,
            ExecutionOperation::Restore => ReconcileOperation::Restore,
        };
        let reconciliation =
            ObservationFirstReconciliationPolicy.reconcile_apply_or_restore(ReconcileInput {
                transaction_id: &request.transaction.transaction_id,
                operation_version_id: &request.operation_version_id,
                exact_prior_state: &request.exact_prior_state,
                exact_requested_state: &request.exact_requested_state,
                exact_observed_state: &observed,
                operation: reconcile_operation,
                dispatch: dispatch_evidence,
            })?;

        if reconciliation.receipt_eligible() && request.restart_required {
            let Some(checkpoint) = request.artifacts.restart_checkpoint.as_ref() else {
                return Err(invalid_artifact(&request.operation_version_id));
            };
            if journal
                .store_checkpoint(&transaction, &request.exact_prior_state, checkpoint)
                .is_err()
            {
                return Ok(journal_failure(
                    sequences,
                    dispatch_count,
                    read_attempts,
                    Some(observed),
                ));
            }
            return Ok(outcome(
                ExecutionVerdict::RestartVerificationRequired,
                MutationGateState::ClosedForRestartVerification,
                NextSafeAction::VerifyAfterRestart,
                sequences,
                dispatch_count,
                read_attempts,
                false,
                Some(observed),
            ));
        }

        let (verdict, gate, action, verdict_event) = verdict_projection(request, &reconciliation);
        if append_next(
            journal,
            &transaction,
            verdict_event,
            &mut current_head,
            &mut sequences,
        )
        .is_err()
        {
            return Ok(journal_failure(
                sequences,
                dispatch_count,
                read_attempts,
                Some(observed),
            ));
        }

        let mut receipt_stored = false;
        if reconciliation.receipt_eligible() {
            validate_receipt(request, &observed, &current_head)?;
            if journal
                .store_receipt(
                    &transaction,
                    &request.exact_prior_state,
                    &request.artifacts.receipt,
                )
                .is_err()
            {
                return Ok(journal_failure(
                    sequences,
                    dispatch_count,
                    read_attempts,
                    Some(observed),
                ));
            }
            receipt_stored = true;
        }

        Ok(outcome(
            verdict,
            gate,
            action,
            sequences,
            dispatch_count,
            read_attempts,
            receipt_stored,
            Some(observed),
        ))
    }

    /// Reconciles one transaction already found in the durable journal. This
    /// path deliberately has no mutation or admission call: startup truth is
    /// established from Windows observation before new work is considered.
    pub fn reconcile_startup<J, B>(
        &mut self,
        request: &ExecutionRequest,
        journal: &mut J,
        broker: &B,
    ) -> PlanEngineResult<ExecutionOutcome>
    where
        J: DurableJournalPort,
        B: PrivilegedBrokerPort,
    {
        if self.mutation_in_flight {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::MutationGateClosed,
                Some(request.transaction.transaction_id.clone()),
            ));
        }
        let (pending_transaction, latest_event) = match journal.load_recovery() {
            Ok(RecoveryLoad::Pending {
                transaction,
                latest_event,
            }) => (transaction, latest_event),
            Ok(RecoveryLoad::Clear) => {
                return Err(PlanEngineError::new(
                    PlanEngineErrorCode::RecoveryRequired,
                    Some(request.transaction.transaction_id.clone()),
                ));
            }
            Ok(RecoveryLoad::CorruptOrUnavailable) | Err(_) => {
                return Ok(journal_failure(Vec::new(), 0, 0, None));
            }
        };
        if pending_transaction.transaction_id != request.transaction.transaction_id {
            return Err(invalid_artifact(&request.operation_version_id));
        }
        validate_transaction_intent(request)?;
        validate_recovery_artifacts(request, &latest_event)?;

        let transaction = PreparedTransactionIdentity::from_transport(pending_transaction);
        let latest = event_metadata(&latest_event);
        let mut current_head = latest.hash.clone();
        let mut sequences = vec![latest.sequence];
        let observation = PreparedObservation::from_parts(
            transaction.clone(),
            request.operation_version_id.clone(),
            request.exact_prior_state.clone(),
            request.observation_command.clone(),
        );
        let (observed, read_attempts) =
            observe_bounded(broker, &observation, request.read_retry_limit);
        let observed = observed.unwrap_or_else(|| {
            event_observed_state(&request.artifacts.observed)
                .expect("validated observed event")
                .clone()
        });
        if !exact_state_matches(
            event_observed_state(&request.artifacts.observed).expect("validated observed event"),
            &observed,
        ) {
            return Err(invalid_artifact(&request.operation_version_id));
        }
        if append_next(
            journal,
            &transaction,
            &request.artifacts.observed,
            &mut current_head,
            &mut sequences,
        )
        .is_err()
        {
            return Ok(journal_failure(sequences, 0, read_attempts, Some(observed)));
        }

        let reconcile_operation = match request.operation {
            ExecutionOperation::Apply => ReconcileOperation::Apply,
            ExecutionOperation::Restore => ReconcileOperation::Restore,
        };
        let dispatch = match latest_event {
            DurableJournalEvent::DispatchReturnedJournalEvent(_) => {
                DispatchEvidence::ReturnedSuccess
            }
            _ => DispatchEvidence::NotDispatched,
        };
        let reconciliation =
            ObservationFirstReconciliationPolicy.reconcile_apply_or_restore(ReconcileInput {
                transaction_id: &request.transaction.transaction_id,
                operation_version_id: &request.operation_version_id,
                exact_prior_state: &request.exact_prior_state,
                exact_requested_state: &request.exact_requested_state,
                exact_observed_state: &observed,
                operation: reconcile_operation,
                dispatch,
            })?;
        let (verdict, gate, action, verdict_event) = verdict_projection(request, &reconciliation);
        if append_next(
            journal,
            &transaction,
            verdict_event,
            &mut current_head,
            &mut sequences,
        )
        .is_err()
        {
            return Ok(journal_failure(sequences, 0, read_attempts, Some(observed)));
        }
        let mut receipt_stored = false;
        if reconciliation.receipt_eligible() {
            validate_receipt(request, &observed, &current_head)?;
            if journal
                .store_receipt(
                    &transaction,
                    &request.exact_prior_state,
                    &request.artifacts.receipt,
                )
                .is_err()
            {
                return Ok(journal_failure(sequences, 0, read_attempts, Some(observed)));
            }
            receipt_stored = true;
        }
        Ok(outcome(
            verdict,
            gate,
            action,
            sequences,
            0,
            read_attempts,
            receipt_stored,
            Some(observed),
        ))
    }

    /// Restores exactly the dependency policy's verified affected closure.
    /// Every target is a separately prepared restore transaction; the first
    /// uncertain or failed restore stops the sequence and globally blocks new
    /// mutation while independent verified nodes remain untouched.
    pub fn execute_rollback<J, B, A>(
        &mut self,
        rollback: &RollbackDecision,
        requests: &[ExecutionRequest],
        journal: &mut J,
        broker: &mut B,
        admission: &A,
    ) -> PlanEngineResult<RollbackExecutionOutcome>
    where
        J: DurableJournalPort,
        B: PrivilegedBrokerPort,
        A: ExecutionAdmissionPort,
    {
        if requests.len() != rollback.restore_in_order().len() {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::RecoveryBlocked,
                Some(rollback.failed_operation_version_id().clone()),
            ));
        }
        let mut steps = Vec::with_capacity(requests.len());
        for (target, request) in rollback.restore_in_order().iter().zip(requests) {
            if request.operation != ExecutionOperation::Restore
                || &request.operation_version_id != target.operation_version_id()
                || !exact_state_matches(&request.exact_prior_state, target.expected_applied_state())
                || !exact_state_matches(&request.exact_requested_state, target.restore_state())
            {
                return Err(invalid_artifact(target.operation_version_id()));
            }
            let step = self.execute(request, journal, broker, admission)?;
            let restored = step.verdict() == ExecutionVerdict::Restored;
            let failed_id = (!restored).then(|| request.operation_version_id.clone());
            let failure_gate = step.gate();
            steps.push(step);
            if let Some(failed_restore_operation_version_id) = failed_id {
                return Ok(RollbackExecutionOutcome {
                    steps,
                    preserved_operation_version_ids: rollback
                        .preserve_operation_version_ids()
                        .to_vec(),
                    failed_restore_operation_version_id: Some(failed_restore_operation_version_id),
                    gate: if failure_gate == MutationGateState::Open {
                        MutationGateState::ClosedForRecovery
                    } else {
                        failure_gate
                    },
                });
            }
        }
        Ok(RollbackExecutionOutcome {
            steps,
            preserved_operation_version_ids: rollback.preserve_operation_version_ids().to_vec(),
            failed_restore_operation_version_id: None,
            gate: MutationGateState::Open,
        })
    }
}

impl ObservationFirstReconciliationPolicy {
    fn reconcile_apply_or_restore(
        &self,
        input: ReconcileInput<'_>,
    ) -> PlanEngineResult<ReconcileDecision> {
        match input.operation {
            ReconcileOperation::Apply => self.reconcile_apply(input),
            ReconcileOperation::Restore => self.reconcile_restore(input),
        }
    }
}

fn observe_bounded<B: PrivilegedBrokerPort>(
    broker: &B,
    observation: &PreparedObservation,
    retry_limit: u8,
) -> (Option<ExactOperationState>, u32) {
    let mut attempts = 0;
    for _ in 0..=retry_limit {
        attempts += 1;
        if let Ok(PrivilegedBrokerResponse::ObservationResponse(response)) =
            broker.observe(observation)
        {
            return (Some(response.exact_observed_state), attempts);
        }
    }
    (None, attempts)
}

fn exact_state_is_known(state: &ExactOperationState) -> bool {
    matches!(state, ExactOperationState::ExactPowerSchemeState(_))
}

fn exact_state_matches(left: &ExactOperationState, right: &ExactOperationState) -> bool {
    match (left, right) {
        (
            ExactOperationState::ExactPowerSchemeState(left),
            ExactOperationState::ExactPowerSchemeState(right),
        ) => {
            left.scheme_id == right.scheme_id
                && left.canonical_state_hash == right.canonical_state_hash
        }
        (
            ExactOperationState::UnknownPowerSchemeState(_),
            ExactOperationState::UnknownPowerSchemeState(_),
        )
        | (
            ExactOperationState::UnavailablePowerSchemeState(_),
            ExactOperationState::UnavailablePowerSchemeState(_),
        ) => true,
        _ => false,
    }
}

fn gate_for_admission_error(code: PlanEngineErrorCode) -> MutationGateState {
    match code {
        PlanEngineErrorCode::Revoked => MutationGateState::ClosedForRevocation,
        PlanEngineErrorCode::JournalUnavailable => MutationGateState::ClosedForJournalFailure,
        PlanEngineErrorCode::RecoveryRequired | PlanEngineErrorCode::RecoveryBlocked => {
            MutationGateState::ClosedForRecovery
        }
        _ => MutationGateState::ClosedForRecovery,
    }
}

fn outcome(
    verdict: ExecutionVerdict,
    gate: MutationGateState,
    next_safe_action: NextSafeAction,
    durable_sequences: Vec<u32>,
    dispatch_count: u32,
    read_attempts: u32,
    receipt_stored: bool,
    observed_state: Option<ExactOperationState>,
) -> ExecutionOutcome {
    ExecutionOutcome {
        verdict,
        gate,
        next_safe_action,
        durable_sequences,
        dispatch_count,
        read_attempts,
        receipt_stored,
        observed_state,
    }
}

fn journal_failure(
    durable_sequences: Vec<u32>,
    dispatch_count: u32,
    read_attempts: u32,
    observed_state: Option<ExactOperationState>,
) -> ExecutionOutcome {
    outcome(
        ExecutionVerdict::JournalFailure,
        MutationGateState::ClosedForJournalFailure,
        NextSafeAction::ReconcilePendingTransaction,
        durable_sequences,
        dispatch_count,
        read_attempts,
        false,
        observed_state,
    )
}

struct EventMetadata<'a> {
    transaction_id: &'a TransactionIdentifier,
    operation_version_id: &'a TransactionIdentifier,
    sequence: u32,
    previous_hash: &'a TransactionHash,
    hash: &'a TransactionHash,
}

fn event_metadata(event: &DurableJournalEvent) -> EventMetadata<'_> {
    macro_rules! metadata {
        ($value:expr) => {
            EventMetadata {
                transaction_id: &$value.transaction_id,
                operation_version_id: &$value.operation_version_id,
                sequence: $value.sequence,
                previous_hash: &$value.previous_event_hash,
                hash: &$value.event_hash,
            }
        };
    }
    match event {
        DurableJournalEvent::PreparedJournalEvent(value) => metadata!(value),
        DurableJournalEvent::DispatchReturnedJournalEvent(value) => metadata!(value),
        DurableJournalEvent::ObservedJournalEvent(value) => metadata!(value),
        DurableJournalEvent::VerifiedJournalEvent(value) => metadata!(value),
        DurableJournalEvent::NotAppliedJournalEvent(value) => metadata!(value),
        DurableJournalEvent::UnknownJournalEvent(value) => metadata!(value),
        DurableJournalEvent::DriftJournalEvent(value) => metadata!(value),
        DurableJournalEvent::ConflictJournalEvent(value) => metadata!(value),
        DurableJournalEvent::RestorePreparedJournalEvent(value) => metadata!(value),
        DurableJournalEvent::RestoredJournalEvent(value) => metadata!(value),
    }
}

fn event_hash(event: &DurableJournalEvent) -> &TransactionHash {
    event_metadata(event).hash
}

fn event_observed_state(event: &DurableJournalEvent) -> Option<&ExactOperationState> {
    match event {
        DurableJournalEvent::ObservedJournalEvent(value) => Some(&value.exact_observed_state),
        DurableJournalEvent::VerifiedJournalEvent(value) => Some(&value.exact_observed_state),
        DurableJournalEvent::NotAppliedJournalEvent(value) => Some(&value.exact_observed_state),
        DurableJournalEvent::UnknownJournalEvent(value) => Some(&value.exact_observed_state),
        DurableJournalEvent::DriftJournalEvent(value) => Some(&value.exact_observed_state),
        DurableJournalEvent::ConflictJournalEvent(value) => Some(&value.exact_observed_state),
        DurableJournalEvent::RestoredJournalEvent(value) => Some(&value.exact_observed_state),
        _ => None,
    }
}

fn invalid_artifact(operation_version_id: &TransactionIdentifier) -> PlanEngineError {
    PlanEngineError::new(
        PlanEngineErrorCode::InvalidGeneratedTransport,
        Some(operation_version_id.clone()),
    )
}

fn validate_event_identity(
    request: &ExecutionRequest,
    event: &DurableJournalEvent,
) -> PlanEngineResult<()> {
    let metadata = event_metadata(event);
    if metadata.transaction_id != &request.transaction.transaction_id
        || metadata.operation_version_id != &request.operation_version_id
    {
        return Err(invalid_artifact(&request.operation_version_id));
    }
    Ok(())
}

fn validate_request_artifacts(request: &ExecutionRequest) -> PlanEngineResult<()> {
    validate_transaction_intent(request)?;
    match (&request.operation, &request.artifacts.prepared) {
        (ExecutionOperation::Apply, DurableJournalEvent::PreparedJournalEvent(event))
            if exact_state_matches(&event.exact_prior_state, &request.exact_prior_state)
                && exact_state_matches(
                    &event.exact_requested_state,
                    &request.exact_requested_state,
                ) => {}
        (ExecutionOperation::Restore, DurableJournalEvent::RestorePreparedJournalEvent(event))
            if exact_state_matches(&event.exact_applied_state, &request.exact_prior_state)
                && exact_state_matches(
                    &event.exact_restore_target_state,
                    &request.exact_requested_state,
                ) => {}
        _ => return Err(invalid_artifact(&request.operation_version_id)),
    }
    validate_event_identity(request, &request.artifacts.prepared)?;
    let prepared = event_metadata(&request.artifacts.prepared);
    if prepared.sequence != 0 || prepared.previous_hash != &request.expected_head_hash {
        return Err(invalid_artifact(&request.operation_version_id));
    }
    let mut expected_sequence = 1;
    let mut expected_head = prepared.hash;
    if let Some(dispatch) = request.artifacts.dispatch_returned.as_ref() {
        validate_event_identity(request, dispatch)?;
        let metadata = event_metadata(dispatch);
        if metadata.sequence != expected_sequence || metadata.previous_hash != expected_head {
            return Err(invalid_artifact(&request.operation_version_id));
        }
        expected_sequence += 1;
        expected_head = metadata.hash;
    }
    validate_event_identity(request, &request.artifacts.observed)?;
    let observed = event_metadata(&request.artifacts.observed);
    if observed.sequence != expected_sequence || observed.previous_hash != expected_head {
        return Err(invalid_artifact(&request.operation_version_id));
    }
    expected_sequence += 1;
    expected_head = observed.hash;
    for verdict in [
        &request.artifacts.verified,
        &request.artifacts.not_applied,
        &request.artifacts.unknown,
        &request.artifacts.drift,
        &request.artifacts.conflict,
        &request.artifacts.restored,
    ] {
        validate_event_identity(request, verdict)?;
        let metadata = event_metadata(verdict);
        if metadata.sequence != expected_sequence || metadata.previous_hash != expected_head {
            return Err(invalid_artifact(&request.operation_version_id));
        }
    }
    Ok(())
}

fn validate_transaction_intent(request: &ExecutionRequest) -> PlanEngineResult<()> {
    use liiiraa_contracts_rust::TransactionIntent;
    let valid = match (request.operation, request.transaction.intent) {
        (ExecutionOperation::Apply, TransactionIntent::Apply) => {
            request.transaction.parent_transaction_id.is_none()
        }
        (ExecutionOperation::Apply, TransactionIntent::RetryAfterObservation) => {
            request.transaction.parent_transaction_id.is_some()
        }
        (
            ExecutionOperation::Restore,
            TransactionIntent::RestoreOperation
            | TransactionIntent::RestorePlan
            | TransactionIntent::RestoreCheckpoint,
        ) => true,
        _ => false,
    };
    if !valid {
        return Err(invalid_artifact(&request.operation_version_id));
    }
    Ok(())
}

fn validate_recovery_artifacts(
    request: &ExecutionRequest,
    latest_event: &DurableJournalEvent,
) -> PlanEngineResult<()> {
    validate_event_identity(request, latest_event)?;
    validate_event_identity(request, &request.artifacts.observed)?;
    let latest = event_metadata(latest_event);
    let observed = event_metadata(&request.artifacts.observed);
    if observed.sequence != latest.sequence + 1 || observed.previous_hash != latest.hash {
        return Err(invalid_artifact(&request.operation_version_id));
    }
    let expected_sequence = observed.sequence + 1;
    for verdict in [
        &request.artifacts.verified,
        &request.artifacts.not_applied,
        &request.artifacts.unknown,
        &request.artifacts.drift,
        &request.artifacts.conflict,
        &request.artifacts.restored,
    ] {
        validate_event_identity(request, verdict)?;
        let metadata = event_metadata(verdict);
        if metadata.sequence != expected_sequence || metadata.previous_hash != observed.hash {
            return Err(invalid_artifact(&request.operation_version_id));
        }
    }
    Ok(())
}

fn append_next<J: DurableJournalPort>(
    journal: &mut J,
    transaction: &PreparedTransactionIdentity,
    event: &DurableJournalEvent,
    current_head: &mut TransactionHash,
    sequences: &mut Vec<u32>,
) -> PlanEngineResult<()> {
    let metadata = event_metadata(event);
    let expected_sequence = sequences.last().map_or(0, |value| value + 1);
    if metadata.sequence != expected_sequence || metadata.previous_hash != current_head {
        return Err(PlanEngineError::new(
            PlanEngineErrorCode::InvalidGeneratedTransport,
            Some(metadata.operation_version_id.clone()),
        ));
    }
    let next_head = journal.append(JournalAppend {
        transaction,
        expected_head_hash: current_head,
        event,
    })?;
    if &next_head != metadata.hash {
        return Err(PlanEngineError::new(
            PlanEngineErrorCode::JournalUnavailable,
            Some(metadata.operation_version_id.clone()),
        ));
    }
    *current_head = next_head;
    sequences.push(metadata.sequence);
    Ok(())
}

fn verdict_projection<'a>(
    request: &'a ExecutionRequest,
    decision: &ReconcileDecision,
) -> (
    ExecutionVerdict,
    MutationGateState,
    NextSafeAction,
    &'a DurableJournalEvent,
) {
    match decision.kind() {
        ReconcileDecisionKind::AppliedNeedsReceipt => (
            ExecutionVerdict::Verified,
            MutationGateState::Open,
            NextSafeAction::None,
            &request.artifacts.verified,
        ),
        ReconcileDecisionKind::RestoredNeedsReceipt => (
            ExecutionVerdict::Restored,
            MutationGateState::Open,
            NextSafeAction::None,
            &request.artifacts.restored,
        ),
        ReconcileDecisionKind::NotAppliedDoNotRetry => (
            ExecutionVerdict::NotApplied,
            MutationGateState::ClosedForRecovery,
            NextSafeAction::GuidedRecovery,
            &request.artifacts.not_applied,
        ),
        ReconcileDecisionKind::NotRestoredDoNotRetry => (
            ExecutionVerdict::NotRestored,
            MutationGateState::ClosedForRecovery,
            NextSafeAction::GuidedRecovery,
            &request.artifacts.not_applied,
        ),
        ReconcileDecisionKind::UnknownBlockMutations => (
            ExecutionVerdict::Unknown,
            MutationGateState::ClosedForUnknownState,
            NextSafeAction::GuidedRecovery,
            &request.artifacts.unknown,
        ),
        ReconcileDecisionKind::DriftRequiresUserChoice => (
            ExecutionVerdict::Drift,
            MutationGateState::ClosedForConflict,
            NextSafeAction::ReviewDrift,
            &request.artifacts.drift,
        ),
        ReconcileDecisionKind::ConflictRequiresUserChoice => (
            ExecutionVerdict::Conflict,
            MutationGateState::ClosedForConflict,
            NextSafeAction::ReviewConflict,
            &request.artifacts.conflict,
        ),
    }
}

fn validate_receipt(
    request: &ExecutionRequest,
    observed: &ExactOperationState,
    journal_head: &TransactionHash,
) -> PlanEngineResult<()> {
    let receipt = &request.artifacts.receipt;
    if receipt.transaction_id != request.transaction.transaction_id
        || receipt.plan_id != request.transaction.plan_id
        || receipt.operation_version_id != request.operation_version_id
        || receipt.journal_head_hash != *journal_head
        || !exact_state_matches(&receipt.exact_prior_state, &request.exact_prior_state)
        || !exact_state_matches(
            &receipt.exact_requested_state,
            &request.exact_requested_state,
        )
        || !exact_state_matches(&receipt.exact_observed_state, observed)
        || !exact_state_matches(&receipt.verification.exact_observed_state, observed)
    {
        return Err(invalid_artifact(&request.operation_version_id));
    }
    Ok(())
}
