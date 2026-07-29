use std::{fs, path::PathBuf};

use serde_json::{Value, json};

#[path = "../src/navigation.rs"]
mod navigation;
#[path = "../src/notifications.rs"]
mod notifications;
#[path = "../src/tray.rs"]
mod tray;
#[path = "../src/window.rs"]
mod window;

use navigation::{
    ExternalNavigationSource, NavigationBridgeError, navigation_event_from_external,
    navigation_event_from_second_instance,
};
use notifications::{
    NotificationBridge, NotificationBridgeError, NotificationEffect, StartupCondition,
    installer_identity_event, startup_state_event,
};
use tray::{
    TrayEffect, TrayLifecycle, TrayLifecycleError, TrayMenuContext, TrayMenuEntryKind,
    tray_menu_model,
};
use window::{
    CloseAction, HostEventMetadata, WindowEffect, WindowLifecycle, WindowLifecycleError, WorkArea,
};

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
            "core:window:allow-close",
            "core:window:allow-minimize",
            "core:window:allow-set-theme",
            "core:window:allow-start-dragging",
            "core:window:allow-toggle-maximize"
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
    assert_eq!(window["decorations"], false);
    assert_eq!(window["resizable"], true);

    let security = &config["app"]["security"];
    let mut runtime_capability = capability.clone();
    runtime_capability
        .as_object_mut()
        .expect("capability is an object")
        .remove("$schema");
    assert_eq!(security["capabilities"], json!([runtime_capability]));
    assert_eq!(security["freezePrototype"], true);
    assert_eq!(security["dangerousDisableAssetCspModification"], false);
    assert!(
        security["csp"].as_str().is_some_and(
            |csp| csp.contains("default-src 'self'") && csp.contains("object-src 'none'")
        )
    );

    let bundle = &config["bundle"];
    assert_eq!(bundle["active"], true);
    assert_eq!(bundle["targets"], json!(["nsis"]));
    assert_eq!(bundle["publisher"], "Liiiraa Boost");
    assert_eq!(bundle["createUpdaterArtifacts"], false);
    assert_eq!(bundle["windows"]["digestAlgorithm"], "sha256");
    assert!(
        bundle["windows"]
            .as_object()
            .is_some_and(|windows| windows.contains_key("certificateThumbprint"))
    );
    assert!(bundle["windows"]["certificateThumbprint"].is_null());
    assert!(
        bundle["windows"]
            .as_object()
            .is_some_and(|windows| windows.contains_key("timestampUrl"))
    );
    assert!(bundle["windows"]["timestampUrl"].is_null());
    assert_eq!(
        bundle["windows"]["nsis"]["installMode"], "currentUser",
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

    assert_eq!(source.matches("#[tauri::command]").count(), 2);
    assert!(source.contains("dispatch_shell_command,"));
    assert!(source.contains("get_shell_bootstrap"));
    assert!(source.contains("validate_renderer_to_host_shell_command"));
    assert!(source.contains("validate_host_to_renderer_shell_event"));
    assert!(source.contains("ShellContract::authorize_startup"));
    assert!(source.contains("WindowEvent::CloseRequested"));
    assert!(source.contains("HostEventMetadata::now(\"close-request\")"));
    assert!(source.contains("current_work_area"));
    assert!(source.contains("HOST_EVENT_CHANNEL"));
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

fn shell_envelope(message_type: &str, payload: Value) -> Value {
    json!({
        "schemaVersion": "1.0",
        "messageType": message_type,
        "requestId": "request-shell-contract-0001",
        "correlationId": "correlation-shell-contract-0001",
        "issuedAt": "2026-07-28T12:00:00.000Z",
        "payload": payload
    })
}

fn primary_work_area() -> WorkArea {
    WorkArea::new("monitor-primary", 0, 0, 1280, 720).expect("valid test work area")
}

#[test]
fn window_close_defaults_to_exit_and_tray_requires_validated_opt_in() {
    let mut lifecycle = WindowLifecycle::default();
    assert_eq!(lifecycle.close_action(), CloseAction::Exit);

    let malformed = shell_envelope(
        "desktop.shell.set-tray-preference.command",
        json!({
            "preference": "keep-game-detection-in-tray",
            "unexpected": "must-not-mutate"
        }),
    );
    assert!(matches!(
        lifecycle.dispatch_renderer_message(&malformed, &primary_work_area()),
        Err(WindowLifecycleError::ContractRejected)
    ));
    assert_eq!(lifecycle.close_action(), CloseAction::Exit);

    let opt_in = shell_envelope(
        "desktop.shell.set-tray-preference.command",
        json!({ "preference": "keep-game-detection-in-tray" }),
    );
    let dispatch = lifecycle
        .dispatch_renderer_message(&opt_in, &primary_work_area())
        .expect("generated tray opt-in command");

    assert_eq!(lifecycle.close_action(), CloseAction::HideToTray);
    assert!(dispatch.effects.iter().any(|effect| {
        matches!(
            effect,
            WindowEffect::Emit(event)
                if serde_json::to_value(event)
                    .is_ok_and(|value| value["messageType"]
                        == "desktop.shell.tray-preference-changed.event")
        )
    }));
}

#[test]
fn window_close_during_recovery_never_exits_the_interface() {
    let mut lifecycle = WindowLifecycle::default();
    lifecycle.set_recovery_in_progress(true);

    let close = lifecycle
        .begin_close(HostEventMetadata::fixed(
            "request-window-close-0001",
            "2026-07-28T12:00:00.000Z",
        ))
        .expect("generated close request event");

    assert_eq!(close.action, CloseAction::AwaitRendererDecision);
    assert_eq!(
        serde_json::to_value(close.event).expect("serializable generated event")["payload"]["context"]
            ["kind"],
        "recovery-in-progress"
    );

    let forbidden_exit = shell_envelope(
        "desktop.shell.resolve-close.command",
        json!({
            "resolution": {
                "context": "recovery-in-progress",
                "decision": "close-interface"
            }
        }),
    );
    assert!(matches!(
        lifecycle.dispatch_renderer_message(&forbidden_exit, &primary_work_area()),
        Err(WindowLifecycleError::ContractRejected)
    ));
    assert_eq!(lifecycle.close_action(), CloseAction::AwaitRendererDecision);

    let stay_here = shell_envelope(
        "desktop.shell.resolve-close.command",
        json!({
            "resolution": {
                "context": "recovery-in-progress",
                "decision": "stay-here"
            }
        }),
    );
    let dispatch = lifecycle
        .dispatch_renderer_message(&stay_here, &primary_work_area())
        .expect("generated recovery close resolution");
    assert!(matches!(
        dispatch.effects.as_slice(),
        [WindowEffect::Close(CloseAction::StayVisible)]
    ));
}

#[test]
fn window_restore_clamps_to_the_selected_monitor_work_area() {
    let mut lifecycle = WindowLifecycle::default();
    let save = shell_envelope(
        "desktop.shell.save-window-state.command",
        json!({
            "state": {
                "kind": "normal",
                "monitorId": "monitor-primary",
                "x": -900,
                "y": 1800,
                "width": 2000,
                "height": 1200
            }
        }),
    );

    let dispatch = lifecycle
        .dispatch_renderer_message(&save, &primary_work_area())
        .expect("generated save-window-state command");
    let applied = dispatch
        .effects
        .iter()
        .find_map(|effect| match effect {
            WindowEffect::ApplyWindowState(state) => serde_json::to_value(state).ok(),
            _ => None,
        })
        .expect("clamped state effect");

    assert_eq!(
        applied,
        json!({
            "kind": "normal",
            "monitorId": "monitor-primary",
            "x": 0,
            "y": 0,
            "width": 1280,
            "height": 720
        })
    );
}

#[test]
fn navigation_maps_only_allowlisted_deep_links_to_generated_events() {
    let event = navigation_event_from_external(
        "liiiraa-boost://goal/measure",
        ExternalNavigationSource::DeepLink,
        HostEventMetadata::fixed("request-navigation-0001", "2026-07-28T12:00:00.000Z"),
    )
    .expect("allowlisted goal deep link");
    let value = serde_json::to_value(event).expect("serializable generated event");

    assert_eq!(
        value["messageType"],
        "desktop.shell.navigation-requested.event"
    );
    assert_eq!(value["payload"]["source"], "deep-link");
    assert_eq!(value["payload"]["intent"]["kind"], "goal");
    assert_eq!(value["payload"]["intent"]["destination"], "measure");

    for rejected in [
        "https://example.invalid/goal/measure",
        "liiiraa-boost://optimizer/apply",
        "liiiraa-boost://documentation/../../SENSITIVE_DOCUMENT",
        "liiiraa-boost://settings/advanced?execute=SENSITIVE_COMMAND",
        "liiiraa-boost://goal/unknown",
    ] {
        let error = navigation_event_from_external(
            rejected,
            ExternalNavigationSource::DeepLink,
            HostEventMetadata::fixed("request-navigation-rejected", "2026-07-28T12:00:00.000Z"),
        )
        .expect_err("unknown, risky, or privileged intent must reject");
        assert_eq!(error, NavigationBridgeError::Rejected);
        assert!(!format!("{error:?}").contains("SENSITIVE"));
    }
}

#[test]
fn navigation_second_instance_ignores_raw_process_arguments_and_emits_one_intent() {
    let arguments = vec![
        "C:\\Program Files\\Liiiraa Boost\\liiiraa-desktop.exe".to_owned(),
        "--opaque-launcher-argument".to_owned(),
        "liiiraa-boost://settings/accessibility".to_owned(),
        "liiiraa-boost://goal/improve".to_owned(),
    ];
    let event = navigation_event_from_second_instance(
        &arguments,
        HostEventMetadata::fixed("request-second-instance-0001", "2026-07-28T12:00:00.000Z"),
    )
    .expect("bounded second-instance arguments")
    .expect("one allowlisted intent");
    let value = serde_json::to_value(event).expect("serializable generated event");

    assert_eq!(value["payload"]["source"], "second-launch");
    assert_eq!(value["payload"]["intent"]["kind"], "settings");
    assert_eq!(value["payload"]["intent"]["destination"], "accessibility");
    assert!(!value.to_string().contains("Program Files"));
    assert!(!value.to_string().contains("opaque-launcher"));
    assert!(!value.to_string().contains("improve"));
}

#[test]
fn navigation_runtime_registers_single_instance_before_deep_link_handlers() {
    let source_path = crate_root().join("src/main.rs");
    let source = fs::read_to_string(&source_path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", source_path.display()));

    let single_instance = source
        .find("tauri_plugin_single_instance::init")
        .expect("single-instance plugin registration");
    let deep_link = source
        .find("tauri_plugin_deep_link::init")
        .expect("deep-link plugin registration");
    assert!(single_instance < deep_link);
    assert!(source.contains("navigation_event_from_second_instance"));
    assert!(source.contains("on_open_url"));
    assert!(source.contains("get_current"));
    assert!(source.contains("focus_main_window"));

    let config = read_json("tauri.conf.json");
    assert_eq!(
        config["plugins"]["deep-link"]["desktop"]["schemes"],
        json!(["liiiraa-boost"])
    );
}

#[test]
fn tray_lifecycle_requires_validated_opt_in_or_an_active_safety_workflow() {
    let mut lifecycle = TrayLifecycle::default();
    assert!(!lifecycle.is_visible());
    assert_eq!(lifecycle.tooltip(), "Liiiraa Boost — Interface open");

    let malformed = shell_envelope(
        "desktop.shell.set-tray-preference.command",
        json!({
            "preference": "keep-game-detection-in-tray",
            "unexpected": "must-not-mutate"
        }),
    );
    assert!(matches!(
        lifecycle.dispatch_renderer_message(&malformed),
        Err(TrayLifecycleError::ContractRejected)
    ));
    assert!(!lifecycle.is_visible());

    let opt_in = shell_envelope(
        "desktop.shell.set-tray-preference.command",
        json!({ "preference": "keep-game-detection-in-tray" }),
    );
    let effects = lifecycle
        .dispatch_renderer_message(&opt_in)
        .expect("generated tray opt-in command");
    assert!(lifecycle.is_visible());
    assert!(matches!(effects.as_slice(), [TrayEffect::SetVisible(true)]));

    let opt_out = shell_envelope(
        "desktop.shell.set-tray-preference.command",
        json!({ "preference": "close-window" }),
    );
    lifecycle.set_safety_workflow_active(true);
    assert!(lifecycle.is_visible());
    assert_eq!(lifecycle.tooltip(), "Liiiraa Boost — Recovery required");
    let effects = lifecycle
        .dispatch_renderer_message(&opt_out)
        .expect("generated tray opt-out command");
    assert!(lifecycle.is_visible());
    assert!(effects.is_empty());

    let effects = lifecycle.set_safety_workflow_active(false);
    assert!(!lifecycle.is_visible());
    assert!(matches!(
        effects.as_slice(),
        [TrayEffect::SetVisible(false)]
    ));
}

#[test]
fn tray_menu_order_actions_and_attention_visibility_match_the_contract() {
    let context = TrayMenuContext {
        selected_game: "VALORANT".to_owned(),
        profile_state: "Competitive · Ready".to_owned(),
        automatic_profiles_paused: false,
        attention_count: 0,
    };
    let menu = tray_menu_model(&context);
    let visible_entries = menu
        .iter()
        .filter(|entry| entry.visible)
        .map(|entry| {
            (
                entry.id.as_deref(),
                entry.label.as_str(),
                entry.enabled,
                entry.kind,
            )
        })
        .collect::<Vec<_>>();

    assert_eq!(
        visible_entries,
        vec![
            (
                Some("tray-open"),
                "Open Liiiraa Boost",
                true,
                TrayMenuEntryKind::Action
            ),
            (
                Some("tray-prepare-launch"),
                "VALORANT · Prepare launch",
                true,
                TrayMenuEntryKind::Action
            ),
            (
                None,
                "Competitive · Ready",
                false,
                TrayMenuEntryKind::Status
            ),
            (
                Some("tray-pause-automatic-profiles"),
                "Pause automatic profiles",
                true,
                TrayMenuEntryKind::Action
            ),
            (None, "", false, TrayMenuEntryKind::Separator),
            (
                Some("tray-settings"),
                "Settings",
                true,
                TrayMenuEntryKind::Action
            ),
            (
                Some("tray-exit-interface"),
                "Exit interface",
                true,
                TrayMenuEntryKind::Action
            ),
        ]
    );

    let attention_menu = tray_menu_model(&TrayMenuContext {
        attention_count: 2,
        ..context
    });
    let attention = attention_menu
        .iter()
        .find(|entry| entry.id.as_deref() == Some("tray-activity"))
        .expect("conditional activity item");
    assert!(attention.visible);
    assert_eq!(attention.label, "Activity requiring attention (2)");
}

#[test]
fn tray_actions_emit_generated_events_and_unknown_actions_reject() {
    let lifecycle = TrayLifecycle::default();
    let open = lifecycle
        .handle_menu_action(
            "tray-open",
            HostEventMetadata::fixed("request-tray-open-0001", "2026-07-28T12:00:00.000Z"),
        )
        .expect("allowlisted tray open action");
    let event = open
        .iter()
        .find_map(|effect| match effect {
            TrayEffect::Emit(event) => serde_json::to_value(event).ok(),
            _ => None,
        })
        .expect("generated navigation event");
    assert_eq!(
        event["messageType"],
        "desktop.shell.navigation-requested.event"
    );
    assert_eq!(event["payload"]["source"], "tray");
    assert_eq!(event["payload"]["intent"]["kind"], "goal");
    assert_eq!(event["payload"]["intent"]["destination"], "home");

    let exit = lifecycle
        .handle_menu_action(
            "tray-exit-interface",
            HostEventMetadata::fixed("request-tray-exit-0001", "2026-07-28T12:00:00.000Z"),
        )
        .expect("allowlisted tray exit action");
    assert!(
        exit.iter()
            .any(|effect| matches!(effect, TrayEffect::ExitInterface))
    );
    assert!(exit.iter().any(|effect| {
        matches!(
            effect,
            TrayEffect::Emit(event)
                if serde_json::to_value(event).is_ok_and(|value| {
                    value["messageType"] == "desktop.shell.close-requested.event"
                        && value["payload"]["context"]["kind"] == "ordinary"
                })
        )
    }));

    assert!(matches!(
        lifecycle.handle_menu_action(
            "tray-run-arbitrary-command",
            HostEventMetadata::fixed("request-tray-rejected-0001", "2026-07-28T12:00:00.000Z",)
        ),
        Err(TrayLifecycleError::UnknownAction)
    ));
}

#[test]
fn notification_startup_preferences_allowlist_categories_and_redact_renderer_copy() {
    let mut bridge = NotificationBridge::default();

    let malformed = shell_envelope(
        "desktop.shell.set-notification-preference.command",
        json!({
            "preference": {
                "enabled": true,
                "focusAssist": "respect",
                "categories": ["recovery-required"]
            },
            "unexpected": "must-not-mutate"
        }),
    );
    assert!(matches!(
        bridge.dispatch_renderer_message(
            &malformed,
            HostEventMetadata::fixed("request-notification-malformed", "2026-07-28T12:00:00.000Z")
        ),
        Err(NotificationBridgeError::ContractRejected)
    ));
    assert!(!bridge.is_enabled());

    let locale = shell_envelope(
        "desktop.shell.set-locale.command",
        json!({ "locale": "pt-BR" }),
    );
    let locale_effects = bridge
        .dispatch_renderer_message(
            &locale,
            HostEventMetadata::fixed("request-notification-locale", "2026-07-28T12:00:00.000Z"),
        )
        .expect("generated locale command");
    assert!(locale_effects.iter().any(|effect| {
        matches!(
            effect,
            NotificationEffect::Emit(event)
                if serde_json::to_value(event).is_ok_and(|value| {
                    value["messageType"] == "desktop.shell.locale-changed.event"
                        && value["payload"]["locale"] == "pt-BR"
                })
        )
    }));

    let preference = shell_envelope(
        "desktop.shell.set-notification-preference.command",
        json!({
            "preference": {
                "enabled": true,
                "focusAssist": "respect",
                "categories": ["recovery-required"]
            }
        }),
    );
    bridge
        .dispatch_renderer_message(
            &preference,
            HostEventMetadata::fixed(
                "request-notification-preference",
                "2026-07-28T12:00:00.000Z",
            ),
        )
        .expect("generated notification preference");
    assert!(bridge.is_enabled());

    let show = shell_envelope(
        "desktop.shell.show-notification.command",
        json!({
            "category": "recovery-required",
            "title": "SENSITIVE_GPU_SERIAL_001",
            "body": "GPU serial SENSITIVE_GPU_SERIAL_001 at PCI path SENSITIVE_PATH",
            "action": {
                "kind": "goal",
                "destination": "recover"
            }
        }),
    );
    let effects = bridge
        .dispatch_renderer_message(
            &show,
            HostEventMetadata::fixed("request-notification-show", "2026-07-28T12:00:00.000Z"),
        )
        .expect("approved recovery notification");
    let approved = effects
        .iter()
        .find_map(|effect| match effect {
            NotificationEffect::Show(notification) => Some(notification),
            _ => None,
        })
        .expect("native notification effect");
    assert_eq!(approved.category, "recovery-required");
    assert!(approved.title.starts_with("Liiiraa Boost"));
    assert!(!approved.title.contains("SENSITIVE"));
    assert!(!approved.body.contains("SENSITIVE"));
    assert!(approved.respects_focus_assist);
    assert_eq!(
        serde_json::to_value(&approved.action).expect("generated notification action")["payload"]["source"],
        "notification"
    );

    let disabled_category = shell_envelope(
        "desktop.shell.show-notification.command",
        json!({
            "category": "account-security",
            "title": "Account event",
            "body": "Review account security.",
            "action": {
                "kind": "goal",
                "destination": "account"
            }
        }),
    );
    assert!(
        bridge
            .dispatch_renderer_message(
                &disabled_category,
                HostEventMetadata::fixed(
                    "request-notification-disabled-category",
                    "2026-07-28T12:00:00.000Z",
                ),
            )
            .expect("valid but disabled category")
            .is_empty()
    );

    let unsafe_action = shell_envelope(
        "desktop.shell.show-notification.command",
        json!({
            "category": "recovery-required",
            "title": "Recovery",
            "body": "Recovery requires attention.",
            "action": {
                "kind": "settings",
                "destination": "advanced"
            }
        }),
    );
    assert!(matches!(
        bridge.dispatch_renderer_message(
            &unsafe_action,
            HostEventMetadata::fixed(
                "request-notification-unsafe-action",
                "2026-07-28T12:00:00.000Z",
            ),
        ),
        Err(NotificationBridgeError::UnsafeAction)
    ));
}

#[test]
fn notification_startup_failures_emit_only_generated_safe_states_and_actions() {
    let cases = [
        (
            StartupCondition::MissingWebView2,
            "failure",
            Some("missing-webview2"),
            Some("install-webview2"),
        ),
        (
            StartupCondition::DamagedInstallation,
            "failure",
            Some("damaged-installation"),
            Some("view-offline-instructions"),
        ),
        (
            StartupCondition::UnsupportedBuild,
            "failure",
            Some("incompatible-windows-build"),
            Some("view-offline-instructions"),
        ),
        (
            StartupCondition::MigrationFailure,
            "failure",
            Some("local-state-migration-failed"),
            Some("open-safe-mode"),
        ),
        (StartupCondition::UpdateInProgress, "updating", None, None),
        (
            StartupCondition::SignatureInvalid,
            "failure",
            Some("update-signature-failed"),
            Some("rollback"),
        ),
        (StartupCondition::RollbackAvailable, "updating", None, None),
        (
            StartupCondition::SafeMode,
            "failure",
            Some("internal-startup-error"),
            Some("open-safe-mode"),
        ),
    ];

    for (index, (condition, kind, reason, recovery_action)) in cases.into_iter().enumerate() {
        let event = startup_state_event(
            condition,
            HostEventMetadata::fixed(
                format!("request-startup-state-{index:04}"),
                "2026-07-28T12:00:00.000Z",
            ),
        )
        .expect("generated startup state");
        let value = serde_json::to_value(event).expect("serializable startup event");
        assert_eq!(
            value["messageType"],
            "desktop.shell.startup-state-changed.event"
        );
        assert_eq!(value["payload"]["state"]["kind"], kind);
        if let Some(reason) = reason {
            assert_eq!(value["payload"]["state"]["reason"], reason);
        }
        if let Some(recovery_action) = recovery_action {
            assert_eq!(value["payload"]["state"]["recoveryAction"], recovery_action);
        }
    }
}

#[test]
fn notification_startup_installer_identity_uses_the_validated_development_channel() {
    let config = read_json("tauri.conf.json");
    let event = installer_identity_event(
        &config,
        HostEventMetadata::fixed(
            "request-installer-identity-0001",
            "2026-07-28T12:00:00.000Z",
        ),
    )
    .expect("generated installer identity event");
    let value = serde_json::to_value(event).expect("serializable installer identity");

    assert_eq!(
        value["messageType"],
        "desktop.shell.installer-identity.event"
    );
    assert_eq!(
        value["payload"]["installer"],
        json!({
            "publisher": "Liiiraa Boost",
            "version": "0.0.0",
            "channel": "development",
            "windowsCompatibility": {
                "kind": "supported",
                "detectedBuild": 0,
                "minimumBuild": 0
            }
        })
    );
}

#[test]
fn notification_startup_runtime_registers_native_effects_and_generated_startup_events() {
    let source_path = crate_root().join("src/main.rs");
    let source = fs::read_to_string(&source_path)
        .unwrap_or_else(|error| panic!("failed to read {}: {error}", source_path.display()));

    assert!(source.contains("NotificationExt"));
    assert!(source.contains(".notification().builder()"));
    assert!(source.contains("installer_identity_event"));
    assert!(source.contains("startup_state_event"));
    assert!(source.contains("StartupCondition::Ready"));
    assert!(source.contains("NotificationBridge::default()"));
}
