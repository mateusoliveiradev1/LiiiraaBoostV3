use liiiraa_contracts_rust::{DependencyGroup, ExactOperationState, TransactionIdentifier};
use liiiraa_plan_engine::dependency::{
    DependencyGraphError, DependencyPolicy, DeterministicDependencyPolicy, MutationBlockingVerdict,
    VerifiedAppliedOperation,
};
use liiiraa_plan_engine::domain::PlanEngineErrorCode;
use proptest::prelude::*;
use proptest::test_runner::RngSeed;
use serde_json::{Value, json};

fn parse<T: serde::de::DeserializeOwned>(value: Value) -> T {
    serde_json::from_value(value).expect("fixture must match the generated contract")
}

fn id(value: &str) -> TransactionIdentifier {
    value.parse().expect("bounded identifier")
}

fn group(id: &str, operations: &[&str], dependencies: &[&str]) -> DependencyGroup {
    DependencyGroup {
        dependency_group_id: self::id(id),
        depends_on_group_ids: dependencies.iter().map(|value| self::id(value)).collect(),
        operation_version_ids: operations.iter().map(|value| self::id(value)).collect(),
    }
}

fn state(scheme: &str, hash_character: char) -> ExactOperationState {
    parse(json!({
        "state": "observed",
        "schemeId": scheme,
        "canonicalStateHash": format!("sha256:{}", hash_character.to_string().repeat(64)),
        "observedAt": "2026-08-13T12:00:00Z"
    }))
}

fn applied(operation: &str, group: &str, character: char) -> VerifiedAppliedOperation {
    VerifiedAppliedOperation::new(
        id(operation),
        id(group),
        state("22222222-2222-4222-8222-222222222222", character),
        state("11111111-1111-4111-8111-111111111111", character),
    )
}

fn graph_groups() -> Vec<DependencyGroup> {
    vec![
        group("group-base", &["op-base"], &[]),
        group("group-tuning", &["op-tuning"], &["group-base"]),
        group("group-overlay", &["op-overlay"], &["group-tuning"]),
        group("group-independent", &["op-independent"], &[]),
    ]
}

fn strings(ids: &[TransactionIdentifier]) -> Vec<&str> {
    ids.iter().map(|id| id.as_str()).collect()
}

#[test]
fn valid_graph_has_deterministic_topological_apply_order() {
    let graph = DeterministicDependencyPolicy.validate(graph_groups());
    assert!(
        graph.is_ok(),
        "an acyclic graph with complete truth must validate"
    );
    let graph = graph.unwrap();
    assert_eq!(
        strings(graph.group_apply_order()),
        [
            "group-base",
            "group-independent",
            "group-tuning",
            "group-overlay"
        ]
    );
    assert_eq!(
        strings(graph.operation_apply_order()),
        ["op-base", "op-independent", "op-tuning", "op-overlay"]
    );
}

#[test]
fn cycles_and_missing_dependency_truth_fail_closed() {
    let cyclic = vec![
        group("group-a", &["op-a"], &["group-b"]),
        group("group-b", &["op-b"], &["group-a"]),
    ];
    assert!(matches!(
        DeterministicDependencyPolicy.validate(cyclic),
        Err(DependencyGraphError::Cycle)
    ));

    let missing = vec![group("group-a", &["op-a"], &["group-missing"])];
    assert!(matches!(
        DeterministicDependencyPolicy.validate(missing),
        Err(DependencyGraphError::MissingDependency)
    ));
}

#[test]
fn partial_failure_restores_only_verified_affected_closure_in_reverse_order() {
    let graph = DeterministicDependencyPolicy
        .validate(graph_groups())
        .expect("valid graph");
    let verified = vec![
        applied("op-base", "group-base", 'a'),
        applied("op-independent", "group-independent", 'i'),
        applied("op-tuning", "group-tuning", 't'),
    ];
    let decision = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-overlay"), &verified)
        .expect("known failure has a scoped rollback");

    assert_eq!(
        decision.failed_operation_version_id().as_str(),
        "op-overlay"
    );
    assert_eq!(
        strings(decision.affected_dependency_group_ids()),
        ["group-base", "group-tuning", "group-overlay"]
    );
    assert_eq!(
        decision
            .restore_in_order()
            .iter()
            .map(|target| target.operation_version_id().as_str())
            .collect::<Vec<_>>(),
        ["op-tuning", "op-base"]
    );
    assert_eq!(
        strings(decision.preserve_operation_version_ids()),
        ["op-independent"]
    );
    assert_eq!(
        decision.blocking_verdict(),
        MutationBlockingVerdict::AffectedClosurePending
    );
}

#[test]
fn flat_undo_all_is_rejected_by_preserving_independent_verified_nodes() {
    let graph = DeterministicDependencyPolicy
        .validate(graph_groups())
        .expect("valid graph");
    let verified = vec![
        applied("op-base", "group-base", 'a'),
        applied("op-tuning", "group-tuning", 't'),
        applied("op-independent", "group-independent", 'i'),
    ];
    let decision = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-overlay"), &verified)
        .expect("known failure has a scoped rollback");

    assert!(
        !decision
            .restore_in_order()
            .iter()
            .any(|target| target.operation_version_id().as_str() == "op-independent")
    );
    assert_eq!(
        strings(decision.preserve_operation_version_ids()),
        ["op-independent"]
    );
}

#[test]
fn cancellation_waits_for_the_atomic_boundary_and_stops_new_operations() {
    let graph = DeterministicDependencyPolicy
        .validate(graph_groups())
        .expect("valid graph");
    let verified = vec![
        applied("op-base", "group-base", 'a'),
        applied("op-independent", "group-independent", 'i'),
    ];
    let decision = DeterministicDependencyPolicy
        .safe_boundary_cancellation(&graph, Some(&id("op-tuning")), &verified)
        .expect("known in-flight operation reaches a safe boundary");

    assert!(decision.blocks_new_operations());
    assert_eq!(
        decision
            .finish_in_flight_operation_version_id()
            .unwrap()
            .as_str(),
        "op-tuning"
    );
    assert_eq!(
        strings(decision.preserve_operation_version_ids()),
        ["op-base", "op-independent"]
    );
}

#[test]
fn restore_failure_blocks_all_later_mutation_without_a_retry_decision() {
    let graph = DeterministicDependencyPolicy
        .validate(graph_groups())
        .expect("valid graph");
    let verified = vec![
        applied("op-base", "group-base", 'a'),
        applied("op-tuning", "group-tuning", 't'),
    ];
    let decision = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-overlay"), &verified)
        .expect("known failure has a scoped rollback");
    let blocked = decision
        .with_restore_failure(&id("op-tuning"))
        .expect("a failed planned restore must produce guided recovery truth");

    assert_eq!(
        blocked.blocking_verdict(),
        MutationBlockingVerdict::GuidedRecoveryRequired
    );
    assert_eq!(
        blocked
            .restore_failure_operation_version_id()
            .unwrap()
            .as_str(),
        "op-tuning"
    );
}

#[test]
fn disconnected_dependency_groups_remain_verified_and_active() {
    let graph = DeterministicDependencyPolicy
        .validate(vec![
            group("group-a", &["op-a"], &[]),
            group("group-b", &["op-b"], &["group-a"]),
            group("group-c", &["op-c"], &[]),
            group("group-d", &["op-d"], &["group-c"]),
        ])
        .expect("two disconnected components are a valid DAG");
    let verified = vec![
        applied("op-a", "group-a", 'a'),
        applied("op-c", "group-c", 'c'),
        applied("op-d", "group-d", 'd'),
    ];
    let decision = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-b"), &verified)
        .expect("failure remains within one connected component");

    assert_eq!(
        decision
            .restore_in_order()
            .iter()
            .map(|target| target.operation_version_id().as_str())
            .collect::<Vec<_>>(),
        ["op-a"]
    );
    assert_eq!(
        strings(decision.preserve_operation_version_ids()),
        ["op-c", "op-d"]
    );
}

#[test]
fn unknown_or_misassigned_applied_truth_blocks_recovery_planning() {
    let graph = DeterministicDependencyPolicy
        .validate(graph_groups())
        .expect("valid graph");
    let unknown = [applied("op-unknown", "group-base", 'u')];
    let error = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-overlay"), &unknown)
        .expect_err("unknown applied truth must fail closed");
    assert_eq!(error.code(), PlanEngineErrorCode::UnknownOperationVersion);

    let wrong_group = [applied("op-base", "group-independent", 'w')];
    let error = DeterministicDependencyPolicy
        .rollback_after_failure(&graph, &id("op-overlay"), &wrong_group)
        .expect_err("misassigned applied truth must fail closed");
    assert_eq!(error.code(), PlanEngineErrorCode::RecoveryBlocked);
}

#[test]
fn cancellation_without_an_atomic_mutation_preserves_verified_truth() {
    let graph = DeterministicDependencyPolicy
        .validate(graph_groups())
        .expect("valid graph");
    let verified = vec![
        applied("op-base", "group-base", 'a'),
        applied("op-independent", "group-independent", 'i'),
    ];
    let cancellation = DeterministicDependencyPolicy
        .safe_boundary_cancellation(&graph, None, &verified)
        .expect("idle cancellation is already at a safe boundary");

    assert!(cancellation.blocks_new_operations());
    assert!(
        cancellation
            .finish_in_flight_operation_version_id()
            .is_none()
    );
    assert_eq!(
        strings(cancellation.preserve_operation_version_ids()),
        ["op-base", "op-independent"]
    );
}

fn generated_dag(group_count: usize, dense: bool) -> Vec<DependencyGroup> {
    (0..group_count)
        .map(|index| {
            let group_id = format!("group-{index:02}");
            let operation_id = format!("op-{index:02}");
            let dependencies: Vec<_> = if index == 0 {
                Vec::new()
            } else if dense {
                (0..index)
                    .map(|dependency| format!("group-{dependency:02}"))
                    .collect()
            } else {
                vec![format!("group-{:02}", index - 1)]
            };
            DependencyGroup {
                dependency_group_id: id(&group_id),
                depends_on_group_ids: dependencies.iter().map(|value| id(value)).collect(),
                operation_version_ids: vec![id(&operation_id)],
            }
        })
        .collect()
}

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 32,
        failure_persistence: None,
        rng_seed: RngSeed::Fixed(0x0607_D017),
        ..ProptestConfig::default()
    })]

    #[test]
    fn dag_input_permutations_preserve_identical_closure_and_restore_order(
        reverse_groups in any::<bool>(),
        reverse_dependencies in any::<bool>(),
        reverse_applied in any::<bool>(),
    ) {
        let baseline_graph = DeterministicDependencyPolicy
            .validate(graph_groups())
            .expect("baseline graph validates");
        let baseline_applied = vec![
            applied("op-base", "group-base", 'a'),
            applied("op-tuning", "group-tuning", 't'),
            applied("op-independent", "group-independent", 'i'),
        ];
        let baseline = DeterministicDependencyPolicy
            .rollback_after_failure(&baseline_graph, &id("op-overlay"), &baseline_applied)
            .expect("baseline rollback plans");

        let mut groups = graph_groups();
        if reverse_groups {
            groups.reverse();
        }
        if reverse_dependencies {
            for group in &mut groups {
                group.depends_on_group_ids.reverse();
            }
        }
        let mut applied_operations = baseline_applied;
        if reverse_applied {
            applied_operations.reverse();
        }
        let permuted_graph = DeterministicDependencyPolicy
            .validate(groups)
            .expect("permuted graph validates");
        let permuted = DeterministicDependencyPolicy
            .rollback_after_failure(&permuted_graph, &id("op-overlay"), &applied_operations)
            .expect("permuted rollback plans");

        prop_assert_eq!(
            strings(permuted.affected_dependency_group_ids()),
            strings(baseline.affected_dependency_group_ids()),
            "D-17 affected closure drifted under input permutation"
        );
        prop_assert_eq!(
            permuted.restore_in_order().iter().map(|target| target.operation_version_id().as_str()).collect::<Vec<_>>(),
            baseline.restore_in_order().iter().map(|target| target.operation_version_id().as_str()).collect::<Vec<_>>(),
            "D-17 reverse-topological restore order drifted under input permutation"
        );
        prop_assert_eq!(
            strings(permuted.preserve_operation_version_ids()),
            strings(baseline.preserve_operation_version_ids()),
            "D-17 independent preservation drifted under input permutation"
        );
    }


    #[test]
    fn sparse_and_dense_dags_restore_no_node_outside_the_failed_closure(
        group_count in 2_usize..10,
        dense in any::<bool>(),
    ) {
        let graph = DeterministicDependencyPolicy
            .validate(generated_dag(group_count, dense))
            .expect("generated forward-only graph is acyclic");
        let applied_operations: Vec<_> = (0..group_count - 1)
            .map(|index| {
                applied(
                    &format!("op-{index:02}"),
                    &format!("group-{index:02}"),
                    char::from(b'a' + u8::try_from(index).unwrap()),
                )
            })
            .collect();
        let failed_id = id(&format!("op-{:02}", group_count - 1));
        let decision = DeterministicDependencyPolicy
            .rollback_after_failure(&graph, &failed_id, &applied_operations)
            .expect("generated failure has complete dependency truth");

        let expected: Vec<_> = (0..group_count - 1)
            .rev()
            .map(|index| format!("op-{index:02}"))
            .collect();
        let restored: Vec<_> = decision
            .restore_in_order()
            .iter()
            .map(|target| target.operation_version_id().as_str().to_owned())
            .collect();
        prop_assert_eq!(
            restored,
            expected,
            "D-17 generated restore included an unrelated node or violated reverse topology"
        );
        prop_assert!(decision.preserve_operation_version_ids().is_empty());
    }

    #[test]
    fn every_generated_back_edge_cycle_is_rejected(
        group_count in 2_usize..10,
    ) {
        let mut groups = generated_dag(group_count, false);
        groups[0]
            .depends_on_group_ids
            .push(id(&format!("group-{:02}", group_count - 1)));
        prop_assert!(matches!(
            DeterministicDependencyPolicy.validate(groups),
            Err(DependencyGraphError::Cycle)
        ));
    }
}
