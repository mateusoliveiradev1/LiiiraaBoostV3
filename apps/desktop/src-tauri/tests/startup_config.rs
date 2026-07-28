use serde_json::json;

#[test]
fn disabled_updater_has_a_valid_fail_closed_plugin_config() {
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.conf.json")).expect("valid Tauri config");
    let updater = &config["plugins"]["updater"];

    assert_eq!(updater["endpoints"], json!([]));
    assert_eq!(updater["pubkey"], "");
    assert!(updater["windows"].is_null());
    assert_eq!(
        config["plugins"]["liiiraa-shell"]["identity"]["updater"]["artifactsEnabled"],
        false
    );
}
