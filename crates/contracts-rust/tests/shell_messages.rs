use liiiraa_contracts_rust::{
    HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
    validate_host_to_renderer_shell_event, validate_renderer_to_host_shell_command,
};
use serde_json::{Value, json};

fn shell_envelope() -> Value {
    json!({
        "schemaVersion": "1.0",
        "requestId": "request-shell-validation-0001",
        "correlationId": "correlation-shell-validation-0001",
        "issuedAt": "2026-07-27T12:00:00.000Z"
    })
}

fn valid_host_event() -> Value {
    let mut envelope = shell_envelope();
    let object = envelope
        .as_object_mut()
        .expect("synthetic shell envelope is an object");
    object.insert(
        "messageType".to_owned(),
        json!("desktop.shell.locale-changed.event"),
    );
    object.insert("payload".to_owned(), json!({ "locale": "pt-BR" }));
    envelope
}

fn valid_renderer_command() -> Value {
    let mut envelope = shell_envelope();
    let object = envelope
        .as_object_mut()
        .expect("synthetic shell envelope is an object");
    object.insert(
        "messageType".to_owned(),
        json!("desktop.shell.show-notification.command"),
    );
    object.insert(
        "payload".to_owned(),
        json!({
            "category": "recovery-required",
            "title": "Recovery required",
            "body": "Review the recovery state.",
            "action": {
                "kind": "goal",
                "destination": "recover"
            }
        }),
    );
    envelope
}

#[test]
fn shell_messages_accept_generated_transport_values() {
    let host_input = valid_host_event();
    let command_input = valid_renderer_command();

    let host =
        validate_host_to_renderer_shell_event(HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, &host_input)
            .expect("valid host event");
    let command = validate_renderer_to_host_shell_command(
        RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
        &command_input,
    )
    .expect("valid renderer command");

    assert_eq!(
        serde_json::to_value(host).expect("serialize generated host event"),
        host_input
    );
    assert_eq!(
        serde_json::to_value(command).expect("serialize generated renderer command"),
        command_input
    );
}

#[test]
fn shell_messages_reject_the_cross_language_invalid_vectors() {
    let valid = valid_renderer_command();
    let invalid_vectors = [
        (
            "desktop.shell.unknown.v1",
            valid.clone(),
            "unknown schema ID",
        ),
        (
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            {
                let mut value = valid.clone();
                value
                    .as_object_mut()
                    .expect("command is an object")
                    .insert("unexpected".to_owned(), json!("SENSITIVE_UNKNOWN_FIELD"));
                value
            },
            "unknown field",
        ),
        (
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            {
                let mut value = valid.clone();
                value.as_object_mut().expect("command is an object").insert(
                    "messageType".to_owned(),
                    json!("desktop.shell.execute-arbitrary.command"),
                );
                value
            },
            "unknown discriminator",
        ),
        (
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            {
                let mut value = shell_envelope();
                let object = value.as_object_mut().expect("command is an object");
                object.insert(
                    "messageType".to_owned(),
                    json!("desktop.shell.navigate.command"),
                );
                object.insert(
                    "payload".to_owned(),
                    json!({
                        "intent": {
                            "kind": "documentation",
                            "documentId": "../../SENSITIVE_NAVIGATION_TARGET"
                        }
                    }),
                );
                value
            },
            "risky navigation",
        ),
        (
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            {
                let mut value = shell_envelope();
                let object = value.as_object_mut().expect("command is an object");
                object.insert(
                    "messageType".to_owned(),
                    json!("desktop.shell.set-locale.command"),
                );
                object.insert("payload".to_owned(), json!({ "locale": "fr-FR" }));
                value
            },
            "unsupported locale",
        ),
        (
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            {
                let mut value = shell_envelope();
                let object = value.as_object_mut().expect("command is an object");
                object.insert(
                    "messageType".to_owned(),
                    json!("desktop.shell.set-tray-preference.command"),
                );
                object.insert(
                    "payload".to_owned(),
                    json!({ "preference": "always-run-in-tray" }),
                );
                value
            },
            "non-opt-in tray behavior",
        ),
        (
            RENDERER_TO_HOST_SHELL_COMMAND_SCHEMA_ID,
            {
                let mut value = valid;
                value
                    .get_mut("payload")
                    .and_then(Value::as_object_mut)
                    .expect("command payload is an object")
                    .insert("category".to_owned(), json!("marketing"));
                value
            },
            "unapproved notification category",
        ),
    ];

    for (schema_id, payload, name) in invalid_vectors {
        assert!(
            validate_renderer_to_host_shell_command(schema_id, &payload).is_err(),
            "{name} must be rejected"
        );
    }
}

#[test]
fn shell_message_errors_are_deterministic_bounded_and_redacted() {
    let secret = "SENSITIVE_SHELL_PAYLOAD_VALUE_MUST_NOT_LEAK";
    let mut invalid = valid_host_event();
    invalid.as_object_mut().expect("event is an object").insert(
        "payload".to_owned(),
        json!({
            "locale": "fr-FR",
            "unexpected": secret
        }),
    );

    let first =
        validate_host_to_renderer_shell_event(HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, &invalid)
            .expect_err("invalid host event");
    let second =
        validate_host_to_renderer_shell_event(HOST_TO_RENDERER_SHELL_EVENT_SCHEMA_ID, &invalid)
            .expect_err("invalid host event");

    assert_eq!(first, second);
    assert!(!first.issues.is_empty());
    assert!(first.issues.len() <= 8);
    assert!(
        first
            .issues
            .iter()
            .all(|issue| issue.path.chars().count() <= 256 && issue.keyword.chars().count() <= 64)
    );

    let serialized = format!("{first:?}");
    assert!(!serialized.contains(secret));
    assert!(!serialized.contains("fr-FR"));
}
