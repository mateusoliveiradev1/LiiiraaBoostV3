#[path = "../src/main.rs"]
mod service;

use std::{
    fs,
    io::Cursor,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use service::installation_manifest::CustodyErrorCode;
use service::ipc::{Broker, BrokerConfig, ClientIdentity};
use service::windows_pipe::{
    AuthenticatedClientToken, FrameError, HostError, HostErrorCode, HostLifecycle, HostState,
    PipeHostConfig, decode_frame, encode_frame,
};

#[cfg(windows)]
use windows_service::service::{ServiceExitCode, ServiceState};

static NEXT_DATABASE: AtomicUsize = AtomicUsize::new(1);

fn database_path(label: &str) -> PathBuf {
    let id = NEXT_DATABASE.fetch_add(1, Ordering::Relaxed);
    let epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock after epoch")
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "liiiraa-host-{label}-{}-{epoch}-{id}",
        std::process::id()
    ));
    fs::create_dir_all(&root).expect("isolated broker directory");
    root.join("broker.sqlite3")
}

fn broker_config() -> BrokerConfig {
    BrokerConfig {
        interactive_session_id: 7,
        interactive_logon_sid: "S-1-5-5-7-42".into(),
        expected_process_hash: "sha256:trusted-native-host".into(),
        service_sid: "S-1-5-80-424242".into(),
        database_custody_verified: true,
        now_unix_seconds: 1_786_608_000,
        max_message_bytes: 64 * 1024,
        request_timeout_millis: 5_000,
    }
}

fn identity() -> ClientIdentity {
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

#[test]
fn installed_host_uses_the_only_local_bounded_endpoint() {
    let config = PipeHostConfig::installed_defaults();
    assert_eq!(config.pipe_name, r"\\.\pipe\LiiiraaBoost\optimizer-v1");
    assert_eq!(config.max_frame_bytes, 64 * 1024);
    assert_eq!(config.read_timeout, Duration::from_secs(5));
    assert_eq!(config.write_timeout, Duration::from_secs(5));
    assert_eq!(config.request_timeout, Duration::from_secs(5));
    assert!(config.reject_remote_clients);
}

#[cfg(windows)]
#[test]
fn startup_failures_reach_scm_as_stable_bounded_service_specific_codes() {
    let cases = [
        (HostErrorCode::InstalledCustody, 63_101_u32),
        (HostErrorCode::InteractiveSession, 63_102_u32),
        (HostErrorCode::RestrictedToken, 63_103_u32),
        (HostErrorCode::StorageAdmission, 63_104_u32),
        (HostErrorCode::PipeAdmission, 63_105_u32),
        (HostErrorCode::InstalledManifest, 63_106_u32),
        (HostErrorCode::InstalledCms, 63_107_u32),
        (HostErrorCode::InstalledIdentity, 63_108_u32),
        (HostErrorCode::InstalledAcl, 63_109_u32),
    ];

    let mut observed = Vec::new();
    for (stage, expected) in cases {
        let error = HostError::for_test(stage);
        assert_eq!(error.service_specific_exit_code(), expected);

        let status = service::windows_service_host::startup_failure_status(error);
        assert_eq!(status.current_state, ServiceState::Stopped);
        assert_eq!(
            status.exit_code,
            ServiceExitCode::ServiceSpecific(expected),
            "SCM must preserve the bounded startup-stage code"
        );
        observed.push(expected);
    }

    observed.sort_unstable();
    observed.dedup();
    assert_eq!(observed.len(), cases.len(), "startup codes must be unique");
    assert!(observed.iter().all(|code| (63_101..=63_109).contains(code)));
}

#[cfg(windows)]
#[test]
fn installed_custody_errors_are_redacted_to_bounded_scm_substages() {
    let cases = [
        (CustodyErrorCode::Missing, 63_101),
        (CustodyErrorCode::Path, 63_101),
        (CustodyErrorCode::Schema, 63_106),
        (CustodyErrorCode::Signature, 63_107),
        (CustodyErrorCode::Authenticode, 63_108),
        (CustodyErrorCode::Hash, 63_108),
        (CustodyErrorCode::Version, 63_108),
        (CustodyErrorCode::Acl, 63_109),
    ];
    for (kind, expected) in cases {
        assert_eq!(
            HostError::for_custody_test(kind).service_specific_exit_code(),
            expected
        );
    }
}

#[cfg(windows)]
#[test]
fn service_wrapper_never_reports_the_legacy_generic_startup_code() {
    let source = include_str!("../src/main.rs");
    assert!(!source.contains("ServiceSpecific(1)"));
    assert!(source.contains("startup_failure_status(error)"));
}

#[test]
fn fixed_length_prefix_rejects_partial_oversized_and_malformed_frames() {
    let valid = serde_json::json!({"kind": "test", "value": 7});
    let encoded = encode_frame(&valid, 128).expect("bounded frame");
    assert_eq!(
        decode_frame(&mut Cursor::new(encoded), 128).expect("decode"),
        valid
    );

    assert_eq!(
        decode_frame(&mut Cursor::new(vec![0, 0, 0]), 128),
        Err(FrameError::Truncated)
    );
    assert_eq!(
        decode_frame(&mut Cursor::new(vec![0, 0, 1, 0]), 128),
        Err(FrameError::TooLarge)
    );
    assert_eq!(
        decode_frame(&mut Cursor::new([0, 0, 0, 2, b'{', b'}']), 128),
        Ok(serde_json::json!({}))
    );
    assert_eq!(
        decode_frame(&mut Cursor::new([0, 0, 0, 2, 0xff, 0xff]), 128),
        Err(FrameError::Malformed)
    );
}

#[test]
fn preshutdown_closes_admission_and_drains_only_the_bounded_inflight_request() {
    let mut lifecycle = HostLifecycle::new();
    assert_eq!(lifecycle.state(), HostState::Starting);
    lifecycle.mark_running().expect("start once");
    lifecycle.begin_request().expect("one in-flight request");
    assert!(lifecycle.begin_request().is_err(), "mutations are serial");

    lifecycle.begin_stopping();
    assert_eq!(lifecycle.state(), HostState::Stopping);
    assert!(lifecycle.begin_request().is_err(), "admission is closed");
    assert!(
        !lifecycle.finish_request(),
        "drain completes before stopped"
    );
    assert_eq!(lifecycle.state(), HostState::Stopped);
}

#[test]
fn authenticated_client_token_is_bound_and_released_exactly_once() {
    let releases = Arc::new(AtomicUsize::new(0));
    {
        let token = AuthenticatedClientToken::for_test(7, "S-1-5-5-7-42", releases.clone());
        assert!(token.is_bound_to(7, "S-1-5-5-7-42"));
        assert!(!token.is_bound_to(8, "S-1-5-5-7-42"));
        assert!(!token.is_bound_to(7, "S-1-5-5-7-99"));
    }
    assert_eq!(releases.load(Ordering::SeqCst), 1);
}

#[test]
fn broker_disconnect_and_preshutdown_release_owned_client_tokens() {
    let releases = Arc::new(AtomicUsize::new(0));
    let mut broker = Broker::open(
        database_path("disconnect-token"),
        broker_config(),
        b"phase-06-test-only-install-secret",
    )
    .expect("open broker");
    let ticket = broker
        .authenticate_client_with_token(
            &identity(),
            "nonce-disconnect",
            AuthenticatedClientToken::for_test(7, "S-1-5-5-7-42", releases.clone()),
        )
        .expect("authenticated token session");
    broker.disconnect_session(&ticket);
    assert_eq!(releases.load(Ordering::SeqCst), 1);

    broker = Broker::open(
        database_path("stop-token"),
        broker_config(),
        b"phase-06-test-only-install-secret",
    )
    .expect("open broker");
    broker
        .authenticate_client_with_token(
            &identity(),
            "nonce-stop",
            AuthenticatedClientToken::for_test(7, "S-1-5-5-7-42", releases.clone()),
        )
        .expect("authenticated token session");
    broker.begin_preshutdown();
    assert_eq!(releases.load(Ordering::SeqCst), 2);
}

#[test]
fn wrong_token_binding_is_rejected_and_released_before_session_creation() {
    let releases = Arc::new(AtomicUsize::new(0));
    let mut broker = Broker::open(
        database_path("wrong-token-binding"),
        broker_config(),
        b"phase-06-test-only-install-secret",
    )
    .expect("open broker");
    broker
        .authenticate_client_with_token(
            &identity(),
            "nonce-wrong-binding",
            AuthenticatedClientToken::for_test(8, "S-1-5-5-8-99", releases.clone()),
        )
        .expect_err("wrong SID/session token binding");
    assert_eq!(releases.load(Ordering::SeqCst), 1);
}

#[test]
fn production_host_source_is_fail_closed_and_has_no_generic_or_network_authority() {
    let source = include_str!("../src/windows_pipe.rs");
    for required in [
        "verify_installed_manifest",
        "PIPE_REJECT_REMOTE_CLIENTS",
        "ImpersonateNamedPipeClient",
        "RevertToSelf",
        "DuplicateTokenEx",
        "AuthenticatedClientToken",
        "PhysicalOperationDispatcher",
        "begin_preshutdown",
    ] {
        assert!(
            source.contains(required),
            "missing host boundary {required}"
        );
    }
    for forbidden in [
        "TcpListener",
        "TcpStream",
        "powershell",
        "cmd.exe",
        "scriptBody",
        "commandLine",
        "GenericOperation",
        "fixture fallback",
    ] {
        assert!(
            !source.contains(forbidden),
            "forbidden authority {forbidden}"
        );
    }
}

#[cfg(windows)]
#[test]
fn windows_host_uses_reject_remote_pipe_mode_and_restores_impersonation() {
    let source = include_str!("../src/windows_pipe.rs");
    assert!(source.contains("PIPE_REJECT_REMOTE_CLIENTS"));
    assert!(source.contains("RevertGuard"));
    assert!(source.contains("DisconnectNamedPipe"));
    assert!(source.contains("CancelIoEx"));
}

#[cfg(windows)]
#[test]
#[ignore = "requires an elevated installed build with signed canonical custody"]
fn elevated_installed_host_can_start_stop_and_restart_without_dispatch() {
    use std::sync::mpsc;

    use service::windows_pipe::WindowsPipeHost;

    for _restart in 0..2 {
        let mut host = WindowsPipeHost::prepare(PipeHostConfig::installed_defaults())
            .expect("verified installed host");
        let (shutdown_tx, shutdown_rx) = mpsc::channel();
        shutdown_tx.send(()).expect("request service stop");
        WindowsPipeHost::run(&mut host, &shutdown_rx).expect("bounded clean stop");
    }
}
