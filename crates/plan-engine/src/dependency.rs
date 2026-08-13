//! Dependency DAG and dependency-scoped rollback interfaces.

use std::collections::{BTreeMap, BTreeSet};

use liiiraa_contracts_rust::{DependencyGroup, ExactOperationState, TransactionIdentifier};

use crate::domain::{PlanEngineError, PlanEngineErrorCode, PlanEngineResult};

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
        if !self
            .restore_in_order
            .iter()
            .any(|target| target.operation_version_id() == operation_version_id)
        {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::RecoveryBlocked,
                Some(operation_version_id.clone()),
            ));
        }

        let mut blocked = self.clone();
        blocked.blocking_verdict = MutationBlockingVerdict::GuidedRecoveryRequired;
        blocked.restore_failure_operation_version_id = Some(operation_version_id.clone());
        Ok(blocked)
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
        graph: &DependencyDag,
        in_flight_operation_version_id: Option<&TransactionIdentifier>,
        applied: &[VerifiedAppliedOperation],
    ) -> PlanEngineResult<SafeBoundaryCancellation> {
        if let Some(operation_version_id) = in_flight_operation_version_id
            && !graph.operation_apply_order.contains(operation_version_id)
        {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::UnknownOperationVersion,
                Some(operation_version_id.clone()),
            ));
        }

        let applied_by_id = validate_applied(graph, applied)?;
        let preserve_operation_version_ids = graph
            .operation_apply_order
            .iter()
            .filter(|operation_id| applied_by_id.contains_key(*operation_id))
            .cloned()
            .collect();

        Ok(SafeBoundaryCancellation {
            finish_in_flight_operation_version_id: in_flight_operation_version_id.cloned(),
            preserve_operation_version_ids,
        })
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
        mut groups: Vec<DependencyGroup>,
    ) -> Result<DependencyDag, DependencyGraphError> {
        if groups.is_empty() {
            return Err(DependencyGraphError::Empty);
        }

        for group in &mut groups {
            if group.operation_version_ids.is_empty() {
                return Err(DependencyGraphError::Empty);
            }
            group.depends_on_group_ids.sort();
            group.operation_version_ids.sort();
        }
        groups.sort_by(|left, right| left.dependency_group_id.cmp(&right.dependency_group_id));

        let mut group_indexes = BTreeMap::new();
        let mut operation_groups = BTreeMap::new();
        for (index, group) in groups.iter().enumerate() {
            if group_indexes
                .insert(group.dependency_group_id.clone(), index)
                .is_some()
            {
                return Err(DependencyGraphError::DuplicateGroup);
            }
            if has_adjacent_duplicate(&group.depends_on_group_ids) {
                return Err(DependencyGraphError::DuplicateGroup);
            }
            for operation_id in &group.operation_version_ids {
                if operation_groups
                    .insert(operation_id.clone(), group.dependency_group_id.clone())
                    .is_some()
                {
                    return Err(DependencyGraphError::DuplicateOperation);
                }
            }
        }

        let mut indegree = BTreeMap::new();
        let mut dependents: BTreeMap<TransactionIdentifier, BTreeSet<TransactionIdentifier>> =
            BTreeMap::new();
        for group in &groups {
            let group_id = &group.dependency_group_id;
            indegree.insert(group_id.clone(), group.depends_on_group_ids.len());
            for dependency_id in &group.depends_on_group_ids {
                if dependency_id == group_id {
                    return Err(DependencyGraphError::SelfDependency);
                }
                if !group_indexes.contains_key(dependency_id) {
                    return Err(DependencyGraphError::MissingDependency);
                }
                dependents
                    .entry(dependency_id.clone())
                    .or_default()
                    .insert(group_id.clone());
            }
        }

        let mut available: BTreeSet<_> = indegree
            .iter()
            .filter(|(_, count)| **count == 0)
            .map(|(group_id, _)| group_id.clone())
            .collect();
        let mut group_apply_order = Vec::with_capacity(groups.len());
        while let Some(group_id) = available.pop_first() {
            group_apply_order.push(group_id.clone());
            if let Some(children) = dependents.get(&group_id) {
                for child_id in children {
                    let count = indegree
                        .get_mut(child_id)
                        .expect("validated dependent has indegree");
                    *count -= 1;
                    if *count == 0 {
                        available.insert(child_id.clone());
                    }
                }
            }
        }
        if group_apply_order.len() != groups.len() {
            return Err(DependencyGraphError::Cycle);
        }

        let operation_apply_order = group_apply_order
            .iter()
            .flat_map(|group_id| {
                groups[*group_indexes.get(group_id).expect("validated group index")]
                    .operation_version_ids
                    .iter()
                    .cloned()
            })
            .collect();

        Ok(DependencyDag::from_parts(
            groups,
            group_apply_order,
            operation_apply_order,
        ))
    }

    fn rollback_after_failure(
        &self,
        graph: &DependencyDag,
        failed_operation_version_id: &TransactionIdentifier,
        applied: &[VerifiedAppliedOperation],
    ) -> PlanEngineResult<RollbackDecision> {
        let operation_groups = operation_groups(graph);
        let failed_group_id = operation_groups
            .get(failed_operation_version_id)
            .ok_or_else(|| {
                PlanEngineError::new(
                    PlanEngineErrorCode::UnknownOperationVersion,
                    Some(failed_operation_version_id.clone()),
                )
            })?;
        let groups_by_id: BTreeMap<_, _> = graph
            .groups
            .iter()
            .map(|group| (group.dependency_group_id.clone(), group))
            .collect();
        let mut affected_groups = BTreeSet::new();
        let mut pending = vec![failed_group_id.clone()];
        while let Some(group_id) = pending.pop() {
            if !affected_groups.insert(group_id.clone()) {
                continue;
            }
            let group = groups_by_id
                .get(&group_id)
                .expect("validated dependency group exists");
            pending.extend(group.depends_on_group_ids.iter().cloned());
        }

        let applied_by_id = validate_applied(graph, applied)?;
        let restore_in_order = graph
            .operation_apply_order
            .iter()
            .rev()
            .filter_map(|operation_id| {
                let operation = applied_by_id.get(operation_id)?;
                affected_groups
                    .contains(operation.dependency_group_id())
                    .then(|| RestoreTarget::from_verified((*operation).clone()))
            })
            .collect();
        let preserve_operation_version_ids = graph
            .operation_apply_order
            .iter()
            .filter(|operation_id| {
                applied_by_id.get(*operation_id).is_some_and(|operation| {
                    !affected_groups.contains(operation.dependency_group_id())
                })
            })
            .cloned()
            .collect();
        let affected_dependency_group_ids = graph
            .group_apply_order
            .iter()
            .filter(|group_id| affected_groups.contains(*group_id))
            .cloned()
            .collect();

        Ok(RollbackDecision::from_parts(
            failed_operation_version_id.clone(),
            affected_dependency_group_ids,
            restore_in_order,
            preserve_operation_version_ids,
            MutationBlockingVerdict::AffectedClosurePending,
        ))
    }
}

fn has_adjacent_duplicate(values: &[TransactionIdentifier]) -> bool {
    values.windows(2).any(|pair| pair[0] == pair[1])
}

fn operation_groups(
    graph: &DependencyDag,
) -> BTreeMap<TransactionIdentifier, TransactionIdentifier> {
    graph
        .groups
        .iter()
        .flat_map(|group| {
            group
                .operation_version_ids
                .iter()
                .cloned()
                .map(|operation_id| (operation_id, group.dependency_group_id.clone()))
        })
        .collect()
}

fn validate_applied<'a>(
    graph: &DependencyDag,
    applied: &'a [VerifiedAppliedOperation],
) -> PlanEngineResult<BTreeMap<TransactionIdentifier, &'a VerifiedAppliedOperation>> {
    let known_operations = operation_groups(graph);
    let mut applied_by_id = BTreeMap::new();
    for operation in applied {
        let operation_id = operation.operation_version_id();
        let Some(expected_group_id) = known_operations.get(operation_id) else {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::UnknownOperationVersion,
                Some(operation_id.clone()),
            ));
        };
        if expected_group_id != operation.dependency_group_id()
            || applied_by_id
                .insert(operation_id.clone(), operation)
                .is_some()
        {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::RecoveryBlocked,
                Some(operation_id.clone()),
            ));
        }
    }
    Ok(applied_by_id)
}
