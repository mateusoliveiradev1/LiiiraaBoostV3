//! Shared closed vocabulary for the pure plan and recovery domain.
//!
//! Renderer data enters this crate only as [`RendererPlanIntent`]. Generated
//! contract documents become authoritative only after a domain policy returns
//! one of the private-field wrappers exported by the other modules.

use liiiraa_contracts_rust::{
    ActivateManagedPowerSchemeRequest, DeleteOwnedPowerSchemeRequest,
    DuplicateManagedPowerSchemeRequest, ExactOperationState, ObservePowerSchemeRequest,
    PlanTransactionDocument, PrepareRestorePointRequest, TransactionIdentifier,
};

use crate::risk::RiskCeiling;

/// Result returned by plan-engine policies and ports.
pub type PlanEngineResult<T> = Result<T, PlanEngineError>;

/// Read-only access to a generated transport backing a domain value.
///
/// The trait deliberately exposes no mutable or consuming accessor. Callers may
/// serialize or inspect accepted authority without editing it in place.
pub trait GeneratedTransport<T> {
    fn transport(&self) -> &T;
}

/// The only plan-composition data accepted directly from the renderer.
///
/// Technical risk, compatibility, evidence quality, authentication, and success
/// are intentionally absent. The renderer may select operations and cap risk;
/// it cannot make an authority claim.
#[derive(Clone, Debug)]
pub struct RendererPlanIntent {
    operation_version_ids: Vec<TransactionIdentifier>,
    risk_ceiling: RiskCeiling,
}

impl RendererPlanIntent {
    pub fn new(
        operation_version_ids: Vec<TransactionIdentifier>,
        risk_ceiling: RiskCeiling,
    ) -> Self {
        Self {
            operation_version_ids,
            risk_ceiling,
        }
    }

    pub fn operation_version_ids(&self) -> &[TransactionIdentifier] {
        &self.operation_version_ids
    }

    pub const fn risk_ceiling(&self) -> RiskCeiling {
        self.risk_ceiling
    }
}

/// A transaction identity that the journal has durably prepared.
///
/// Construction is crate-private so an external adapter cannot turn an
/// uncommitted transaction document into mutation authority.
#[derive(Clone, Debug)]
pub struct PreparedTransactionIdentity(PlanTransactionDocument);

impl PreparedTransactionIdentity {
    pub(crate) const fn from_transport(transport: PlanTransactionDocument) -> Self {
        Self(transport)
    }
}

impl GeneratedTransport<PlanTransactionDocument> for PreparedTransactionIdentity {
    fn transport(&self) -> &PlanTransactionDocument {
        &self.0
    }
}

/// The only broker read command available to the plan engine.
#[derive(Clone, Debug)]
pub enum BrokerObservationCommand {
    ObservePowerScheme(ObservePowerSchemeRequest),
}

/// The complete allowlist of privileged broker mutation commands.
///
/// There is deliberately no string command, script, registry, file, service,
/// or generic JSON variant.
#[derive(Clone, Debug)]
pub enum BrokerMutationCommand {
    DuplicateManagedPowerScheme(DuplicateManagedPowerSchemeRequest),
    ActivateManagedPowerScheme(ActivateManagedPowerSchemeRequest),
    DeleteOwnedPowerScheme(DeleteOwnedPowerSchemeRequest),
    PrepareRestorePoint(PrepareRestorePointRequest),
}

/// Observation request bound to a prepared transaction and expected prior state.
#[derive(Clone, Debug)]
pub struct PreparedObservation {
    transaction: PreparedTransactionIdentity,
    operation_version_id: TransactionIdentifier,
    expected_prior_state: ExactOperationState,
    command: BrokerObservationCommand,
}

impl PreparedObservation {
    pub(crate) const fn from_parts(
        transaction: PreparedTransactionIdentity,
        operation_version_id: TransactionIdentifier,
        expected_prior_state: ExactOperationState,
        command: BrokerObservationCommand,
    ) -> Self {
        Self {
            transaction,
            operation_version_id,
            expected_prior_state,
            command,
        }
    }

    pub const fn transaction(&self) -> &PreparedTransactionIdentity {
        &self.transaction
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn expected_prior_state(&self) -> &ExactOperationState {
        &self.expected_prior_state
    }

    pub const fn command(&self) -> &BrokerObservationCommand {
        &self.command
    }
}

/// Mutation request bound to durable intent, exact precondition, and target state.
#[derive(Clone, Debug)]
pub struct PreparedMutation {
    transaction: PreparedTransactionIdentity,
    operation_version_id: TransactionIdentifier,
    expected_prior_state: ExactOperationState,
    requested_state: ExactOperationState,
    command: BrokerMutationCommand,
}

impl PreparedMutation {
    pub(crate) const fn from_parts(
        transaction: PreparedTransactionIdentity,
        operation_version_id: TransactionIdentifier,
        expected_prior_state: ExactOperationState,
        requested_state: ExactOperationState,
        command: BrokerMutationCommand,
    ) -> Self {
        Self {
            transaction,
            operation_version_id,
            expected_prior_state,
            requested_state,
            command,
        }
    }

    pub const fn transaction(&self) -> &PreparedTransactionIdentity {
        &self.transaction
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn expected_prior_state(&self) -> &ExactOperationState {
        &self.expected_prior_state
    }

    pub const fn requested_state(&self) -> &ExactOperationState {
        &self.requested_state
    }

    pub const fn command(&self) -> &BrokerMutationCommand {
        &self.command
    }
}

/// Stable fail-closed error categories shared by policy implementations.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlanEngineErrorCode {
    InvalidGeneratedTransport,
    UnknownOperationVersion,
    EvidenceNotAdmitted,
    RiskCeilingExceeded,
    ExtremeLocked,
    ApprovalRequired,
    ApprovalStale,
    DependencyGraphInvalid,
    RecoveryRequired,
    RecoveryBlocked,
    PromotionBlocked,
    Revoked,
    JournalUnavailable,
    BrokerRejected,
    BrokerUnavailable,
    StrongAuthenticationRejected,
    MutationGateClosed,
}

/// Bounded error projection. It carries identifiers and stable codes, never raw
/// evidence, credentials, broker payloads, or diagnostic contents.
#[derive(Clone, Debug)]
pub struct PlanEngineError {
    code: PlanEngineErrorCode,
    subject_id: Option<TransactionIdentifier>,
}

impl PlanEngineError {
    pub const fn code(&self) -> PlanEngineErrorCode {
        self.code
    }

    pub const fn subject_id(&self) -> Option<&TransactionIdentifier> {
        self.subject_id.as_ref()
    }

    pub(crate) const fn new(
        code: PlanEngineErrorCode,
        subject_id: Option<TransactionIdentifier>,
    ) -> Self {
        Self { code, subject_id }
    }
}
