use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, HostToRendererShellEvent,
    RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID, RendererToHostShellCommand, ShellTrayPreference,
    validate_host_to_renderer_shell_event, validate_renderer_to_host_shell_command,
};
use serde_json::{Value, json};

use crate::window::HostEventMetadata;

pub const TRAY_ID: &str = "liiiraa-boost-tray";

const OPEN_ID: &str = "tray-open";
const PREPARE_LAUNCH_ID: &str = "tray-prepare-launch";
const PAUSE_AUTOMATIC_PROFILES_ID: &str = "tray-pause-automatic-profiles";
const ACTIVITY_ID: &str = "tray-activity";
const SETTINGS_ID: &str = "tray-settings";
const EXIT_INTERFACE_ID: &str = "tray-exit-interface";

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TrayMenuEntryKind {
    Action,
    Status,
    Separator,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrayMenuEntry {
    pub id: Option<String>,
    pub label: String,
    pub enabled: bool,
    pub visible: bool,
    pub kind: TrayMenuEntryKind,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TrayMenuContext {
    pub selected_game: String,
    pub profile_state: String,
    pub automatic_profiles_paused: bool,
    pub attention_count: u32,
}

impl Default for TrayMenuContext {
    fn default() -> Self {
        Self {
            selected_game: "No game selected".to_owned(),
            profile_state: "Current profile · Not selected".to_owned(),
            automatic_profiles_paused: false,
            attention_count: 0,
        }
    }
}

pub fn tray_menu_model(context: &TrayMenuContext) -> Vec<TrayMenuEntry> {
    vec![
        action(OPEN_ID, "Open Liiiraa Boost"),
        action(
            PREPARE_LAUNCH_ID,
            format!("{} · Prepare launch", context.selected_game),
        ),
        TrayMenuEntry {
            id: None,
            label: context.profile_state.clone(),
            enabled: false,
            visible: true,
            kind: TrayMenuEntryKind::Status,
        },
        action(
            PAUSE_AUTOMATIC_PROFILES_ID,
            if context.automatic_profiles_paused {
                "Resume automatic profiles"
            } else {
                "Pause automatic profiles"
            },
        ),
        TrayMenuEntry {
            id: Some(ACTIVITY_ID.to_owned()),
            label: format!("Activity requiring attention ({})", context.attention_count),
            enabled: true,
            visible: context.attention_count > 0,
            kind: TrayMenuEntryKind::Action,
        },
        TrayMenuEntry {
            id: None,
            label: String::new(),
            enabled: false,
            visible: true,
            kind: TrayMenuEntryKind::Separator,
        },
        action(SETTINGS_ID, "Settings"),
        action(EXIT_INTERFACE_ID, "Exit interface"),
    ]
}

fn action(id: &str, label: impl Into<String>) -> TrayMenuEntry {
    TrayMenuEntry {
        id: Some(id.to_owned()),
        label: label.into(),
        enabled: true,
        visible: true,
        kind: TrayMenuEntryKind::Action,
    }
}

#[derive(Clone, Debug)]
pub enum TrayEffect {
    SetVisible(bool),
    Emit(HostToRendererShellEvent),
    ExitInterface,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum TrayLifecycleError {
    ContractRejected,
    HostEventRejected,
    UnknownAction,
}

#[derive(Clone, Debug, Default)]
pub struct TrayLifecycle {
    opted_in: bool,
    safety_workflow_active: bool,
}

impl TrayLifecycle {
    pub fn is_visible(&self) -> bool {
        self.opted_in || self.safety_workflow_active
    }

    pub fn tooltip(&self) -> &'static str {
        if self.safety_workflow_active {
            "Liiiraa Boost — Recovery required"
        } else {
            "Liiiraa Boost — Interface open"
        }
    }

    pub fn dispatch_renderer_message(
        &mut self,
        message: &Value,
    ) -> Result<Vec<TrayEffect>, TrayLifecycleError> {
        let command = validate_renderer_to_host_shell_command(
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            message,
        )
        .map_err(|_| TrayLifecycleError::ContractRejected)?;
        let RendererToHostShellCommand::SetTrayPreferenceCommand(command) = command else {
            return Err(TrayLifecycleError::ContractRejected);
        };

        let was_visible = self.is_visible();
        self.opted_in = matches!(
            command.payload.preference,
            ShellTrayPreference::KeepGameDetectionInTray
        );
        Ok(visibility_effect(was_visible, self.is_visible()))
    }

    pub fn set_safety_workflow_active(&mut self, active: bool) -> Vec<TrayEffect> {
        let was_visible = self.is_visible();
        self.safety_workflow_active = active;
        visibility_effect(was_visible, self.is_visible())
    }

    pub fn handle_menu_action(
        &self,
        action_id: &str,
        metadata: HostEventMetadata,
    ) -> Result<Vec<TrayEffect>, TrayLifecycleError> {
        let action = TrayAction::try_from(action_id)?;
        let effects = match action {
            TrayAction::Open => vec![TrayEffect::Emit(navigation_event(
                json!({ "kind": "goal", "destination": "home" }),
                metadata,
            )?)],
            TrayAction::PrepareLaunch => vec![TrayEffect::Emit(navigation_event(
                json!({ "kind": "goal", "destination": "prepare" }),
                metadata,
            )?)],
            TrayAction::PauseAutomaticProfiles => vec![TrayEffect::Emit(navigation_event(
                json!({ "kind": "settings", "destination": "background" }),
                metadata,
            )?)],
            TrayAction::Activity => vec![TrayEffect::Emit(navigation_event(
                json!({ "kind": "goal", "destination": "activity" }),
                metadata,
            )?)],
            TrayAction::Settings => vec![TrayEffect::Emit(navigation_event(
                json!({ "kind": "settings", "destination": "general" }),
                metadata,
            )?)],
            TrayAction::ExitInterface => vec![
                TrayEffect::Emit(build_host_event(
                    "desktop.shell.close-requested.event",
                    json!({ "context": { "kind": "ordinary" } }),
                    metadata,
                )?),
                TrayEffect::ExitInterface,
            ],
        };

        Ok(effects)
    }
}

fn visibility_effect(was_visible: bool, is_visible: bool) -> Vec<TrayEffect> {
    if was_visible == is_visible {
        Vec::new()
    } else {
        vec![TrayEffect::SetVisible(is_visible)]
    }
}

fn navigation_event(
    intent: Value,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, TrayLifecycleError> {
    build_host_event(
        "desktop.shell.navigation-requested.event",
        json!({
            "source": "tray",
            "intent": intent,
        }),
        metadata,
    )
}

fn build_host_event(
    message_type: &str,
    payload: Value,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, TrayLifecycleError> {
    validate_host_to_renderer_shell_event(
        HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID,
        &metadata.into_envelope(message_type, payload),
    )
    .map_err(|_| TrayLifecycleError::HostEventRejected)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TrayAction {
    Open,
    PrepareLaunch,
    PauseAutomaticProfiles,
    Activity,
    Settings,
    ExitInterface,
}

impl TryFrom<&str> for TrayAction {
    type Error = TrayLifecycleError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            OPEN_ID => Ok(Self::Open),
            PREPARE_LAUNCH_ID => Ok(Self::PrepareLaunch),
            PAUSE_AUTOMATIC_PROFILES_ID => Ok(Self::PauseAutomaticProfiles),
            ACTIVITY_ID => Ok(Self::Activity),
            SETTINGS_ID => Ok(Self::Settings),
            EXIT_INTERFACE_ID => Ok(Self::ExitInterface),
            _ => Err(TrayLifecycleError::UnknownAction),
        }
    }
}
