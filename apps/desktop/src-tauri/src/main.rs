mod navigation;
mod tray;
mod window;

use std::sync::Mutex;

use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, HostToRendererShellEvent,
    RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID, RendererToHostShellCommand, ShellWindowState,
    validate_host_to_renderer_shell_event, validate_renderer_to_host_shell_command,
};
use navigation::{
    ExternalNavigationSource, navigation_event_from_external, navigation_event_from_second_instance,
};
use serde::Serialize;
use serde_json::Value;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconId};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;
use tray::{
    TRAY_ID, TrayEffect, TrayLifecycle, TrayMenuContext, TrayMenuEntryKind, tray_menu_model,
};
use window::{
    CloseAction, HOST_EVENT_CHANNEL, HostEventMetadata, WindowEffect, WindowLifecycle,
    WindowLifecycleError, WorkArea,
};

const FIXTURE_ADAPTER: &str = "fixture";
const ADAPTER_ENVIRONMENT_VARIABLE: &str = "LIIIRAA_DESKTOP_ADAPTER";

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
    message: Value,
) -> Result<RendererToHostShellCommand, ShellDispatchError> {
    let command = ShellContract::dispatch_renderer_command(&message)?;
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
    Ok(command)
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
                if matches!(event, HostToRendererShellEvent::NavigationRequestedEvent(_)) {
                    focus_main_window(app)?;
                }
                app.emit(HOST_EVENT_CHANNEL, event)
                    .map_err(|_| ShellDispatchError::HostOperationFailed)?;
            }
            TrayEffect::ExitInterface => app.exit(0),
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

    let menu_context = TrayMenuContext::default();
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
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder
        .build(app)
        .map_err(|_| ShellDispatchError::HostOperationFailed)?;

    Ok(())
}

fn build_profile() -> BuildProfile {
    if cfg!(debug_assertions) {
        BuildProfile::Development
    } else {
        BuildProfile::Production
    }
}

fn run() -> Result<(), String> {
    let configured_adapter = std::env::var(ADAPTER_ENVIRONMENT_VARIABLE).ok();
    ShellContract::authorize_startup(build_profile(), configured_adapter.as_deref())
        .map_err(|_| "desktop startup policy rejected the configured adapter".to_owned())?;

    tauri::Builder::default()
        .manage(Mutex::new(WindowLifecycle::default()))
        .manage(Mutex::new(TrayLifecycle::default()))
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
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
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
        .invoke_handler(tauri::generate_handler![dispatch_shell_command])
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }

            let WindowEvent::CloseRequested { api, .. } = event else {
                return;
            };
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

            let _ = window.emit(HOST_EVENT_CHANNEL, close.event);
            match close.action {
                CloseAction::Exit => {}
                CloseAction::HideToTray => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                CloseAction::StayVisible | CloseAction::AwaitRendererDecision => {
                    api.prevent_close();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
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
