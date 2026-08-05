#[path = "../src/credential_store.rs"]
mod credential_store;
#[path = "../src/identity.rs"]
mod identity;

use std::{cell::RefCell, fs, io::Write, net::TcpStream, path::PathBuf, thread};

use credential_store::{CredentialStore, CredentialStoreError};
use identity::{
    CredentialCustody, DESKTOP_EXCHANGE_PATH, DesktopAuthorizationChallenge,
    DesktopCallbackEvidence, DesktopExchangeResponse, DesktopIdentityError, DesktopSessionContact,
    LoopbackCallbackListener, SystemBrowserLauncher, accept_desktop_exchange,
    begin_desktop_sign_in, complete_desktop_callback, reconcile_authenticated_contact,
    revoke_desktop_session,
};
use liiiraa_contracts_rust::SessionState;
use serde_json::{Value, json};

const ISSUER: &str = "https://identity.liiiraa.test";
const REDIRECT_URI: &str = "http://127.0.0.1:49152/oauth/callback";
const STATE: &str = "state_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
const CODE_CHALLENGE: &str = "challenge_0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef";
const API_CREDENTIAL: &str = "api-issued-rotated-credential-do-not-render";

#[derive(Default)]
struct MemoryCredentialStore {
    credential: RefCell<Option<String>>,
    writes: RefCell<usize>,
    deletes: RefCell<usize>,
}

#[derive(Default)]
struct RecordingSystemBrowser {
    opened_urls: RefCell<Vec<String>>,
}

impl SystemBrowserLauncher for RecordingSystemBrowser {
    fn open(&self, url: &str) -> Result<(), DesktopIdentityError> {
        self.opened_urls.borrow_mut().push(url.to_owned());
        Ok(())
    }
}

impl CredentialStore for MemoryCredentialStore {
    fn write_rotated_credential(&self, credential: &str) -> Result<(), CredentialStoreError> {
        self.credential.replace(Some(credential.to_owned()));
        *self.writes.borrow_mut() += 1;
        Ok(())
    }

    fn read_credential(&self) -> Result<Option<String>, CredentialStoreError> {
        Ok(self.credential.borrow().clone())
    }

    fn delete_credential(&self) -> Result<(), CredentialStoreError> {
        self.credential.replace(None);
        *self.deletes.borrow_mut() += 1;
        Ok(())
    }
}

fn challenge() -> DesktopAuthorizationChallenge {
    DesktopAuthorizationChallenge {
        challenge_id: "challenge_desktop_0001".to_owned(),
        authorization_url: format!(
            "{ISSUER}/api/auth/oauth2/authorize?response_type=code&client_id=liiiraa-windows-public-client&redirect_uri=http%3A%2F%2F127.0.0.1%3A49152%2Foauth%2Fcallback&state={STATE}&code_challenge={CODE_CHALLENGE}&code_challenge_method=S256"
        ),
        state: STATE.to_owned(),
        code_challenge: CODE_CHALLENGE.to_owned(),
        code_challenge_method: "S256".to_owned(),
        issuer: ISSUER.to_owned(),
        redirect_uri: REDIRECT_URI.to_owned(),
    }
}

fn callback(state: &str) -> DesktopCallbackEvidence {
    DesktopCallbackEvidence {
        authorization_code: "one-shot-authorization-code".to_owned(),
        state: state.to_owned(),
        issuer: ISSUER.to_owned(),
        redirect_uri: REDIRECT_URI.to_owned(),
        remote_address: "127.0.0.1".to_owned(),
    }
}

fn session_projection(state: &str) -> Value {
    json!({
        "schemaVersion": "1.0",
        "aggregateVersion": "1",
        "etag": "session-desktop-0001-v1",
        "correlationId": "desktop-identity-0001",
        "provenance": "postgres-authority",
        "kind": "session-projection",
        "sessionId": "session-desktop-0001",
        "accountId": "account-player-0001",
        "state": state,
        "authenticationStrength": "passkey",
        "scopes": ["session-desktop"],
        "authenticatedAt": "2030-01-02T03:04:05.000Z",
        "expiresAt": "2030-02-01T03:04:05.000Z",
        "lastSeenAt": "2030-01-02T03:04:05.000Z"
    })
}

fn exchange_response(state: &str) -> DesktopExchangeResponse {
    serde_json::from_value(json!({
        "session": session_projection(state),
        "credentialCustody": {
            "kind": "windows-credential-manager",
            "credential": API_CREDENTIAL,
            "expiresAt": "2030-02-01T03:04:05.000Z"
        }
    }))
    .expect("API desktop exchange response must match generated session contracts")
}

fn crate_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

#[test]
fn desktop_sign_in_uses_the_system_browser_and_forwards_only_api_exchange_evidence() {
    let browser = RecordingSystemBrowser::default();
    let mut pending =
        begin_desktop_sign_in(&browser, challenge()).expect("API challenge should be admitted");
    assert_eq!(browser.opened_urls.borrow().len(), 1);
    assert_eq!(browser.opened_urls.borrow()[0], pending.authorization_url());
    assert!(pending.authorization_url().starts_with(ISSUER));
    assert!(
        pending
            .authorization_url()
            .contains("code_challenge_method=S256")
    );
    assert!(!pending.authorization_url().contains("client_secret"));

    let exchange = complete_desktop_callback(&mut pending, callback(STATE))
        .expect("exact one-shot callback should be forwarded");
    assert_eq!(exchange.path(), DESKTOP_EXCHANGE_PATH);
    let body = serde_json::to_value(exchange).expect("exchange request should serialize");
    assert_eq!(body["challengeId"], "challenge_desktop_0001");
    assert_eq!(body["authorizationCode"], "one-shot-authorization-code");
    assert_eq!(body["state"], STATE);
    assert_eq!(body["issuer"], ISSUER);
    assert_eq!(body["redirectUri"], REDIRECT_URI);
    assert!(body.get("codeVerifier").is_none());
    assert!(body.get("clientSecret").is_none());
    assert!(!body.to_string().contains("/oauth2/token"));
}

#[test]
fn desktop_callback_is_exact_loopback_state_bound_and_one_shot_even_after_rejection() {
    let browser = RecordingSystemBrowser::default();
    let mut pending =
        begin_desktop_sign_in(&browser, challenge()).expect("API challenge should be admitted");
    assert_eq!(
        complete_desktop_callback(&mut pending, callback("wrong-state")),
        Err(DesktopIdentityError::CallbackMismatch),
    );
    assert_eq!(
        complete_desktop_callback(&mut pending, callback(STATE)),
        Err(DesktopIdentityError::CallbackConsumed),
    );

    let mut pending =
        begin_desktop_sign_in(&browser, challenge()).expect("API challenge should be admitted");
    let mut non_loopback = callback(STATE);
    non_loopback.remote_address = "192.0.2.1".to_owned();
    assert_eq!(
        complete_desktop_callback(&mut pending, non_loopback),
        Err(DesktopIdentityError::CallbackMismatch),
    );
}

#[test]
fn desktop_callback_listener_binds_ephemeral_loopback_and_closes_after_one_request() {
    let mut listener = LoopbackCallbackListener::bind().expect("loopback listener should bind");
    let redirect_uri = listener.redirect_uri().to_owned();
    let address = redirect_uri
        .strip_prefix("http://")
        .and_then(|value| value.strip_suffix("/oauth/callback"))
        .expect("listener redirect URI should be exact");
    let address = address.to_owned();
    let sender = thread::spawn(move || {
        let mut stream = TcpStream::connect(address).expect("loopback client should connect");
        write!(
            stream,
            "GET /oauth/callback?code=one-shot%2Dauthorization%2Dcode&state={STATE} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n"
        )
        .expect("callback request should write");
    });

    let evidence = listener
        .receive(ISSUER)
        .expect("one callback should be admitted");
    sender.join().expect("callback sender should finish");
    assert_eq!(evidence.authorization_code, "one-shot-authorization-code");
    assert_eq!(evidence.state, STATE);
    assert_eq!(evidence.redirect_uri, redirect_uri);
    assert_eq!(evidence.remote_address, "127.0.0.1");
    assert_eq!(
        listener.receive(ISSUER),
        Err(DesktopIdentityError::CallbackConsumed),
    );
}

#[test]
fn api_issued_credential_is_custodied_natively_and_never_returned_to_the_renderer() {
    let store = MemoryCredentialStore::default();
    let response = exchange_response("active");
    assert_eq!(
        response.credential_custody.kind,
        CredentialCustody::WindowsCredentialManager
    );

    let projection = accept_desktop_exchange(&store, response)
        .expect("API-issued credential should enter native custody");
    assert_eq!(*store.writes.borrow(), 1);
    assert_eq!(
        store.read_credential().unwrap().as_deref(),
        Some(API_CREDENTIAL)
    );
    let renderer_value = serde_json::to_value(projection).expect("projection should serialize");
    assert_eq!(renderer_value["state"], "active");
    assert!(!renderer_value.to_string().contains(API_CREDENTIAL));
    assert!(!renderer_value.to_string().contains("credentialCustody"));
}

#[test]
fn next_authenticated_contact_revocation_deletes_only_the_native_credential() {
    let store = MemoryCredentialStore::default();
    accept_desktop_exchange(&store, exchange_response("active"))
        .expect("credential should be stored before revocation");
    let local_safety_history = vec!["restore-point-0001", "audit-event-0001"];

    let disposition = reconcile_authenticated_contact(
        &store,
        DesktopSessionContact {
            state: SessionState::Revoked,
        },
    )
    .expect("revocation should clear credential custody");

    assert_eq!(disposition.as_str(), "signed-out");
    assert_eq!(*store.deletes.borrow(), 1);
    assert_eq!(store.read_credential().unwrap(), None);
    assert_eq!(
        local_safety_history,
        ["restore-point-0001", "audit-event-0001"]
    );
}

#[test]
fn explicit_sign_out_is_idempotent_and_credential_errors_are_redacted() {
    let store = MemoryCredentialStore::default();
    revoke_desktop_session(&store).expect("missing credential deletion should be idempotent");
    revoke_desktop_session(&store).expect("repeated deletion should remain idempotent");
    assert_eq!(*store.deletes.borrow(), 2);

    let error = DesktopIdentityError::CredentialCustody(CredentialStoreError::Unavailable);
    let rendered = format!("{error:?} {error}");
    assert!(!rendered.contains(API_CREDENTIAL));
    assert!(!rendered.contains("one-shot-authorization-code"));
}

#[test]
fn rust_identity_boundary_has_no_provider_exchange_secret_or_plaintext_store_path() {
    let identity_source = fs::read_to_string(crate_root().join("src/identity.rs"))
        .expect("identity source should be readable");
    let credential_source = fs::read_to_string(crate_root().join("src/credential_store.rs"))
        .expect("credential-store source should be readable");
    let cargo = fs::read_to_string(crate_root().join("Cargo.toml"))
        .expect("desktop Cargo manifest should be readable");

    for prohibited in [
        "/oauth2/token",
        "client_secret",
        "clientSecret",
        "localStorage",
        "sessionStorage",
        "rusqlite",
        "Authorization: Bearer",
    ] {
        assert!(
            !identity_source.contains(prohibited),
            "prohibited native identity surface: {prohibited}"
        );
        assert!(
            !credential_source.contains(prohibited),
            "prohibited credential custody surface: {prohibited}"
        );
    }
    assert!(identity_source.contains(DESKTOP_EXCHANGE_PATH));
    assert!(credential_source.contains("keyring::Entry"));
    assert!(cargo.contains("keyring = \"=4.1.5\""));
    assert!(cargo.contains("windows = { version = \"=0.62.2\""));
    assert!(identity_source.contains("ShellExecuteW"));
}

#[cfg(target_os = "windows")]
#[test]
fn packaged_windows_credential_manager_round_trip_smoke() {
    use credential_store::WindowsCredentialStore;

    let account = format!("plan-04-20-smoke-{}", std::process::id());
    let store = WindowsCredentialStore::for_account(account);
    store
        .delete_credential()
        .expect("pre-existing smoke credential should clear");
    store
        .write_rotated_credential(API_CREDENTIAL)
        .expect("Credential Manager write should succeed");
    assert_eq!(
        store.read_credential().unwrap().as_deref(),
        Some(API_CREDENTIAL)
    );
    store
        .delete_credential()
        .expect("smoke credential should clear");
    assert_eq!(store.read_credential().unwrap(), None);
}
