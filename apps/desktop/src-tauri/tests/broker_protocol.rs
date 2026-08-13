#[path = "../src/plan_executor.rs"]
mod plan_executor;

use liiiraa_contracts_rust::PrivilegedBrokerResponse;
use plan_executor::{
    AuthenticatedBrokerClient, BrokerClientError, BrokerSessionMaterial, BrokerTransport,
};
use serde_json::{Value, json};
use std::cell::Cell;

const FIXTURE: &str =
    include_str!("../../../packages/contracts-ts/src/fixtures/transactional-plans/valid.json");

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
    let mut client = AuthenticatedBrokerClient::connect(transport).unwrap();

    assert_eq!(
        client.exchange_validated(
            "transaction-0001",
            "step-0001",
            "power-scheme-v1",
            json!({"kind": "run-powershell", "script": "whoami"}),
        ),
        Err(BrokerClientError::InvalidRequest),
    );
    assert_eq!(client.transport().exchanges.get(), 0);
}

#[test]
fn generated_request_is_authenticated_and_response_is_validated_before_mapping() {
    let response = fixture_value("bounded broker response");
    let transport = RecordingTransport {
        exchanges: Cell::new(0),
        response: serde_json::to_vec(&json!({"document": response})).unwrap(),
    };
    let mut client = AuthenticatedBrokerClient::connect(transport).unwrap();

    let result = client
        .exchange_validated(
            "transaction-0001",
            "broker-request-0001",
            "power-scheme-v1",
            fixture_value("narrow broker request"),
        )
        .unwrap();
    assert!(matches!(result, PrivilegedBrokerResponse::ObservationResponse(_)));
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
        let mut client = AuthenticatedBrokerClient::connect(transport).unwrap();
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
        response: serde_json::to_vec(&json!({"document": response})).unwrap(),
    };
    let mut client = AuthenticatedBrokerClient::connect(transport).unwrap();
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
