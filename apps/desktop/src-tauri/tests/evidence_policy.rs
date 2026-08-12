#[path = "../src/evidence_policy.rs"]
mod evidence_policy;

use evidence_policy::{
    CapabilityObservation, CapabilityState, ClaimAuthority, ComparisonAuthority, EvidenceFreshness,
    EvidenceReference, LifecycleAdmission, LifecycleState, PolicyInput, PolicyReason,
    RecommendationTier, evaluate_claim, evaluate_policy,
};
use liiiraa_contracts_rust::EvidenceQuality;
use proptest::prelude::*;

fn reference(id: &str) -> EvidenceReference {
    EvidenceReference {
        evidence_id: id.to_owned(),
        evidence_version: 1,
    }
}

fn capability(
    id: &str,
    state: CapabilityState,
    freshness: EvidenceFreshness,
) -> CapabilityObservation {
    CapabilityObservation {
        capability_id: id.to_owned(),
        state,
        freshness,
        evidence: reference(&format!("evidence-{id}")),
    }
}

fn valid_input() -> PolicyInput {
    PolicyInput {
        marketing_name: "Marketing label that must not grant authority".to_owned(),
        requested_tier: RecommendationTier::Compatible,
        capabilities: vec![
            capability(
                "cpu.topology",
                CapabilityState::Available,
                EvidenceFreshness::Current,
            ),
            capability(
                "gpu.telemetry",
                CapabilityState::Available,
                EvidenceFreshness::Current,
            ),
        ],
        lifecycle: LifecycleAdmission {
            state: LifecycleState::Supported,
            evidence: reference("evidence-lifecycle"),
            acknowledgement: None,
        },
        quality: EvidenceQuality::Valid,
        quality_evidence: reference("evidence-quality"),
    }
}

#[test]
fn marketing_names_never_change_capability_eligibility() {
    let baseline = evaluate_policy(&valid_input());
    let mut renamed = valid_input();
    renamed.marketing_name = "RTX HYPER ULTRA UNLOCKED".to_owned();

    assert_eq!(evaluate_policy(&renamed), baseline);
    assert!(baseline.actionable);
    assert_eq!(baseline.tier, RecommendationTier::Compatible);
}

#[test]
fn each_invalid_evidence_state_fails_closed_with_a_navigable_reason() {
    let invalid_states = [
        EvidenceFreshness::Stale,
        EvidenceFreshness::Contradictory,
        EvidenceFreshness::Corrupt,
        EvidenceFreshness::Unavailable,
    ];

    for state in invalid_states {
        let mut input = valid_input();
        input.capabilities[0].freshness = state;
        let verdict = evaluate_policy(&input);

        assert!(!verdict.actionable);
        assert_eq!(verdict.tier, RecommendationTier::Hidden);
        assert!(verdict.reasons.iter().any(|reason| reason.evidence.is_some()));
        assert!(verdict.reasons.iter().all(|reason| !reason.localization_key.is_empty()));
    }
}

#[test]
fn capability_states_are_explainable_and_deny_by_default() {
    let cases = [
        (CapabilityState::Available, true, RecommendationTier::Compatible),
        (
            CapabilityState::Experimental,
            false,
            RecommendationTier::Experimental,
        ),
        (
            CapabilityState::Unavailable,
            false,
            RecommendationTier::Unsupported,
        ),
        (CapabilityState::Forbidden, false, RecommendationTier::Hidden),
        (CapabilityState::Unknown, false, RecommendationTier::Hidden),
    ];

    for (state, actionable, tier) in cases {
        let mut input = valid_input();
        input.capabilities[0].state = state;
        let verdict = evaluate_policy(&input);
        assert_eq!(verdict.actionable, actionable);
        assert_eq!(verdict.tier, tier);
        if !actionable {
            assert!(!verdict.reasons.is_empty());
        }
    }
}

#[test]
fn lifecycle_warnings_require_exact_acknowledgement() {
    let mut input = valid_input();
    input.lifecycle.state = LifecycleState::Warning {
        warning_id: "windows-build-eol".to_owned(),
    };

    let blocked = evaluate_policy(&input);
    assert!(!blocked.actionable);
    assert!(blocked.acknowledgement_required);
    assert!(blocked.reasons.iter().any(|reason| {
        reason.code == PolicyReason::LifecycleAcknowledgementRequired
    }));

    input.lifecycle.acknowledgement = Some("wrong-warning".to_owned());
    assert!(!evaluate_policy(&input).actionable);

    input.lifecycle.acknowledgement = Some("windows-build-eol".to_owned());
    let admitted = evaluate_policy(&input);
    assert!(admitted.actionable);
    assert!(!admitted.acknowledgement_required);
}

#[test]
fn every_non_valid_metric_quality_blocks_actionability() {
    for quality in [
        EvidenceQuality::Degraded,
        EvidenceQuality::Insufficient,
        EvidenceQuality::Invalid,
    ] {
        let mut input = valid_input();
        input.quality = quality;
        let verdict = evaluate_policy(&input);
        assert!(!verdict.actionable);
        assert!(verdict.reasons.iter().any(|reason| {
            reason.code == PolicyReason::MetricQualityRejected
                && reason.evidence.as_ref() == Some(&reference("evidence-quality"))
        }));
    }
}

#[test]
fn all_blockers_are_returned_in_stable_order() {
    let mut input = valid_input();
    input.capabilities = vec![
        capability(
            "z-last",
            CapabilityState::Unknown,
            EvidenceFreshness::Corrupt,
        ),
        capability(
            "a-first",
            CapabilityState::Unavailable,
            EvidenceFreshness::Stale,
        ),
    ];
    input.quality = EvidenceQuality::Invalid;

    let verdict = evaluate_policy(&input);
    let sort_keys = verdict
        .reasons
        .iter()
        .map(|reason| reason.sort_key())
        .collect::<Vec<_>>();
    let mut expected = sort_keys.clone();
    expected.sort();
    expected.dedup();

    assert_eq!(sort_keys, expected);
    assert!(verdict.reasons.len() >= 5);
}

#[test]
fn claim_admission_is_revoked_without_deleting_history() {
    let approved = ComparisonAuthority {
        comparison_id: "comparison-1".to_owned(),
        evidence: reference("evidence-comparison-1"),
        state: ClaimAuthority::Approved,
        quality: EvidenceQuality::Valid,
    };

    let admitted = evaluate_claim(&approved);
    assert!(admitted.admitted);
    assert_eq!(admitted.history_reference, approved.evidence);

    let revoked = evaluate_claim(&ComparisonAuthority {
        state: ClaimAuthority::Revoked,
        ..approved.clone()
    });
    assert!(!revoked.admitted);
    assert_eq!(revoked.history_reference, approved.evidence);
    assert_eq!(revoked.reasons[0].code, PolicyReason::ComparisonApprovalRevoked);
}

#[test]
fn claim_admission_rejects_invalid_or_missing_comparison_authority() {
    for state in [ClaimAuthority::Pending, ClaimAuthority::Missing] {
        let verdict = evaluate_claim(&ComparisonAuthority {
            comparison_id: "comparison-2".to_owned(),
            evidence: reference("evidence-comparison-2"),
            state,
            quality: EvidenceQuality::Valid,
        });
        assert!(!verdict.admitted);
        assert!(!verdict.reasons.is_empty());
    }

    let invalid_quality = evaluate_claim(&ComparisonAuthority {
        comparison_id: "comparison-3".to_owned(),
        evidence: reference("evidence-comparison-3"),
        state: ClaimAuthority::Approved,
        quality: EvidenceQuality::Degraded,
    });
    assert!(!invalid_quality.admitted);
}

proptest! {
    #[test]
    fn capability_order_never_changes_the_verdict(order in prop::collection::vec(0usize..4, 0..32)) {
        let canonical = vec![
            capability("cpu.topology", CapabilityState::Available, EvidenceFreshness::Current),
            capability("gpu.telemetry", CapabilityState::Unavailable, EvidenceFreshness::Current),
            capability("os.lifecycle", CapabilityState::Experimental, EvidenceFreshness::Stale),
            capability("storage.health", CapabilityState::Unknown, EvidenceFreshness::Contradictory),
        ];
        let mut first = valid_input();
        first.capabilities = canonical.clone();
        let expected = evaluate_policy(&first);

        let mut reordered = canonical;
        for index in order {
            let destination = index % reordered.len();
            reordered.rotate_left(destination);
        }
        let mut second = valid_input();
        second.capabilities = reordered;
        prop_assert_eq!(evaluate_policy(&second), expected);
    }

    #[test]
    fn any_required_capability_degradation_blocks_actionability(
        state in prop_oneof![
            Just(CapabilityState::Unavailable),
            Just(CapabilityState::Forbidden),
            Just(CapabilityState::Unknown),
            Just(CapabilityState::Experimental),
        ],
        freshness in prop_oneof![
            Just(EvidenceFreshness::Current),
            Just(EvidenceFreshness::Stale),
            Just(EvidenceFreshness::Contradictory),
            Just(EvidenceFreshness::Corrupt),
            Just(EvidenceFreshness::Unavailable),
        ],
    ) {
        let mut input = valid_input();
        input.capabilities[0].state = state;
        input.capabilities[0].freshness = freshness;
        prop_assert!(!evaluate_policy(&input).actionable);
    }
}
