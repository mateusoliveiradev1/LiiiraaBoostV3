#[path = "../src/evidence_store.rs"]
mod evidence_store;
#[path = "../src/measurement.rs"]
mod measurement;

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use evidence_store::{EvidenceLifecycle, EvidenceStore};
use liiiraa_contracts_rust::validate_hardware_evidence_document;
use measurement::{
    BoundedScheduler, CaptureMetadata, CaptureSession, CounterObservation, FrameAggregator,
    FrameEvent, MetricKind, SchedulerLimits, SourceHealth,
};

const STARTED_AT: &str = "2026-08-12T12:00:00Z";
const COMPLETED_AT: &str = "2026-08-12T12:00:10Z";

fn reference_trace() -> measurement::ReferenceTrace {
    serde_json::from_str(include_str!(
        "fixtures/measurement/reference-traces.json"
    ))
    .expect("reference trace fixture")
}

fn metadata(session_id: &str) -> CaptureMetadata {
    CaptureMetadata {
        session_id: session_id.to_owned(),
        evidence_version: 1,
        started_at: STARTED_AT.to_owned(),
        deadline_at: "2026-08-12T12:00:30Z".to_owned(),
        baseline_id: format!("baseline-{session_id}"),
        inventory_evidence_id: "inventory-real-windows-1".to_owned(),
        inventory_evidence_hash: format!("sha256:{}", "a".repeat(64)),
        collector_version: "measurement-v1".to_owned(),
    }
}

#[test]
fn reference_frames_reproduce_fps_one_percent_low_and_frame_time() {
    let trace = reference_trace();
    let aggregate = FrameAggregator::summarize(&trace.frames).expect("reliable frame aggregate");

    assert_eq!(aggregate.sample_count, trace.expected.sample_count);
    assert!((aggregate.average_frame_time_ms - trace.expected.average_frame_time_ms).abs() < 0.001);
    assert!((aggregate.average_fps - trace.expected.average_fps).abs() < 0.001);
    assert!((aggregate.one_percent_low_fps - trace.expected.one_percent_low_fps).abs() < 0.001);
    assert!((aggregate.p95_frame_time_ms - trace.expected.p95_frame_time_ms).abs() < 0.001);
}

#[test]
fn frames_are_event_driven_and_non_frame_polling_never_exceeds_one_hz() {
    let mut scheduler = BoundedScheduler::new(SchedulerLimits::default());
    for offset in 0..100 {
        assert!(scheduler.admit_frame_event(offset * 1_000_000));
    }

    assert!(scheduler.try_reserve_counter(MetricKind::CpuUtilizationPercent, 0));
    scheduler.complete_counter(MetricKind::CpuUtilizationPercent);
    assert!(!scheduler.try_reserve_counter(MetricKind::CpuUtilizationPercent, 100_000_000));
    assert!(!scheduler.try_reserve_counter(MetricKind::CpuUtilizationPercent, 999_999_999));
    assert!(scheduler.try_reserve_counter(MetricKind::CpuUtilizationPercent, 1_000_000_000));
    scheduler.complete_counter(MetricKind::CpuUtilizationPercent);

    assert_eq!(scheduler.accepted_frame_events(), 100);
    assert_eq!(scheduler.accepted_counter_polls(), 2);
    assert!(scheduler.effective_counter_interval_ns() >= 1_000_000_000);
}

#[test]
fn permission_loss_and_invalid_counter_status_stay_non_numeric_and_degrade() {
    let mut capture = CaptureSession::new(metadata("session-degraded"), SchedulerLimits::default())
        .expect("capture state");
    for frame in reference_trace().frames.into_iter().take(8) {
        capture.ingest_frame(frame);
    }
    capture.ingest_counter(CounterObservation {
        monotonic_ns: 1_000_000_000,
        metric: MetricKind::GpuUtilizationPercent,
        value: None,
        health: SourceHealth::PermissionDenied,
    });
    capture.ingest_counter(CounterObservation {
        monotonic_ns: 1_000_000_000,
        metric: MetricKind::CpuUtilizationPercent,
        value: Some(97.0),
        health: SourceHealth::InvalidCounterStatus,
    });

    let result = capture.finalize(COMPLETED_AT).expect("degraded evidence");
    validate_hardware_evidence_document(&result.document).expect("generated contract accepts it");
    assert_eq!(result.document["status"], "degraded");
    let serialized = serde_json::to_string(&result.document).unwrap();
    assert!(!serialized.contains("97.0"));
    assert!(!serialized.contains("gpu-utilization-percent"));
    assert!(serialized.contains("permission-denied"));
    assert!(serialized.contains("invalid-counter-status"));
}

#[test]
fn monotonic_clock_discontinuity_invalidates_instead_of_reordering_samples() {
    let mut capture = CaptureSession::new(metadata("session-clock-jump"), SchedulerLimits::default())
        .expect("capture state");
    capture.ingest_frame(FrameEvent {
        monotonic_ns: 20_000_000,
        frame_time_ms: 10.0,
        health: SourceHealth::Valid,
    });
    capture.ingest_frame(FrameEvent {
        monotonic_ns: 10_000_000,
        frame_time_ms: 10.0,
        health: SourceHealth::Valid,
    });

    let result = capture.finalize(COMPLETED_AT).expect("invalid evidence remains inspectable");
    validate_hardware_evidence_document(&result.document).expect("generated contract accepts it");
    assert_eq!(result.document["status"], "invalid");
    assert!(result.document.get("chunks").is_none());
    assert!(result.document["reason"]
        .as_str()
        .unwrap()
        .contains("clock-discontinuity"));
}

#[test]
fn bounded_backpressure_records_loss_and_never_grows_the_sample_buffer() {
    let limits = SchedulerLimits {
        max_buffered_samples: 3,
        ..SchedulerLimits::default()
    };
    let mut capture = CaptureSession::new(metadata("session-backpressure"), limits)
        .expect("capture state");
    for index in 0..5 {
        capture.ingest_frame(FrameEvent {
            monotonic_ns: index * 10_000_000,
            frame_time_ms: 10.0,
            health: SourceHealth::Valid,
        });
    }

    let result = capture.finalize(COMPLETED_AT).expect("degraded bounded evidence");
    assert_eq!(result.document["status"], "degraded");
    assert_eq!(result.document["chunks"][0]["values"].as_array().unwrap().len(), 3);
    assert!(serde_json::to_string(&result.document)
        .unwrap()
        .contains("backpressure"));
}

#[test]
fn cancellation_is_bounded_visible_and_idempotent() {
    let mut capture = CaptureSession::new(metadata("session-cancelled"), SchedulerLimits::default())
        .expect("capture state");
    assert!(capture.request_cancel(5_000_000));
    assert!(!capture.request_cancel(6_000_000));
    assert!(capture.acknowledge_cancel(105_000_000));
    assert!(!capture.acknowledge_cancel(106_000_000));

    let result = capture.finalize(COMPLETED_AT).expect("cancelled evidence");
    validate_hardware_evidence_document(&result.document).expect("generated contract accepts it");
    assert_eq!(result.document["status"], "incomplete");
    assert_eq!(result.document["execution"]["cancellationState"], "acknowledged");
    assert!(capture.cancellation_latency_ms().unwrap() <= 250);
}

#[test]
fn incomplete_and_completed_sessions_remain_visible_across_restart() {
    let database = TempDatabase::new("measurement-lifecycle");
    {
        let mut store = EvidenceStore::open(&database.path).expect("open evidence store");
        let mut capture = CaptureSession::new(metadata("session-persisted"), SchedulerLimits::default())
            .expect("capture state");
        capture.persist_incomplete(&mut store, 10).expect("persist incomplete session");
        for frame in reference_trace().frames.into_iter().take(10) {
            capture.ingest_frame(frame);
        }
        let result = capture.finalize(COMPLETED_AT).expect("completed evidence");
        assert_eq!(result.document["status"], "completed");
        capture
            .persist_completed(&mut store, &result, 11)
            .expect("atomic completion");
    }

    let store = EvidenceStore::open(&database.path).expect("reopen evidence store");
    let stored = store.get("session-persisted").expect("restart-visible session");
    assert_eq!(stored.lifecycle, EvidenceLifecycle::Completed);
    assert_eq!(store.chunk_sequences("session-persisted").unwrap(), vec![0]);
}

struct TempDatabase {
    path: PathBuf,
}

impl TempDatabase {
    fn new(label: &str) -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "liiiraa-{label}-{}-{nonce}.sqlite3",
            std::process::id()
        ));
        let _ = fs::remove_file(&path);
        Self { path }
    }
}

impl Drop for TempDatabase {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
        let _ = fs::remove_file(self.path.with_extension("sqlite3-shm"));
        let _ = fs::remove_file(self.path.with_extension("sqlite3-wal"));
    }
}

