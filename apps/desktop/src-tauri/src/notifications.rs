use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, HostToRendererShellEvent,
    RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID, RendererToHostShellCommand, ShellLocale,
    ShellNavigationIntent, ShellNotificationCategory, validate_host_to_renderer_shell_event,
    validate_renderer_to_host_shell_command,
};
use serde_json::{Value, json};

use crate::window::HostEventMetadata;

#[derive(Clone, Debug)]
pub struct ApprovedNotification {
    pub category: String,
    pub title: String,
    pub body: String,
    pub respects_focus_assist: bool,
    pub action: HostToRendererShellEvent,
}

#[derive(Clone, Debug)]
pub enum NotificationEffect {
    Emit(HostToRendererShellEvent),
    Show(ApprovedNotification),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum NotificationBridgeError {
    ContractRejected,
    HostEventRejected,
    InvalidInstallerIdentity,
    UnsafeAction,
}

#[derive(Clone, Debug)]
pub struct NotificationBridge {
    locale: ShellLocale,
    enabled: bool,
    categories: Vec<ShellNotificationCategory>,
}

impl Default for NotificationBridge {
    fn default() -> Self {
        Self {
            locale: ShellLocale::En,
            enabled: false,
            categories: Vec::new(),
        }
    }
}

impl NotificationBridge {
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn dispatch_renderer_message(
        &mut self,
        message: &Value,
        metadata: HostEventMetadata,
    ) -> Result<Vec<NotificationEffect>, NotificationBridgeError> {
        let command = validate_renderer_to_host_shell_command(
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            message,
        )
        .map_err(|_| NotificationBridgeError::ContractRejected)?;

        match command {
            RendererToHostShellCommand::SetLocaleCommand(command) => {
                self.locale = command.payload.locale;
                Ok(vec![NotificationEffect::Emit(build_host_event(
                    "desktop.shell.locale-changed.event",
                    json!({ "locale": command.payload.locale }),
                    metadata,
                )?)])
            }
            RendererToHostShellCommand::SetNotificationPreferenceCommand(command) => {
                self.enabled = command.payload.preference.enabled;
                self.categories = command.payload.preference.categories.clone();
                Ok(vec![NotificationEffect::Emit(build_host_event(
                    "desktop.shell.notification-preference-changed.event",
                    json!({ "preference": command.payload.preference }),
                    metadata,
                )?)])
            }
            RendererToHostShellCommand::ShowNotificationCommand(command) => {
                let category = command.payload.category;
                if !self.enabled || !self.categories.contains(&category) {
                    return Ok(Vec::new());
                }
                if !notification_action_is_safe(&category, &command.payload.action) {
                    return Err(NotificationBridgeError::UnsafeAction);
                }

                let (title, body) = approved_copy(&self.locale, &category);
                let action = build_host_event(
                    "desktop.shell.navigation-requested.event",
                    json!({
                        "source": "notification",
                        "intent": command.payload.action,
                    }),
                    metadata,
                )?;
                Ok(vec![NotificationEffect::Show(ApprovedNotification {
                    category: category.to_string(),
                    title: title.to_owned(),
                    body: body.to_owned(),
                    respects_focus_assist: true,
                    action,
                })])
            }
            _ => Err(NotificationBridgeError::ContractRejected),
        }
    }
}

fn notification_action_is_safe(
    category: &ShellNotificationCategory,
    action: &ShellNavigationIntent,
) -> bool {
    let Ok(action) = serde_json::to_value(action) else {
        return false;
    };
    let expected = match category {
        ShellNotificationCategory::RecoveryRequired => {
            json!({ "kind": "goal", "destination": "recover" })
        }
        ShellNotificationCategory::RestartDeadline => {
            json!({ "kind": "settings", "destination": "updates" })
        }
        ShellNotificationCategory::GameProfileRestoreFailed => {
            json!({ "kind": "goal", "destination": "prepare" })
        }
        ShellNotificationCategory::SignedUpdateActionRequired => {
            json!({ "kind": "settings", "destination": "updates" })
        }
        ShellNotificationCategory::AccountSecurity => {
            json!({ "kind": "goal", "destination": "account" })
        }
    };
    action == expected
}

fn approved_copy(
    locale: &ShellLocale,
    category: &ShellNotificationCategory,
) -> (&'static str, &'static str) {
    match (locale, category) {
        (ShellLocale::PtBr, ShellNotificationCategory::RecoveryRequired) => (
            "Liiiraa Boost — Recuperação necessária",
            "Uma alteração precisa ser revisada. Abra a recuperação para continuar com segurança.",
        ),
        (ShellLocale::PtBr, ShellNotificationCategory::RestartDeadline) => (
            "Liiiraa Boost — Reinicialização agendada",
            "O prazo escolhido está próximo. Revise a reinicialização antes de continuar.",
        ),
        (ShellLocale::PtBr, ShellNotificationCategory::GameProfileRestoreFailed) => (
            "Liiiraa Boost — Falha ao restaurar perfil",
            "O perfil do jogo não foi restaurado. Abra Preparar para revisar o estado seguro.",
        ),
        (ShellLocale::PtBr, ShellNotificationCategory::SignedUpdateActionRequired) => (
            "Liiiraa Boost — Atualização assinada requer ação",
            "Uma atualização verificada aguarda sua revisão nas configurações.",
        ),
        (ShellLocale::PtBr, ShellNotificationCategory::AccountSecurity) => (
            "Liiiraa Boost — Segurança da conta",
            "Um evento de segurança requer sua revisão. Abra a conta para ver os detalhes.",
        ),
        (ShellLocale::En, ShellNotificationCategory::RecoveryRequired) => (
            "Liiiraa Boost — Recovery required",
            "A change requires review. Open recovery to continue safely.",
        ),
        (ShellLocale::En, ShellNotificationCategory::RestartDeadline) => (
            "Liiiraa Boost — Restart scheduled",
            "Your chosen deadline is approaching. Review the restart before continuing.",
        ),
        (ShellLocale::En, ShellNotificationCategory::GameProfileRestoreFailed) => (
            "Liiiraa Boost — Profile restore failed",
            "The game profile was not restored. Open Prepare to review the safe state.",
        ),
        (ShellLocale::En, ShellNotificationCategory::SignedUpdateActionRequired) => (
            "Liiiraa Boost — Signed update requires action",
            "A verified update is waiting for your review in Settings.",
        ),
        (ShellLocale::En, ShellNotificationCategory::AccountSecurity) => (
            "Liiiraa Boost — Account security",
            "A security event requires review. Open Account to view the details.",
        ),
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum StartupCondition {
    OpeningShell,
    Ready,
    MissingWebView2,
    DamagedInstallation,
    UnsupportedBuild,
    MigrationFailure,
    UpdateInProgress,
    SignatureInvalid,
    RollbackAvailable,
    SafeMode,
}

pub fn startup_state_event(
    condition: StartupCondition,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, NotificationBridgeError> {
    let state = match condition {
        StartupCondition::OpeningShell => {
            json!({ "kind": "splash", "step": "opening-shell" })
        }
        StartupCondition::Ready => json!({ "kind": "ready" }),
        StartupCondition::MissingWebView2 => json!({
            "kind": "failure",
            "reason": "missing-webview2",
            "recoveryAction": "install-webview2"
        }),
        StartupCondition::DamagedInstallation => json!({
            "kind": "failure",
            "reason": "damaged-installation",
            "recoveryAction": "view-offline-instructions"
        }),
        StartupCondition::UnsupportedBuild => json!({
            "kind": "failure",
            "reason": "incompatible-windows-build",
            "recoveryAction": "view-offline-instructions"
        }),
        StartupCondition::MigrationFailure => json!({
            "kind": "failure",
            "reason": "local-state-migration-failed",
            "recoveryAction": "open-safe-mode"
        }),
        StartupCondition::UpdateInProgress => {
            json!({ "kind": "updating", "step": "installing-update" })
        }
        StartupCondition::SignatureInvalid => json!({
            "kind": "failure",
            "reason": "update-signature-failed",
            "recoveryAction": "rollback"
        }),
        StartupCondition::RollbackAvailable => {
            json!({ "kind": "updating", "step": "preparing-rollback" })
        }
        StartupCondition::SafeMode => json!({
            "kind": "failure",
            "reason": "internal-startup-error",
            "recoveryAction": "open-safe-mode"
        }),
    };

    build_host_event(
        "desktop.shell.startup-state-changed.event",
        json!({ "state": state }),
        metadata,
    )
}

pub fn installer_identity_event(
    config: &Value,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, NotificationBridgeError> {
    let identity = config
        .pointer("/plugins/liiiraa-shell/identity")
        .and_then(Value::as_object)
        .ok_or(NotificationBridgeError::InvalidInstallerIdentity)?;
    let publisher = identity
        .get("publisher")
        .cloned()
        .ok_or(NotificationBridgeError::InvalidInstallerIdentity)?;
    let version = identity
        .get("version")
        .cloned()
        .ok_or(NotificationBridgeError::InvalidInstallerIdentity)?;
    let channel = identity
        .get("channel")
        .cloned()
        .ok_or(NotificationBridgeError::InvalidInstallerIdentity)?;
    let supported_windows = identity
        .get("compatibility")
        .and_then(|compatibility| compatibility.get("windows"))
        .and_then(Value::as_array)
        .ok_or(NotificationBridgeError::InvalidInstallerIdentity)?;
    if supported_windows.is_empty()
        || !supported_windows
            .iter()
            .all(|version| matches!(version.as_str(), Some("10" | "11")))
    {
        return Err(NotificationBridgeError::InvalidInstallerIdentity);
    }

    build_host_event(
        "desktop.shell.installer-identity.event",
        json!({
            "installer": {
                "publisher": publisher,
                "version": version,
                "channel": channel,
                "windowsCompatibility": {
                    "kind": "supported",
                    "detectedBuild": 0,
                    "minimumBuild": 0,
                },
            }
        }),
        metadata,
    )
    .map_err(|_| NotificationBridgeError::InvalidInstallerIdentity)
}

fn build_host_event(
    message_type: &str,
    payload: Value,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, NotificationBridgeError> {
    validate_host_to_renderer_shell_event(
        HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
        &metadata.into_envelope(message_type, payload),
    )
    .map_err(|_| NotificationBridgeError::HostEventRejected)
}
