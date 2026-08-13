#[path = "../src/main.rs"]
mod service;

use std::{
    io::Cursor,
    sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};

use service::windows_pipe::{
    AuthenticatedClientToken, FrameError, HostLifecycle, HostState, PipeHostConfig,
    decode_frame, encode_frame,
};

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
    assert!(!lifecycle.finish_request(), "drain completes before stopped");
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
        assert!(source.contains(required), "missing host boundary {required}");
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
        assert!(!source.contains(forbidden), "forbidden authority {forbidden}");
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
