use std::{fs, path::PathBuf};

use serde_json::{Value, json};

fn crate_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn read_json(relative_path: &str) -> Value {
    let path = crate_root().join(relative_path);
    let contents = fs::read_to_string(&path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", path.display()));
    serde_json::from_str(&contents)
        .unwrap_or_else(|error| panic!("failed to parse {}: {error}", path.display()))
}

#[test]
fn capabilities_lock_host_identity_and_non_elevation() {
    let capability = read_json("capabilities/default.json");
    assert_eq!(capability["identifier"], "main-shell");
    assert_eq!(capability["windows"], json!(["main"]));
    assert_eq!(
        capability["permissions"],
        json!([
            "core:event:allow-listen",
            "core:event:allow-unlisten"
        ])
    );
    assert!(capability.get("remote").is_none());

    let config = read_json("tauri.conf.json");
    let window = &config["app"]["windows"][0];
    assert_eq!(window["label"], "main");
    assert_eq!(window["width"], 1280);
    assert_eq!(window["height"], 800);
    assert_eq!(window["minWidth"], 760);
    assert_eq!(window["minHeight"], 600);
    assert_eq!(window["center"], true);

    let security = &config["app"]["security"];
    assert_eq!(security["capabilities"], json!(["main-shell"]));
    assert_eq!(security["freezePrototype"], true);
    assert_eq!(security["dangerousDisableAssetCspModification"], false);
    assert!(security["csp"]
        .as_str()
        .is_some_and(|csp| csp.contains("default-src 'self'") && csp.contains("object-src 'none'")));

    let bundle = &config["bundle"];
    assert_eq!(bundle["active"], true);
    assert_eq!(bundle["targets"], json!(["nsis"]));
    assert_eq!(bundle["publisher"], "Liiiraa Boost");
    assert_eq!(bundle["createUpdaterArtifacts"], false);
    assert_eq!(bundle["windows"]["digestAlgorithm"], "sha256");
    assert!(bundle["windows"]
        .as_object()
        .is_some_and(|windows| windows.contains_key("certificateThumbprint")));
    assert!(bundle["windows"]["certificateThumbprint"].is_null());
    assert!(bundle["windows"]
        .as_object()
        .is_some_and(|windows| windows.contains_key("timestampUrl")));
    assert!(bundle["windows"]["timestampUrl"].is_null());
    assert_eq!(
        bundle["windows"]["nsis"]["installMode"],
        "currentUser",
        "the installer must not request per-machine elevation"
    );

    let identity = &config["plugins"]["liiiraa-shell"]["identity"];
    assert_eq!(identity["publisher"], "Liiiraa Boost");
    assert_eq!(identity["version"], config["version"]);
    assert_eq!(identity["channel"], "development");
    assert_eq!(identity["compatibility"]["windows"], json!(["10", "11"]));
    assert_eq!(identity["updater"]["signatureRequired"], true);
    assert_eq!(identity["updater"]["publicKeyConfigured"], false);
    assert_eq!(identity["updater"]["artifactsEnabled"], false);
    assert_eq!(identity["signing"]["class"], "self-signed-development");
    assert_eq!(identity["signing"]["certificateOwnerPlan"], "02-33");
    assert_eq!(identity["signing"]["publicTrust"], false);
    assert_eq!(identity["signing"]["smartScreenReputation"], false);
    assert_eq!(identity["signing"]["productionReady"], false);
    assert_eq!(identity["signing"]["distributionAllowed"], false);
}

#[test]
fn capabilities_keep_command_registration_bounded_to_generated_shell_dispatch() {
    let source_path = crate_root().join("src/main.rs");
    let source = fs::read_to_string(&source_path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", source_path.display()));

    assert_eq!(source.matches("#[tauri::command]").count(), 1);
    assert!(source.contains("tauri::generate_handler![dispatch_shell_command]"));
    assert!(source.contains("validate_renderer_to_host_shell_command"));
    assert!(source.contains("validate_host_to_renderer_shell_event"));
    assert!(source.contains("ShellContract::authorize_startup"));
    assert!(
        source
            .find("ShellContract::authorize_startup")
            .zip(source.find("tauri::Builder::default"))
            .is_some_and(|(policy, builder)| policy < builder),
        "startup policy must run before the native host is constructed"
    );

    for forbidden in [
        "execute_script",
        "run_script",
        "write_registry",
        "set_service",
        "write_file",
        "optimizer_command",
        "privileged_service",
        "requireAdministrator",
        "highestAvailable",
    ] {
        assert!(
            !source.contains(forbidden),
            "forbidden native authority registered: {forbidden}"
        );
    }
}
