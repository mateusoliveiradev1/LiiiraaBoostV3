use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, HostToRendererShellEvent,
    RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID, RendererToHostShellCommand,
    validate_host_to_renderer_shell_event, validate_renderer_to_host_shell_command,
};
use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

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
    message: Value,
) -> Result<RendererToHostShellCommand, ShellDispatchError> {
    ShellContract::dispatch_renderer_command(&message)
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
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            },
        ))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![dispatch_shell_command])
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
