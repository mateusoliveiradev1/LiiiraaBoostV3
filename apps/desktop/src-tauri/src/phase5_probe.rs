use std::{fs, path::PathBuf, thread, time::Duration};

use serde_json::{Value, json};

use crate::{
    evidence_commands::{
        CancelCaptureRequest, CaptureStartRequest, EvidenceAuthority, InventoryRefreshRequest,
    },
    hardware_inventory::WindowsInventorySource,
};

const PROBE_FLAG: &str = "--phase5-probe";
const HARDWARE_CLASSES: [&str; 12] = [
    "cpu", "gpu", "memory", "storage", "network", "display", "audio", "usb", "windows", "drivers",
    "security", "games",
];

struct ProbeArguments {
    output_path: PathBuf,
    sample_seconds: u64,
    collected_at: String,
    deadline_at: String,
    policy_date: u32,
}

pub fn try_run() -> Result<bool, String> {
    let arguments = std::env::args().collect::<Vec<_>>();
    let Some(flag_index) = arguments.iter().position(|argument| argument == PROBE_FLAG) else {
        return Ok(false);
    };
    let probe = parse_arguments(&arguments[(flag_index + 1)..])?;
    run_probe(probe)?;
    Ok(true)
}

fn parse_arguments(arguments: &[String]) -> Result<ProbeArguments, String> {
    if arguments.len() != 5 {
        return Err(
            "phase5 probe requires output, duration, collected-at, deadline-at and policy-date"
                .to_owned(),
        );
    }
    let sample_seconds = arguments[1]
        .parse::<u64>()
        .map_err(|_| "phase5 probe duration is invalid".to_owned())?;
    if !(1..=3_600).contains(&sample_seconds) {
        return Err("phase5 probe duration is outside the admitted range".to_owned());
    }
    let policy_date = arguments[4]
        .parse::<u32>()
        .map_err(|_| "phase5 probe policy date is invalid".to_owned())?;
    Ok(ProbeArguments {
        output_path: PathBuf::from(&arguments[0]),
        sample_seconds,
        collected_at: arguments[2].clone(),
        deadline_at: arguments[3].clone(),
        policy_date,
    })
}

fn run_probe(probe: ProbeArguments) -> Result<(), String> {
    let export_root =
        std::env::temp_dir().join(format!("liiiraa-phase5-probe-{}", std::process::id()));
    let mut authority = EvidenceAuthority::new(
        export_root,
        b"phase5-packaged-authority-probe-salt".to_vec(),
    )
    .map_err(|error| format!("phase5 authority initialization failed: {error:?}"))?;

    let inventory = authority
        .refresh_inventory(
            InventoryRefreshRequest {
                schema_version: "1.0".to_owned(),
                evidence_id: "phase5-current-pc-inventory".to_owned(),
                evidence_version: 1,
                collected_at: probe.collected_at.clone(),
                deadline_at: probe.deadline_at.clone(),
                per_source_timeout_ms: 5_000,
                policy_date: probe.policy_date,
            },
            WindowsInventorySource,
        )
        .map_err(|error| format!("phase5 native inventory failed: {error:?}"))?;

    let inventory_hash = inventory
        .get("evidenceHash")
        .and_then(Value::as_str)
        .ok_or_else(|| "phase5 inventory did not expose an admitted evidence hash".to_owned())?;
    authority
        .start_capture(CaptureStartRequest {
            schema_version: "1.0".to_owned(),
            session_id: "phase5-current-pc-cancellation".to_owned(),
            evidence_version: 1,
            started_at: probe.collected_at.clone(),
            deadline_at: probe.deadline_at,
            baseline_id: "phase5-packaged-probe".to_owned(),
            inventory_evidence_id: "phase5-current-pc-inventory".to_owned(),
            inventory_evidence_hash: inventory_hash.to_owned(),
            collector_version: "liiiraa-native-evidence@1".to_owned(),
        })
        .map_err(|error| format!("phase5 capture initialization failed: {error:?}"))?;
    let cancellation = authority
        .cancel_capture(CancelCaptureRequest {
            schema_version: "1.0".to_owned(),
            monotonic_ns: 1_000_000,
        })
        .map_err(|error| format!("phase5 capture cancellation failed: {error:?}"))?;

    let hardware_classes = HARDWARE_CLASSES.map(|hardware_class| {
        let fact = inventory.get(hardware_class).unwrap_or(&Value::Null);
        let state = fact
            .get("state")
            .and_then(Value::as_str)
            .unwrap_or("unavailable");
        let source = fact
            .get("source")
            .and_then(Value::as_str)
            .unwrap_or("native-readonly-boundary");
        let reason_code = fact.get("reasonCode").and_then(Value::as_str);
        let mut summary = json!({
            "hardwareClass": hardware_class,
            "state": state,
            "source": source,
        });
        if let Some(reason_code) = reason_code {
            summary["reasonCode"] = Value::String(reason_code.to_owned());
        }
        summary
    });

    // Keep the exact packaged native authority alive so the outer Windows probe can
    // measure its real idle footprint. No WebView is created and no raw hardware
    // value crosses this boundary.
    thread::sleep(Duration::from_secs(probe.sample_seconds));

    let summary = json!({
        "schemaVersion": 1,
        "collectorVersion": "liiiraa-native-evidence@1",
        "hardwareClasses": hardware_classes,
        "pollingHz": 0,
        "cancellationMs": cancellation.latency_ms,
        "rawIdentifiersFound": [],
    });
    let bytes = serde_json::to_vec_pretty(&summary)
        .map_err(|error| format!("phase5 probe serialization failed: {error}"))?;
    if let Some(parent) = probe.output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("phase5 probe output directory failed: {error}"))?;
    }
    fs::write(&probe.output_path, bytes)
        .map_err(|error| format!("phase5 probe output failed: {error}"))?;
    Ok(())
}
