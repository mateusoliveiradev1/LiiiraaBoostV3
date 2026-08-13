//! Dependency DAG and dependency-scoped rollback interfaces.

use liiiraa_contracts_rust::{DependencyGroup, ExactOperationState, TransactionIdentifier};

use crate::domain::PlanEngineResult;

/// A validated acyclic dependency graph backed by generated groups.
#[derive(Clone, Debug)]
pub struct DependencyDag {
    groups: Vec<DependencyGroup>,
    group_apply_order: Vec<TransactionIdentifier>,
    operation_apply_order: Vec<TransactionIdentifier>,
}

impl DependencyDag {
    pub(crate) const fn from_parts(
        groups: Vec<DependencyGroup>,
        group_apply_order: Vec<TransactionIdentifier>,
        operation_apply_order: Vec<TransactionIdentifier>,
    ) -> Self {
        Self {
            groups,
            group_apply_order,
            operation_apply_order,
        }
    }

    pub fn groups(&self) -> &[DependencyGroup] {
        &self.groups
    }

    pub fn group_apply_order(&self) -> &[TransactionIdentifier] {
        &self.group_apply_order
    }

    pub fn operation_apply_order(&self) -> &[TransactionIdentifier] {
        &self.operation_apply_order
    }
}

/// Invalid graph states rejected before plan composition.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DependencyGraphError {
    Empty,
    DuplicateGroup,
    DuplicateOperation,
    MissingDependency,
    SelfDependency,
    Cycle,
    UnknownOperation,
}

/// An operation proven applied and verified before a later failure.
#[derive(Clone, Debug)]
pub struct VerifiedAppliedOperation {
    operation_version_id: TransactionIdentifier,
    dependency_group_id: TransactionIdentifier,
    exact_applied_state: ExactOperationState,
    exact_restore_state: ExactOperationState,
}

impl VerifiedAppliedOperation {
    pub const fn new(
        operation_version_id: TransactionIdentifier,
        dependency_group_id: TransactionIdentifier,
        exact_applied_state: ExactOperationState,
        exact_restore_state: ExactOperationState,
    ) -> Self {
        Self {
            operation_version_id,
            dependency_group_id,
            exact_applied_state,
            exact_restore_state,
        }
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn dependency_group_id(&self) -> &TransactionIdentifier {
        &self.dependency_group_id
    }

    pub const fn exact_applied_state(&self) -> &ExactOperationState {
        &self.exact_applied_state
    }

    pub const fn exact_restore_state(&self) -> &ExactOperationState {
        &self.exact_restore_state
    }
}

/// Exact restore target emitted only for the failed dependency closure.
#[derive(Clone, Debug)]
pub struct RestoreTarget {
    operation_version_id: TransactionIdentifier,
    dependency_group_id: TransactionIdentifier,
    expected_applied_state: ExactOperationState,
    restore_state: ExactOperationState,
}

impl RestoreTarget {
    pub(crate) fn from_verified(operation: VerifiedAppliedOperation) -> Self {
        Self {
            operation_version_id: operation.operation_version_id,
            dependency_group_id: operation.dependency_group_id,
            expected_applied_state: operation.exact_applied_state,
            restore_state: operation.exact_restore_state,
        }
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn dependency_group_id(&self) -> &TransactionIdentifier {
        &self.dependency_group_id
    }

    pub const fn expected_applied_state(&self) -> &ExactOperationState {
        &self.expected_applied_state
    }

    pub const fn restore_state(&self) -> &ExactOperationState {
        &self.restore_state
    }
}

/// Dependency-scoped result: affected operations restore in reverse topological
/// order while independent verified operations are explicitly preserved.
#[derive(Clone, Debug)]
pub struct RollbackDecision {
    failed_operation_version_id: TransactionIdentifier,
    affected_dependency_group_ids: Vec<TransactionIdentifier>,
    restore_in_order: Vec<RestoreTarget>,
    preserve_operation_version_ids: Vec<TransactionIdentifier>,
    blocking_verdict: MutationBlockingVerdict,
    restore_failure_operation_version_id: Option<TransactionIdentifier>,
}

impl RollbackDecision {
    pub(crate) const fn from_parts(
        failed_operation_version_id: TransactionIdentifier,
        affected_dependency_group_ids: Vec<TransactionIdentifier>,
        restore_in_order: Vec<RestoreTarget>,
        preserve_operation_version_ids: Vec<TransactionIdentifier>,
        blocking_verdict: MutationBlockingVerdict,
    ) -> Self {
        Self {
            failed_operation_version_id,
            affected_dependency_group_ids,
            restore_in_order,
            preserve_operation_version_ids,
            blocking_verdict,
            restore_failure_operation_version_id: None,
        }
    }

    pub const fn failed_operation_version_id(&self) -> &TransactionIdentifier {
        &self.failed_operation_version_id
    }

    pub fn affected_dependency_group_ids(&self) -> &[TransactionIdentifier] {
        &self.affected_dependency_group_ids
    }

    pub fn restore_in_order(&self) -> &[RestoreTarget] {
        &self.restore_in_order
    }

    pub fn preserve_operation_version_ids(&self) -> &[TransactionIdentifier] {
        &self.preserve_operation_version_ids
    }

    pub const fn blocking_verdict(&self) -> MutationBlockingVerdict {
        self.blocking_verdict
    }

    pub const fn restore_failure_operation_version_id(&self) -> Option<&TransactionIdentifier> {
        self.restore_failure_operation_version_id.as_ref()
    }

    pub fn with_restore_failure(
        &self,
        operation_version_id: &TransactionIdentifier,
    ) -> PlanEngineResult<Self> {
        let _ = operation_version_id;
        Err(crate::domain::PlanEngineError::new(
            crate::domain::PlanEngineErrorCode::RecoveryBlocked,
            None,
        ))
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MutationBlockingVerdict {
    AffectedClosurePending,
    GuidedRecoveryRequired,
}

#[derive(Clone, Debug)]
pub struct SafeBoundaryCancellation {
    finish_in_flight_operation_version_id: Option<TransactionIdentifier>,
    preserve_operation_version_ids: Vec<TransactionIdentifier>,
}

impl SafeBoundaryCancellation {
    pub const fn finish_in_flight_operation_version_id(&self) -> Option<&TransactionIdentifier> {
        self.finish_in_flight_operation_version_id.as_ref()
    }

    pub fn preserve_operation_version_ids(&self) -> &[TransactionIdentifier] {
        &self.preserve_operation_version_ids
    }

    pub const fn blocks_new_operations(&self) -> bool {
        true
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct DeterministicDependencyPolicy;

impl DeterministicDependencyPolicy {
    pub fn safe_boundary_cancellation(
        &self,
        _graph: &DependencyDag,
        _in_flight_operation_version_id: Option<&TransactionIdentifier>,
        _applied: &[VerifiedAppliedOperation],
    ) -> PlanEngineResult<SafeBoundaryCancellation> {
        Err(crate::domain::PlanEngineError::new(
            crate::domain::PlanEngineErrorCode::RecoveryBlocked,
            None,
        ))
    }
}

pub trait DependencyPolicy {
    fn validate(&self, groups: Vec<DependencyGroup>)
    -> Result<DependencyDag, DependencyGraphError>;

    fn rollback_after_failure(
        &self,
        graph: &DependencyDag,
        failed_operation_version_id: &TransactionIdentifier,
        applied: &[VerifiedAppliedOperation],
    ) -> PlanEngineResult<RollbackDecision>;
}

impl DependencyPolicy for DeterministicDependencyPolicy {
    fn validate(
        &self,
        _groups: Vec<DependencyGroup>,
    ) -> Result<DependencyDag, DependencyGraphError> {
        Err(DependencyGraphError::Empty)
    }

    fn rollback_after_failure(
        &self,
        _graph: &DependencyDag,
        failed_operation_version_id: &TransactionIdentifier,
        _applied: &[VerifiedAppliedOperation],
    ) -> PlanEngineResult<RollbackDecision> {
        Err(crate::domain::PlanEngineError::new(
            crate::domain::PlanEngineErrorCode::RecoveryBlocked,
            Some(failed_operation_version_id.clone()),
        ))
    }
}
