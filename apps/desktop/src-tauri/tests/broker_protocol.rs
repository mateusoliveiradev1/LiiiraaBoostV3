#[path = "../src/plan_executor.rs"]
mod plan_executor;
#[path = "../src/recovery_store/mod.rs"]
mod recovery_store;

use liiiraa_contracts_rust::PrivilegedBrokerResponse;
use plan_executor::{
    AuthenticatedBrokerClient, BrokerClientError, BrokerSessionMaterial, BrokerTransport,
    BrokerWire, OPTIMIZER_PIPE_ENDPOINT, WindowsNamedPipeBrokerTransport,
};
use serde_json::{Value, json};
use std::{
    cell::Cell,
    collections::VecDeque,
    io::{self, Read, Write},
    time::Duration,
};

const FIXTURE: &str =
    include_str!("../../../../packages/contracts-ts/src/fixtures/transactional-plans/valid.json");

fn fixture_value(id: &str) -> Value {
    let root: Value = serde_json::from_str(FIXTURE).unwrap();
    root["cases"]
        .as_array()
        .unwrap()
        .iter()
        .find(|case| case["id"] == id)
        .unwrap()["document"]
        .clone()
}

struct RecordingTransport {
    exchanges: Cell<usize>,
    response: Vec<u8>,
}

impl BrokerTransport for RecordingTransport {
    fn authenticate(&mut self) -> Result<BrokerSessionMaterial, BrokerClientError> {
        BrokerSessionMaterial::new(
            "session-0001".to_owned(),
            "server-nonce-0001".to_owned(),
            vec![0x5a; 32],
            1,
        )
    }

    fn exchange(&mut self, _: &[u8]) -> Result<Vec<u8>, BrokerClientError> {
        self.exchanges.set(self.exchanges.get() + 1);
        Ok(self.response.clone())
    }
}

#[test]
fn raw_invalid_or_unknown_broker_messages_are_rejected_before_transport() {
    let transport = RecordingTransport {
        exchanges: Cell::new(0),
        response: Vec::new(),
    };
    let client = AuthenticatedBrokerClient::connect(transport).unwrap();

    assert!(matches!(
        client.exchange_validated(
            "transaction-0001",
            "step-0001",
            "power-scheme-v1",
            json!({"kind": "run-powershell", "script": "whoami"}),
        ),
        Err(BrokerClientError::InvalidRequest),
    ));
    assert_eq!(client.transport().exchanges.get(), 0);
}

#[test]
fn generated_request_is_authenticated_and_response_is_validated_before_mapping() {
    let response = fixture_value("bounded broker response");
    let transport = RecordingTransport {
        exchanges: Cell::new(0),
        response: serde_json::to_vec(&response).unwrap(),
    };
    let client = AuthenticatedBrokerClient::connect(transport).unwrap();

    let result = client
        .exchange_validated(
            "transaction-0001",
            "broker-request-0001",
            "power-scheme-v1",
            fixture_value("narrow broker request"),
        )
        .unwrap();
    assert!(matches!(
        result,
        PrivilegedBrokerResponse::ObservationResponse(_)
    ));
    assert_eq!(client.transport().exchanges.get(), 1);
    assert_eq!(client.next_counter(), 2);
}

#[test]
fn malformed_or_oversized_response_never_becomes_native_success() {
    for response in [
        br#"{"document":{"kind":"fixture-success"}}"#.to_vec(),
        vec![b'x'; 65_537],
    ] {
        let transport = RecordingTransport {
            exchanges: Cell::new(0),
            response,
        };
        let client = AuthenticatedBrokerClient::connect(transport).unwrap();
        assert!(matches!(
            client.exchange_validated(
                "transaction-0001",
                "broker-request-0001",
                "power-scheme-v1",
                fixture_value("narrow broker request"),
            ),
            Err(BrokerClientError::InvalidResponse | BrokerClientError::MessageTooLarge),
        ));
    }
}

#[test]
fn session_material_is_native_only_and_counters_are_monotonic() {
    let response = fixture_value("bounded broker response");
    let transport = RecordingTransport {
        exchanges: Cell::new(0),
        response: serde_json::to_vec(&response).unwrap(),
    };
    let client = AuthenticatedBrokerClient::connect(transport).unwrap();
    let request = fixture_value("narrow broker request");

    client
        .exchange_validated(
            "transaction-0001",
            "broker-request-0001",
            "power-scheme-v1",
            request.clone(),
        )
        .unwrap();
    client
        .exchange_validated(
            "transaction-0001",
            "broker-request-0002",
            "power-scheme-v1",
            request,
        )
        .unwrap();
    assert_eq!(client.next_counter(), 3);
    assert!(!format!("{client:?}").contains("5a5a5a"));
}

#[derive(Default)]
struct ScriptedWire {
    reads: VecDeque<io::Result<Vec<u8>>>,
    writes: Vec<u8>,
    connect_count: usize,
    identity_checks: usize,
    connected: bool,
}

impl Read for ScriptedWire {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        let mut chunk = self.reads.pop_front().unwrap_or_else(|| {
            Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "script exhausted",
            ))
        })?;
        let count = output.len().min(chunk.len());
        output[..count].copy_from_slice(&chunk[..count]);
        if count < chunk.len() {
            chunk.drain(..count);
            self.reads.push_front(Ok(chunk));
        }
        Ok(count)
    }
}

impl Write for ScriptedWire {
    fn write(&mut self, input: &[u8]) -> io::Result<usize> {
        let count = input.len().min(3);
        self.writes.extend_from_slice(&input[..count]);
        Ok(count)
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

impl BrokerWire for ScriptedWire {
    fn connect(&mut self, endpoint: &str, _: Duration) -> io::Result<()> {
        assert_eq!(endpoint, OPTIMIZER_PIPE_ENDPOINT);
        self.connect_count += 1;
        self.connected = true;
        Ok(())
    }

    fn verify_local_server(&mut self) -> io::Result<()> {
        self.identity_checks += 1;
        Ok(())
    }

    fn disconnect(&mut self) {
        self.connected = false;
    }
}

fn framed(value: Value) -> Vec<u8> {
    let payload = serde_json::to_vec(&value).unwrap();
    let mut frame = (payload.len() as u32).to_be_bytes().to_vec();
    frame.extend(payload);
    frame
}

fn scripted_transport(
    reads: Vec<io::Result<Vec<u8>>>,
) -> WindowsNamedPipeBrokerTransport<ScriptedWire> {
    WindowsNamedPipeBrokerTransport::from_wire(
        ScriptedWire {
            reads: reads.into(),
            ..ScriptedWire::default()
        },
        Duration::from_millis(100),
    )
}

#[test]
fn fixed_pipe_handshake_is_length_prefixed_partial_io_safe_and_identity_checked() {
    let accepted = json!({
        "kind": "broker-handshake-accepted-v1",
        "sessionId": "session-0001",
        "serverNonce": "server-nonce-0001",
        "sessionKey": "5a".repeat(32),
        "nextCounter": 41,
    });
    let response = fixture_value("bounded broker response");
    let accepted_frame = framed(accepted);
    let response_frame = framed(response.clone());
    let reads = accepted_frame
        .chunks(2)
        .chain(response_frame.chunks(5))
        .map(|chunk| Ok(chunk.to_vec()))
        .collect();
    let transport = scripted_transport(reads);
    let client = AuthenticatedBrokerClient::connect(transport).unwrap();

    let result = client
        .exchange_validated(
            "transaction-0001",
            "broker-request-0001",
            "power-scheme-v1",
            fixture_value("narrow broker request"),
        )
        .unwrap();

    assert!(matches!(
        result,
        PrivilegedBrokerResponse::ObservationResponse(_)
    ));
    assert_eq!(client.next_counter(), 42);
    let transport = client.transport();
    let wire = transport.wire();
    assert_eq!(wire.connect_count, 1);
    assert_eq!(wire.identity_checks, 1);
    let handshake_length = u32::from_be_bytes(wire.writes[..4].try_into().unwrap()) as usize;
    let handshake: Value = serde_json::from_slice(&wire.writes[4..4 + handshake_length]).unwrap();
    assert_eq!(handshake["kind"], "broker-handshake-v1");
    assert!(
        handshake["clientNonce"]
            .as_str()
            .is_some_and(|value| !value.is_empty())
    );
    assert!(!wire.writes.windows(7).any(|window| window == b"fixture"));
}

#[test]
fn oversized_partial_timeout_and_disconnect_fail_closed_without_alternate_transport() {
    let oversized = (65_537_u32).to_be_bytes().to_vec();
    let mut transport = scripted_transport(vec![Ok(oversized)]);
    assert!(matches!(
        transport.authenticate(),
        Err(BrokerClientError::MessageTooLarge)
    ));
    assert!(!transport.wire().connected);

    let mut timeout = scripted_transport(vec![Err(io::Error::new(
        io::ErrorKind::TimedOut,
        "deadline",
    ))]);
    assert!(matches!(
        timeout.authenticate(),
        Err(BrokerClientError::TransportUnavailable)
    ));
    assert!(!timeout.wire().connected);

    let source = include_str!("../src/plan_executor.rs");
    assert!(source.contains(r"\\.\pipe\LiiiraaBoost\optimizer-v1"));
    for forbidden in [
        "TcpStream",
        "executePhysicalMutation",
        "cmd.exe",
        "powershell",
    ] {
        assert!(
            !source.contains(forbidden),
            "forbidden fallback: {forbidden}"
        );
    }
}

#[test]
fn wrong_endpoint_cannot_be_constructed_and_disconnect_requires_fresh_authentication() {
    assert_eq!(
        OPTIMIZER_PIPE_ENDPOINT,
        r"\\.\pipe\LiiiraaBoost\optimizer-v1"
    );
    let source = include_str!("../src/plan_executor.rs");
    assert!(!source.contains("pub fn with_endpoint"));
    assert!(!source.contains("pub fn new(endpoint"));
}
