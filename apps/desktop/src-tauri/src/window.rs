use std::{
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, HostToRendererShellEvent,
    RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID, RendererToHostShellCommand, ShellCloseResolution,
    ShellMaximizedWindowState, ShellMinimizedWindowStateRestoreState, ShellMonitorId,
    ShellNormalWindowState, ShellOrdinaryCloseResolutionDecision,
    ShellRecoveryCloseResolutionDecision, ShellTrayPreference, ShellWindowState,
    validate_host_to_renderer_shell_event, validate_renderer_to_host_shell_command,
};
use serde_json::{Value, json};

pub const HOST_EVENT_CHANNEL: &str = "desktop-shell-event";

static HOST_EVENT_SEQUENCE: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CloseAction {
    Exit,
    HideToTray,
    StayVisible,
    AwaitRendererDecision,
}

#[derive(Clone, Debug)]
pub enum WindowEffect {
    Emit(HostToRendererShellEvent),
    ApplyWindowState(ShellWindowState),
    Close(CloseAction),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum WindowLifecycleError {
    ContractRejected,
    HostEventRejected,
    InvalidWorkArea,
}

#[derive(Clone, Debug)]
pub struct WorkArea {
    monitor_id: ShellMonitorId,
    x: i32,
    y: i32,
    width: i64,
    height: i64,
}

impl WorkArea {
    pub fn new(
        monitor_id: impl Into<String>,
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    ) -> Result<Self, WindowLifecycleError> {
        if width < 760 || height < 600 {
            return Err(WindowLifecycleError::InvalidWorkArea);
        }

        let monitor_id = ShellMonitorId::try_from(monitor_id.into())
            .map_err(|_| WindowLifecycleError::InvalidWorkArea)?;

        Ok(Self {
            monitor_id,
            x,
            y,
            width: i64::from(width),
            height: i64::from(height),
        })
    }
}

#[derive(Clone, Debug)]
pub struct HostEventMetadata {
    request_id: String,
    correlation_id: Option<String>,
    issued_at: String,
}

impl HostEventMetadata {
    #[cfg(test)]
    pub fn fixed(request_id: impl Into<String>, issued_at: impl Into<String>) -> Self {
        Self {
            request_id: request_id.into(),
            correlation_id: None,
            issued_at: issued_at.into(),
        }
    }

    pub fn now(kind: &str) -> Self {
        let elapsed = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default();
        let sequence = HOST_EVENT_SEQUENCE.fetch_add(1, Ordering::Relaxed);

        Self {
            request_id: format!("host-{kind}-{}-{sequence}", elapsed.as_secs()),
            correlation_id: None,
            issued_at: format_unix_timestamp(elapsed.as_secs()),
        }
    }
}

#[derive(Clone, Debug)]
pub struct CloseRequest {
    pub action: CloseAction,
    pub event: HostToRendererShellEvent,
}

#[derive(Clone, Debug)]
pub struct WindowDispatch {
    pub command: RendererToHostShellCommand,
    pub effects: Vec<WindowEffect>,
}

#[derive(Clone, Debug)]
pub struct WindowLifecycle {
    keep_game_detection_in_tray: bool,
    recovery_in_progress: bool,
}

impl Default for WindowLifecycle {
    fn default() -> Self {
        Self {
            keep_game_detection_in_tray: false,
            recovery_in_progress: false,
        }
    }
}

impl WindowLifecycle {
    pub fn close_action(&self) -> CloseAction {
        if self.recovery_in_progress {
            CloseAction::AwaitRendererDecision
        } else if self.keep_game_detection_in_tray {
            CloseAction::HideToTray
        } else {
            CloseAction::Exit
        }
    }

    #[allow(
        dead_code,
        reason = "the recovery workflow owns this bounded host state"
    )]
    pub fn set_recovery_in_progress(&mut self, recovery_in_progress: bool) {
        self.recovery_in_progress = recovery_in_progress;
    }

    pub fn begin_close(
        &self,
        metadata: HostEventMetadata,
    ) -> Result<CloseRequest, WindowLifecycleError> {
        let context = if self.recovery_in_progress {
            json!({ "kind": "recovery-in-progress" })
        } else {
            json!({ "kind": "ordinary" })
        };
        let event = build_host_event(
            "desktop.shell.close-requested.event",
            json!({ "context": context }),
            metadata,
        )?;

        Ok(CloseRequest {
            action: self.close_action(),
            event,
        })
    }

    pub fn dispatch_renderer_message(
        &mut self,
        message: &Value,
        work_area: &WorkArea,
    ) -> Result<WindowDispatch, WindowLifecycleError> {
        let command = validate_renderer_to_host_shell_command(
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            message,
        )
        .map_err(|_| WindowLifecycleError::ContractRejected)?;

        let effects = match &command {
            RendererToHostShellCommand::SetTrayPreferenceCommand(command) => {
                self.keep_game_detection_in_tray = matches!(
                    command.payload.preference,
                    ShellTrayPreference::KeepGameDetectionInTray
                );
                vec![WindowEffect::Emit(build_host_event(
                    "desktop.shell.tray-preference-changed.event",
                    json!({ "preference": command.payload.preference }),
                    HostEventMetadata::now("tray-preference"),
                )?)]
            }
            RendererToHostShellCommand::ResolveCloseCommand(command) => {
                let action = match &command.payload.resolution {
                    ShellCloseResolution::OrdinaryCloseResolution(resolution) => {
                        match resolution.decision {
                            ShellOrdinaryCloseResolutionDecision::CloseInterface => {
                                CloseAction::Exit
                            }
                            ShellOrdinaryCloseResolutionDecision::KeepRunningInTray => {
                                CloseAction::HideToTray
                            }
                        }
                    }
                    ShellCloseResolution::RecoveryCloseResolution(resolution) => {
                        match resolution.decision {
                            ShellRecoveryCloseResolutionDecision::KeepRunningInTray => {
                                CloseAction::HideToTray
                            }
                            ShellRecoveryCloseResolutionDecision::StayHere => {
                                CloseAction::StayVisible
                            }
                        }
                    }
                };
                vec![WindowEffect::Close(action)]
            }
            RendererToHostShellCommand::SaveWindowStateCommand(command) => {
                let state = clamp_window_state(command.payload.state.clone(), work_area);
                vec![
                    WindowEffect::ApplyWindowState(state.clone()),
                    WindowEffect::Emit(window_state_event(
                        &state,
                        HostEventMetadata::now("window-state"),
                    )?),
                ]
            }
            _ => Vec::new(),
        };

        Ok(WindowDispatch { command, effects })
    }
}

pub fn window_state_event(
    state: &ShellWindowState,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, WindowLifecycleError> {
    build_host_event(
        "desktop.shell.window-state-changed.event",
        json!({ "state": state }),
        metadata,
    )
}

fn clamp_window_state(state: ShellWindowState, work_area: &WorkArea) -> ShellWindowState {
    match state {
        ShellWindowState::NormalWindowState(state) => {
            ShellWindowState::NormalWindowState(clamp_normal_state(state, work_area))
        }
        ShellWindowState::MaximizedWindowState(state) => {
            ShellWindowState::MaximizedWindowState(clamp_maximized_state(state, work_area))
        }
        ShellWindowState::MinimizedWindowState(mut state) => {
            state.restore_state = match state.restore_state {
                ShellMinimizedWindowStateRestoreState::NormalWindowState(state) => {
                    ShellMinimizedWindowStateRestoreState::NormalWindowState(clamp_normal_state(
                        state, work_area,
                    ))
                }
                ShellMinimizedWindowStateRestoreState::MaximizedWindowState(state) => {
                    ShellMinimizedWindowStateRestoreState::MaximizedWindowState(
                        clamp_maximized_state(state, work_area),
                    )
                }
            };
            ShellWindowState::MinimizedWindowState(state)
        }
    }
}

fn clamp_normal_state(
    mut state: ShellNormalWindowState,
    work_area: &WorkArea,
) -> ShellNormalWindowState {
    state.monitor_id = work_area.monitor_id.clone();
    state.width = state.width.min(work_area.width);
    state.height = state.height.min(work_area.height);
    state.x = clamp_axis(state.x, work_area.x, work_area.width - state.width);
    state.y = clamp_axis(state.y, work_area.y, work_area.height - state.height);
    state
}

fn clamp_maximized_state(
    mut state: ShellMaximizedWindowState,
    work_area: &WorkArea,
) -> ShellMaximizedWindowState {
    state.monitor_id = work_area.monitor_id.clone();
    state.restore_width = state.restore_width.min(work_area.width);
    state.restore_height = state.restore_height.min(work_area.height);
    state.x = clamp_axis(state.x, work_area.x, work_area.width - state.restore_width);
    state.y = clamp_axis(
        state.y,
        work_area.y,
        work_area.height - state.restore_height,
    );
    state
}

fn clamp_axis(value: i32, origin: i32, remaining: i64) -> i32 {
    let maximum = i64::from(origin) + remaining.max(0);
    i64::from(value).clamp(i64::from(origin), maximum) as i32
}

fn build_host_event(
    message_type: &str,
    payload: Value,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, WindowLifecycleError> {
    let mut message = json!({
        "schemaVersion": "1.0",
        "messageType": message_type,
        "requestId": metadata.request_id,
        "issuedAt": metadata.issued_at,
        "payload": payload
    });

    if let Some(correlation_id) = metadata.correlation_id {
        message["correlationId"] = Value::String(correlation_id);
    }

    validate_host_to_renderer_shell_event(HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, &message)
        .map_err(|_| WindowLifecycleError::HostEventRejected)
}

fn format_unix_timestamp(seconds: u64) -> String {
    let days = (seconds / 86_400) as i64;
    let seconds_of_day = seconds % 86_400;
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;

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

    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}
