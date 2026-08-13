#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[allow(dead_code)]
mod account_sync;
#[cfg(test)]
#[path = "recovery_store/advanced_preference.rs"]
mod advanced_preference;
#[allow(dead_code)]
mod comparison;
#[allow(dead_code)]
mod credential_store;
#[allow(dead_code)]
mod device_identity;
#[allow(dead_code)]
mod evidence_commands;
#[allow(dead_code)]
mod evidence_policy;
#[allow(dead_code)]
mod evidence_report;
#[allow(dead_code)]
mod evidence_store;
#[allow(dead_code)]
mod hardware_inventory;
#[allow(dead_code)]
mod identity;
mod live_telemetry;
#[allow(dead_code)]
mod measurement;
mod navigation;
mod notifications;
#[allow(dead_code)]
mod offline_entitlement;
mod phase5_probe;
#[allow(dead_code)]
mod plan_auth;
#[allow(dead_code)]
mod plan_commands;
#[allow(dead_code)]
mod plan_executor;
#[allow(dead_code)]
mod premium_authority;
#[allow(dead_code)]
mod recovery_store;
mod tray;
mod window;
#[allow(dead_code)]
mod windows_lifecycle;

use std::{
    fs,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use account_sync::{AccountSyncRequest, AccountSyncResponse, AccountSyncState};
#[cfg(test)]
use advanced_preference::{
    AdvancedPreferenceError, AdvancedPreferenceState, AdvancedPreferenceStore, DevicePosture,
};
use credential_store::WindowsCredentialStore;
use evidence_commands::{
    CancelCaptureRequest, CaptureStartRequest, CommandError as EvidenceCommandError,
    ComparisonCommandRequest, EvidenceAuthority, EvidenceHealth, ExportReceipt,
    ExportReportRequest, FinishCaptureRequest, InventoryRefreshRequest, RenderReportRequest,
};
use hardware_inventory::{
    HardwareClass, HardwareInventorySource, RawHardwareFact, WindowsInventorySource,
};
use identity::{
    DesktopIdentityError, DesktopPkceProof, LoopbackCallbackListener, WindowsDesktopIdentityApi,
    WindowsSystemBrowser, open_account_subscription_in_system_browser,
    open_admin_in_system_browser, perform_desktop_sign_in, sign_out_desktop, validate_https_origin,
};
use live_telemetry::{LiveTelemetrySampler, LiveTelemetrySnapshot};
use plan_auth::{
    AdvancedPreferenceAction, AdvancedPreferenceApprovalRequest, NativeAdvancedPreferenceApproval,
    OpaqueApprovalReceipt,
};
use plan_commands::{
    AcceptedPlanIntent, AdvancedPreferenceCommand, DiagnosticExportRequest, PlanCommand,
    PlanDocumentRequest, command_acceptance, validate_advanced_preference_request,
    validate_export_file_name, validate_plan_document,
};
use plan_executor::{
    AdvancedPreferenceAuthority, AdvancedPreferenceSnapshot, AdvancedPreferenceSnapshotState,
    AdvancedPreferenceTransition, AdvancedPreferenceTransitionAction, BindingFreshness,
    DiagnosticConsent, DiagnosticExportReceipt, DiagnosticPreview, ExecutionSnapshot,
    NativeDevicePosture, PlanExecutor, PlanExecutorError,
};
#[cfg(not(test))]
use recovery_store::advanced_preference::{
    AdvancedPreferenceError, AdvancedPreferenceState, AdvancedPreferenceStore, DevicePosture,
};
use recovery_store::{RecoveryStore, integrity_anchor::WindowsIntegrityAnchor};

use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, HostToRendererShellEvent,
    RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID, RendererToHostShellCommand, SessionProjection,
    ShellLocale, ShellWindowState, validate_host_to_renderer_shell_event,
    validate_renderer_to_host_shell_command,
};
use navigation::{
    ExternalNavigationSource, navigation_event_from_external, navigation_event_from_second_instance,
};
use notifications::{
    NotificationBridge, NotificationEffect, StartupCondition, installer_identity_event,
    startup_state_event,
};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent, TrayIconId};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, RunEvent, State, WebviewWindow,
    WindowEvent, ipc::Channel,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_notification::NotificationExt;
use tray::{
    TRAY_ID, TrayEffect, TrayLifecycle, TrayMenuContext, TrayMenuEntryKind, tray_menu_model,
};
use window::{
    CloseAction, HOST_EVENT_CHANNEL, HostEventMetadata, WindowEffect, WindowLifecycle,
    WindowLifecycleError, WorkArea,
};

const FIXTURE_ADAPTER: &str = "fixture";
const ADAPTER_ENVIRONMENT_VARIABLE: &str = "LIIIRAA_DESKTOP_ADAPTER";
type NativePlanExecutor = PlanExecutor<RecoveryStore>;

#[derive(Clone, Debug)]
struct DesktopRuntimeOrigins {
    admin_origin: String,
    api_origin: String,
    account_origin: String,
}

#[derive(Clone, Debug, Default)]
struct DesktopRuntimeConfig {
    origins: Option<DesktopRuntimeOrigins>,
}

#[derive(Clone, Debug)]
struct AdvancedPreferenceNativeContext {
    device_id: String,
}

struct NativeAdvancedPreferenceAuthority {
    store: AdvancedPreferenceStore,
    approval: Option<NativeAdvancedPreferenceApproval>,
}

impl AdvancedPreferenceAuthority for NativeAdvancedPreferenceAuthority {
    fn revalidate(
        &mut self,
        posture: &NativeDevicePosture,
        occurred_at: &str,
    ) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
        self.store
            .observe_binding(stored_device_posture(posture), occurred_at)
            .map_err(map_advanced_preference_error)?;
        project_advanced_preference(&self.store, occurred_at)
    }

    fn transition(
        &mut self,
        transition: AdvancedPreferenceTransition,
    ) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
        let posture = stored_device_posture(&transition.posture);
        self.store
            .observe_binding(posture.clone(), &transition.occurred_at)
            .map_err(map_advanced_preference_error)?;
        if u32::try_from(self.store.projection().event_count).ok()
            != Some(transition.expected_sequence)
        {
            return Err(PlanExecutorError::AuthoritativeSnapshotRequired);
        }
        let approval = self
            .approval
            .as_ref()
            .ok_or(PlanExecutorError::AuthenticationFailed)?;
        let action = match transition.action {
            AdvancedPreferenceTransitionAction::Enable => AdvancedPreferenceAction::Enable,
            AdvancedPreferenceTransitionAction::Revoke => AdvancedPreferenceAction::Revoke,
        };
        let receipt = OpaqueApprovalReceipt::from_native_response(transition.proof_reference)
            .map_err(|_| PlanExecutorError::InvalidRequest)?;
        let proof = approval
            .consume(
                AdvancedPreferenceApprovalRequest {
                    action,
                    authorization_context_id: transition.authorization_context_id,
                    device_id: posture.device_id.clone(),
                    hardware_fingerprint: posture.hardware_fingerprint.clone(),
                    receipt,
                    security_posture_fingerprint: posture.security_posture_fingerprint.clone(),
                },
                transition.now_unix_ms,
            )
            .map_err(|_| PlanExecutorError::AuthenticationFailed)?;
        match transition.action {
            AdvancedPreferenceTransitionAction::Enable => {
                self.store
                    .enable(&proof, transition.now_unix_ms, &transition.occurred_at)
            }
            AdvancedPreferenceTransitionAction::Revoke => {
                self.store
                    .revoke(&proof, transition.now_unix_ms, &transition.occurred_at)
            }
        }
        .map_err(map_advanced_preference_error)?;
        project_advanced_preference(&self.store, &transition.occurred_at)
    }
}

fn stored_device_posture(posture: &NativeDevicePosture) -> DevicePosture {
    DevicePosture {
        device_id: posture.device_id.clone(),
        hardware_fingerprint: posture.hardware_fingerprint.clone(),
        security_posture_fingerprint: posture.security_posture_fingerprint.clone(),
    }
}

fn project_advanced_preference(
    store: &AdvancedPreferenceStore,
    updated_at: &str,
) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
    let history = store.history().map_err(map_advanced_preference_error)?;
    let state = match store.projection().state {
        AdvancedPreferenceState::Disabled => AdvancedPreferenceSnapshotState::Disabled,
        AdvancedPreferenceState::Enabled => AdvancedPreferenceSnapshotState::Enabled,
        AdvancedPreferenceState::Revoked => AdvancedPreferenceSnapshotState::Revoked,
        AdvancedPreferenceState::RevalidationRequired => {
            AdvancedPreferenceSnapshotState::Invalidated
        }
    };
    Ok(AdvancedPreferenceSnapshot {
        kind: "advanced-preference",
        schema_version: "1.0",
        state,
        reason: history
            .last()
            .map(|event| event.reason_code.clone())
            .unwrap_or_else(|| "never-enabled".to_owned()),
        binding_freshness: if state == AdvancedPreferenceSnapshotState::Invalidated {
            BindingFreshness::Stale
        } else {
            BindingFreshness::Current
        },
        sequence: u32::try_from(store.projection().event_count)
            .map_err(|_| PlanExecutorError::InvalidResponse)?,
        updated_at: history
            .last()
            .map(|event| event.occurred_at.clone())
            .unwrap_or_else(|| updated_at.to_owned()),
        provenance: "native",
    })
}

fn map_advanced_preference_error(error: AdvancedPreferenceError) -> PlanExecutorError {
    use AdvancedPreferenceError as Error;
    match error {
        Error::InvalidProofAction
        | Error::ProofBindingMismatch
        | Error::ProofExpired
        | Error::ProofReplayed => PlanExecutorError::AuthenticationFailed,
        Error::InvalidTransition => PlanExecutorError::InvalidRequest,
        Error::IntegrityFailure
        | Error::StorageFull
        | Error::StorageIo
        | Error::StorageBusy
        | Error::Storage => PlanExecutorError::JournalUnavailable,
    }
}

fn desktop_runtime_origins(plugin_config: Option<&Value>) -> Option<DesktopRuntimeOrigins> {
    let plugin_config = plugin_config?;
    let api_origin = plugin_config
        .pointer("/identity/runtime/apiOrigin")?
        .as_str()?;
    let account_origin = plugin_config
        .pointer("/identity/runtime/accountOrigin")?
        .as_str()?;
    let admin_origin = plugin_config
        .pointer("/identity/runtime/adminOrigin")?
        .as_str()?;
    WindowsDesktopIdentityApi::from_origins(api_origin, account_origin).ok()?;
    account_sync::WindowsAccountAuthorityApi::from_origin(api_origin).ok()?;
    validate_https_origin(admin_origin).ok()?;
    Some(DesktopRuntimeOrigins {
        admin_origin: admin_origin.to_owned(),
        api_origin: api_origin.to_owned(),
        account_origin: account_origin.to_owned(),
    })
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BuildProfile {
    Development,
    Production,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ShellDispatchError {
    ContractRejected,
    FixtureAdapterForbidden,
    HostOperationFailed,
    WindowUnavailable,
}

pub struct ShellContract;

impl ShellContract {
    pub fn dispatch_renderer_command(
        message: &Value,
    ) -> Result<RendererToHostShellCommand, ShellDispatchError> {
        validate_renderer_to_host_shell_command(RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID, message)
            .map_err(|_| ShellDispatchError::ContractRejected)
    }

    pub fn prepare_host_event(
        message: &Value,
    ) -> Result<HostToRendererShellEvent, ShellDispatchError> {
        validate_host_to_renderer_shell_event(HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, message)
            .map_err(|_| ShellDispatchError::ContractRejected)
    }

    pub fn authorize_startup(
        profile: BuildProfile,
        adapter: Option<&str>,
    ) -> Result<(), ShellDispatchError> {
        if profile == BuildProfile::Production
            && adapter.is_some_and(|value| value.eq_ignore_ascii_case(FIXTURE_ADAPTER))
        {
            return Err(ShellDispatchError::FixtureAdapterForbidden);
        }

        Ok(())
    }
}

#[tauri::command]
fn dispatch_shell_command(
    app: AppHandle,
    lifecycle: State<'_, Mutex<WindowLifecycle>>,
    tray_lifecycle: State<'_, Mutex<TrayLifecycle>>,
    notification_bridge: State<'_, Mutex<NotificationBridge>>,
    message: Value,
) -> Result<RendererToHostShellCommand, ShellDispatchError> {
    let command = ShellContract::dispatch_renderer_command(&message)?;
    if matches!(
        &command,
        RendererToHostShellCommand::SetLocaleCommand(_)
            | RendererToHostShellCommand::SetNotificationPreferenceCommand(_)
            | RendererToHostShellCommand::ShowNotificationCommand(_)
    ) {
        let effects = notification_bridge
            .lock()
            .map_err(|_| ShellDispatchError::HostOperationFailed)?
            .dispatch_renderer_message(&message, HostEventMetadata::now("notification-command"))
            .map_err(|_| ShellDispatchError::ContractRejected)?;
        apply_notification_effects(&app, effects)?;
        return Ok(command);
    }

    let work_area = current_work_area(&app)?;
    let dispatch = lifecycle
        .lock()
        .map_err(|_| ShellDispatchError::HostOperationFailed)?
        .dispatch_renderer_message(&message, &work_area)
        .map_err(map_window_error)?;

    let tray_effects = if matches!(
        &command,
        RendererToHostShellCommand::SetTrayPreferenceCommand(_)
    ) {
        tray_lifecycle
            .lock()
            .map_err(|_| ShellDispatchError::HostOperationFailed)?
            .dispatch_renderer_message(&message)
            .map_err(|_| ShellDispatchError::ContractRejected)?
    } else {
        Vec::new()
    };

    apply_window_effects(&app, dispatch.effects)?;
    apply_tray_effects(&app, tray_effects)?;
    Ok(dispatch.command)
}

fn current_work_area(app: &AppHandle) -> Result<WorkArea, ShellDispatchError> {
    let window = app
        .get_webview_window("main")
        .ok_or(ShellDispatchError::WindowUnavailable)?;
    let monitor = window
        .current_monitor()
        .map_err(|_| ShellDispatchError::HostOperationFailed)?
        .ok_or(ShellDispatchError::WindowUnavailable)?;
    let monitor_id = monitor
        .name()
        .cloned()
        .unwrap_or_else(|| "monitor-unnamed".to_owned());
    let work_area = monitor.work_area();

    WorkArea::new(
        monitor_id,
        work_area.position.x,
        work_area.position.y,
        work_area.size.width,
        work_area.size.height,
    )
    .map_err(map_window_error)
}

fn map_window_error(error: WindowLifecycleError) -> ShellDispatchError {
    match error {
        WindowLifecycleError::ContractRejected => ShellDispatchError::ContractRejected,
        WindowLifecycleError::HostEventRejected | WindowLifecycleError::InvalidWorkArea => {
            ShellDispatchError::HostOperationFailed
        }
    }
}

fn apply_window_effects(
    app: &AppHandle,
    effects: Vec<WindowEffect>,
) -> Result<(), ShellDispatchError> {
    for effect in effects {
        match effect {
            WindowEffect::Emit(event) => app
                .emit(HOST_EVENT_CHANNEL, event)
                .map_err(|_| ShellDispatchError::HostOperationFailed)?,
            WindowEffect::ApplyWindowState(state) => {
                let window = app
                    .get_webview_window("main")
                    .ok_or(ShellDispatchError::WindowUnavailable)?;
                apply_window_state(&window, &state)?;
            }
            WindowEffect::Close(CloseAction::Exit) => app.exit(0),
            WindowEffect::Close(CloseAction::HideToTray) => {
                let window = app
                    .get_webview_window("main")
                    .ok_or(ShellDispatchError::WindowUnavailable)?;
                window
                    .hide()
                    .map_err(|_| ShellDispatchError::HostOperationFailed)?;
            }
            WindowEffect::Close(CloseAction::StayVisible | CloseAction::AwaitRendererDecision) => {
                let window = app
                    .get_webview_window("main")
                    .ok_or(ShellDispatchError::WindowUnavailable)?;
                window
                    .show()
                    .and_then(|()| window.set_focus())
                    .map_err(|_| ShellDispatchError::HostOperationFailed)?;
            }
        }
    }

    Ok(())
}

fn apply_window_state(
    window: &WebviewWindow,
    state: &ShellWindowState,
) -> Result<(), ShellDispatchError> {
    match state {
        ShellWindowState::NormalWindowState(state) => {
            window
                .unminimize()
                .and_then(|()| window.unmaximize())
                .and_then(|()| window.set_position(PhysicalPosition::new(state.x, state.y)))
                .and_then(|()| {
                    window.set_size(PhysicalSize::new(state.width as u32, state.height as u32))
                })
                .and_then(|()| window.show())
                .map_err(|_| ShellDispatchError::HostOperationFailed)?;
        }
        ShellWindowState::MaximizedWindowState(state) => {
            window
                .unminimize()
                .and_then(|()| window.unmaximize())
                .and_then(|()| window.set_position(PhysicalPosition::new(state.x, state.y)))
                .and_then(|()| {
                    window.set_size(PhysicalSize::new(
                        state.restore_width as u32,
                        state.restore_height as u32,
                    ))
                })
                .and_then(|()| window.maximize())
                .map_err(|_| ShellDispatchError::HostOperationFailed)?;
        }
        ShellWindowState::MinimizedWindowState(_) => {
            window
                .minimize()
                .map_err(|_| ShellDispatchError::HostOperationFailed)?;
        }
    }

    Ok(())
}

fn focus_main_window(app: &AppHandle) -> Result<(), ShellDispatchError> {
    let window = app
        .get_webview_window("main")
        .ok_or(ShellDispatchError::WindowUnavailable)?;
    window
        .unminimize()
        .and_then(|()| window.show())
        .and_then(|()| window.set_focus())
        .map_err(|_| ShellDispatchError::HostOperationFailed)
}

fn emit_navigation_event(
    app: &AppHandle,
    event: HostToRendererShellEvent,
) -> Result<(), ShellDispatchError> {
    focus_main_window(app)?;
    app.emit(HOST_EVENT_CHANNEL, event)
        .map_err(|_| ShellDispatchError::HostOperationFailed)
}

fn apply_tray_effects(app: &AppHandle, effects: Vec<TrayEffect>) -> Result<(), ShellDispatchError> {
    for effect in effects {
        match effect {
            TrayEffect::SetVisible(true) => ensure_native_tray(app)?,
            TrayEffect::SetVisible(false) => {
                let tray_id = TrayIconId::new(TRAY_ID);
                if let Some(tray) = app.tray_by_id(&tray_id) {
                    tray.set_visible(false)
                        .map_err(|_| ShellDispatchError::HostOperationFailed)?;
                }
            }
            TrayEffect::Emit(event) => {
                if matches!(
                    event,
                    HostToRendererShellEvent::NavigationRequestedEvent(_)
                        | HostToRendererShellEvent::CloseRequestedEvent(_)
                ) {
                    focus_main_window(app)?;
                }
                app.emit(HOST_EVENT_CHANNEL, event)
                    .map_err(|_| ShellDispatchError::HostOperationFailed)?;
            }
        }
    }

    Ok(())
}

fn apply_notification_effects(
    app: &AppHandle,
    effects: Vec<NotificationEffect>,
) -> Result<(), ShellDispatchError> {
    for effect in effects {
        match effect {
            NotificationEffect::Emit(event) => app
                .emit(HOST_EVENT_CHANNEL, event)
                .map_err(|_| ShellDispatchError::HostOperationFailed)?,
            NotificationEffect::Show(notification) => {
                if !notification.respects_focus_assist {
                    return Err(ShellDispatchError::ContractRejected);
                }
                let action = serde_json::to_value(&notification.action)
                    .map_err(|_| ShellDispatchError::HostOperationFailed)?;
                let notification_builder = app.notification().builder();
                notification_builder
                    .title(notification.title)
                    .body(notification.body)
                    .extra("category", notification.category)
                    .extra("shellAction", action)
                    .show()
                    .map_err(|_| ShellDispatchError::HostOperationFailed)?;
            }
        }
    }

    Ok(())
}

fn ensure_native_tray(app: &AppHandle) -> Result<(), ShellDispatchError> {
    let tray_id = TrayIconId::new(TRAY_ID);
    if let Some(tray) = app.tray_by_id(&tray_id) {
        let tooltip = app
            .state::<Mutex<TrayLifecycle>>()
            .lock()
            .map_err(|_| ShellDispatchError::HostOperationFailed)?
            .tooltip();
        tray.set_tooltip(Some(tooltip))
            .and_then(|()| tray.set_visible(true))
            .map_err(|_| ShellDispatchError::HostOperationFailed)?;
        return Ok(());
    }

    let menu_context = TrayMenuContext::for_locale(system_shell_locale());
    let mut menu = MenuBuilder::new(app);
    for entry in tray_menu_model(&menu_context)
        .into_iter()
        .filter(|entry| entry.visible)
    {
        match entry.kind {
            TrayMenuEntryKind::Separator => {
                menu = menu.separator();
            }
            TrayMenuEntryKind::Action | TrayMenuEntryKind::Status => {
                let id = entry
                    .id
                    .unwrap_or_else(|| "tray-current-profile-state".to_owned());
                let item = MenuItemBuilder::with_id(id, entry.label)
                    .enabled(entry.enabled)
                    .build(app)
                    .map_err(|_| ShellDispatchError::HostOperationFailed)?;
                menu = menu.item(&item);
            }
        }
    }
    let menu = menu
        .build()
        .map_err(|_| ShellDispatchError::HostOperationFailed)?;
    let tooltip = app
        .state::<Mutex<TrayLifecycle>>()
        .lock()
        .map_err(|_| ShellDispatchError::HostOperationFailed)?
        .tooltip();
    let mut builder = TrayIconBuilder::with_id(tray_id)
        .menu(&menu)
        .show_menu_on_left_click(false)
        .tooltip(tooltip)
        .on_menu_event(|app, event| {
            let effects = app
                .state::<Mutex<TrayLifecycle>>()
                .lock()
                .ok()
                .and_then(|lifecycle| {
                    lifecycle
                        .handle_menu_action(
                            event.id().as_ref(),
                            HostEventMetadata::now("tray-action"),
                        )
                        .ok()
                });
            if let Some(effects) = effects {
                let _ = apply_tray_effects(app, effects);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::DoubleClick {
                    button: MouseButton::Left,
                    ..
                }
            ) {
                let _ = focus_main_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder
        .build(app)
        .map_err(|_| ShellDispatchError::HostOperationFailed)?;

    Ok(())
}

fn system_shell_locale() -> ShellLocale {
    let locale = sys_locale::get_locale()
        .unwrap_or_else(|| "en".to_owned())
        .to_ascii_lowercase();
    if locale.starts_with("pt") {
        ShellLocale::PtBr
    } else {
        ShellLocale::En
    }
}

fn build_profile() -> BuildProfile {
    if cfg!(debug_assertions) {
        BuildProfile::Development
    } else {
        BuildProfile::Production
    }
}

#[tauri::command]
fn get_shell_bootstrap() -> Result<Vec<HostToRendererShellEvent>, ShellDispatchError> {
    let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
        .map_err(|_| ShellDispatchError::HostOperationFailed)?;
    [
        installer_identity_event(&config, HostEventMetadata::now("installer-identity-replay")),
        startup_state_event(
            StartupCondition::Ready,
            HostEventMetadata::now("startup-ready-replay"),
        ),
    ]
    .into_iter()
    .map(|event| event.map_err(|_| ShellDispatchError::ContractRejected))
    .collect()
}

#[tauri::command]
fn sync_account(
    state: State<'_, Mutex<AccountSyncState>>,
    runtime: State<'_, DesktopRuntimeConfig>,
    request: AccountSyncRequest,
) -> AccountSyncResponse {
    let Some(origins) = runtime.origins.as_ref() else {
        return account_sync::unavailable_account_response();
    };
    match state.lock() {
        Ok(mut state) => {
            account_sync::sync_account_from_native(&mut state, request, &origins.api_origin)
        }
        Err(_) => account_sync::unavailable_account_response(),
    }
}

#[tauri::command]
fn refresh_hardware_inventory(
    state: State<'_, Mutex<EvidenceAuthority>>,
    request: InventoryRefreshRequest,
) -> Result<Value, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("refresh-inventory")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .refresh_inventory(request, WindowsInventorySource)
}

#[tauri::command]
fn read_hardware_inventory(
    state: State<'_, Mutex<EvidenceAuthority>>,
) -> Result<Value, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("read-inventory")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .read_inventory()
}

#[tauri::command]
fn start_measurement_capture(
    state: State<'_, Mutex<EvidenceAuthority>>,
    request: CaptureStartRequest,
) -> Result<Value, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("start-capture")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .start_capture(request)
}

#[tauri::command]
fn cancel_measurement_capture(
    state: State<'_, Mutex<EvidenceAuthority>>,
    request: CancelCaptureRequest,
) -> Result<evidence_commands::CancellationReceipt, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("cancel-capture")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .cancel_capture(request)
}

#[tauri::command]
fn finish_measurement_capture(
    state: State<'_, Mutex<EvidenceAuthority>>,
    request: FinishCaptureRequest,
) -> Result<Value, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("finish-capture")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .finish_capture(request)
}

#[tauri::command]
fn read_live_telemetry(
    state: State<'_, Mutex<LiveTelemetrySampler>>,
) -> Result<LiveTelemetrySnapshot, EvidenceCommandError> {
    let mut sampler = state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?;
    Ok(sampler.sample().snapshot)
}

#[tauri::command]
fn sample_measurement_capture(
    telemetry: State<'_, Mutex<LiveTelemetrySampler>>,
    evidence: State<'_, Mutex<EvidenceAuthority>>,
) -> Result<LiveTelemetrySnapshot, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("sample-capture")?;
    let reading = telemetry
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .sample();
    evidence
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .ingest_live_telemetry(&reading.observations)?;
    Ok(reading.snapshot)
}

#[tauri::command]
fn compare_measurement_sessions(
    state: State<'_, Mutex<EvidenceAuthority>>,
    request: ComparisonCommandRequest,
) -> Result<Value, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("compare-measurements")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .compare_measurements(request)
}

#[tauri::command]
fn render_evidence_report(
    state: State<'_, Mutex<EvidenceAuthority>>,
    request: RenderReportRequest,
) -> Result<Value, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("render-report")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .render_report(request)
}

#[tauri::command]
fn export_evidence_report(
    state: State<'_, Mutex<EvidenceAuthority>>,
    request: ExportReportRequest,
) -> Result<ExportReceipt, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("export-report")?;
    state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .export_report(request)
}

#[tauri::command]
fn read_evidence_health(
    state: State<'_, Mutex<EvidenceAuthority>>,
) -> Result<EvidenceHealth, EvidenceCommandError> {
    EvidenceAuthority::admit_operation("read-health")?;
    Ok(state
        .lock()
        .map_err(|_| EvidenceCommandError::AuthorityUnavailable)?
        .read_health())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
enum DesktopAuthCommandError {
    InvalidRequest,
    Rejected,
    Unavailable,
}

impl From<DesktopIdentityError> for DesktopAuthCommandError {
    fn from(error: DesktopIdentityError) -> Self {
        match error {
            DesktopIdentityError::InvalidAuthorizationChallenge
            | DesktopIdentityError::CallbackMismatch
            | DesktopIdentityError::CallbackConsumed
            | DesktopIdentityError::InvalidExchangeResponse => Self::Rejected,
            DesktopIdentityError::CallbackTimeout => Self::Rejected,
            DesktopIdentityError::AuthorizationUnavailable
            | DesktopIdentityError::SystemBrowserUnavailable
            | DesktopIdentityError::CallbackUnavailable
            | DesktopIdentityError::CredentialCustody(_) => Self::Unavailable,
        }
    }
}

#[tauri::command]
fn prepare_device_binding() -> device_identity::DeviceBindingPreview {
    device_identity::prepare_device_binding()
}

#[tauri::command]
async fn bind_current_device(
    runtime: State<'_, DesktopRuntimeConfig>,
    request: device_identity::DeviceBindingRequest,
) -> Result<device_identity::DeviceBindingMutationResponse, DesktopAuthCommandError> {
    let api_origin = runtime
        .origins
        .as_ref()
        .map(|origins| origins.api_origin.clone())
        .ok_or(DesktopAuthCommandError::Unavailable)?;
    tauri::async_runtime::spawn_blocking(move || {
        device_identity::bind_current_device(&api_origin, request).map_err(|error| match error {
            device_identity::DeviceIdentityError::Unauthorized
            | device_identity::DeviceIdentityError::InvalidResponse => {
                DesktopAuthCommandError::Rejected
            }
            _ => DesktopAuthCommandError::Unavailable,
        })
    })
    .await
    .map_err(|_| DesktopAuthCommandError::Unavailable)?
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSignInCommandResponse {
    session: SessionProjection,
    status: &'static str,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopSignOutCommandResponse {
    status: &'static str,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopOpenAdminCommandResponse {
    status: &'static str,
}

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopOpenAccountSubscriptionCommandResponse {
    status: &'static str,
}

#[tauri::command]
async fn open_admin(
    runtime: State<'_, DesktopRuntimeConfig>,
) -> Result<DesktopOpenAdminCommandResponse, DesktopAuthCommandError> {
    let admin_origin = runtime
        .origins
        .as_ref()
        .map(|origins| origins.admin_origin.clone())
        .ok_or(DesktopAuthCommandError::Unavailable)?;
    tauri::async_runtime::spawn_blocking(move || {
        open_admin_in_system_browser(&WindowsSystemBrowser, &admin_origin)
            .map_err(DesktopAuthCommandError::from)?;
        Ok(DesktopOpenAdminCommandResponse { status: "opened" })
    })
    .await
    .map_err(|_| DesktopAuthCommandError::Unavailable)?
}

#[tauri::command]
async fn open_account_subscription(
    runtime: State<'_, DesktopRuntimeConfig>,
    locale: String,
) -> Result<DesktopOpenAccountSubscriptionCommandResponse, DesktopAuthCommandError> {
    let account_origin = runtime
        .origins
        .as_ref()
        .map(|origins| origins.account_origin.clone())
        .ok_or(DesktopAuthCommandError::Unavailable)?;
    tauri::async_runtime::spawn_blocking(move || {
        open_account_subscription_in_system_browser(
            &WindowsSystemBrowser,
            &account_origin,
            &locale,
        )
        .map_err(DesktopAuthCommandError::from)?;
        Ok(DesktopOpenAccountSubscriptionCommandResponse { status: "opened" })
    })
    .await
    .map_err(|_| DesktopAuthCommandError::Unavailable)?
}

#[tauri::command]
async fn desktop_sign_in(
    runtime: State<'_, DesktopRuntimeConfig>,
    email: String,
) -> Result<DesktopSignInCommandResponse, DesktopAuthCommandError> {
    let origins = runtime
        .origins
        .clone()
        .ok_or(DesktopAuthCommandError::Unavailable)?;
    tauri::async_runtime::spawn_blocking(move || {
        if email.trim().is_empty() || email.len() > 254 {
            return Err(DesktopAuthCommandError::InvalidRequest);
        }
        let mut callback =
            LoopbackCallbackListener::bind().map_err(DesktopAuthCommandError::from)?;
        let proof = DesktopPkceProof::generate().map_err(DesktopAuthCommandError::from)?;
        let api =
            WindowsDesktopIdentityApi::from_origins(&origins.api_origin, &origins.account_origin)
                .map_err(DesktopAuthCommandError::from)?;
        let store =
            WindowsCredentialStore::for_account(account_sync::DESKTOP_ACCOUNT_CREDENTIAL_SLOT);
        let session = perform_desktop_sign_in(
            &api,
            &WindowsSystemBrowser,
            &store,
            &mut callback,
            &email,
            proof,
        )
        .map_err(DesktopAuthCommandError::from)?;
        Ok(DesktopSignInCommandResponse {
            session,
            status: "authenticated",
        })
    })
    .await
    .map_err(|_| DesktopAuthCommandError::Unavailable)?
}

#[tauri::command]
async fn desktop_sign_out(
    runtime: State<'_, DesktopRuntimeConfig>,
) -> Result<DesktopSignOutCommandResponse, DesktopAuthCommandError> {
    let origins = runtime
        .origins
        .clone()
        .ok_or(DesktopAuthCommandError::Unavailable)?;
    tauri::async_runtime::spawn_blocking(move || {
        let api =
            WindowsDesktopIdentityApi::from_origins(&origins.api_origin, &origins.account_origin)
                .map_err(DesktopAuthCommandError::from)?;
        let store =
            WindowsCredentialStore::for_account(account_sync::DESKTOP_ACCOUNT_CREDENTIAL_SLOT);
        sign_out_desktop(&api, &store).map_err(DesktopAuthCommandError::from)?;
        Ok(DesktopSignOutCommandResponse {
            status: "signed-out",
        })
    })
    .await
    .map_err(|_| DesktopAuthCommandError::Unavailable)?
}

fn accept_renderer_plan_intent(
    command: PlanCommand,
    request: PlanDocumentRequest,
) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    let document = validate_plan_document(command, &request.document)?;
    command_acceptance(command, &document).ok_or(PlanExecutorError::InvalidRequest)
}

fn native_clock() -> Result<(u64, String), PlanExecutorError> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| PlanExecutorError::InvalidResponse)?;
    let millis =
        u64::try_from(duration.as_millis()).map_err(|_| PlanExecutorError::InvalidResponse)?;
    Ok((millis, format_utc_timestamp(duration.as_secs())))
}

fn format_utc_timestamp(unix_seconds: u64) -> String {
    let days = i64::try_from(unix_seconds / 86_400).unwrap_or(i64::MAX);
    let seconds = unix_seconds % 86_400;
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    let hour = seconds / 3_600;
    let minute = (seconds % 3_600) / 60;
    let second = seconds % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn current_advanced_device_posture(device_id: &str) -> NativeDevicePosture {
    let inventory = WindowsInventorySource.collect();
    let mut hardware = Sha256::new();
    hardware.update(b"liiiraa-phase5-advanced-hardware-v1\0");
    let mut security = Sha256::new();
    security.update(b"liiiraa-phase5-advanced-security-v1\0");
    for (class, fact) in &inventory.facts {
        let class_name = class.contract_key();
        let fact_value = match fact {
            RawHardwareFact::Observed { value, source, .. } => format!("observed|{source}|{value}"),
            RawHardwareFact::Unavailable { reason, source, .. } => {
                format!("unavailable|{source}|{reason:?}")
            }
            RawHardwareFact::Contradictory {
                first,
                second,
                source,
                ..
            } => {
                format!("contradictory|{source}|{first}|{second}")
            }
        };
        let target = if *class == HardwareClass::Security {
            &mut security
        } else {
            &mut hardware
        };
        target.update(class_name.as_bytes());
        target.update([0]);
        target.update(fact_value.as_bytes());
        target.update([0]);
    }
    security.update(format!("{:?}", inventory.windows_version).as_bytes());
    NativeDevicePosture {
        device_id: device_id.to_owned(),
        hardware_fingerprint: format!("sha256:{:x}", hardware.finalize()),
        security_posture_fingerprint: format!("sha256:{:x}", security.finalize()),
    }
}

#[tauri::command]
fn read_advanced_preference(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    context: State<'_, AdvancedPreferenceNativeContext>,
) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
    let (_, occurred_at) = native_clock()?;
    let posture = current_advanced_device_posture(&context.device_id);
    Ok(executor
        .lock()
        .map_err(|_| PlanExecutorError::JournalUnavailable)?
        .revalidate_advanced_preference(posture, &occurred_at))
}

fn transition_advanced_preference(
    executor: &Mutex<NativePlanExecutor>,
    context: &AdvancedPreferenceNativeContext,
    command: AdvancedPreferenceCommand,
    request: Value,
) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
    let request = validate_advanced_preference_request(command, &request)?;
    let (now_unix_ms, occurred_at) = native_clock()?;
    let posture = current_advanced_device_posture(&context.device_id);
    let mut executor = executor
        .lock()
        .map_err(|_| PlanExecutorError::JournalUnavailable)?;
    match command {
        AdvancedPreferenceCommand::Enable => executor.enable_advanced_preference(
            posture,
            request.authorization_context_id,
            request.proof_reference,
            request.expected_sequence,
            now_unix_ms,
            &occurred_at,
        ),
        AdvancedPreferenceCommand::Revoke => executor.revoke_advanced_preference(
            posture,
            request.authorization_context_id,
            request.proof_reference,
            request.expected_sequence,
            now_unix_ms,
            &occurred_at,
        ),
        AdvancedPreferenceCommand::Read => Err(PlanExecutorError::InvalidRequest),
    }
}

#[tauri::command]
fn enable_advanced_preference(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    context: State<'_, AdvancedPreferenceNativeContext>,
    request: Value,
) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
    transition_advanced_preference(
        &executor,
        &context,
        AdvancedPreferenceCommand::Enable,
        request,
    )
}

#[tauri::command]
fn revoke_advanced_preference(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    context: State<'_, AdvancedPreferenceNativeContext>,
    request: Value,
) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
    transition_advanced_preference(
        &executor,
        &context,
        AdvancedPreferenceCommand::Revoke,
        request,
    )
}

#[tauri::command]
fn compose_plan(request: PlanDocumentRequest) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    accept_renderer_plan_intent(PlanCommand::Compose, request)
}

#[tauri::command]
fn revise_plan(request: PlanDocumentRequest) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    accept_renderer_plan_intent(PlanCommand::Revise, request)
}

#[tauri::command]
fn approve_plan(request: PlanDocumentRequest) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    accept_renderer_plan_intent(PlanCommand::Approve, request)
}

fn reject_unavailable_mutation(
    executor: &Mutex<NativePlanExecutor>,
    context: &AdvancedPreferenceNativeContext,
    command: PlanCommand,
    request: PlanDocumentRequest,
    progress: Channel<ExecutionSnapshot>,
) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    let accepted = accept_renderer_plan_intent(command, request)?;
    let mut executor = executor
        .lock()
        .map_err(|_| PlanExecutorError::JournalUnavailable)?;
    if command == PlanCommand::Apply {
        let (_, occurred_at) = native_clock()?;
        let posture = current_advanced_device_posture(&context.device_id);
        let preference = executor.revalidate_advanced_preference(posture, &occurred_at);
        if matches!(
            preference.state,
            plan_executor::AdvancedPreferenceSnapshotState::Invalidated
                | plan_executor::AdvancedPreferenceSnapshotState::Unavailable
        ) {
            return Err(PlanExecutorError::RecoveryRequired);
        }
    }
    let snapshot = executor.read_execution();
    progress
        .send(snapshot)
        .map_err(|_| PlanExecutorError::InvalidResponse)?;
    if !executor.accepts_new_mutation() {
        return Err(PlanExecutorError::RecoveryRequired);
    }
    // A renderer document is only intent. The physical request and proof must
    // be recomputed from native authority and sent by the authenticated broker
    // transport; until a verified packaged broker session exists, fail closed.
    let _ = accepted;
    Err(PlanExecutorError::BrokerUnavailable)
}

#[tauri::command]
fn apply_plan(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    context: State<'_, AdvancedPreferenceNativeContext>,
    request: PlanDocumentRequest,
    progress: Channel<ExecutionSnapshot>,
) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    reject_unavailable_mutation(&executor, &context, PlanCommand::Apply, request, progress)
}

#[tauri::command]
fn restore_plan_operation(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    context: State<'_, AdvancedPreferenceNativeContext>,
    request: PlanDocumentRequest,
    progress: Channel<ExecutionSnapshot>,
) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    reject_unavailable_mutation(
        &executor,
        &context,
        PlanCommand::RestoreOperation,
        request,
        progress,
    )
}

#[tauri::command]
fn restore_plan(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    context: State<'_, AdvancedPreferenceNativeContext>,
    request: PlanDocumentRequest,
    progress: Channel<ExecutionSnapshot>,
) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    reject_unavailable_mutation(
        &executor,
        &context,
        PlanCommand::RestorePlan,
        request,
        progress,
    )
}

#[tauri::command]
fn restore_recovery_checkpoint(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    context: State<'_, AdvancedPreferenceNativeContext>,
    request: PlanDocumentRequest,
    progress: Channel<ExecutionSnapshot>,
) -> Result<AcceptedPlanIntent, PlanExecutorError> {
    reject_unavailable_mutation(
        &executor,
        &context,
        PlanCommand::RestoreCheckpoint,
        request,
        progress,
    )
}

#[tauri::command]
fn read_plan_execution(
    executor: State<'_, Mutex<NativePlanExecutor>>,
) -> Result<ExecutionSnapshot, PlanExecutorError> {
    executor
        .lock()
        .map_err(|_| PlanExecutorError::JournalUnavailable)
        .map(|executor| executor.read_execution())
}

#[tauri::command]
fn subscribe_plan_execution(
    executor: State<'_, Mutex<NativePlanExecutor>>,
    progress: Channel<ExecutionSnapshot>,
) -> Result<ExecutionSnapshot, PlanExecutorError> {
    let snapshot = executor
        .lock()
        .map_err(|_| PlanExecutorError::JournalUnavailable)?
        .read_execution();
    progress
        .send(snapshot.clone())
        .map_err(|_| PlanExecutorError::InvalidResponse)?;
    Ok(snapshot)
}

#[tauri::command]
fn preview_plan_diagnostic(
    executor: State<'_, Mutex<NativePlanExecutor>>,
) -> Result<DiagnosticPreview, PlanExecutorError> {
    executor
        .lock()
        .map_err(|_| PlanExecutorError::JournalUnavailable)?
        .preview_diagnostics()
}

#[tauri::command]
fn export_plan_diagnostic(
    app: AppHandle,
    executor: State<'_, Mutex<NativePlanExecutor>>,
    request: DiagnosticExportRequest,
) -> Result<DiagnosticExportReceipt, PlanExecutorError> {
    validate_export_file_name(&request.file_name)?;
    let export_root = app
        .path()
        .app_data_dir()
        .map_err(|_| PlanExecutorError::ExportFailed)?
        .join("recovery-exports");
    fs::create_dir_all(&export_root).map_err(|_| PlanExecutorError::ExportFailed)?;
    executor
        .lock()
        .map_err(|_| PlanExecutorError::JournalUnavailable)?
        .export_diagnostics(
            &export_root.join(request.file_name),
            DiagnosticConsent {
                preview_fingerprint: request.preview_fingerprint,
                approved: request.approved,
            },
        )
}

fn run() -> Result<(), String> {
    let configured_adapter = std::env::var(ADAPTER_ENVIRONMENT_VARIABLE).ok();
    ShellContract::authorize_startup(build_profile(), configured_adapter.as_deref())
        .map_err(|_| "desktop startup policy rejected the configured adapter".to_owned())?;

    tauri::Builder::default()
        .manage(Mutex::new(WindowLifecycle::default()))
        .manage(Mutex::new(
            TrayLifecycle::with_locale(system_shell_locale()),
        ))
        .manage(Mutex::new(NotificationBridge::default()))
        .manage(Mutex::new(AccountSyncState::default()))
        .manage(Mutex::new(LiveTelemetrySampler::default()))
        .plugin(tauri_plugin_single_instance::init(
            |app, arguments, _cwd| {
                let _ = focus_main_window(app);
                if let Ok(Some(event)) = navigation_event_from_second_instance(
                    &arguments,
                    HostEventMetadata::now("second-instance-navigation"),
                ) {
                    let _ = emit_navigation_event(app, event);
                }
            },
        ))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let origins = desktop_runtime_origins(app.config().plugins.0.get("liiiraa-shell"));
            let advanced_api_origin = origins.as_ref().map(|value| value.api_origin.clone());
            app.manage(DesktopRuntimeConfig { origins });
            let recovery_root = app.path().app_data_dir()?.join("transactional-recovery");
            fs::create_dir_all(&recovery_root)?;
            let recovery_path = recovery_root.join("recovery.sqlite3");
            let integrity_anchor = Arc::new(WindowsIntegrityAnchor::new());
            let recovery_store = RecoveryStore::open(&recovery_path, integrity_anchor.clone())
                .map_err(|_| {
                    std::io::Error::other("native recovery authority could not be initialized")
                })?;
            let database_id = recovery_store
                .diagnostic_export()
                .map_err(|_| std::io::Error::other("native device identity unavailable"))?
                .database_id;
            let device_id = format!("device-{:x}", Sha256::digest(database_id.as_bytes()));
            let (_, occurred_at) =
                native_clock().map_err(|_| std::io::Error::other("native clock unavailable"))?;
            let posture = current_advanced_device_posture(&device_id);
            let advanced_preference = AdvancedPreferenceStore::open(
                &recovery_path,
                integrity_anchor,
                stored_device_posture(&posture),
                &occurred_at,
            )
            .map_err(|_| std::io::Error::other("Advanced preference authority unavailable"))?;
            let authority = NativeAdvancedPreferenceAuthority {
                store: advanced_preference,
                approval: advanced_api_origin
                    .as_deref()
                    .map(NativeAdvancedPreferenceApproval::from_origin)
                    .transpose()
                    .map_err(|_| std::io::Error::other("Advanced preference API origin invalid"))?,
            };
            let mut plan_executor =
                PlanExecutor::new(recovery_store).with_advanced_preference(Box::new(authority));
            plan_executor.reconcile_startup().map_err(|_| {
                std::io::Error::other("native recovery authority could not be reconciled")
            })?;
            let _ = plan_executor.revalidate_advanced_preference(posture, &occurred_at);
            app.manage(Mutex::new(plan_executor));
            app.manage(AdvancedPreferenceNativeContext { device_id });
            let evidence_root = app.path().app_data_dir()?.join("evidence-authority");
            let evidence_authority = EvidenceAuthority::open(evidence_root).map_err(|_| {
                std::io::Error::other("native evidence authority could not be initialized")
            })?;
            app.manage(Mutex::new(evidence_authority));
            let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
            let startup_events = [
                installer_identity_event(&config, HostEventMetadata::now("installer-identity")),
                startup_state_event(
                    StartupCondition::OpeningShell,
                    HostEventMetadata::now("startup-opening-shell"),
                ),
                startup_state_event(
                    StartupCondition::Ready,
                    HostEventMetadata::now("startup-ready"),
                ),
            ];
            for event in startup_events {
                let event = event.map_err(|_| {
                    std::io::Error::other("generated startup event failed validation")
                })?;
                app.emit(HOST_EVENT_CHANNEL, event)?;
            }

            let app_handle = app.handle().clone();
            app.deep_link().on_open_url(move |open_url| {
                for url in open_url.urls() {
                    if let Ok(event) = navigation_event_from_external(
                        url.as_str(),
                        ExternalNavigationSource::DeepLink,
                        HostEventMetadata::now("deep-link-navigation"),
                    ) {
                        let _ = emit_navigation_event(&app_handle, event);
                        break;
                    }
                }
            });

            if let Ok(Some(urls)) = app.deep_link().get_current() {
                for url in urls {
                    if let Ok(event) = navigation_event_from_external(
                        url.as_str(),
                        ExternalNavigationSource::DeepLink,
                        HostEventMetadata::now("startup-deep-link-navigation"),
                    ) {
                        let _ = emit_navigation_event(app.handle(), event);
                        break;
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            apply_plan,
            approve_plan,
            bind_current_device,
            cancel_measurement_capture,
            compare_measurement_sessions,
            compose_plan,
            desktop_sign_in,
            desktop_sign_out,
            dispatch_shell_command,
            enable_advanced_preference,
            export_evidence_report,
            export_plan_diagnostic,
            finish_measurement_capture,
            get_shell_bootstrap,
            open_account_subscription,
            open_admin,
            prepare_device_binding,
            preview_plan_diagnostic,
            read_advanced_preference,
            read_plan_execution,
            read_live_telemetry,
            read_evidence_health,
            read_hardware_inventory,
            refresh_hardware_inventory,
            render_evidence_report,
            restore_recovery_checkpoint,
            revoke_advanced_preference,
            restore_plan_operation,
            restore_plan,
            revise_plan,
            sample_measurement_capture,
            start_measurement_capture,
            subscribe_plan_execution,
            sync_account
        ])
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            match event {
                WindowEvent::Resized(_) => {
                    let should_hide = window.is_minimized().unwrap_or(false)
                        && window
                            .state::<Mutex<WindowLifecycle>>()
                            .lock()
                            .is_ok_and(|lifecycle| lifecycle.should_hide_on_minimize());
                    if should_hide {
                        let _ = window.hide();
                    }
                }
                WindowEvent::CloseRequested { api, .. } => {
                    let lifecycle = window.state::<Mutex<WindowLifecycle>>();
                    let close = lifecycle.lock().ok().and_then(|lifecycle| {
                        lifecycle
                            .begin_close(HostEventMetadata::now("close-request"))
                            .ok()
                    });

                    let Some(close) = close else {
                        api.prevent_close();
                        return;
                    };

                    match close.action {
                        CloseAction::Exit => {}
                        CloseAction::HideToTray => {
                            api.prevent_close();
                            let _ = window.hide();
                        }
                        CloseAction::StayVisible | CloseAction::AwaitRendererDecision => {
                            api.prevent_close();
                            if let Some(event) = close.event {
                                let _ = window.emit(HOST_EVENT_CHANNEL, event);
                            }
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .map_err(|error| format!("desktop host failed: {error}"))?
        .run(|app, event| {
            if matches!(event, RunEvent::ExitRequested { .. } | RunEvent::Exit) {
                if let Some(executor) = app.try_state::<Mutex<NativePlanExecutor>>() {
                    if let Ok(mut executor) = executor.lock() {
                        executor.begin_shutdown();
                    }
                }
            }
        });
    Ok(())
}

fn main() {
    match phase5_probe::try_run() {
        Ok(true) => return,
        Ok(false) => {}
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn envelope(message_type: &str, payload: Value) -> Value {
        json!({
            "schemaVersion": "1.0",
            "messageType": message_type,
            "requestId": "request-shell-host-0001",
            "correlationId": "correlation-shell-host-0001",
            "issuedAt": "2026-07-27T12:00:00.000Z",
            "payload": payload
        })
    }

    #[test]
    fn shell_contract_dispatches_only_valid_generated_messages() {
        let command = envelope(
            "desktop.shell.set-locale.command",
            json!({ "locale": "pt-BR" }),
        );
        let event = envelope(
            "desktop.shell.locale-changed.event",
            json!({ "locale": "pt-BR" }),
        );

        assert!(ShellContract::dispatch_renderer_command(&command).is_ok());
        assert!(ShellContract::prepare_host_event(&event).is_ok());
    }

    #[test]
    fn production_startup_refuses_fixture_adapter() {
        assert_eq!(
            ShellContract::authorize_startup(BuildProfile::Production, Some(FIXTURE_ADAPTER)),
            Err(ShellDispatchError::FixtureAdapterForbidden)
        );
        assert_eq!(
            ShellContract::authorize_startup(BuildProfile::Development, Some(FIXTURE_ADAPTER)),
            Ok(())
        );
        assert_eq!(
            ShellContract::authorize_startup(BuildProfile::Production, None),
            Ok(())
        );
    }

    #[test]
    fn shell_contract_rejects_unknown_and_cross_direction_messages() {
        let unknown = envelope(
            "desktop.shell.execute-arbitrary.command",
            json!({ "script": "SENSITIVE_COMMAND" }),
        );
        let host_event = envelope(
            "desktop.shell.locale-changed.event",
            json!({ "locale": "pt-BR" }),
        );

        assert!(matches!(
            ShellContract::dispatch_renderer_command(&unknown),
            Err(ShellDispatchError::ContractRejected)
        ));
        assert!(matches!(
            ShellContract::dispatch_renderer_command(&host_event),
            Err(ShellDispatchError::ContractRejected)
        ));
    }
}
