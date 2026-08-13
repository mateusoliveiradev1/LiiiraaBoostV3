use liiiraa_contracts_rust::{
    OperationPromotionDocument, RedactedDiagnosticExportDocument,
    SignedOperationRevocationDocument, TransactionIdentifier,
};
use liiiraa_plan_engine::{
    domain::GeneratedTransport,
    promotion::{
        DiagnosticReleaseConsent, DiagnosticReleaseIntent, ExactEvidenceIdentity,
        ExactStageEvidence, ExactVersionPromotionPolicy, LocalDiagnosticJournal,
        NextPromotionStage, PromotionBlockReason, PromotionDecision, PromotionRequest,
        PromotionStage, RedactedDiagnosticPolicy, RestartEvidence, RevocationSignatureVerifier,
    },
};
use proptest::prelude::*;
use serde_json::{Value, json};

const BUILD_ID: &str = "desktop-build-06-10";

fn parse<T: serde::de::DeserializeOwned>(value: Value) -> T {
    serde_json::from_value(value).expect("fixture must match the generated contract")
}

fn id(value: &str) -> TransactionIdentifier {
    value.parse().expect("bounded identifier")
}

fn promotion(
    operation_version: &str,
    stage: PromotionStage,
    verdict: &str,
    promotion_id: &str,
    previous_promotion_id: Option<&str>,
) -> OperationPromotionDocument {
    let (stage_name, previous_stage) = match stage {
        PromotionStage::DeterministicSimulation => ("deterministic-simulation", None),
        PromotionStage::CleanWindowsVm => ("clean-windows-vm", Some("deterministic-simulation")),
        PromotionStage::OwnerPc => ("owner-pc", Some("clean-windows-vm")),
        PromotionStage::FriendsPc => ("friends-pc", Some("owner-pc")),
    };
    let evidence_id = format!("evidence-{operation_version}-{stage_name}");
    let mut value = json!({
        "kind": "operation-promotion",
        "schemaVersion": "1.0",
        "promotionId": promotion_id,
        "operationVersionId": operation_version,
        "stage": stage_name,
        "verdict": verdict,
        "evidence": [{
            "evidenceId": evidence_id,
            "evidenceHash": format!("sha256:{}", "a".repeat(64)),
            "capturedAt": "2026-08-13T12:00:00Z"
        }],
        "recordedAt": "2026-08-13T12:01:00Z",
        "audit": {
            "auditId": format!("audit-{promotion_id}"),
            "recordedAt": "2026-08-13T12:01:00Z"
        }
    });
    if let Some(previous_stage) = previous_stage {
        value["previousStage"] = json!(previous_stage);
        value["previousPromotionId"] =
            json!(previous_promotion_id.unwrap_or("missing-previous-promotion"));
    }
    parse(value)
}

#[allow(clippy::too_many_arguments)]
fn cycle(
    operation_version: &str,
    stage: PromotionStage,
    prepared: bool,
    applied: bool,
    verified_after_apply: bool,
    restart: RestartEvidence,
    restored: bool,
    verified_after_restore: bool,
) -> ExactStageEvidence {
    ExactStageEvidence::new(
        id(operation_version),
        id(BUILD_ID),
        stage,
        vec![ExactEvidenceIdentity::new(
            format!("evidence-{operation_version}-{}", stage.as_str()),
            format!("sha256:{}", "a".repeat(64)),
        )],
        prepared,
        applied,
        verified_after_apply,
        restart,
        restored,
        verified_after_restore,
        vec![id("hardware-observed-1")],
        vec![id("coverage-gap-unobserved-hardware")],
    )
}

fn complete_cycle(operation_version: &str, stage: PromotionStage) -> ExactStageEvidence {
    cycle(
        operation_version,
        stage,
        true,
        true,
        true,
        RestartEvidence::NotRequired,
        true,
        true,
    )
}

fn complete_cycle_for_build(
    operation_version: &str,
    stage: PromotionStage,
    build_id: &str,
) -> ExactStageEvidence {
    ExactStageEvidence::new(
        id(operation_version),
        id(build_id),
        stage,
        vec![ExactEvidenceIdentity::new(
            format!("evidence-{operation_version}-{}", stage.as_str()),
            format!("sha256:{}", "a".repeat(64)),
        )],
        true,
        true,
        true,
        RestartEvidence::NotRequired,
        true,
        true,
        vec![id("hardware-observed-1")],
        vec![id("coverage-gap-unobserved-hardware")],
    )
}

#[derive(Clone)]
struct ExactSignatureVerifier;

impl RevocationSignatureVerifier for ExactSignatureVerifier {
    fn verify(&self, document: &SignedOperationRevocationDocument) -> bool {
        document.signature.as_str() == "valid-signature"
            && document.signature_key_id.as_str() == "release-key-1"
            && document.signed_payload_hash.as_str() == format!("sha256:{}", "b".repeat(64))
            && document.recovery_remains_available
    }
}

fn policy() -> ExactVersionPromotionPolicy<ExactSignatureVerifier> {
    ExactVersionPromotionPolicy::new(ExactSignatureVerifier)
}

fn evaluate(
    policy: &mut ExactVersionPromotionPolicy<ExactSignatureVerifier>,
    candidate: OperationPromotionDocument,
    evidence: ExactStageEvidence,
) -> PromotionDecision {
    policy.evaluate(PromotionRequest::new(candidate, evidence))
}

fn assert_blocked(decision: PromotionDecision, expected: PromotionBlockReason) {
    assert!(
        matches!(decision, PromotionDecision::Blocked(actual) if actual == expected),
        "expected {expected:?}, got {decision:?}"
    );
}

#[test]
fn d01_exact_version_advances_only_through_all_four_stages_in_order() {
    let mut policy = policy();
    let version = "power-scheme-v1";
    let cases = [
        (
            PromotionStage::DeterministicSimulation,
            "promotion-simulation",
            None,
            NextPromotionStage::CleanWindowsVm,
        ),
        (
            PromotionStage::CleanWindowsVm,
            "promotion-vm",
            Some("promotion-simulation"),
            NextPromotionStage::OwnerPc,
        ),
        (
            PromotionStage::OwnerPc,
            "promotion-owner",
            Some("promotion-vm"),
            NextPromotionStage::FriendsPc,
        ),
        (
            PromotionStage::FriendsPc,
            "promotion-friends",
            Some("promotion-owner"),
            NextPromotionStage::FullyPromoted,
        ),
    ];

    for (stage, promotion_id, previous, expected_next) in cases {
        let decision = evaluate(
            &mut policy,
            promotion(version, stage, "passed", promotion_id, previous),
            complete_cycle(version, stage),
        );
        let PromotionDecision::Accepted { promotion, next } = decision else {
            panic!("valid exact-version sequence must advance: {decision:?}")
        };
        assert_eq!(promotion.operation_version_id().as_str(), version);
        assert_eq!(promotion.immutable_build_id().as_str(), BUILD_ID);
        assert_eq!(promotion.stage(), stage);
        assert_eq!(next, expected_next);
    }
}

#[test]
fn d01_stage_skip_and_cross_version_evidence_reuse_fail_closed() {
    let mut skipped = policy();
    assert_blocked(
        evaluate(
            &mut skipped,
            promotion(
                "power-scheme-v1",
                PromotionStage::OwnerPc,
                "passed",
                "promotion-owner",
                Some("promotion-vm"),
            ),
            complete_cycle("power-scheme-v1", PromotionStage::OwnerPc),
        ),
        PromotionBlockReason::MissingPreviousStage,
    );

    let mut cross_version = policy();
    let simulation = evaluate(
        &mut cross_version,
        promotion(
            "power-scheme-v1",
            PromotionStage::DeterministicSimulation,
            "passed",
            "promotion-v1-simulation",
            None,
        ),
        complete_cycle("power-scheme-v1", PromotionStage::DeterministicSimulation),
    );
    assert!(matches!(simulation, PromotionDecision::Accepted { .. }));
    assert_blocked(
        evaluate(
            &mut cross_version,
            promotion(
                "power-scheme-v2",
                PromotionStage::CleanWindowsVm,
                "passed",
                "promotion-v2-vm",
                Some("promotion-v1-simulation"),
            ),
            complete_cycle("power-scheme-v2", PromotionStage::CleanWindowsVm),
        ),
        PromotionBlockReason::MissingPreviousStage,
    );
}

#[test]
fn immutable_build_drift_cannot_borrow_a_versions_prior_stage() {
    let mut policy = policy();
    let simulation = evaluate(
        &mut policy,
        promotion(
            "power-scheme-v1",
            PromotionStage::DeterministicSimulation,
            "passed",
            "build-a-simulation",
            None,
        ),
        complete_cycle_for_build(
            "power-scheme-v1",
            PromotionStage::DeterministicSimulation,
            "desktop-build-a",
        ),
    );
    assert!(matches!(simulation, PromotionDecision::Accepted { .. }));
    assert_blocked(
        evaluate(
            &mut policy,
            promotion(
                "power-scheme-v1",
                PromotionStage::CleanWindowsVm,
                "passed",
                "build-b-vm",
                Some("build-a-simulation"),
            ),
            complete_cycle_for_build(
                "power-scheme-v1",
                PromotionStage::CleanWindowsVm,
                "desktop-build-b",
            ),
        ),
        PromotionBlockReason::VersionMismatch,
    );
}

#[test]
fn d02_each_stage_requires_the_complete_recovery_cycle_and_exact_evidence_identity() {
    let stage = PromotionStage::DeterministicSimulation;
    let incomplete = [
        cycle(
            "power-scheme-v1",
            stage,
            false,
            true,
            true,
            RestartEvidence::NotRequired,
            true,
            true,
        ),
        cycle(
            "power-scheme-v1",
            stage,
            true,
            false,
            true,
            RestartEvidence::NotRequired,
            true,
            true,
        ),
        cycle(
            "power-scheme-v1",
            stage,
            true,
            true,
            false,
            RestartEvidence::NotRequired,
            true,
            true,
        ),
        cycle(
            "power-scheme-v1",
            stage,
            true,
            true,
            true,
            RestartEvidence::RequiredButMissing,
            true,
            true,
        ),
        cycle(
            "power-scheme-v1",
            stage,
            true,
            true,
            true,
            RestartEvidence::Completed,
            false,
            true,
        ),
        cycle(
            "power-scheme-v1",
            stage,
            true,
            true,
            true,
            RestartEvidence::Completed,
            true,
            false,
        ),
    ];

    for evidence in incomplete {
        let mut policy = policy();
        assert_blocked(
            evaluate(
                &mut policy,
                promotion(
                    "power-scheme-v1",
                    stage,
                    "passed",
                    "promotion-simulation",
                    None,
                ),
                evidence,
            ),
            PromotionBlockReason::EvidenceIncomplete,
        );
    }

    let mut wrong_version = policy();
    assert_blocked(
        evaluate(
            &mut wrong_version,
            promotion(
                "power-scheme-v1",
                stage,
                "passed",
                "promotion-simulation",
                None,
            ),
            complete_cycle("power-scheme-v2", stage),
        ),
        PromotionBlockReason::VersionMismatch,
    );

    let mut wrong_stage = policy();
    assert_blocked(
        evaluate(
            &mut wrong_stage,
            promotion(
                "power-scheme-v1",
                stage,
                "passed",
                "promotion-simulation",
                None,
            ),
            complete_cycle("power-scheme-v1", PromotionStage::CleanWindowsVm),
        ),
        PromotionBlockReason::StageSkipped,
    );

    let mut wrong_hash = policy();
    let mismatched = ExactStageEvidence::new(
        id("power-scheme-v1"),
        id(BUILD_ID),
        stage,
        vec![ExactEvidenceIdentity::new(
            "evidence-power-scheme-v1-deterministic-simulation",
            format!("sha256:{}", "f".repeat(64)),
        )],
        true,
        true,
        true,
        RestartEvidence::NotRequired,
        true,
        true,
        vec![id("hardware-observed-1")],
        vec![id("coverage-gap-unobserved-hardware")],
    );
    assert_blocked(
        evaluate(
            &mut wrong_hash,
            promotion(
                "power-scheme-v1",
                stage,
                "passed",
                "promotion-simulation",
                None,
            ),
            mismatched,
        ),
        PromotionBlockReason::EvidenceIncomplete,
    );
}

#[test]
fn d06_failure_permanently_blocks_that_version_and_correction_restarts_at_simulation() {
    let mut policy = policy();
    assert_blocked(
        evaluate(
            &mut policy,
            promotion(
                "power-scheme-v1",
                PromotionStage::DeterministicSimulation,
                "failed",
                "promotion-v1-failed",
                None,
            ),
            complete_cycle("power-scheme-v1", PromotionStage::DeterministicSimulation),
        ),
        PromotionBlockReason::StageFailed,
    );
    assert_blocked(
        evaluate(
            &mut policy,
            promotion(
                "power-scheme-v1",
                PromotionStage::DeterministicSimulation,
                "passed",
                "promotion-v1-override",
                None,
            ),
            complete_cycle("power-scheme-v1", PromotionStage::DeterministicSimulation),
        ),
        PromotionBlockReason::StageFailed,
    );
    assert_blocked(
        evaluate(
            &mut policy,
            promotion(
                "power-scheme-v1",
                PromotionStage::CleanWindowsVm,
                "passed",
                "promotion-v1-vm",
                Some("promotion-v1-failed"),
            ),
            complete_cycle("power-scheme-v1", PromotionStage::CleanWindowsVm),
        ),
        PromotionBlockReason::StageFailed,
    );

    let corrected = evaluate(
        &mut policy,
        promotion(
            "power-scheme-v2",
            PromotionStage::DeterministicSimulation,
            "passed",
            "promotion-v2-simulation",
            None,
        ),
        complete_cycle("power-scheme-v2", PromotionStage::DeterministicSimulation),
    );
    assert!(matches!(corrected, PromotionDecision::Accepted { .. }));
}

#[test]
fn malformed_failure_evidence_cannot_poison_an_exact_operation_version() {
    let mut policy = policy();
    let malformed_failure = ExactStageEvidence::new(
        id("power-scheme-v1"),
        id(BUILD_ID),
        PromotionStage::DeterministicSimulation,
        vec![ExactEvidenceIdentity::new(
            "different-evidence",
            format!("sha256:{}", "f".repeat(64)),
        )],
        true,
        true,
        true,
        RestartEvidence::NotRequired,
        true,
        true,
        vec![id("hardware-observed-1")],
        vec![id("coverage-gap-unobserved-hardware")],
    );
    assert_blocked(
        evaluate(
            &mut policy,
            promotion(
                "power-scheme-v1",
                PromotionStage::DeterministicSimulation,
                "failed",
                "malformed-failure",
                None,
            ),
            malformed_failure,
        ),
        PromotionBlockReason::EvidenceIncomplete,
    );

    let valid = evaluate(
        &mut policy,
        promotion(
            "power-scheme-v1",
            PromotionStage::DeterministicSimulation,
            "passed",
            "valid-after-rejected-failure",
            None,
        ),
        complete_cycle("power-scheme-v1", PromotionStage::DeterministicSimulation),
    );
    assert!(matches!(valid, PromotionDecision::Accepted { .. }));
}

#[test]
fn non_pass_verdicts_never_authorize_promotion() {
    for (verdict, reason) in [
        ("pending", PromotionBlockReason::PreviousStageNotPassed),
        ("blocked", PromotionBlockReason::PreviousStageNotPassed),
        ("revoked", PromotionBlockReason::VersionRevoked),
    ] {
        let mut policy = policy();
        assert_blocked(
            evaluate(
                &mut policy,
                promotion(
                    "power-scheme-v1",
                    PromotionStage::DeterministicSimulation,
                    verdict,
                    "promotion-non-pass",
                    None,
                ),
                complete_cycle("power-scheme-v1", PromotionStage::DeterministicSimulation),
            ),
            reason,
        );
    }
}

fn revocation(operation_version: &str, signature: &str) -> SignedOperationRevocationDocument {
    parse(json!({
        "kind": "operation-revocation",
        "schemaVersion": "1.0",
        "revocationId": format!("revocation-{operation_version}"),
        "operationVersionId": operation_version,
        "reason": "Observed unsafe behavior",
        "issuedAt": "2026-08-13T13:00:00Z",
        "signatureKeyId": "release-key-1",
        "signedPayloadHash": format!("sha256:{}", "b".repeat(64)),
        "signature": signature,
        "recoveryRemainsAvailable": true,
        "audit": {
            "auditId": format!("audit-revocation-{operation_version}"),
            "recordedAt": "2026-08-13T13:00:01Z"
        }
    }))
}

#[test]
fn d08_revocation_fails_closed_and_has_no_remote_mutation_authority() {
    let mut policy = policy();
    assert!(
        policy
            .verify_revocation(revocation("power-scheme-v1", "unsigned"))
            .is_err()
    );
    assert!(!policy.new_applications_blocked(&id("power-scheme-v1")));

    let disposition = policy
        .verify_revocation(revocation("power-scheme-v1", "valid-signature"))
        .expect("exact signed revocation must be admitted");
    assert!(disposition.blocks_new_applications());
    assert!(disposition.alerts_affected_users());
    assert!(disposition.local_recovery_available());
    assert!(!disposition.authorizes_remote_rollback());
    assert!(!disposition.authorizes_remote_execution());
    assert!(policy.new_applications_blocked(&id("power-scheme-v1")));
    assert!(policy.local_recovery_available(&id("power-scheme-v1")));
    assert!(!policy.new_applications_blocked(&id("power-scheme-v2")));

    assert_blocked(
        evaluate(
            &mut policy,
            promotion(
                "power-scheme-v1",
                PromotionStage::DeterministicSimulation,
                "passed",
                "promotion-after-revocation",
                None,
            ),
            complete_cycle("power-scheme-v1", PromotionStage::DeterministicSimulation),
        ),
        PromotionBlockReason::VersionRevoked,
    );
}

fn diagnostic_document() -> RedactedDiagnosticExportDocument {
    parse(json!({
        "kind": "redacted-diagnostic-export",
        "schemaVersion": "1.0",
        "exportId": "diagnostic-export-1",
        "planId": "plan-1",
        "generatedAt": "2026-08-13T14:00:00Z",
        "journalHeadHash": format!("sha256:{}", "c".repeat(64)),
        "entries": [{
            "eventId": "event-1",
            "transactionId": "transaction-1",
            "operationVersionId": "power-scheme-v1",
            "state": "blocked",
            "occurredAt": "2026-08-13T13:59:00Z",
            "reasonCode": "verification-failed",
            "eventHash": format!("sha256:{}", "d".repeat(64))
        }],
        "redactionsApplied": ["machine-identifier", "account-identity", "secret-material"],
        "audit": {
            "auditId": "audit-diagnostic-1",
            "recordedAt": "2026-08-13T14:00:01Z"
        }
    }))
}

#[test]
fn d07_diagnostics_are_local_redacted_preview_first_and_never_auto_uploaded() {
    let raw_machine = "DESKTOP-RAW-IDENTIFIER";
    let raw_account = "owner@example.invalid";
    let raw_secret = "top-secret-token";
    let journal = LocalDiagnosticJournal::new(
        diagnostic_document(),
        vec![raw_machine.into(), raw_account.into()],
        vec![raw_secret.into()],
    );
    let preview = RedactedDiagnosticPolicy
        .project_redacted(&journal)
        .expect("local projection must succeed");
    let serialized = serde_json::to_string(preview.transport()).expect("serialize preview");
    assert!(!serialized.contains(raw_machine));
    assert!(!serialized.contains(raw_account));
    assert!(!serialized.contains(raw_secret));
    assert!(preview.requires_explicit_consent());
    assert!(!preview.has_automatic_transport());

    let denied = DiagnosticReleaseConsent::new(
        preview.fingerprint().to_owned(),
        DiagnosticReleaseIntent::ExportLocalFile,
        false,
    );
    assert!(preview.authorize_release(denied).is_err());

    let wrong_preview = DiagnosticReleaseConsent::new(
        format!("sha256:{}", "e".repeat(64)),
        DiagnosticReleaseIntent::SendToSupport,
        true,
    );
    assert!(preview.authorize_release(wrong_preview).is_err());

    for intent in [
        DiagnosticReleaseIntent::ExportLocalFile,
        DiagnosticReleaseIntent::SendToSupport,
    ] {
        let consent = DiagnosticReleaseConsent::new(preview.fingerprint().to_owned(), intent, true);
        let release = preview
            .authorize_release(consent)
            .expect("exact preview and explicit consent authorize a user action");
        assert_eq!(release.intent(), intent);
        assert!(!release.is_automatic());
    }
}

#[test]
fn d35_every_projection_retains_coverage_gaps_and_never_claims_universal_support() {
    let mut policy = policy();
    for (stage, promotion_id, previous) in [
        (
            PromotionStage::DeterministicSimulation,
            "coverage-simulation",
            None,
        ),
        (
            PromotionStage::CleanWindowsVm,
            "coverage-vm",
            Some("coverage-simulation"),
        ),
        (
            PromotionStage::OwnerPc,
            "coverage-owner",
            Some("coverage-vm"),
        ),
        (
            PromotionStage::FriendsPc,
            "coverage-friends",
            Some("coverage-owner"),
        ),
    ] {
        let decision = evaluate(
            &mut policy,
            promotion("power-scheme-v1", stage, "passed", promotion_id, previous),
            complete_cycle("power-scheme-v1", stage),
        );
        let PromotionDecision::Accepted { promotion, .. } = decision else {
            panic!("complete stage should be accepted: {decision:?}")
        };
        assert_eq!(
            promotion
                .coverage_gaps()
                .iter()
                .map(|identifier| identifier.as_str())
                .collect::<Vec<_>>(),
            ["coverage-gap-unobserved-hardware"]
        );
        assert!(!promotion.claims_universal_support());
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn arbitrary_stage_histories_never_advance_across_a_gap_or_after_failure(
        stages in prop::collection::vec(0u8..=4, 1..24),
    ) {
        let mut policy = policy();
        let version = "property-version-v1";
        let mut next_expected = PromotionStage::DeterministicSimulation;
        let mut failed = false;
        let mut previous_promotion: Option<String> = None;

        for (index, code) in stages.into_iter().enumerate() {
            let stage = match code % 4 {
                0 => PromotionStage::DeterministicSimulation,
                1 => PromotionStage::CleanWindowsVm,
                2 => PromotionStage::OwnerPc,
                _ => PromotionStage::FriendsPc,
            };
            let should_fail = code == 4;
            let promotion_id = format!("property-promotion-{index}");
            let decision = evaluate(
                &mut policy,
                promotion(
                    version,
                    stage,
                    if should_fail { "failed" } else { "passed" },
                    &promotion_id,
                    previous_promotion.as_deref(),
                ),
                complete_cycle(version, stage),
            );

            match decision {
                PromotionDecision::Accepted { promotion, .. } => {
                    prop_assert!(!failed);
                    prop_assert_eq!(promotion.stage(), next_expected);
                    previous_promotion = Some(promotion_id);
                    next_expected = next_expected.next().unwrap_or(PromotionStage::FriendsPc);
                }
                PromotionDecision::Blocked(PromotionBlockReason::StageFailed) => {
                    failed = true;
                }
                PromotionDecision::Blocked(_) => {}
            }
        }
    }

    #[test]
    fn arbitrary_sensitive_values_never_enter_redacted_preview(
        machine_suffix in "[A-Za-z0-9]{1,24}",
        secret_suffix in "[A-Za-z0-9]{1,24}",
    ) {
        let raw_machine = format!("RAW-MACHINE-{machine_suffix}");
        let raw_secret = format!("RAW-SECRET-{secret_suffix}");
        let journal = LocalDiagnosticJournal::new(
            diagnostic_document(),
            vec![raw_machine.clone()],
            vec![raw_secret.clone()],
        );
        let preview = RedactedDiagnosticPolicy
            .project_redacted(&journal)
            .expect("raw fields remain outside the redacted projection");
        let serialized = serde_json::to_string(preview.transport()).expect("serialize preview");
        prop_assert!(!serialized.contains(&raw_machine));
        prop_assert!(!serialized.contains(&raw_secret));
        prop_assert!(!preview.has_automatic_transport());
    }
}
