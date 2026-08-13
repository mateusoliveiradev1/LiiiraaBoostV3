use liiiraa_contracts_rust::{
    DependencyGroup, DeviceAuthorityBinding, EvidenceReference, PlanOperation,
};
use liiiraa_plan_engine::{
    domain::{GeneratedTransport, PlanEngineErrorCode, RendererPlanIntent},
    revision::{
        CanonicalOperationRegistry, DeterministicRevisionComposer, RevisionComposition,
        RevisionEvidence, RevisionEvidenceDisposition,
    },
    risk::RiskCeiling,
};
use serde_json::{Value, json};

fn parse<T: serde::de::DeserializeOwned>(value: Value) -> T {
    serde_json::from_value(value).expect("fixture must match the generated contract")
}

fn hash(character: char) -> String {
    format!("sha256:{}", character.to_string().repeat(64))
}

fn evidence(id: &str, character: char) -> EvidenceReference {
    parse(json!({
        "evidenceId": id,
        "evidenceHash": hash(character),
        "capturedAt": "2026-08-13T10:00:00Z",
        "validUntil": "2026-08-14T10:00:00Z",
        "quality": "valid"
    }))
}

fn operation(
    id: &str,
    group_id: &str,
    risk: &str,
    restart: &str,
    recovery: &str,
    evidence: Vec<EvidenceReference>,
) -> PlanOperation {
    parse(json!({
        "operationVersionId": id,
        "operationKind": "managed-power-scheme-v1",
        "purpose": format!("Purpose for {id}"),
        "expectedImpact": format!("Expected impact for {id}"),
        "risk": risk,
        "evidence": evidence,
        "compatibility": {
            "verdict": "compatible",
            "reasons": [format!("Compatible evidence for {id}")]
        },
        "restartEffect": restart,
        "previousValue": {
            "state": "observed",
            "schemeId": "11111111-1111-4111-8111-111111111111",
            "canonicalStateHash": hash('1'),
            "observedAt": "2026-08-13T10:00:00Z"
        },
        "requestedValue": {
            "state": "observed",
            "schemeId": "22222222-2222-4222-8222-222222222222",
            "canonicalStateHash": hash('2'),
            "observedAt": "2026-08-13T10:00:01Z"
        },
        "recoveryMethod": recovery,
        "dependencyGroupId": group_id
    }))
}

fn group(id: &str, operations: &[&str], dependencies: &[&str]) -> DependencyGroup {
    parse(json!({
        "dependencyGroupId": id,
        "operationVersionIds": operations,
        "dependsOnGroupIds": dependencies
    }))
}

fn device() -> DeviceAuthorityBinding {
    parse(json!({
        "deviceBindingId": "device-native-1",
        "hardwareFingerprint": hash('a'),
        "securityPostureFingerprint": hash('b')
    }))
}

fn admitted(id: &str, references: Vec<EvidenceReference>) -> RevisionEvidence {
    RevisionEvidence::new(
        id.parse().unwrap(),
        references,
        RevisionEvidenceDisposition::Admitted,
    )
}

fn registry() -> CanonicalOperationRegistry {
    CanonicalOperationRegistry::new(
        vec![
            operation(
                "op-advanced-v1",
                "group-tuning",
                "advanced",
                "required",
                "system-restore-complement",
                vec![evidence("evidence-advanced", 'd')],
            ),
            operation(
                "op-verified-v1",
                "group-base",
                "verified",
                "none",
                "exact-prior-scheme",
                vec![evidence("evidence-verified", 'c')],
            ),
        ],
        vec![
            group("group-tuning", &["op-advanced-v1"], &["group-base"]),
            group("group-base", &["op-verified-v1"], &[]),
        ],
    )
}

fn authorities() -> Vec<RevisionEvidence> {
    vec![
        admitted("op-advanced-v1", vec![evidence("evidence-advanced", 'd')]),
        admitted("op-verified-v1", vec![evidence("evidence-verified", 'c')]),
    ]
}

fn compose(
    selected: &[&str],
    registry: &CanonicalOperationRegistry,
    evidence: &[RevisionEvidence],
) -> liiiraa_plan_engine::revision::PlanRevisionHistory {
    let intent = RendererPlanIntent::new(
        selected.iter().map(|id| id.parse().unwrap()).collect(),
        RiskCeiling::Advanced,
    );
    let device = device();

    DeterministicRevisionComposer
        .compose(RevisionComposition::new(
            &intent, &device, registry, evidence,
        ))
        .expect("admitted canonical inputs compose")
}

#[test]
fn equal_authority_inputs_produce_identical_canonical_bytes_and_fingerprints() {
    let registry_a = registry();
    let evidence_a = authorities();
    let first = compose(
        &["op-advanced-v1", "op-verified-v1"],
        &registry_a,
        &evidence_a,
    );

    let mut operations = registry().operations().to_vec();
    operations.reverse();
    let mut groups = registry().dependency_groups().to_vec();
    groups.reverse();
    let registry_b = CanonicalOperationRegistry::new(operations, groups);
    let mut evidence_b = authorities();
    evidence_b.reverse();
    let second = compose(
        &["op-verified-v1", "op-advanced-v1"],
        &registry_b,
        &evidence_b,
    );

    let first_document = first.current().transport();
    let second_document = second.current().transport();
    assert_eq!(
        serde_json::to_vec(first_document).unwrap(),
        serde_json::to_vec(second_document).unwrap()
    );
    assert_eq!(
        first_document.revision_fingerprint,
        second_document.revision_fingerprint
    );
    assert_eq!(
        first_document.evidence_fingerprint,
        second_document.evidence_fingerprint
    );
}

#[test]
fn composed_revision_preserves_complete_operation_metadata_in_dependency_order() {
    let registry = registry();
    let evidence = authorities();
    let history = compose(&["op-advanced-v1", "op-verified-v1"], &registry, &evidence);
    let document = history.current().transport();

    assert_eq!(document.revision.get(), 1);
    assert_eq!(document.operations.len(), 2);
    assert_eq!(
        document.operations[0].operation_version_id.as_str(),
        "op-verified-v1"
    );
    assert_eq!(
        document.operations[1].operation_version_id.as_str(),
        "op-advanced-v1"
    );
    assert_eq!(
        document.dependency_groups[0].dependency_group_id.as_str(),
        "group-base"
    );
    assert_eq!(
        document.dependency_groups[1].depends_on_group_ids[0].as_str(),
        "group-base"
    );
    let advanced = &document.operations[1];
    assert_eq!(advanced.purpose.as_str(), "Purpose for op-advanced-v1");
    assert_eq!(
        advanced.expected_impact.as_str(),
        "Expected impact for op-advanced-v1"
    );
    assert_eq!(advanced.risk.to_string(), "advanced");
    assert_eq!(advanced.compatibility.verdict.to_string(), "compatible");
    assert_eq!(advanced.restart_effect.to_string(), "required");
    assert_eq!(
        advanced.recovery_method.to_string(),
        "system-restore-complement"
    );
    assert_eq!(advanced.evidence[0].evidence_hash.as_str(), hash('d'));
    assert_ne!(document.revision_fingerprint, document.evidence_fingerprint);
    assert_eq!(document.device.hardware_fingerprint.as_str(), hash('a'));
}

#[test]
fn add_and_remove_create_new_revisions_without_rewriting_prior_bytes() {
    let registry = registry();
    let evidence = authorities();
    let initial = compose(&["op-verified-v1"], &registry, &evidence);
    let initial_bytes = serde_json::to_vec(initial.current().transport()).unwrap();

    let add_intent = RendererPlanIntent::new(
        vec![
            "op-verified-v1".parse().unwrap(),
            "op-advanced-v1".parse().unwrap(),
        ],
        RiskCeiling::Advanced,
    );
    let device = device();
    let added = DeterministicRevisionComposer
        .revise(
            &initial,
            RevisionComposition::new(&add_intent, &device, &registry, &evidence),
        )
        .expect("adding an operation creates a revision");
    let remove_intent = RendererPlanIntent::new(
        vec!["op-verified-v1".parse().unwrap()],
        RiskCeiling::Advanced,
    );
    let removed = DeterministicRevisionComposer
        .revise(
            &added,
            RevisionComposition::new(&remove_intent, &device, &registry, &evidence),
        )
        .expect("removing an operation creates a revision");

    assert_eq!(removed.revisions().len(), 3);
    assert_eq!(removed.revisions()[0].transport().revision.get(), 1);
    assert_eq!(removed.revisions()[1].transport().revision.get(), 2);
    assert_eq!(removed.revisions()[2].transport().revision.get(), 3);
    assert_eq!(
        serde_json::to_vec(removed.revisions()[0].transport()).unwrap(),
        initial_bytes
    );
    assert_ne!(
        removed.revisions()[0].revision_fingerprint(),
        removed.revisions()[1].revision_fingerprint()
    );
    assert_ne!(
        removed.revisions()[1].revision_fingerprint(),
        removed.revisions()[2].revision_fingerprint()
    );
}

fn assert_evidence_disposition_is_rejected(disposition: RevisionEvidenceDisposition) {
    let registry = registry();
    let evidence = vec![RevisionEvidence::new(
        "op-verified-v1".parse().unwrap(),
        vec![evidence("evidence-verified", 'c')],
        disposition,
    )];
    let intent = RendererPlanIntent::new(
        vec!["op-verified-v1".parse().unwrap()],
        RiskCeiling::Verified,
    );
    let device = device();
    let error = DeterministicRevisionComposer
        .compose(RevisionComposition::new(
            &intent, &device, &registry, &evidence,
        ))
        .expect_err("non-admitted evidence must fail closed");
    assert_eq!(error.code(), PlanEngineErrorCode::EvidenceNotAdmitted);
}

#[test]
fn unknown_evidence_cannot_become_compatible_plan_truth() {
    assert_evidence_disposition_is_rejected(RevisionEvidenceDisposition::Unknown);
}

#[test]
fn degraded_evidence_cannot_become_compatible_plan_truth() {
    assert_evidence_disposition_is_rejected(RevisionEvidenceDisposition::Degraded);
}

#[test]
fn contradictory_evidence_cannot_become_compatible_plan_truth() {
    assert_evidence_disposition_is_rejected(RevisionEvidenceDisposition::Contradictory);
}

#[test]
fn incompatible_evidence_cannot_become_compatible_plan_truth() {
    assert_evidence_disposition_is_rejected(RevisionEvidenceDisposition::Incompatible);
}

#[test]
fn revoked_evidence_cannot_become_compatible_plan_truth() {
    assert_evidence_disposition_is_rejected(RevisionEvidenceDisposition::Revoked);
}
