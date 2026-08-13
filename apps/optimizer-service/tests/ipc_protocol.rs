#[path = "../src/main.rs"]
mod service;

use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
};

use serde_json::{Value, json};
use service::{
    dedup_store::FaultPoint,
    ipc::{
        AllowedOperation, Broker, BrokerConfig, BrokerError, BrokerErrorCode, ClientIdentity,
        OperationDispatcher, PIPE_REJECT_REMOTE_CLIENTS, PipeSecurityPolicy, ReplyDisposition,
    },
};

static NEXT_DATABASE: AtomicU64 = AtomicU64::new(1);
const SECRET: &[u8] = b"phase-06-test-only-install-secret";

struct SpyDispatcher {
    calls: usize,
}

impl SpyDispatcher {
    fn new() -> Self {
        Self { calls: 0 }
    }
}

impl OperationDispatcher for SpyDispatcher {
    fn dispatch(&mut self, operation: AllowedOperation) -> Result<Value, BrokerError> {
        self.calls += 1;
        let request_id = match operation {
            AllowedOperation::ObservePowerScheme => "step-observe",
            AllowedOperation::DuplicateManagedPowerScheme => "step-duplicate",
            AllowedOperation::ActivateManagedPowerScheme => "step-activate",
            AllowedOperation::DeleteOwnedPowerScheme => "step-delete",
            AllowedOperation::PrepareRestorePoint => "step-restore-point",
        };
        Ok(json!({
            "kind": "broker-accepted-response",
            "schemaVersion": "1.0",
            "responseId": format!("response-{request_id}"),
            "requestId": request_id,
            "outcome": "accepted",
            "completedAt": "2026-08-13T08:00:00Z"
        }))
    }
}

fn database_path(label: &str) -> PathBuf {
    let id = NEXT_DATABASE.fetch_add(1, Ordering::Relaxed);
    let root =
        std::env::temp_dir().join(format!("liiiraa-ipc-{label}-{}-{id}", std::process::id()));
    fs::create_dir_all(&root).expect("create isolated test directory");
    root.join("broker.sqlite3")
}

fn config() -> BrokerConfig {
    BrokerConfig {
        interactive_session_id: 7,
        interactive_logon_sid: "S-1-5-5-7-42".into(),
        expected_process_hash: "sha256:trusted-native-host".into(),
        service_sid: "S-1-5-80-424242".into(),
        database_custody_verified: true,
        now_unix_seconds: 1_786_608_000,
        max_message_bytes: 64 * 1024,
    }
}

fn legitimate_identity() -> ClientIdentity {
    ClientIdentity {
        local_machine: true,
        remote_transport: false,
        impersonation_succeeded: true,
        token_query_succeeded: true,
        session_id: 7,
        logon_sid: "S-1-5-5-7-42".into(),
        process_id: 4242,
        process_image_hash: "sha256:trusted-native-host".into(),
    }
}

fn observe_request(counter: u32) -> Value {
    json!({
        "kind": "observe-power-scheme-request",
        "schemaVersion": "1.0",
        "requestId": "step-observe",
        "deviceBindingId": "device-verified",
        "issuedAt": "2026-08-13T08:00:00Z",
        "nonce": "request-nonce-observe",
        "counter": counter
    })
}

fn accepted_envelope(
    broker: &mut Broker,
    request: Value,
) -> (service::ipc::SessionTicket, service::ipc::BrokerEnvelope) {
    let ticket = broker
        .authenticate_client(&legitimate_identity(), "client-nonce-1")
        .expect("legitimate local native host authenticates");
    let envelope = Broker::sign_envelope(
        &ticket,
        "transaction-1",
        "step-observe",
        "power-scheme-observe-v1",
        request,
    );
    (ticket, envelope)
}

#[test]
fn pipe_policy_is_local_only_and_has_an_explicit_service_dacl() {
    let policy = PipeSecurityPolicy::service_only("S-1-5-5-7-42", "S-1-5-80-424242");
    assert_eq!(policy.pipe_name, r"\\.\pipe\LiiiraaBoost\optimizer-v1");
    assert_ne!(policy.open_mode_flags & PIPE_REJECT_REMOTE_CLIENTS, 0);
    assert!(policy.sddl.starts_with("D:P"));
    for required_sid in ["SY", "BA", "S-1-5-5-7-42", "S-1-5-80-424242"] {
        assert!(policy.sddl.contains(required_sid), "missing {required_sid}");
    }
    assert!(
        !policy.sddl.contains("WD"),
        "Everyone must not receive access"
    );
    assert!(
        !policy.sddl.contains("AN"),
        "anonymous must not receive access"
    );
}

#[test]
fn legitimate_request_dispatches_once_and_terminal_replay_survives_reopen() {
    let path = database_path("terminal-reopen");
    let mut dispatcher = SpyDispatcher::new();
    let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
    let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(1));
    let first = broker
        .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
        .expect("first request accepted");
    assert_eq!(first.disposition, ReplyDisposition::Terminal);
    assert_eq!(dispatcher.calls, 1);
    drop(broker);

    let mut reopened = Broker::open(&path, config(), SECRET).expect("reopen broker");
    let (new_ticket, replay) = accepted_envelope(&mut reopened, observe_request(1));
    let replayed = reopened
        .submit(&new_ticket, &replay, &mut dispatcher, FaultPoint::None)
        .expect("exact replay returns durable terminal outcome");
    assert_eq!(replayed, first);
    assert_eq!(dispatcher.calls, 1, "terminal replay must not redispatch");
}

#[test]
fn identity_spoof_remote_and_wrong_session_fail_before_dispatch() {
    let path = database_path("identity");
    let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
    let baseline = legitimate_identity();
    let mut cases = Vec::new();
    let mut remote = baseline.clone();
    remote.remote_transport = true;
    cases.push(remote);
    let mut nonlocal = baseline.clone();
    nonlocal.local_machine = false;
    cases.push(nonlocal);
    let mut no_impersonation = baseline.clone();
    no_impersonation.impersonation_succeeded = false;
    cases.push(no_impersonation);
    let mut no_token = baseline.clone();
    no_token.token_query_succeeded = false;
    cases.push(no_token);
    let mut wrong_session = baseline.clone();
    wrong_session.session_id = 8;
    cases.push(wrong_session);
    let mut wrong_logon = baseline.clone();
    wrong_logon.logon_sid = "S-1-5-5-8-99".into();
    cases.push(wrong_logon);
    let mut spoofed_process = baseline;
    spoofed_process.process_image_hash = "sha256:same-user-spoof".into();
    cases.push(spoofed_process);

    for identity in cases {
        let error = broker
            .authenticate_client(&identity, "client-nonce")
            .expect_err("untrusted peer must fail closed");
        assert_eq!(error.code, BrokerErrorCode::AuthenticationFailed);
    }
}

#[test]
fn malformed_generic_and_extreme_authority_never_reaches_dispatch() {
    let path = database_path("generic");
    let forbidden = [
        json!({"kind":"generic-operation","commandLine":"powershell.exe"}),
        json!({"kind":"script-request","script":"Remove-Item"}),
        json!({"kind":"file-request","path":"C:\\Windows"}),
        json!({"kind":"registry-request","registryPath":"HKLM\\Software"}),
        json!({"kind":"service-request","serviceName":"AnyService"}),
        json!({"kind":"remote-request","host":"example.invalid"}),
        json!({"kind":"observe-power-scheme-request","risk":"Extreme"}),
    ];

    for (index, request) in forbidden.into_iter().enumerate() {
        let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
        let (ticket, envelope) = accepted_envelope(&mut broker, request);
        let mut dispatcher = SpyDispatcher::new();
        let error = broker
            .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
            .expect_err("generic authority must be rejected");
        assert_eq!(error.code, BrokerErrorCode::InvalidMessage, "case {index}");
        assert_eq!(dispatcher.calls, 0, "case {index} dispatched unexpectedly");
    }
}

#[test]
fn mac_nonce_counter_and_duplicate_conflict_fail_closed() {
    let path = database_path("replay");
    let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
    let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(4));
    let mut dispatcher = SpyDispatcher::new();

    let mut wrong_mac = envelope.clone();
    wrong_mac.mac_hex = "00".repeat(32);
    assert_eq!(
        broker
            .submit(&ticket, &wrong_mac, &mut dispatcher, FaultPoint::None)
            .expect_err("wrong MAC")
            .code,
        BrokerErrorCode::InvalidMac
    );

    let mut wrong_nonce = envelope.clone();
    wrong_nonce.server_nonce = "captured-server-nonce".into();
    assert_eq!(
        broker
            .submit(&ticket, &wrong_nonce, &mut dispatcher, FaultPoint::None)
            .expect_err("wrong server nonce")
            .code,
        BrokerErrorCode::ReplayRejected
    );

    broker
        .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
        .expect("valid request");
    let conflicting = Broker::sign_envelope(
        &ticket,
        "transaction-1",
        "step-observe",
        "power-scheme-observe-v2",
        observe_request(5),
    );
    assert_eq!(
        broker
            .submit(&ticket, &conflicting, &mut dispatcher, FaultPoint::None)
            .expect_err("same identity with different bytes")
            .code,
        BrokerErrorCode::DuplicateConflict
    );
    assert_eq!(dispatcher.calls, 1);
}

#[test]
fn reservation_and_dispatch_crashes_require_observation_after_restart() {
    for (label, fault) in [
        ("after-reserve", FaultPoint::AfterReserve),
        ("after-dispatch", FaultPoint::AfterDispatch),
    ] {
        let path = database_path(label);
        let mut dispatcher = SpyDispatcher::new();
        let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
        let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(9));
        let _ = broker.submit(&ticket, &envelope, &mut dispatcher, fault);
        let calls_after_fault = dispatcher.calls;
        drop(broker);

        let mut reopened = Broker::open(&path, config(), SECRET).expect("reopen broker");
        let (new_ticket, replay) = accepted_envelope(&mut reopened, observe_request(9));
        let result = reopened
            .submit(&new_ticket, &replay, &mut dispatcher, FaultPoint::None)
            .expect("uncertain replay returns observation authority");
        assert_eq!(result.disposition, ReplyDisposition::ObservationRequired);
        assert_eq!(dispatcher.calls, calls_after_fault, "{label} redispatched");
    }
}

#[test]
fn custody_failure_and_preshutdown_block_new_dispatch() {
    let path = database_path("custody");
    let mut invalid = config();
    invalid.database_custody_verified = false;
    assert_eq!(
        Broker::open(&path, invalid, SECRET)
            .err()
            .expect("custody must be required")
            .code,
        BrokerErrorCode::CustodyUnavailable
    );

    let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
    let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(11));
    broker.begin_preshutdown();
    let mut dispatcher = SpyDispatcher::new();
    assert_eq!(
        broker
            .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
            .expect_err("preshutdown stops admission")
            .code,
        BrokerErrorCode::ServerStopping
    );
    assert_eq!(dispatcher.calls, 0);
}

#[test]
fn bounded_message_and_terminal_only_retention_are_enforced() {
    let path = database_path("bounds-retention");
    let mut tiny = config();
    tiny.max_message_bytes = 32;
    let mut broker = Broker::open(&path, tiny, SECRET).expect("open broker");
    let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(13));
    let mut dispatcher = SpyDispatcher::new();
    assert_eq!(
        broker
            .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
            .expect_err("oversized message")
            .code,
        BrokerErrorCode::MessageTooLarge
    );
    assert_eq!(dispatcher.calls, 0);

    let mut normal = Broker::open(&path, config(), SECRET).expect("reopen broker");
    assert_eq!(normal.prune_terminal_before(i64::MAX).expect("prune"), 0);
}
