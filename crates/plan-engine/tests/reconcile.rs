use liiiraa_contracts_rust::{ExactOperationState, TransactionIdentifier};
use liiiraa_plan_engine::reconcile::{
    DispatchEvidence, GuidedRecoveryChoice, ObservationFirstReconciliationPolicy,
    ReconcileDecision, ReconcileDecisionKind, ReconcileInput, ReconcileOperation,
};
use serde_json::{Value, json};

fn parse<T: serde::de::DeserializeOwned>(value: Value) -> T {
    serde_json::from_value(value).expect("fixture must match the generated contract")
}

fn id(value: &str) -> TransactionIdentifier {
    value.parse().expect("bounded identifier")
}

fn state(scheme: &str, hash_character: char) -> ExactOperationState {
    parse(json!({
        "state": "observed",
        "schemeId": scheme,
        "canonicalStateHash": format!("sha256:{}", hash_character.to_string().repeat(64)),
        "observedAt": "2026-08-13T12:00:00Z"
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
