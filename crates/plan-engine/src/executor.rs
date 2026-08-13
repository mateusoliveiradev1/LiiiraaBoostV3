//! Durable executor, narrow effect ports, and restart/cancellation boundaries.

use liiiraa_contracts_rust::{
    ActionProofReference, DurableJournalEvent, ExactOperationState, PlanApprovalDocument,
    PlanTransactionDocument, PrivilegedBrokerResponse, ProgressEventDocument,
    ProgressSnapshotDocument, RecoveryCheckpointDocument, TransactionHash, TransactionIdentifier,
    TransactionReceiptDocument,
};

use crate::domain::{
    GeneratedTransport, PlanEngineResult, PreparedMutation, PreparedObservation,
    PreparedTransactionIdentity,
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
        _request: &ExecutionRequest,
        _journal: &mut J,
        _broker: &mut B,
        _admission: &A,
    ) -> PlanEngineResult<ExecutionOutcome>
    where
        J: DurableJournalPort,
        B: PrivilegedBrokerPort,
        A: ExecutionAdmissionPort,
    {
        Err(crate::domain::PlanEngineError::new(
            crate::domain::PlanEngineErrorCode::JournalUnavailable,
            None,
        ))
    }
}
