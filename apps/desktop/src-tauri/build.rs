fn main() {
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=capabilities/default.json");
    println!("cargo:rerun-if-changed=capabilities/main.json");
    const APP_COMMANDS: &[&str] = &[
        "apply_plan",
        "approve_plan",
        "bind_current_device",
        "cancel_measurement_capture",
        "compare_measurement_sessions",
        "compose_plan",
        "desktop_sign_in",
        "desktop_sign_out",
        "dispatch_shell_command",
        "export_evidence_report",
        "export_plan_diagnostic",
        "finish_measurement_capture",
        "get_shell_bootstrap",
        "open_account_subscription",
        "open_admin",
        "prepare_device_binding",
        "preview_plan_diagnostic",
        "read_evidence_health",
        "read_plan_execution",
        "read_hardware_inventory",
        "read_live_telemetry",
        "refresh_hardware_inventory",
        "render_evidence_report",
        "restore_recovery_checkpoint",
        "restore_plan_operation",
        "restore_plan",
        "revise_plan",
        "sample_measurement_capture",
        "start_measurement_capture",
        "subscribe_plan_execution",
        "sync_account",
    ];
    let attributes = tauri_build::Attributes::new()
        .app_manifest(tauri_build::AppManifest::new().commands(APP_COMMANDS));
    tauri_build::try_build(attributes).expect("Tauri build manifest must be valid");
}
