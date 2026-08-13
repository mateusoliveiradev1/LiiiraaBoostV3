use liiiraa_plan_engine::risk::{
    AdmissionBlockReason, AdmissionDecision, AdmissionEvidence, AdmissionPolicy, AdmissionRequest,
    AdvancedPreferenceProjection, AdvancedPreferenceState, ApprovalAction, ApprovalDiff,
    ApprovalFingerprint, ConfirmationEvidence, ExecutableRisk, LocalRecoveryAdmission,
    OneUseApplyProof, OperationRisk, OperationRiskVersion, ProofDisposition, RecoveryReadiness,
    RestorePointStatus, RiskCeiling, local_recovery_admission,
};
use proptest::prelude::*;

const EXPERIMENTAL_PHRASE: &str = "APPLY EXPERIMENTAL PLAN";

fn operation(id: &str, risk: OperationRisk) -> OperationRiskVersion {
    OperationRiskVersion::new(id, risk, AdmissionEvidence::Admitted).expect("valid operation")
}

fn fingerprint(risk: ExecutableRisk, operation_ids: &[&str]) -> ApprovalFingerprint {
    ApprovalFingerprint::new(
        "plan-fingerprint-v1",
        "evidence-fingerprint-v1",
        "recovery-fingerprint-v1",
        "device-1",
        "hardware-v1",
        "security-v1",
        operation_ids.iter().copied(),
        risk,
    )
    .expect("valid fingerprint")
}

fn enabled_preference() -> AdvancedPreferenceProjection {
    AdvancedPreferenceProjection::new(
        AdvancedPreferenceState::Enabled,
        "device-1",
        "hardware-v1",
        "security-v1",
    )
    .expect("valid preference")
}

fn ready_recovery() -> RecoveryReadiness {
    RecoveryReadiness::new(true, RestorePointStatus::Ready, false)
}

fn unavailable_restore_acknowledged() -> RecoveryReadiness {
    RecoveryReadiness::new(true, RestorePointStatus::Unavailable, true)
}

fn proof(binding: ApprovalFingerprint) -> OneUseApplyProof {
    OneUseApplyProof::new(
        "proof-1",
        ApprovalAction::ApplyPlan,
        binding,
        2_000,
        ProofDisposition::Available,
    )
    .expect("valid proof")
}

fn verified_confirmation(binding: ApprovalFingerprint) -> ConfirmationEvidence {
    ConfirmationEvidence::verified(binding)
}

fn advanced_confirmation(binding: ApprovalFingerprint) -> ConfirmationEvidence {
    ConfirmationEvidence::advanced(binding, true)
}

fn experimental_confirmation(
    binding: ApprovalFingerprint,
    operation_ids: &[&str],
) -> ConfirmationEvidence {
    ConfirmationEvidence::experimental(
        binding,
        true,
        operation_ids.iter().copied(),
        true,
        EXPERIMENTAL_PHRASE,
    )
    .expect("valid confirmation")
}

fn evaluate(
    operations: &[OperationRiskVersion],
    ceiling: RiskCeiling,
    preference: Option<&AdvancedPreferenceProjection>,
    beta_participant: bool,
    recovery: &RecoveryReadiness,
    confirmation: Option<&ConfirmationEvidence>,
    proof: Option<&OneUseApplyProof>,
    current: &ApprovalFingerprint,
) -> AdmissionDecision {
    AdmissionPolicy::evaluate(AdmissionRequest::new(
        operations,
        ceiling,
        preference,
        beta_participant,
        recovery,
        confirmation,
        proof,
        current,
        1_000,
    ))
}

fn assert_blocked(decision: &AdmissionDecision, expected: AdmissionBlockReason) {
    match decision {
        AdmissionDecision::Blocked(blockers) => {
            assert!(
                blockers.contains(&expected),
                "expected blocker {} in {blockers:?}",
                expected.code()
            );
            assert!(blockers.iter().all(|blocker| !blocker.code().is_empty()));
        }
        AdmissionDecision::Executable(admission) => {
            panic!("unexpected executable admission at {:?}", admission.risk())
        }
    }
}

#[test]
fn d09_verified_is_available_by_default_but_d11_requires_review_and_confirmation() {
    let operations = [operation(
        "power-plan-v1",
        OperationRisk::Executable(ExecutableRisk::Verified),
    )];
    let binding = fingerprint(ExecutableRisk::Verified, &["power-plan-v1"]);
    let recovery = ready_recovery();

    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Verified,
            None,
            false,
            &recovery,
            None,
            None,
            &binding,
        ),
        AdmissionBlockReason::ReviewConfirmationRequired,
    );

    let confirmation = verified_confirmation(binding.clone());
    let decision = evaluate(
        &operations,
        RiskCeiling::Verified,
        None,
        false,
        &recovery,
        Some(&confirmation),
        None,
        &binding,
    );
    assert!(matches!(decision, AdmissionDecision::Executable(_)));
}

#[test]
fn d10_risk_ceiling_caps_only_the_explicit_selection_and_never_auto_selects() {
    let selected = [operation(
        "verified-v1",
        OperationRisk::Executable(ExecutableRisk::Verified),
    )];
    let binding = fingerprint(ExecutableRisk::Verified, &["verified-v1"]);
    let confirmation = verified_confirmation(binding.clone());
    let decision = evaluate(
        &selected,
        RiskCeiling::Experimental,
        None,
        true,
        &ready_recovery(),
        Some(&confirmation),
        None,
        &binding,
    );

    let AdmissionDecision::Executable(admission) = decision else {
        panic!("explicit verified selection should be admitted")
    };
    assert_eq!(admission.risk(), ExecutableRisk::Verified);
    assert_eq!(admission.operation_version_ids(), ["verified-v1"]);
}

#[test]
fn d12_registered_risk_is_immutable_and_uncertain_evidence_fails_closed() {
    for (label, evidence) in [
        ("missing", AdmissionEvidence::Missing),
        ("degraded", AdmissionEvidence::Degraded),
        ("contradictory", AdmissionEvidence::Contradictory),
        ("incompatible", AdmissionEvidence::Incompatible),
        ("unknown", AdmissionEvidence::Unknown),
    ] {
        let operations = [OperationRiskVersion::new(
            "advanced-v1",
            OperationRisk::Executable(ExecutableRisk::Advanced),
            evidence,
        )
        .expect("valid operation")];
        let binding = fingerprint(ExecutableRisk::Advanced, &["advanced-v1"]);
        assert_blocked(
            &evaluate(
                &operations,
                RiskCeiling::Experimental,
                Some(&enabled_preference()),
                true,
                &ready_recovery(),
                Some(&advanced_confirmation(binding.clone())),
                Some(&proof(binding.clone())),
                &binding,
            ),
            AdmissionBlockReason::EvidenceNotAdmitted,
        );
        assert_eq!(
            operations[0].risk(),
            OperationRisk::Executable(ExecutableRisk::Advanced),
            "{label}"
        );
    }
}

#[test]
fn d13_advanced_requires_enabled_device_local_preference_bound_to_current_posture() {
    let operations = [operation(
        "advanced-v1",
        OperationRisk::Executable(ExecutableRisk::Advanced),
    )];
    let binding = fingerprint(ExecutableRisk::Advanced, &["advanced-v1"]);
    let confirmation = advanced_confirmation(binding.clone());
    let strong_proof = proof(binding.clone());
    let recovery = ready_recovery();

    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Advanced,
            None,
            false,
            &recovery,
            Some(&confirmation),
            Some(&strong_proof),
            &binding,
        ),
        AdmissionBlockReason::AdvancedPreferenceMissing,
    );

    for (state, expected) in [
        (
            AdvancedPreferenceState::Disabled,
            AdmissionBlockReason::AdvancedPreferenceDisabled,
        ),
        (
            AdvancedPreferenceState::Revoked,
            AdmissionBlockReason::AdvancedPreferenceRevoked,
        ),
        (
            AdvancedPreferenceState::RevalidationRequired,
            AdmissionBlockReason::AdvancedPreferenceRevalidationRequired,
        ),
    ] {
        let preference =
            AdvancedPreferenceProjection::new(state, "device-1", "hardware-v1", "security-v1")
                .expect("valid preference");
        assert_blocked(
            &evaluate(
                &operations,
                RiskCeiling::Advanced,
                Some(&preference),
                false,
                &recovery,
                Some(&confirmation),
                Some(&strong_proof),
                &binding,
            ),
            expected,
        );
    }

    for (device, hardware, security) in [
        ("device-2", "hardware-v1", "security-v1"),
        ("device-1", "hardware-v2", "security-v1"),
        ("device-1", "hardware-v1", "security-v2"),
    ] {
        let preference = AdvancedPreferenceProjection::new(
            AdvancedPreferenceState::Enabled,
            device,
            hardware,
            security,
        )
        .expect("valid preference");
        assert_blocked(
            &evaluate(
                &operations,
                RiskCeiling::Advanced,
                Some(&preference),
                false,
                &recovery,
                Some(&confirmation),
                Some(&strong_proof),
                &binding,
            ),
            AdmissionBlockReason::AdvancedPreferenceBindingMismatch,
        );
    }
}

#[test]
fn d11_d27_advanced_accepts_manifest_rollback_with_explicit_second_layer_acknowledgement() {
    let operations = [operation(
        "advanced-v1",
        OperationRisk::Executable(ExecutableRisk::Advanced),
    )];
    let binding = fingerprint(ExecutableRisk::Advanced, &["advanced-v1"]);
    let confirmation = advanced_confirmation(binding.clone());
    let strong_proof = proof(binding.clone());
    let preference = enabled_preference();

    let decision = evaluate(
        &operations,
        RiskCeiling::Advanced,
        Some(&preference),
        false,
        &unavailable_restore_acknowledged(),
        Some(&confirmation),
        Some(&strong_proof),
        &binding,
    );
    assert!(matches!(decision, AdmissionDecision::Executable(_)));

    let unacknowledged = RecoveryReadiness::new(true, RestorePointStatus::Unavailable, false);
    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Advanced,
            Some(&preference),
            false,
            &unacknowledged,
            Some(&confirmation),
            Some(&strong_proof),
            &binding,
        ),
        AdmissionBlockReason::SecondRecoveryLayerAcknowledgementRequired,
    );
}

#[test]
fn d14_experimental_visibility_is_not_consent_and_each_version_and_apply_are_fresh() {
    let operations = [operation(
        "experimental-v1",
        OperationRisk::Executable(ExecutableRisk::Experimental),
    )];
    let binding = fingerprint(ExecutableRisk::Experimental, &["experimental-v1"]);
    let preference = enabled_preference();
    let strong_proof = proof(binding.clone());

    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Experimental,
            Some(&preference),
            true,
            &ready_recovery(),
            None,
            Some(&strong_proof),
            &binding,
        ),
        AdmissionBlockReason::ReviewConfirmationRequired,
    );

    let wrong_phrase = ConfirmationEvidence::experimental(
        binding.clone(),
        true,
        ["experimental-v1"],
        true,
        "apply experimental plan",
    )
    .expect("valid confirmation");
    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Experimental,
            Some(&preference),
            true,
            &ready_recovery(),
            Some(&wrong_phrase),
            Some(&strong_proof),
            &binding,
        ),
        AdmissionBlockReason::ExperimentalPhraseMismatch,
    );

    let confirmation = experimental_confirmation(binding.clone(), &["experimental-v1"]);
    let decision = evaluate(
        &operations,
        RiskCeiling::Experimental,
        Some(&preference),
        true,
        &ready_recovery(),
        Some(&confirmation),
        Some(&strong_proof),
        &binding,
    );
    assert!(matches!(decision, AdmissionDecision::Executable(_)));
}

#[test]
fn d09_d11_experimental_requires_beta_and_both_recovery_layers_while_extreme_never_executes() {
    let operations = [operation(
        "experimental-v1",
        OperationRisk::Executable(ExecutableRisk::Experimental),
    )];
    let binding = fingerprint(ExecutableRisk::Experimental, &["experimental-v1"]);
    let confirmation = experimental_confirmation(binding.clone(), &["experimental-v1"]);
    let strong_proof = proof(binding.clone());
    let preference = enabled_preference();

    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Experimental,
            Some(&preference),
            false,
            &ready_recovery(),
            Some(&confirmation),
            Some(&strong_proof),
            &binding,
        ),
        AdmissionBlockReason::ExperimentalCohortRequired,
    );
    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Experimental,
            Some(&preference),
            true,
            &unavailable_restore_acknowledged(),
            Some(&confirmation),
            Some(&strong_proof),
            &binding,
        ),
        AdmissionBlockReason::ComplementaryRestoreRequired,
    );

    let extreme = [operation("extreme-v1", OperationRisk::ExtremeLocked)];
    assert_blocked(
        &evaluate(
            &extreme,
            RiskCeiling::Experimental,
            Some(&preference),
            true,
            &ready_recovery(),
            None,
            None,
            &binding,
        ),
        AdmissionBlockReason::ExtremeLocked,
    );
}

#[test]
fn d15_mixed_plan_inherits_maximum_risk_and_preserves_sensitive_confirmation() {
    let operations = [
        operation(
            "verified-v1",
            OperationRisk::Executable(ExecutableRisk::Verified),
        ),
        operation(
            "advanced-v1",
            OperationRisk::Executable(ExecutableRisk::Advanced),
        ),
    ];
    let binding = fingerprint(ExecutableRisk::Advanced, &["verified-v1", "advanced-v1"]);
    let verified_only = verified_confirmation(binding.clone());
    assert_blocked(
        &evaluate(
            &operations,
            RiskCeiling::Advanced,
            Some(&enabled_preference()),
            false,
            &ready_recovery(),
            Some(&verified_only),
            Some(&proof(binding.clone())),
            &binding,
        ),
        AdmissionBlockReason::DetailedReviewRequired,
    );
}

#[test]
fn d16_any_authority_diff_invalidates_review_and_requires_a_fresh_exact_fingerprint() {
    let operations = [operation(
        "advanced-v1",
        OperationRisk::Executable(ExecutableRisk::Advanced),
    )];
    let approved = fingerprint(ExecutableRisk::Advanced, &["advanced-v1"]);
    let confirmation = advanced_confirmation(approved.clone());
    let strong_proof = proof(approved.clone());
    let preference = enabled_preference();
    let recovery = ready_recovery();

    for (label, current, diff) in [
        (
            "plan",
            approved.with_plan_fingerprint("plan-v2"),
            ApprovalDiff::PlanFingerprint,
        ),
        (
            "evidence",
            approved.with_evidence_fingerprint("evidence-v2"),
            ApprovalDiff::EvidenceFingerprint,
        ),
        (
            "recovery",
            approved.with_recovery_fingerprint("recovery-v2"),
            ApprovalDiff::RecoveryFingerprint,
        ),
        (
            "device",
            approved.with_device_binding("device-2"),
            ApprovalDiff::DeviceBinding,
        ),
        (
            "hardware",
            approved.with_hardware_fingerprint("hardware-v2"),
            ApprovalDiff::HardwareFingerprint,
        ),
        (
            "security",
            approved.with_security_posture_fingerprint("security-v2"),
            ApprovalDiff::SecurityPostureFingerprint,
        ),
        (
            "risk",
            approved.with_effective_risk(ExecutableRisk::Experimental),
            ApprovalDiff::Risk,
        ),
        (
            "operations",
            approved
                .with_operation_version_ids(["advanced-v2"])
                .expect("valid set"),
            ApprovalDiff::OperationVersionSet,
        ),
    ] {
        assert_blocked(
            &evaluate(
                &operations,
                RiskCeiling::Advanced,
                Some(&preference),
                false,
                &recovery,
                Some(&confirmation),
                Some(&strong_proof),
                &current,
            ),
            AdmissionBlockReason::FreshReviewRequired(diff),
        );
        assert!(!label.is_empty());
    }
}

#[test]
fn apply_proof_rejects_stale_wrong_action_replay_and_exact_binding_mismatch() {
    let operations = [operation(
        "advanced-v1",
        OperationRisk::Executable(ExecutableRisk::Advanced),
    )];
    let binding = fingerprint(ExecutableRisk::Advanced, &["advanced-v1"]);
    let confirmation = advanced_confirmation(binding.clone());
    let preference = enabled_preference();
    let recovery = ready_recovery();

    let cases = [
        (
            "expired",
            OneUseApplyProof::new(
                "proof-expired",
                ApprovalAction::ApplyPlan,
                binding.clone(),
                999,
                ProofDisposition::Available,
            )
            .expect("valid proof"),
            AdmissionBlockReason::ProofExpired,
        ),
        (
            "wrong-action",
            OneUseApplyProof::new(
                "proof-action",
                ApprovalAction::EnableAdvancedPreference,
                binding.clone(),
                2_000,
                ProofDisposition::Available,
            )
            .expect("valid proof"),
            AdmissionBlockReason::ProofWrongAction,
        ),
        (
            "consumed",
            OneUseApplyProof::new(
                "proof-consumed",
                ApprovalAction::ApplyPlan,
                binding.clone(),
                2_000,
                ProofDisposition::Consumed,
            )
            .expect("valid proof"),
            AdmissionBlockReason::ProofConsumed,
        ),
        (
            "wrong-device",
            proof(binding.with_device_binding("device-2")),
            AdmissionBlockReason::ProofBindingMismatch(ApprovalDiff::DeviceBinding),
        ),
        (
            "wrong-fingerprint",
            proof(binding.with_plan_fingerprint("plan-v2")),
            AdmissionBlockReason::ProofBindingMismatch(ApprovalDiff::PlanFingerprint),
        ),
        (
            "wrong-operation-set",
            proof(
                binding
                    .with_operation_version_ids(["advanced-v2"])
                    .expect("valid set"),
            ),
            AdmissionBlockReason::ProofBindingMismatch(ApprovalDiff::OperationVersionSet),
        ),
    ];

    for (label, candidate, expected) in cases {
        assert_blocked(
            &evaluate(
                &operations,
                RiskCeiling::Advanced,
                Some(&preference),
                false,
                &recovery,
                Some(&confirmation),
                Some(&candidate),
                &binding,
            ),
            expected,
        );
        assert!(!label.is_empty());
    }
}

#[test]
fn recovery_remains_callable_without_subscription_or_authentication_inputs() {
    assert_eq!(local_recovery_admission(), LocalRecoveryAdmission::Callable);
}

fn executable_risk_strategy() -> impl Strategy<Value = ExecutableRisk> {
    prop_oneof![
        Just(ExecutableRisk::Verified),
        Just(ExecutableRisk::Advanced),
        Just(ExecutableRisk::Experimental),
    ]
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    #[test]
    fn d15_effective_risk_is_the_bounded_maximum(
        risks in prop::collection::vec(executable_risk_strategy(), 1..=8)
    ) {
        let operations: Vec<_> = risks
            .iter()
            .enumerate()
            .map(|(index, risk)| operation(
                &format!("operation-{index}"),
                OperationRisk::Executable(*risk),
            ))
            .collect();
        let expected = risks.into_iter().max().expect("non-empty generated risks");
        prop_assert_eq!(AdmissionPolicy::effective_risk(&operations), Ok(expected));
    }

    #[test]
    fn exact_plan_evidence_or_recovery_drift_always_blocks(
        drift_index in 0_usize..3,
        suffix in "[a-z0-9]{1,12}",
    ) {
        let operations = [operation(
            "advanced-v1",
            OperationRisk::Executable(ExecutableRisk::Advanced),
        )];
        let approved = fingerprint(ExecutableRisk::Advanced, &["advanced-v1"]);
        let current = match drift_index {
            0 => approved.with_plan_fingerprint(&format!("plan-{suffix}")),
            1 => approved.with_evidence_fingerprint(&format!("evidence-{suffix}")),
            _ => approved.with_recovery_fingerprint(&format!("recovery-{suffix}")),
        };
        let expected = match drift_index {
            0 => ApprovalDiff::PlanFingerprint,
            1 => ApprovalDiff::EvidenceFingerprint,
            _ => ApprovalDiff::RecoveryFingerprint,
        };
        let decision = evaluate(
            &operations,
            RiskCeiling::Advanced,
            Some(&enabled_preference()),
            false,
            &ready_recovery(),
            Some(&advanced_confirmation(approved.clone())),
            Some(&proof(approved)),
            &current,
        );
        prop_assert!(matches!(
            decision,
            AdmissionDecision::Blocked(ref blockers)
                if blockers.contains(&AdmissionBlockReason::FreshReviewRequired(expected))
        ));
    }
}
