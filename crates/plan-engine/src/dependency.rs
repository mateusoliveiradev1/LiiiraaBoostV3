//! Dependency DAG and dependency-scoped rollback interfaces.

use liiiraa_contracts_rust::{DependencyGroup, ExactOperationState, TransactionIdentifier};

use crate::domain::PlanEngineResult;

/// A validated acyclic dependency graph backed by generated groups.
#[derive(Clone, Debug)]
pub struct DependencyDag(Vec<DependencyGroup>);

impl DependencyDag {
    pub(crate) const fn from_groups(groups: Vec<DependencyGroup>) -> Self {
        Self(groups)
    }

    pub fn groups(&self) -> &[DependencyGroup] {
        &self.0
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
    pub(crate) const fn from_parts(
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
    restore_in_order: Vec<RestoreTarget>,
    preserve_operation_version_ids: Vec<TransactionIdentifier>,
}

impl RollbackDecision {
    pub(crate) const fn from_parts(
        restore_in_order: Vec<RestoreTarget>,
        preserve_operation_version_ids: Vec<TransactionIdentifier>,
    ) -> Self {
        Self {
            restore_in_order,
            preserve_operation_version_ids,
        }
    }

    pub fn restore_in_order(&self) -> &[RestoreTarget] {
        &self.restore_in_order
    }

    pub fn preserve_operation_version_ids(&self) -> &[TransactionIdentifier] {
        &self.preserve_operation_version_ids
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
