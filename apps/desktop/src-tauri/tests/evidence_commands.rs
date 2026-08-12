#[path = "../src/comparison.rs"]
mod comparison;
#[path = "../src/evidence_commands.rs"]
mod evidence_commands;
#[path = "../src/evidence_report.rs"]
mod evidence_report;
#[path = "../src/evidence_store.rs"]
mod evidence_store;
#[path = "../src/hardware_inventory.rs"]
mod hardware_inventory;
#[path = "../src/measurement.rs"]
mod measurement;
#[path = "../src/windows_lifecycle.rs"]
mod windows_lifecycle;

use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use comparison::{EvidenceQuality, MetricSample, SessionEvidence};
use evidence_commands::{
    CancelCaptureRequest, CaptureStartRequest, CommandError, ComparisonCommandRequest,
    EvidenceAuthority, ExportFormat, ExportReportRequest, FinishCaptureRequest,
    InventoryRefreshRequest, RenderReportRequest,
};
use hardware_inventory::{HardwareClass, HardwareInventorySource, RawHardwareFact, RawInventory};
use measurement::{CounterObservation, MetricKind, SourceHealth};
use windows_lifecycle::{ServicingChannel, WindowsEdition, WindowsVersionEvidence};

const NOW: &str = "2026-08-12T12:00:00Z";
const DEADLINE: &str = "2026-08-12T12:00:30Z";

#[derive(Clone)]
struct SyntheticInventory {
    raw: RawInventory,
}

impl HardwareInventorySource for SyntheticInventory {
    fn collect(&self) -> RawInventory {
        self.raw.clone()
    }
}

fn observed_inventory() -> RawInventory {
    let mut facts = BTreeMap::new();
    for (class, value) in [
        (HardwareClass::Cpu, "AMD Ryzen 7 7800X3D"),
        (HardwareClass::Gpu, "NVIDIA GeForce RTX 4070"),
        (HardwareClass::Memory, "32 GiB"),
        (HardwareClass::Storage, "2 fixed volumes"),
        (HardwareClass::Network, "1 active adapter"),
        (HardwareClass::Display, "2560x1440 144 Hz"),
        (HardwareClass::Audio, "default endpoint"),
        (HardwareClass::Usb, "4 devices"),
        (HardwareClass::Windows, "build 26100"),
        (HardwareClass::Drivers, "display driver observed"),
        (HardwareClass::Security, "security state available"),
        (HardwareClass::Games, "2 supported games"),
    ] {
        facts.insert(
            class,
            RawHardwareFact::observed(value, "synthetic-native", NOW, 8),
        );
    }
    facts.insert(
        HardwareClass::Storage,
        RawHardwareFact::observed_with_protected(
            "2 fixed volumes",
            "synthetic-native",
            NOW,
            8,
            vec!["RAW-SERIAL-MUST-NOT-CROSS".to_owned()],
        ),
    );
    RawInventory {
        facts,
        windows_version: WindowsVersionEvidence {
            major: 10,
            minor: 0,
            build: 26_100,
            edition: WindowsEdition::Professional,
            channel: ServicingChannel::GeneralAvailability,
            esu_enrolled: false,
            contradictory: false,
            policy_version: 1,
        },
    }
}

fn refresh_request() -> InventoryRefreshRequest {
    InventoryRefreshRequest {
        schema_version: "1.0".to_owned(),
        evidence_id: "inventory-command-1".to_owned(),
        evidence_version: 1,
        collected_at: NOW.to_owned(),
        deadline_at: DEADLINE.to_owned(),
        per_source_timeout_ms: 250,
        policy_date: 20_260_812,
    }
}

fn capture_request() -> CaptureStartRequest {
    CaptureStartRequest {
        schema_version: "1.0".to_owned(),
        session_id: "session-command-1".to_owned(),
        evidence_version: 1,
        started_at: NOW.to_owned(),
        deadline_at: DEADLINE.to_owned(),
        baseline_id: "baseline-command-1".to_owned(),
        inventory_evidence_id: "inventory-command-1".to_owned(),
        inventory_evidence_hash: hash('a'),
        collector_version: "measurement-command-v1".to_owned(),
    }
}

fn hash(seed: char) -> String {
    format!("sha256:{}", seed.to_string().repeat(64))
}

fn session(id: &str, seed: char, value: f64) -> SessionEvidence {
    SessionEvidence {
        session_id: id.to_owned(),
        evidence_hash: hash(seed),
        inventory_evidence_id: "inventory-command-1".to_owned(),
        inventory_evidence_hash: hash('a'),
        workload_id: "supported-game".to_owned(),
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

fn comparison_request() -> ComparisonCommandRequest {
    ComparisonCommandRequest {
        schema_version: "1.0".to_owned(),
        comparison_id: "comparison-command-1".to_owned(),
        before: session("session-before-command", 'b', 12.0),
        after: session("session-after-command", 'c', 9.0),
        compared_at: "2026-08-12T12:01:00Z".to_owned(),
    }
}

struct TempDirectory {
    path: PathBuf,
}

impl TempDirectory {
    fn new(label: &str) -> Self {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "liiiraa-evidence-commands-{}-{}-{unique}",
            std::process::id(),
            label
        ));
        fs::create_dir_all(&path).expect("temporary export root");
        Self { path }
    }
}

impl Drop for TempDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn authority(directory: &TempDirectory) -> EvidenceAuthority {
    EvidenceAuthority::new(
        directory.path.clone(),
        b"purpose-bound-inventory-command-salt".to_vec(),
    )
    .expect("valid authority")
}

#[test]
fn refresh_and_read_are_contract_valid_private_operations() {
    let directory = TempDirectory::new("inventory");
    let mut authority = authority(&directory);
    let refreshed = authority
        .refresh_inventory(
            refresh_request(),
            SyntheticInventory {
                raw: observed_inventory(),
            },
        )
        .expect("refresh inventory");

    assert_eq!(refreshed["kind"], "inventory-snapshot");
    assert_eq!(authority.read_inventory().unwrap(), refreshed);
    let serialized = serde_json::to_string(&refreshed).unwrap();
    assert!(!serialized.contains("RAW-SERIAL-MUST-NOT-CROSS"));
    assert!(!serialized.contains("purpose-bound-inventory-command-salt"));
    assert!(!serialized.to_ascii_lowercase().contains("serialnumber"));

    let health = authority.read_health();
    assert_eq!(health.authority, "available");
    assert_eq!(health.inventory, "ready");
    assert_eq!(health.capture, "idle");
    assert_eq!(health.overhead.counter_poll_ceiling_hz, 1);
    assert_eq!(health.overhead.cancellation_budget_ms, 250);
    assert!(!health.overhead.elevated);
}

#[test]
fn malformed_refresh_keeps_the_last_admitted_snapshot() {
    let directory = TempDirectory::new("malformed");
    let mut authority = authority(&directory);
    authority
        .refresh_inventory(
            refresh_request(),
            SyntheticInventory {
                raw: observed_inventory(),
            },
        )
        .expect("initial refresh");
    let admitted = authority.read_inventory().unwrap();

    let mut malformed = refresh_request();
    malformed.schema_version = "future".to_owned();
    assert_eq!(
        authority.refresh_inventory(
            malformed,
            SyntheticInventory {
                raw: observed_inventory(),
            }
        ),
        Err(CommandError::InvalidRequest)
    );
    assert_eq!(authority.read_inventory().unwrap(), admitted);
}

#[test]
fn capture_start_and_cancel_are_bounded_reachable_and_idempotent() {
    let directory = TempDirectory::new("capture");
    let mut authority = authority(&directory);

    let started = authority.start_capture(capture_request()).expect("start");
    assert_eq!(started["status"], "incomplete");
    assert_eq!(
        authority
            .start_capture(capture_request())
            .expect("same start is idempotent"),
        started
    );
    let mut competing = capture_request();
    competing.session_id = "session-command-2".to_owned();
    assert_eq!(
        authority.start_capture(competing),
        Err(CommandError::AlreadyActive)
    );

    let first = authority
        .cancel_capture(CancelCaptureRequest {
            schema_version: "1.0".to_owned(),
            monotonic_ns: 5_000_000,
        })
        .expect("first cancel");
    let repeated = authority
        .cancel_capture(CancelCaptureRequest {
            schema_version: "1.0".to_owned(),
            monotonic_ns: 6_000_000,
        })
        .expect("idempotent cancel");

    assert_eq!(first.state, "acknowledged");
    assert_eq!(repeated.state, "acknowledged");
    assert!(first.latency_ms <= 250);
    assert_eq!(authority.read_health().capture, "cancelled");
}

#[test]
fn live_counter_samples_are_admitted_before_capture_finishes() {
    let directory = TempDirectory::new("live-telemetry-capture");
    let mut authority = authority(&directory);
    authority.start_capture(capture_request()).expect("start");

    let incomplete = authority
        .ingest_live_telemetry(&[
            CounterObservation {
                monotonic_ns: 1_100_000_000,
                metric: MetricKind::CpuUtilizationPercent,
                value: Some(37.5),
                health: SourceHealth::Valid,
            },
            CounterObservation {
                monotonic_ns: 1_100_000_000,
                metric: MetricKind::MemoryWorkingSetBytes,
                value: Some(10_737_418_240.0),
                health: SourceHealth::Valid,
            },
        ])
        .expect("admit live telemetry");
    assert_eq!(incomplete["status"], "incomplete");

    let completed = authority
        .finish_capture(FinishCaptureRequest {
            schema_version: "1.0".to_owned(),
            completed_at: "2026-08-12T12:00:02Z".to_owned(),
        })
        .expect("finish capture");

    assert_eq!(completed["status"], "completed");
    let chunks = completed["chunks"].as_array().expect("metric chunks");
    assert_eq!(chunks.len(), 2);
    let serialized = serde_json::to_string(chunks).expect("serialize chunks");
    assert!(serialized.contains("cpu-utilization-percent"));
    assert!(serialized.contains("memory-working-set-bytes"));
}

#[test]
fn missing_authority_returns_stable_recovery_codes() {
    let directory = TempDirectory::new("missing");
    let mut authority = authority(&directory);

    assert_eq!(authority.read_inventory(), Err(CommandError::NotFound));
    assert_eq!(
        authority.cancel_capture(CancelCaptureRequest {
            schema_version: "1.0".to_owned(),
            monotonic_ns: 1,
        }),
        Err(CommandError::NotFound)
    );
    assert_eq!(
        authority.export_report(ExportReportRequest {
            schema_version: "1.0".to_owned(),
            report_id: "missing-report".to_owned(),
            format: ExportFormat::Json,
            file_name: "missing-report.json".to_owned(),
        }),
        Err(CommandError::NotFound)
    );
}

#[test]
fn comparison_report_and_export_use_only_admitted_authority() {
    let directory = TempDirectory::new("report");
    let mut authority = authority(&directory);
    let decision = authority
        .compare_measurements(comparison_request())
        .expect("accepted comparison");
    assert_eq!(decision["state"], "accepted");

    let report = authority
        .render_report(RenderReportRequest {
            schema_version: "1.0".to_owned(),
            report_id: "report-command-1".to_owned(),
            comparison_id: "comparison-command-1".to_owned(),
            generated_at: "2026-08-12T12:02:00Z".to_owned(),
            limitations: vec!["Válido somente para esta carga reproduzível.".to_owned()],
        })
        .expect("render report");
    assert_eq!(report["kind"], "evidence-report");

    let json = authority
        .export_report(ExportReportRequest {
            schema_version: "1.0".to_owned(),
            report_id: "report-command-1".to_owned(),
            format: ExportFormat::Json,
            file_name: "report-command-1.json".to_owned(),
        })
        .expect("export json");
    let html = authority
        .export_report(ExportReportRequest {
            schema_version: "1.0".to_owned(),
            report_id: "report-command-1".to_owned(),
            format: ExportFormat::Html,
            file_name: "report-command-1.html".to_owned(),
        })
        .expect("export html");

    assert_eq!(json.file_name, "report-command-1.json");
    assert_eq!(html.file_name, "report-command-1.html");
    assert!(json.stored);
    assert!(html.stored);
    assert!(directory.path.join(&json.file_name).is_file());
    assert!(directory.path.join(&html.file_name).is_file());
    assert!(
        fs::read_to_string(directory.path.join(&html.file_name))
            .unwrap()
            .contains("<main")
    );
}

#[test]
fn arbitrary_paths_and_generic_native_operations_are_rejected() {
    let directory = TempDirectory::new("least-privilege");
    let mut authority = authority(&directory);
    authority
        .compare_measurements(comparison_request())
        .expect("comparison");
    authority
        .render_report(RenderReportRequest {
            schema_version: "1.0".to_owned(),
            report_id: "report-command-1".to_owned(),
            comparison_id: "comparison-command-1".to_owned(),
            generated_at: "2026-08-12T12:02:00Z".to_owned(),
            limitations: vec!["Limitação explícita.".to_owned()],
        })
        .expect("report");

    for path in [
        "../outside.json",
        "subdir/report.json",
        "C:\\Windows\\report.json",
        "report.exe",
    ] {
        let result = authority.export_report(ExportReportRequest {
            schema_version: "1.0".to_owned(),
            report_id: "report-command-1".to_owned(),
            format: ExportFormat::Json,
            file_name: path.to_owned(),
        });
        assert_eq!(result, Err(CommandError::PathRejected), "{path}");
    }

    for forbidden in [
        "execute-script",
        "run-powershell",
        "query-registry",
        "write-file",
        "raw-sql",
        "request-elevation",
    ] {
        assert_eq!(
            EvidenceAuthority::admit_operation(forbidden),
            Err(CommandError::OperationRejected),
            "{forbidden}"
        );
    }
}

#[test]
fn capability_manifest_grants_no_shell_or_broad_filesystem_power() {
    let capability = include_str!("../capabilities/default.json");
    let value: serde_json::Value = serde_json::from_str(capability).expect("capability JSON");
    let permissions = value["permissions"].as_array().expect("permissions");
    let serialized = serde_json::to_string(permissions).unwrap();

    assert!(!serialized.contains("shell:"));
    assert!(!serialized.contains("fs:"));
    assert!(!serialized.contains("process:allow-exit"));
    assert!(!serialized.contains("process:allow-relaunch"));
    assert!(value["description"].as_str().unwrap().contains("evidence"));
}
