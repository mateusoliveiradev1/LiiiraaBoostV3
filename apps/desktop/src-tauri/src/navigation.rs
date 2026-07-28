use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, HostToRendererShellEvent,
    validate_host_to_renderer_shell_event,
};
use serde_json::{Value, json};

use crate::window::HostEventMetadata;

const DEEP_LINK_PREFIX: &str = "liiiraa-boost://";
const MAX_EXTERNAL_INPUT_LENGTH: usize = 512;

const GOAL_DESTINATIONS: &[&str] = &[
    "home",
    "prepare",
    "improve",
    "measure",
    "recover",
    "assistant",
    "activity",
    "account",
];
const SETTINGS_DESTINATIONS: &[&str] = &[
    "general",
    "background",
    "appearance",
    "accessibility",
    "privacy",
    "notifications",
    "updates",
    "advanced",
];
const CALIBRATION_DESTINATIONS: &[&str] = &[
    "welcome",
    "trust",
    "inventory",
    "diagnosis",
    "recovery",
    "goals",
    "games",
    "summary",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ExternalNavigationSource {
    SecondLaunch,
    DeepLink,
}

impl ExternalNavigationSource {
    fn as_contract_value(self) -> &'static str {
        match self {
            Self::SecondLaunch => "second-launch",
            Self::DeepLink => "deep-link",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NavigationBridgeError {
    Rejected,
}

pub fn navigation_event_from_external(
    input: &str,
    source: ExternalNavigationSource,
    metadata: HostEventMetadata,
) -> Result<HostToRendererShellEvent, NavigationBridgeError> {
    let intent = parse_external_intent(input)?;
    let message = metadata.into_envelope(
        "desktop.shell.navigation-requested.event",
        json!({
            "source": source.as_contract_value(),
            "intent": intent
        }),
    );

    validate_host_to_renderer_shell_event(HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, &message)
        .map_err(|_| NavigationBridgeError::Rejected)
}

pub fn navigation_event_from_second_instance(
    arguments: &[String],
    metadata: HostEventMetadata,
) -> Result<Option<HostToRendererShellEvent>, NavigationBridgeError> {
    let Some(input) = arguments
        .iter()
        .find(|argument| argument.starts_with(DEEP_LINK_PREFIX))
    else {
        return Ok(None);
    };

    navigation_event_from_external(input, ExternalNavigationSource::SecondLaunch, metadata)
        .map(Some)
}

fn parse_external_intent(input: &str) -> Result<Value, NavigationBridgeError> {
    if input.is_empty()
        || input.len() > MAX_EXTERNAL_INPUT_LENGTH
        || !input.is_ascii()
        || input.contains(['?', '#', '%', '\\'])
        || input.contains("..")
    {
        return Err(NavigationBridgeError::Rejected);
    }

    let route = input
        .strip_prefix(DEEP_LINK_PREFIX)
        .ok_or(NavigationBridgeError::Rejected)?;
    let mut segments = route.split('/');
    let kind = segments.next().ok_or(NavigationBridgeError::Rejected)?;
    let destination = segments.next().ok_or(NavigationBridgeError::Rejected)?;
    if destination.is_empty() || segments.next().is_some() {
        return Err(NavigationBridgeError::Rejected);
    }

    match kind {
        "goal" if GOAL_DESTINATIONS.contains(&destination) => Ok(json!({
            "kind": "goal",
            "destination": destination
        })),
        "settings" if SETTINGS_DESTINATIONS.contains(&destination) => Ok(json!({
            "kind": "settings",
            "destination": destination
        })),
        "calibration" if CALIBRATION_DESTINATIONS.contains(&destination) => Ok(json!({
            "kind": "calibration",
            "destination": destination
        })),
        "documentation" if is_safe_document_id(destination) => Ok(json!({
            "kind": "documentation",
            "documentId": destination
        })),
        _ => Err(NavigationBridgeError::Rejected),
    }
}

fn is_safe_document_id(document_id: &str) -> bool {
    !document_id.is_empty()
        && document_id.len() <= 128
        && document_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
}
