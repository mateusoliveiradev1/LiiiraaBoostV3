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

#[test]
fn staging_identity_origins_are_packaged_with_the_internal_build() {
    let config: serde_json::Value =
        serde_json::from_str(include_str!("../tauri.staging.conf.json"))
            .expect("valid staging Tauri config");
    let runtime = &config["plugins"]["liiiraa-shell"]["identity"]["runtime"];

    assert_eq!(
        runtime["apiOrigin"],
        "https://liiiraa-api-staging.onrender.com"
    );
    assert_eq!(
        runtime["accountOrigin"],
        "https://conta.liiiraaboost.com.br"
    );
    assert_eq!(runtime["adminOrigin"], "https://admin.liiiraaboost.com.br");
}
