#[path = "../src/comparison.rs"]
mod comparison;
#[path = "../src/evidence_report.rs"]
mod evidence_report;

use comparison::{
    ClaimAuthorityState, ComparisonBlocker, ComparisonRequest, EvidenceQuality, MetricSample,
    SessionEvidence, admit_claim, compare,
};
use evidence_report::{ReportError, render_report, verify_report};
use liiiraa_contracts_rust::validate_hardware_evidence_document;

const COMPARED_AT: &str = "2026-08-12T03:00:00Z";

fn hash(seed: char) -> String {
    format!("sha256:{}", seed.to_string().repeat(64))
}

fn session(id: &str, seed: char, value: f64) -> SessionEvidence {
    SessionEvidence {
        session_id: id.to_owned(),
        evidence_hash: hash(seed),
        inventory_evidence_id: "inventory-1".to_owned(),
        inventory_evidence_hash: hash('a'),
        workload_id: "game-fixture".to_owned(),
        environment_id: "windows-11-24h2".to_owned(),
        methodology_id: "event-frame-v1".to_owned(),
        duration_ms: 60_000,
        coverage_ppm: 1_000_000,
        source_healthy: true,
        quality: EvidenceQuality::Valid,
        metric: Some(MetricSample {
            kind: "frame-time-ms".to_owned(),
            unit: "milliseconds".to_owned(),
            value,
            quality: EvidenceQuality::Valid,
        }),
    }
}

fn request() -> ComparisonRequest {
    ComparisonRequest {
        comparison_id: "comparison-1".to_owned(),
        before: session("session-before", 'b', 12.0),
        after: session("session-after", 'c', 9.0),
        compared_at: COMPARED_AT.to_owned(),
    }
}

#[test]
fn equivalent_sessions_produce_one_schema_valid_authoritative_projection() {
    let result = compare(&request());
    assert!(result.accepted());
    validate_hardware_evidence_document(&result.document).expect("comparison contract");
    let projection = result.projection.as_ref().expect("projection");
    assert_eq!(projection.before, 12.0);
    assert_eq!(projection.after, 9.0);
    assert_eq!(projection.delta, -3.0);
    assert_eq!(result.document["acceptedResult"]["delta"], -3.0);
    assert_eq!(
        result.document["acceptedResult"]["evidenceHash"],
        projection.evidence_hash
    );
}

#[test]
fn every_dimension_mismatch_is_returned_in_stable_order_without_delta() {
    let mut input = request();
    input.after.inventory_evidence_hash = hash('d');
    input.after.workload_id = "other-game".to_owned();
    input.after.methodology_id = "polling-v2".to_owned();
    input.after.duration_ms = 5_000;
    input.after.coverage_ppm = 500_000;
    input.after.source_healthy = false;
    input.before.quality = EvidenceQuality::Invalid;
    input.after.quality = EvidenceQuality::Degraded;
    input.after.metric.as_mut().unwrap().kind = "fps".to_owned();

    let result = compare(&input);
    assert!(!result.accepted());
    assert_eq!(
        result.blockers,
        vec![
            ComparisonBlocker::HardwareDrift,
            ComparisonBlocker::WorkloadDrift,
            ComparisonBlocker::InsufficientSamples,
            ComparisonBlocker::InvalidBefore,
            ComparisonBlocker::InvalidAfter,
            ComparisonBlocker::IncompatibleMetric,
            ComparisonBlocker::UnsupportedQuality,
        ]
    );
    assert!(result.projection.is_none());
    assert!(result.document.get("acceptedResult").is_none());
    validate_hardware_evidence_document(&result.document).expect("rejected contract");
}

#[test]
fn absent_optional_metric_never_turns_into_a_numeric_placeholder() {
    let mut input = request();
    input.after.metric = None;
    let result = compare(&input);
    assert_eq!(result.blockers, vec![ComparisonBlocker::IncompatibleMetric]);
    let serialized = serde_json::to_string(&result.document).unwrap();
    assert!(!serialized.contains("\"delta\""));
    assert!(!serialized.contains("0.0"));
}

#[test]
fn report_json_and_accessible_offline_html_share_the_exact_projection() {
    let comparison = compare(&request());
    let report = render_report(
        &comparison,
        "report-1",
        "2026-08-12T03:01:00Z",
        &["Somente uma carga reproduzível foi comparada.".to_owned()],
    )
    .expect("report");
    validate_hardware_evidence_document(&report.document).expect("report contract");
    verify_report(&report).expect("report verifies");

    let projection = comparison.projection.unwrap();
    assert!(report.json.contains(&projection.evidence_hash));
    assert!(report.html.contains(&projection.evidence_hash));
    assert!(report.html.contains("<main"));
    assert!(report.html.contains("<caption>"));
    assert!(report.html.contains("lang=\"pt-BR\""));
    assert!(!report.html.contains("http://"));
    assert!(!report.html.contains("https://"));
    assert!(!report.html.contains("serial"));
    assert!(!report.html.contains("macAddress"));
}

#[test]
fn tampered_json_or_html_fails_reopen_validation() {
    let comparison = compare(&request());
    let report = render_report(
        &comparison,
        "report-tamper",
        "2026-08-12T03:01:00Z",
        &["Limitação declarada".to_owned()],
    )
    .unwrap();

    let mut bad_json = report.clone();
    bad_json.json = bad_json.json.replace("-3.0", "999.0");
    assert_eq!(verify_report(&bad_json), Err(ReportError::HashMismatch));

    let mut bad_html = report;
    bad_html.html = bad_html.html.replace("-3", "999");
    assert_eq!(verify_report(&bad_html), Err(ReportError::HashMismatch));
}

#[test]
fn only_approved_immutable_comparison_can_support_a_claim() {
    let comparison = compare(&request());
    let admitted = admit_claim(
        "claim-1",
        "Redução medida de frame time",
        &comparison,
        ClaimAuthorityState::Approved,
        COMPARED_AT,
    );
    assert!(admitted.admitted);
    validate_hardware_evidence_document(&admitted.document).expect("claim contract");

    let revoked = admit_claim(
        "claim-1",
        "Redução medida de frame time",
        &comparison,
        ClaimAuthorityState::Revoked,
        COMPARED_AT,
    );
    assert!(!revoked.admitted);
    assert_eq!(revoked.history_reference, "comparison-1");
    assert_eq!(revoked.document["state"], "rejected");

    let rejected_comparison = {
        let mut input = request();
        input.after.workload_id = "other".to_owned();
        compare(&input)
    };
    assert!(
        !admit_claim(
            "claim-2",
            "claim",
            &rejected_comparison,
            ClaimAuthorityState::Approved,
            COMPARED_AT,
        )
        .admitted
    );
}
