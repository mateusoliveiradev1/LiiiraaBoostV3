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
pub enum RecoveryLoad {
    Clear,
    Pending {
        transaction: PreparedTransactionIdentity,
        latest_event: DurableJournalEvent,
    },
    CorruptOrUnavailable,
}

/// Append-oriented journal and immutable receipt/checkpoint authority.
pub trait DurableJournalPort {
    fn prepare(
        &mut self,
        transaction: &PlanTransactionDocument,
        prepared_event: &DurableJournalEvent,
    ) -> PlanEngineResult<PreparedTransactionIdentity>;

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
