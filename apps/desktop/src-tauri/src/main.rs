use liiiraa_contracts_rust::{HostToRendererShellEvent, RendererToHostShellCommand};
use serde_json::Value;

const FIXTURE_ADAPTER: &str = "fixture";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum BuildProfile {
    Development,
    Production,
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum ShellDispatchError {
    ContractRejected,
    FixtureAdapterForbidden,
}

struct ShellContract;

impl ShellContract {
    fn dispatch_renderer_command(
        _message: &Value,
    ) -> Result<RendererToHostShellCommand, ShellDispatchError> {
        Err(ShellDispatchError::ContractRejected)
    }

    fn prepare_host_event(
        _message: &Value,
    ) -> Result<HostToRendererShellEvent, ShellDispatchError> {
        Err(ShellDispatchError::ContractRejected)
    }

    fn authorize_startup(
        _profile: BuildProfile,
        _adapter: Option<&str>,
    ) -> Result<(), ShellDispatchError> {
        Err(ShellDispatchError::FixtureAdapterForbidden)
    }
}

fn main() {}

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
}
