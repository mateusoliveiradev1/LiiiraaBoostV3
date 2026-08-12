#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[allow(dead_code)]
mod account_sync;
#[allow(dead_code)]
mod credential_store;
#[allow(dead_code)]
mod device_identity;
#[allow(dead_code)]
mod evidence_policy;
#[allow(dead_code)]
mod identity;
mod navigation;
mod notifications;
#[allow(dead_code)]
mod offline_entitlement;
#[allow(dead_code)]
mod premium_authority;
mod tray;
mod window;

use std::sync::Mutex;

use account_sync::{AccountSyncRequest, AccountSyncResponse, AccountSyncState};
use credential_store::WindowsCredentialStore;
use identity::{
    DesktopIdentityError, DesktopPkceProof, LoopbackCallbackListener, WindowsDesktopIdentityApi,
    WindowsSystemBrowser, open_account_subscription_in_system_browser,
    open_admin_in_system_browser, perform_desktop_sign_in, sign_out_desktop, validate_https_origin,
};

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
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent, TrayIconId};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow, WindowEvent,
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
            app.manage(DesktopRuntimeConfig { origins });
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
            bind_current_device,
            desktop_sign_in,
            desktop_sign_out,
            dispatch_shell_command,
            get_shell_bootstrap,
            open_account_subscription,
            open_admin,
            prepare_device_binding,
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
        .run(tauri::generate_context!())
        .map_err(|error| format!("desktop host failed: {error}"))
}

fn main() {
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
