use serde_json::json;

#[test]
fn packaged_build_embeds_the_vite_frontend() {
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).expect("valid Tauri config");

    assert_eq!(
        config["build"]["frontendDist"],
        json!("../dist"),
        "the packaged host must embed the Vite output containing index.html"
    );
    assert_eq!(
        config["build"]["beforeBuildCommand"],
        json!("pnpm build"),
        "tauri build must produce the Vite output before compiling the host"
    );
}

#[test]
fn packaged_windows_build_uses_the_gui_subsystem() {
    let main_source = include_str!("../src/main.rs");

    assert!(
        main_source.contains("windows_subsystem = \"windows\"")
            && main_source.contains("not(debug_assertions)"),
        "release builds must use the Windows GUI subsystem while debug builds keep console diagnostics"
    );
}

#[test]
fn packaged_shell_can_listen_for_validated_host_events() {
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).expect("valid Tauri config");
    let permissions = config["app"]["security"]["capabilities"][0]["permissions"]
        .as_array()
        .expect("capability permissions");
    assert!(
        permissions
            .iter()
            .any(|value| value == "core:event:allow-listen")
    );
}
