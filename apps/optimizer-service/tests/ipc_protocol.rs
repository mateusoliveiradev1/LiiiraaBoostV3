#[path = "../src/main.rs"]
mod service;

use std::{
    fs,
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use liiiraa_contracts_rust::PrivilegedBrokerRequest;
use serde_json::{Value, json};
use service::dispatcher::DispatchContext;
use service::{
    dedup_store::FaultPoint,
    ipc::{
        Broker, BrokerConfig, BrokerError, BrokerErrorCode, ClientIdentity, OperationDispatcher,
        PIPE_REJECT_REMOTE_CLIENTS, PipeSecurityPolicy, ReplyDisposition,
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
    fn dispatch(
        &mut self,
        operation: PrivilegedBrokerRequest,
        _context: &DispatchContext,
    ) -> Result<Value, BrokerError> {
        self.calls += 1;
        let request_id = match operation {
            PrivilegedBrokerRequest::ObservePowerSchemeRequest(_) => "step-observe",
            PrivilegedBrokerRequest::DuplicateManagedPowerSchemeRequest(_) => "step-duplicate",
            PrivilegedBrokerRequest::ActivateManagedPowerSchemeRequest(_) => "step-activate",
            PrivilegedBrokerRequest::DeleteOwnedPowerSchemeRequest(_) => "step-delete",
            PrivilegedBrokerRequest::PrepareRestorePointRequest(_) => "step-restore-point",
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
    let epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock after epoch")
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "liiiraa-ipc-{label}-{}-{epoch}-{id}",
        std::process::id()
    ));
    fs::create_dir_all(&root).expect("create isolated test directory");
    root.join("broker.sqlite3")
}

fn config() -> BrokerConfig {
    config_at(1_786_608_000)
}

fn config_at(now_unix_seconds: i64) -> BrokerConfig {
    BrokerConfig {
        interactive_session_id: 7,
        interactive_logon_sid: "S-1-5-5-7-42".into(),
        expected_process_hash: "sha256:trusted-native-host".into(),
        service_sid: "S-1-5-80-424242".into(),
        database_custody_verified: true,
        now_unix_seconds,
        max_message_bytes: 64 * 1024,
        request_timeout_millis: 5_000,
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
fn ipc_pipe_policy_is_local_only_and_has_an_explicit_service_dacl() {
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
    let storage_sddl = PipeSecurityPolicy::service_storage_sddl("S-1-5-80-424242");
    assert!(storage_sddl.starts_with("D:P"));
    assert!(storage_sddl.contains("SY"));
    assert!(storage_sddl.contains("BA"));
    assert!(storage_sddl.contains("S-1-5-80-424242"));
    assert!(!storage_sddl.contains("S-1-5-5-7-42"));
}

#[test]
fn ipc_legitimate_request_dispatches_once_and_terminal_replay_survives_reopen() {
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
fn ipc_identity_spoof_remote_and_wrong_session_fail_before_dispatch() {
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
fn ipc_malformed_generic_and_extreme_authority_never_reaches_dispatch() {
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
fn ipc_mac_nonce_counter_and_duplicate_conflict_fail_closed() {
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
fn ipc_reservation_and_dispatch_crashes_require_observation_after_restart() {
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
fn ipc_custody_failure_and_preshutdown_block_new_dispatch() {
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
fn ipc_bounded_message_and_terminal_only_retention_are_enforced() {
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

#[test]
fn ipc_replay_counter_and_nonce_authority_survive_a_fresh_service_session() {
    let path = database_path("durable-counter");
    let mut dispatcher = SpyDispatcher::new();
    let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
    let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(50));
    broker
        .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
        .expect("establish durable counter");
    drop(broker);

    let mut reopened = Broker::open(&path, config(), SECRET).expect("reopen broker");
    let ticket = reopened
        .authenticate_client(&legitimate_identity(), "fresh-client-nonce")
        .expect("fresh authenticated session");
    for (step, nonce, counter) in [
        ("step-stale-counter", "fresh-request-nonce", 49),
        ("step-reused-nonce", "request-nonce-observe", 51),
    ] {
        let request = json!({
            "kind": "observe-power-scheme-request",
            "schemaVersion": "1.0",
            "requestId": step,
            "deviceBindingId": "device-verified",
            "issuedAt": "2026-08-13T08:00:00Z",
            "nonce": nonce,
            "counter": counter
        });
        let envelope = Broker::sign_envelope(
            &ticket,
            "transaction-replay-probe",
            step,
            "power-scheme-observe-v1",
            request,
        );
        assert_eq!(
            reopened
                .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
                .expect_err("durable replay authority must reject")
                .code,
            BrokerErrorCode::ReplayRejected
        );
    }
    assert_eq!(dispatcher.calls, 1);
}

#[test]
fn ipc_repeated_reopen_never_redispatches_a_terminal_identity() {
    let path = database_path("repeated-reopen");
    let mut dispatcher = SpyDispatcher::new();
    let mut expected = None;
    for iteration in 0..4 {
        let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
        let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(71));
        let reply = broker
            .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
            .expect("open or replay");
        if iteration == 0 {
            expected = Some(reply);
        } else {
            assert_eq!(Some(reply), expected);
        }
    }
    assert_eq!(dispatcher.calls, 1);
}

#[test]
fn ipc_preshutdown_preserves_an_inflight_reservation_for_next_boot_observation() {
    let path = database_path("preshutdown-inflight");
    let mut dispatcher = SpyDispatcher::new();
    let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
    let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(80));
    assert_eq!(
        broker
            .submit(
                &ticket,
                &envelope,
                &mut dispatcher,
                FaultPoint::AfterReserve
            )
            .expect_err("injected boundary")
            .code,
        BrokerErrorCode::DatabaseUnavailable
    );
    broker.begin_preshutdown();
    assert_eq!(
        broker
            .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
            .expect_err("no admission during preshutdown")
            .code,
        BrokerErrorCode::ServerStopping
    );
    drop(broker);

    let mut reopened = Broker::open(&path, config(), SECRET).expect("next boot reopen");
    let (new_ticket, replay) = accepted_envelope(&mut reopened, observe_request(80));
    assert_eq!(
        reopened
            .submit(&new_ticket, &replay, &mut dispatcher, FaultPoint::None)
            .expect("recover uncertain identity")
            .disposition,
        ReplyDisposition::ObservationRequired
    );
    assert_eq!(dispatcher.calls, 0);
}

#[test]
fn ipc_retention_waits_for_the_full_horizon_and_preserves_unresolved_or_referenced_rows() {
    let base = 1_786_608_000;

    let terminal_path = database_path("retention-terminal");
    let mut dispatcher = SpyDispatcher::new();
    let mut terminal = Broker::open(&terminal_path, config_at(base), SECRET).expect("open");
    let (ticket, envelope) = accepted_envelope(&mut terminal, observe_request(90));
    terminal
        .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
        .expect("terminal");
    assert_eq!(
        terminal
            .prune_terminal_before(i64::MAX)
            .expect("early prune"),
        0
    );
    drop(terminal);
    let mut expired = Broker::open(
        &terminal_path,
        config_at(base + service::ipc::MAX_REPLAY_RETENTION_SECONDS + 1),
        SECRET,
    )
    .expect("reopen after horizon");
    assert_eq!(
        expired
            .prune_terminal_before(i64::MAX)
            .expect("expired prune"),
        1
    );
    assert_eq!(expired.retained_identity_count().expect("count"), 0);

    let unresolved_path = database_path("retention-unresolved");
    let mut unresolved = Broker::open(&unresolved_path, config_at(base), SECRET).expect("open");
    let (ticket, envelope) = accepted_envelope(&mut unresolved, observe_request(91));
    let _ = unresolved.submit(
        &ticket,
        &envelope,
        &mut dispatcher,
        FaultPoint::AfterReserve,
    );
    drop(unresolved);
    let mut unresolved = Broker::open(
        &unresolved_path,
        config_at(base + service::ipc::MAX_REPLAY_RETENTION_SECONDS + 1),
        SECRET,
    )
    .expect("reopen unresolved");
    assert_eq!(
        unresolved.prune_terminal_before(i64::MAX).expect("prune"),
        0
    );
    assert_eq!(unresolved.retained_identity_count().expect("count"), 1);

    let referenced_path = database_path("retention-referenced");
    let mut referenced = Broker::open(&referenced_path, config_at(base), SECRET).expect("open");
    let (ticket, envelope) = accepted_envelope(&mut referenced, observe_request(92));
    referenced
        .submit(&ticket, &envelope, &mut dispatcher, FaultPoint::None)
        .expect("terminal");
    referenced
        .reference_for_recovery("transaction-1", "step-observe")
        .expect("reference identity");
    drop(referenced);
    let mut referenced = Broker::open(
        &referenced_path,
        config_at(base + service::ipc::MAX_REPLAY_RETENTION_SECONDS + 1),
        SECRET,
    )
    .expect("reopen referenced");
    assert_eq!(
        referenced.prune_terminal_before(i64::MAX).expect("prune"),
        0
    );
    assert_eq!(referenced.retained_identity_count().expect("count"), 1);
}

#[test]
fn ipc_timeout_and_malformed_mac_lengths_are_closed_before_dispatch() {
    let path = database_path("timeout-fuzz");
    let mut broker = Broker::open(&path, config(), SECRET).expect("open broker");
    let (ticket, envelope) = accepted_envelope(&mut broker, observe_request(100));
    let mut dispatcher = SpyDispatcher::new();
    assert_eq!(
        broker
            .submit_with_elapsed(&ticket, &envelope, &mut dispatcher, FaultPoint::None, 5_001,)
            .expect_err("expired request")
            .code,
        BrokerErrorCode::Timeout
    );
    let invalid_macs = vec![
        String::new(),
        "0".to_owned(),
        "00".to_owned(),
        "f".repeat(63),
        "gg".repeat(32),
    ];
    for invalid_mac in invalid_macs {
        let mut malformed = envelope.clone();
        malformed.mac_hex = invalid_mac;
        assert_eq!(
            broker
                .submit(&ticket, &malformed, &mut dispatcher, FaultPoint::None)
                .expect_err("malformed MAC")
                .code,
            BrokerErrorCode::InvalidMac
        );
    }
    assert_eq!(dispatcher.calls, 0);
}

#[test]
fn ipc_protocol_errors_are_stable_redacted_codes_and_source_has_no_generic_authority() {
    let error = Broker::open(database_path("redaction"), config(), b"short")
        .err()
        .expect("short secret fails closed");
    assert_eq!(
        format!("{error:?}"),
        "BrokerError { code: CustodyUnavailable }"
    );
    for secret_fragment in ["short", "trusted-native-host", "S-1-5", "broker.sqlite3"] {
        assert!(!format!("{error:?}").contains(secret_fragment));
    }

    let source = include_str!("../src/ipc.rs");
    for forbidden in [
        "commandLine",
        "powershell",
        "registryPath",
        "serviceName",
        "scriptBody",
        "GenericOperation",
    ] {
        assert!(
            !source.contains(forbidden),
            "generic authority token {forbidden}"
        );
    }
}
