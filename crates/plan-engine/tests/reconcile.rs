use liiiraa_contracts_rust::{ExactOperationState, TransactionIdentifier};
use liiiraa_plan_engine::reconcile::{
    DispatchEvidence, GuidedRecoveryChoice, ObservationFirstReconciliationPolicy,
    ReconcileDecision, ReconcileDecisionKind, ReconcileInput, ReconcileOperation,
};
use proptest::prelude::*;
use proptest::test_runner::RngSeed;
use serde_json::{Value, json};

fn parse<T: serde::de::DeserializeOwned>(value: Value) -> T {
    serde_json::from_value(value).expect("fixture must match the generated contract")
}

fn id(value: &str) -> TransactionIdentifier {
    value.parse().expect("bounded identifier")
}

fn state(scheme: &str, hash_character: char) -> ExactOperationState {
    state_at(scheme, hash_character, "2026-08-13T12:00:00Z")
}

fn state_at(scheme: &str, hash_character: char, observed_at: &str) -> ExactOperationState {
    parse(json!({
        "state": "observed",
        "schemeId": scheme,
        "canonicalStateHash": format!("sha256:{}", hash_character.to_string().repeat(64)),
        "observedAt": observed_at
    }))
}

fn unknown(reason: &str) -> ExactOperationState {
    parse(json!({
        "state": "unknown",
        "reason": reason,
        "observedAt": "2026-08-13T12:00:00Z"
    }))
}

fn unavailable(reason: &str) -> ExactOperationState {
    parse(json!({
        "state": "unavailable",
        "reason": reason,
        "observedAt": "2026-08-13T12:00:00Z"
    }))
}

fn exact_json(state: &ExactOperationState) -> Value {
    serde_json::to_value(state).expect("generated state serializes")
}

fn input<'a>(
    operation: ReconcileOperation,
    dispatch: DispatchEvidence,
    prior: &'a ExactOperationState,
    requested: &'a ExactOperationState,
    observed: &'a ExactOperationState,
) -> ReconcileInput<'a> {
    ReconcileInput {
        transaction_id: Box::leak(Box::new(id("transaction-original"))),
        operation_version_id: Box::leak(Box::new(id("operation-power-v1"))),
        exact_prior_state: prior,
        exact_requested_state: requested,
        exact_observed_state: observed,
        operation,
        dispatch,
    }
}

fn dispatch_boundaries() -> [DispatchEvidence; 6] {
    [
        DispatchEvidence::NotDispatched,
        DispatchEvidence::ReturnedSuccess,
        DispatchEvidence::ReturnedFailure,
        DispatchEvidence::TimedOut,
        DispatchEvidence::ResponseLost,
        DispatchEvidence::AbandonedMutex,
    ]
}

#[test]
fn requested_apply_observation_is_applied_and_receipt_eligible_for_every_dispatch_boundary() {
    let prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');

    for dispatch in dispatch_boundaries() {
        let decision = ObservationFirstReconciliationPolicy
            .reconcile_apply(input(
                ReconcileOperation::Apply,
                dispatch,
                &prior,
                &requested,
                &requested,
            ))
            .expect("exact apply truth reconciles");
        assert_eq!(decision.kind(), ReconcileDecisionKind::AppliedNeedsReceipt);
        assert!(decision.receipt_eligible());
        assert!(!decision.allows_automatic_retry());
        assert_eq!(decision.evidence().dispatch(), dispatch);
    }
}

#[test]
fn prior_apply_observation_is_not_applied_and_never_retried() {
    let prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');

    for dispatch in dispatch_boundaries() {
        let decision = ObservationFirstReconciliationPolicy
            .reconcile_apply(input(
                ReconcileOperation::Apply,
                dispatch,
                &prior,
                &requested,
                &prior,
            ))
            .expect("exact apply truth reconciles");
        assert_eq!(decision.kind(), ReconcileDecisionKind::NotAppliedDoNotRetry);
        assert!(!decision.receipt_eligible());
        assert!(!decision.allows_automatic_retry());
    }
}

#[test]
fn third_apply_observation_is_drift_with_all_exact_values_and_user_choice() {
    let prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');
    let observed = state("33333333-3333-4333-8333-333333333333", 'c');
    let decision = ObservationFirstReconciliationPolicy
        .reconcile_apply(input(
            ReconcileOperation::Apply,
            DispatchEvidence::ResponseLost,
            &prior,
            &requested,
            &observed,
        ))
        .expect("third apply state reconciles to drift");

    assert_eq!(
        decision.kind(),
        ReconcileDecisionKind::DriftRequiresUserChoice
    );
    assert!(decision.requires_user_choice());
    assert!(!decision.receipt_eligible());
    assert_eq!(
        exact_json(decision.evidence().exact_prior_state()),
        exact_json(&prior)
    );
    assert_eq!(
        exact_json(decision.evidence().exact_requested_state()),
        exact_json(&requested)
    );
    assert_eq!(
        exact_json(decision.evidence().exact_observed_state()),
        exact_json(&observed)
    );
}

#[test]
fn requested_restore_observation_is_verified_restored_for_every_dispatch_boundary() {
    let applied = state("22222222-2222-4222-8222-222222222222", 'b');
    let restore_prior = state("11111111-1111-4111-8111-111111111111", 'a');

    for dispatch in dispatch_boundaries() {
        let decision = ObservationFirstReconciliationPolicy
            .reconcile_restore(input(
                ReconcileOperation::Restore,
                dispatch,
                &applied,
                &restore_prior,
                &restore_prior,
            ))
            .expect("exact restore truth reconciles");
        assert_eq!(decision.kind(), ReconcileDecisionKind::RestoredNeedsReceipt);
        assert!(decision.receipt_eligible());
        assert!(!decision.allows_automatic_retry());
    }
}

#[test]
fn applied_restore_observation_is_not_restored_and_never_retried() {
    let applied = state("22222222-2222-4222-8222-222222222222", 'b');
    let restore_prior = state("11111111-1111-4111-8111-111111111111", 'a');

    for dispatch in dispatch_boundaries() {
        let decision = ObservationFirstReconciliationPolicy
            .reconcile_restore(input(
                ReconcileOperation::Restore,
                dispatch,
                &applied,
                &restore_prior,
                &applied,
            ))
            .expect("exact restore truth reconciles");
        assert_eq!(
            decision.kind(),
            ReconcileDecisionKind::NotRestoredDoNotRetry
        );
        assert!(!decision.receipt_eligible());
        assert!(!decision.allows_automatic_retry());
    }
}

#[test]
fn third_restore_observation_is_conflict_with_all_exact_values_and_user_choice() {
    let applied = state("22222222-2222-4222-8222-222222222222", 'b');
    let restore_prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let observed = state("33333333-3333-4333-8333-333333333333", 'c');
    let decision = ObservationFirstReconciliationPolicy
        .reconcile_restore(input(
            ReconcileOperation::Restore,
            DispatchEvidence::AbandonedMutex,
            &applied,
            &restore_prior,
            &observed,
        ))
        .expect("third restore state reconciles to conflict");

    assert_eq!(
        decision.kind(),
        ReconcileDecisionKind::ConflictRequiresUserChoice
    );
    assert!(decision.requires_user_choice());
    assert!(!decision.receipt_eligible());
    assert_eq!(
        exact_json(decision.evidence().exact_prior_state()),
        exact_json(&applied)
    );
    assert_eq!(
        exact_json(decision.evidence().exact_requested_state()),
        exact_json(&restore_prior)
    );
    assert_eq!(
        exact_json(decision.evidence().exact_observed_state()),
        exact_json(&observed)
    );
}

#[test]
fn unknown_or_unavailable_state_blocks_mutation_without_receipt_or_retry() {
    let exact = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');
    let unknown_state = unknown("observation interrupted");
    let unavailable_state = unavailable("prior state was not captured");

    for (prior, target, observed) in [
        (&unknown_state, &requested, &requested),
        (&unavailable_state, &requested, &requested),
        (&exact, &unknown_state, &exact),
        (&exact, &requested, &unknown_state),
        (&exact, &requested, &unavailable_state),
    ] {
        let decision = ObservationFirstReconciliationPolicy
            .reconcile_apply(input(
                ReconcileOperation::Apply,
                DispatchEvidence::TimedOut,
                prior,
                target,
                observed,
            ))
            .expect("uncertain state produces a closed unknown outcome");
        assert_eq!(
            decision.kind(),
            ReconcileDecisionKind::UnknownBlockMutations
        );
        assert!(!decision.receipt_eligible());
        assert!(!decision.allows_automatic_retry());
    }
}

#[test]
fn dispatch_metadata_is_diagnostic_and_never_changes_observation_truth() {
    let prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');
    let decisions: Vec<_> = dispatch_boundaries()
        .into_iter()
        .map(|dispatch| {
            ObservationFirstReconciliationPolicy
                .reconcile_apply(input(
                    ReconcileOperation::Apply,
                    dispatch,
                    &prior,
                    &requested,
                    &requested,
                ))
                .expect("dispatch evidence is diagnostic")
                .kind()
        })
        .collect();

    assert!(
        decisions
            .iter()
            .all(|kind| *kind == ReconcileDecisionKind::AppliedNeedsReceipt)
    );
}

#[test]
fn conflict_choices_create_child_intents_without_rewriting_original_evidence() {
    let applied = state("22222222-2222-4222-8222-222222222222", 'b');
    let restore_prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let observed = state("33333333-3333-4333-8333-333333333333", 'c');
    let decision = ObservationFirstReconciliationPolicy
        .reconcile_restore(input(
            ReconcileOperation::Restore,
            DispatchEvidence::ResponseLost,
            &applied,
            &restore_prior,
            &observed,
        ))
        .expect("restore conflict is explicit");

    let keep = ObservationFirstReconciliationPolicy
        .create_resolution_intent(
            &decision,
            GuidedRecoveryChoice::KeepCurrentState,
            id("transaction-keep-current"),
        )
        .expect("keep-current creates a child transaction intent");
    assert_eq!(
        keep.parent_transaction_id().as_str(),
        "transaction-original"
    );
    assert_eq!(exact_json(keep.exact_prior_state()), exact_json(&observed));
    assert_eq!(
        exact_json(keep.exact_requested_state()),
        exact_json(&observed)
    );

    let restore = ObservationFirstReconciliationPolicy
        .create_resolution_intent(
            &decision,
            GuidedRecoveryChoice::RestoreExactPriorState,
            id("transaction-restore-prior"),
        )
        .expect("restore-prior creates a child transaction intent");
    assert_eq!(
        restore.parent_transaction_id().as_str(),
        "transaction-original"
    );
    assert_eq!(
        exact_json(restore.exact_prior_state()),
        exact_json(&observed)
    );
    assert_eq!(
        exact_json(restore.exact_requested_state()),
        exact_json(&restore_prior)
    );

    assert_eq!(
        exact_json(decision.evidence().exact_observed_state()),
        exact_json(&observed),
        "creating a resolution intent must not rewrite the original observation"
    );
}

#[test]
fn receipt_eligibility_is_closed_to_observed_applied_or_restored_outcomes() {
    let prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');
    let third = state("33333333-3333-4333-8333-333333333333", 'c');
    let decisions = [
        ObservationFirstReconciliationPolicy.reconcile_apply(input(
            ReconcileOperation::Apply,
            DispatchEvidence::ReturnedSuccess,
            &prior,
            &requested,
            &prior,
        )),
        ObservationFirstReconciliationPolicy.reconcile_apply(input(
            ReconcileOperation::Apply,
            DispatchEvidence::ReturnedSuccess,
            &prior,
            &requested,
            &third,
        )),
        ObservationFirstReconciliationPolicy.reconcile_apply(input(
            ReconcileOperation::Apply,
            DispatchEvidence::ReturnedSuccess,
            &prior,
            &requested,
            &unknown("lost observation"),
        )),
    ];

    assert!(decisions.into_iter().all(|decision| {
        let decision = decision.expect("closed decision");
        !decision.receipt_eligible() && !decision.allows_automatic_retry()
    }));
    assert!(matches!(
        ObservationFirstReconciliationPolicy
            .reconcile_apply(input(
                ReconcileOperation::Apply,
                DispatchEvidence::ReturnedFailure,
                &prior,
                &requested,
                &requested,
            ))
            .expect("requested observation is authoritative"),
        ReconcileDecision::AppliedNeedsReceipt(_)
    ));
}

#[test]
fn canonical_state_identity_ignores_observation_timestamp_metadata() {
    let prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');
    let observed_later = state_at(
        "22222222-2222-4222-8222-222222222222",
        'b',
        "2026-08-13T12:05:00Z",
    );

    let decision = ObservationFirstReconciliationPolicy
        .reconcile_apply(input(
            ReconcileOperation::Apply,
            DispatchEvidence::ReturnedFailure,
            &prior,
            &requested,
            &observed_later,
        ))
        .expect("observation timestamp is evidence metadata, not state identity");

    assert_eq!(decision.kind(), ReconcileDecisionKind::AppliedNeedsReceipt);
    assert_eq!(
        exact_json(decision.evidence().exact_observed_state()),
        exact_json(&observed_later),
        "the exact later observation is retained even though identity comparison ignores time"
    );
}

#[test]
fn apply_and_restore_entrypoints_reject_mismatched_durable_intent() {
    let prior = state("11111111-1111-4111-8111-111111111111", 'a');
    let requested = state("22222222-2222-4222-8222-222222222222", 'b');

    let apply_error = ObservationFirstReconciliationPolicy
        .reconcile_apply(input(
            ReconcileOperation::Restore,
            DispatchEvidence::NotDispatched,
            &prior,
            &requested,
            &prior,
        ))
        .expect_err("apply entrypoint must reject restore intent");
    let restore_error = ObservationFirstReconciliationPolicy
        .reconcile_restore(input(
            ReconcileOperation::Apply,
            DispatchEvidence::NotDispatched,
            &prior,
            &requested,
            &prior,
        ))
        .expect_err("restore entrypoint must reject apply intent");

    assert_eq!(
        apply_error.code(),
        liiiraa_plan_engine::domain::PlanEngineErrorCode::InvalidGeneratedTransport
    );
    assert_eq!(
        restore_error.code(),
        liiiraa_plan_engine::domain::PlanEngineErrorCode::InvalidGeneratedTransport
    );
}

fn permutation_state(index: u8) -> ExactOperationState {
    match index {
        0 => state("11111111-1111-4111-8111-111111111111", 'a'),
        1 => state("22222222-2222-4222-8222-222222222222", 'b'),
        2 => state("33333333-3333-4333-8333-333333333333", 'c'),
        3 => unknown("bounded property unknown"),
        _ => unavailable("bounded property unavailable"),
    }
}

fn known_identity(state: &ExactOperationState) -> Option<(String, String)> {
    match state {
        ExactOperationState::ExactPowerSchemeState(state) => Some((
            state.scheme_id.to_string(),
            state.canonical_state_hash.to_string(),
        )),
        ExactOperationState::UnavailablePowerSchemeState(_)
        | ExactOperationState::UnknownPowerSchemeState(_) => None,
    }
}

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 96,
        failure_persistence: None,
        rng_seed: RngSeed::Fixed(0x0608_D005_D028),
        ..ProptestConfig::default()
    })]

    #[test]
    fn every_bounded_state_and_dispatch_permutation_has_one_closed_safe_decision(
        prior_index in 0_u8..5,
        requested_index in 0_u8..5,
        observed_index in 0_u8..5,
        dispatch_index in 0_usize..6,
        restoring in any::<bool>(),
    ) {
        let prior = permutation_state(prior_index);
        let requested = permutation_state(requested_index);
        let observed = permutation_state(observed_index);
        let operation = if restoring {
            ReconcileOperation::Restore
        } else {
            ReconcileOperation::Apply
        };
        let dispatch = dispatch_boundaries()[dispatch_index];
        let decision = if restoring {
            ObservationFirstReconciliationPolicy.reconcile_restore(input(
                operation,
                dispatch,
                &prior,
                &requested,
                &observed,
            ))
        } else {
            ObservationFirstReconciliationPolicy.reconcile_apply(input(
                operation,
                dispatch,
                &prior,
                &requested,
                &observed,
            ))
        }
        .expect("all generated-contract states terminate in a named decision");

        let prior_identity = known_identity(&prior);
        let requested_identity = known_identity(&requested);
        let observed_identity = known_identity(&observed);
        let expected = match (observed_identity, requested_identity, prior_identity, restoring) {
            (None, _, _, _) | (_, None, _, _) | (_, _, None, _) => {
                ReconcileDecisionKind::UnknownBlockMutations
            }
            (Some(observed), Some(requested), _, false) if observed == requested => {
                ReconcileDecisionKind::AppliedNeedsReceipt
            }
            (Some(observed), Some(requested), _, true) if observed == requested => {
                ReconcileDecisionKind::RestoredNeedsReceipt
            }
            (Some(observed), _, Some(prior), false) if observed == prior => {
                ReconcileDecisionKind::NotAppliedDoNotRetry
            }
            (Some(observed), _, Some(prior), true) if observed == prior => {
                ReconcileDecisionKind::NotRestoredDoNotRetry
            }
            (Some(_), Some(_), Some(_), false) => {
                ReconcileDecisionKind::DriftRequiresUserChoice
            }
            (Some(_), Some(_), Some(_), true) => {
                ReconcileDecisionKind::ConflictRequiresUserChoice
            }
        };

        prop_assert_eq!(decision.kind(), expected);
        prop_assert!(!decision.allows_automatic_retry());
        prop_assert_eq!(decision.receipt_eligible(), matches!(
            expected,
            ReconcileDecisionKind::AppliedNeedsReceipt
                | ReconcileDecisionKind::RestoredNeedsReceipt
        ));
        prop_assert_eq!(decision.evidence().dispatch(), dispatch);
    }
}

#[test]
fn exhaustive_generated_state_matrix_terminates_without_retry_authority() {
    let transaction_id = id("transaction-exhaustive-matrix");
    let operation_version_id = id("operation-power-v1");

    for prior_index in 0_u8..5 {
        for requested_index in 0_u8..5 {
            for observed_index in 0_u8..5 {
                let prior = permutation_state(prior_index);
                let requested = permutation_state(requested_index);
                let observed = permutation_state(observed_index);

                for dispatch in dispatch_boundaries() {
                    for operation in [ReconcileOperation::Apply, ReconcileOperation::Restore] {
                        let reconcile_input = ReconcileInput {
                            transaction_id: &transaction_id,
                            operation_version_id: &operation_version_id,
                            exact_prior_state: &prior,
                            exact_requested_state: &requested,
                            exact_observed_state: &observed,
                            operation,
                            dispatch,
                        };
                        let decision = match operation {
                            ReconcileOperation::Apply => ObservationFirstReconciliationPolicy
                                .reconcile_apply(reconcile_input),
                            ReconcileOperation::Restore => ObservationFirstReconciliationPolicy
                                .reconcile_restore(reconcile_input),
                        }
                        .expect("every contract-state permutation must terminate");

                        assert!(!decision.allows_automatic_retry());
                        assert_eq!(decision.evidence().operation(), operation);
                        assert_eq!(decision.evidence().dispatch(), dispatch);
                    }
                }
            }
        }
    }
}
