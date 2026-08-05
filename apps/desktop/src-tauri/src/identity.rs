use std::{
    fmt,
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpListener},
    time::Duration,
};

use liiiraa_contracts_rust::{SessionProjection, SessionState};
use serde::{Deserialize, Serialize};
use subtle::ConstantTimeEq;

use crate::credential_store::{CredentialStore, CredentialStoreError};

pub const DESKTOP_AUTHORIZATION_PATH: &str = "/v1/identity/desktop/authorizations";
pub const DESKTOP_EXCHANGE_PATH: &str = "/v1/identity/desktop/exchanges";

const MINIMUM_PKCE_VALUE_LENGTH: usize = 43;
const MAXIMUM_PKCE_VALUE_LENGTH: usize = 128;
const MAXIMUM_AUTHORIZATION_CODE_LENGTH: usize = 2_048;
const MAXIMUM_CALLBACK_REQUEST_BYTES: usize = 8_192;

pub trait SystemBrowserLauncher {
    fn open(&self, url: &str) -> Result<(), DesktopIdentityError>;
}

#[derive(Clone, Copy, Debug, Default)]
pub struct WindowsSystemBrowser;

#[cfg(target_os = "windows")]
impl SystemBrowserLauncher for WindowsSystemBrowser {
    fn open(&self, url: &str) -> Result<(), DesktopIdentityError> {
        use windows::{
            Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
            core::{HSTRING, PCWSTR},
        };

        let operation = HSTRING::from("open");
        let url = HSTRING::from(url);
        // SAFETY: Every pointer is backed by an owned HSTRING for the duration of this call;
        // the remaining optional ShellExecute parameters are explicitly null.
        let result = unsafe {
            ShellExecuteW(
                None,
                &operation,
                &url,
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        if result.0 as usize <= 32 {
            return Err(DesktopIdentityError::SystemBrowserUnavailable);
        }
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
impl SystemBrowserLauncher for WindowsSystemBrowser {
    fn open(&self, _url: &str) -> Result<(), DesktopIdentityError> {
        Err(DesktopIdentityError::SystemBrowserUnavailable)
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct DesktopAuthorizationChallenge {
    pub challenge_id: String,
    pub authorization_url: String,
    pub state: String,
    pub code_challenge: String,
    pub code_challenge_method: String,
    pub issuer: String,
    pub redirect_uri: String,
}

impl fmt::Debug for DesktopAuthorizationChallenge {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("DesktopAuthorizationChallenge")
            .field("challenge_id", &"[redacted]")
            .field("authorization_url", &"[system-browser-url]")
            .field("state", &"[redacted]")
            .field("code_challenge", &"[redacted]")
            .field("code_challenge_method", &self.code_challenge_method)
            .field("issuer", &self.issuer)
            .field("redirect_uri", &self.redirect_uri)
            .finish()
    }
}

pub struct PendingDesktopSignIn {
    challenge: DesktopAuthorizationChallenge,
    callback_consumed: bool,
}

impl PendingDesktopSignIn {
    pub fn authorization_url(&self) -> &str {
        &self.challenge.authorization_url
    }
}

impl fmt::Debug for PendingDesktopSignIn {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("PendingDesktopSignIn")
            .field("challenge", &"[redacted]")
            .field("callback_consumed", &self.callback_consumed)
            .finish()
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct DesktopCallbackEvidence {
    pub authorization_code: String,
    pub state: String,
    pub issuer: String,
    pub redirect_uri: String,
    pub remote_address: String,
}

pub struct LoopbackCallbackListener {
    listener: Option<TcpListener>,
    redirect_uri: String,
}

impl LoopbackCallbackListener {
    pub fn bind() -> Result<Self, DesktopIdentityError> {
        let listener = TcpListener::bind(SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0))
            .map_err(|_| DesktopIdentityError::CallbackUnavailable)?;
        let address = listener
            .local_addr()
            .map_err(|_| DesktopIdentityError::CallbackUnavailable)?;
        Ok(Self {
            listener: Some(listener),
            redirect_uri: format!("http://127.0.0.1:{}/oauth/callback", address.port()),
        })
    }

    pub fn redirect_uri(&self) -> &str {
        &self.redirect_uri
    }

    pub fn receive(
        &mut self,
        expected_issuer: &str,
    ) -> Result<DesktopCallbackEvidence, DesktopIdentityError> {
        let listener = self
            .listener
            .take()
            .ok_or(DesktopIdentityError::CallbackConsumed)?;
        let (mut stream, peer) = listener
            .accept()
            .map_err(|_| DesktopIdentityError::CallbackUnavailable)?;
        if peer.ip() != Ipv4Addr::LOCALHOST {
            return Err(DesktopIdentityError::CallbackMismatch);
        }
        stream
            .set_read_timeout(Some(Duration::from_secs(5)))
            .map_err(|_| DesktopIdentityError::CallbackUnavailable)?;
        let request = read_callback_request(&mut stream)?;
        let evidence = parse_callback_request(
            &request,
            expected_issuer,
            &self.redirect_uri,
            &peer.ip().to_string(),
        )?;
        let _ = stream.write_all(
            b"HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: 48\r\nConnection: close\r\n\r\nAuthentication received. Return to Liiiraa Boost.",
        );
        Ok(evidence)
    }
}

impl fmt::Debug for LoopbackCallbackListener {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("LoopbackCallbackListener")
            .field("bound", &self.listener.is_some())
            .field("redirect_uri", &self.redirect_uri)
            .finish()
    }
}

impl fmt::Debug for DesktopCallbackEvidence {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("DesktopCallbackEvidence")
            .field("authorization_code", &"[redacted]")
            .field("state", &"[redacted]")
            .field("issuer", &self.issuer)
            .field("redirect_uri", &self.redirect_uri)
            .field("remote_address", &self.remote_address)
            .finish()
    }
}

#[derive(Clone, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopExchangeRequest {
    challenge_id: String,
    authorization_code: String,
    state: String,
    issuer: String,
    redirect_uri: String,
}

impl DesktopExchangeRequest {
    pub fn path(&self) -> &'static str {
        DESKTOP_EXCHANGE_PATH
    }
}

impl fmt::Debug for DesktopExchangeRequest {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("DesktopExchangeRequest")
            .field("path", &DESKTOP_EXCHANGE_PATH)
            .field("challenge_id", &"[redacted]")
            .field("authorization_code", &"[redacted]")
            .field("state", &"[redacted]")
            .field("issuer", &self.issuer)
            .field("redirect_uri", &self.redirect_uri)
            .finish()
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq)]
pub enum CredentialCustody {
    #[serde(rename = "windows-credential-manager")]
    WindowsCredentialManager,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CredentialCustodyEnvelope {
    pub kind: CredentialCustody,
    credential: String,
    expires_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DesktopExchangeResponse {
    pub session: SessionProjection,
    pub credential_custody: CredentialCustodyEnvelope,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DesktopSessionContact {
    pub state: SessionState,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AuthenticatedContactDisposition {
    Active,
    SignedOut,
}

impl AuthenticatedContactDisposition {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::SignedOut => "signed-out",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DesktopIdentityError {
    InvalidAuthorizationChallenge,
    SystemBrowserUnavailable,
    CallbackUnavailable,
    CallbackConsumed,
    CallbackMismatch,
    InvalidExchangeResponse,
    CredentialCustody(CredentialStoreError),
}

impl fmt::Display for DesktopIdentityError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidAuthorizationChallenge => "desktop authorization could not begin",
            Self::SystemBrowserUnavailable => "system browser could not open",
            Self::CallbackUnavailable => "desktop authorization callback is unavailable",
            Self::CallbackConsumed | Self::CallbackMismatch => {
                "desktop authorization callback was rejected"
            }
            Self::InvalidExchangeResponse => "desktop authorization could not complete",
            Self::CredentialCustody(_) => "desktop credential custody failed",
        })
    }
}

fn read_callback_request(stream: &mut impl Read) -> Result<Vec<u8>, DesktopIdentityError> {
    let mut request = Vec::with_capacity(1_024);
    let mut chunk = [0_u8; 1_024];
    loop {
        let read = stream
            .read(&mut chunk)
            .map_err(|_| DesktopIdentityError::CallbackUnavailable)?;
        if read == 0 {
            break;
        }
        request.extend_from_slice(&chunk[..read]);
        if request.len() > MAXIMUM_CALLBACK_REQUEST_BYTES {
            return Err(DesktopIdentityError::CallbackMismatch);
        }
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }
    Ok(request)
}

fn decode_query_component(value: &str) -> Result<String, DesktopIdentityError> {
    let mut decoded = Vec::with_capacity(value.len());
    let bytes = value.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                let hex = std::str::from_utf8(&bytes[index + 1..index + 3])
                    .map_err(|_| DesktopIdentityError::CallbackMismatch)?;
                decoded.push(
                    u8::from_str_radix(hex, 16)
                        .map_err(|_| DesktopIdentityError::CallbackMismatch)?,
                );
                index += 3;
            }
            b'+' => {
                decoded.push(b' ');
                index += 1;
            }
            byte if byte != b'%' => {
                decoded.push(byte);
                index += 1;
            }
            _ => return Err(DesktopIdentityError::CallbackMismatch),
        }
    }
    String::from_utf8(decoded).map_err(|_| DesktopIdentityError::CallbackMismatch)
}

fn parse_callback_request(
    request: &[u8],
    expected_issuer: &str,
    redirect_uri: &str,
    remote_address: &str,
) -> Result<DesktopCallbackEvidence, DesktopIdentityError> {
    let request =
        std::str::from_utf8(request).map_err(|_| DesktopIdentityError::CallbackMismatch)?;
    let request_line = request
        .split("\r\n")
        .next()
        .ok_or(DesktopIdentityError::CallbackMismatch)?;
    let mut parts = request_line.split_ascii_whitespace();
    let method = parts.next();
    let target = parts.next();
    let version = parts.next();
    if method != Some("GET") || version != Some("HTTP/1.1") || parts.next().is_some() {
        return Err(DesktopIdentityError::CallbackMismatch);
    }
    let target = target.ok_or(DesktopIdentityError::CallbackMismatch)?;
    let (path, query) = target
        .split_once('?')
        .ok_or(DesktopIdentityError::CallbackMismatch)?;
    if path != "/oauth/callback" {
        return Err(DesktopIdentityError::CallbackMismatch);
    }
    let mut authorization_code = None;
    let mut state = None;
    for pair in query.split('&') {
        let (name, value) = pair
            .split_once('=')
            .ok_or(DesktopIdentityError::CallbackMismatch)?;
        let value = decode_query_component(value)?;
        match name {
            "code" if authorization_code.is_none() => authorization_code = Some(value),
            "state" if state.is_none() => state = Some(value),
            _ => return Err(DesktopIdentityError::CallbackMismatch),
        }
    }
    Ok(DesktopCallbackEvidence {
        authorization_code: authorization_code.ok_or(DesktopIdentityError::CallbackMismatch)?,
        state: state.ok_or(DesktopIdentityError::CallbackMismatch)?,
        issuer: expected_issuer.to_owned(),
        redirect_uri: redirect_uri.to_owned(),
        remote_address: remote_address.to_owned(),
    })
}

impl std::error::Error for DesktopIdentityError {}

impl From<CredentialStoreError> for DesktopIdentityError {
    fn from(error: CredentialStoreError) -> Self {
        Self::CredentialCustody(error)
    }
}

fn is_base64url_value(value: &str) -> bool {
    (MINIMUM_PKCE_VALUE_LENGTH..=MAXIMUM_PKCE_VALUE_LENGTH).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

fn exact_loopback_redirect(redirect_uri: &str) -> bool {
    let Some(authority_and_path) = redirect_uri.strip_prefix("http://127.0.0.1:") else {
        return false;
    };
    let Some((port, path)) = authority_and_path.split_once('/') else {
        return false;
    };
    port.parse::<u16>().is_ok_and(|port| port > 0) && path == "oauth/callback"
}

fn exact_issuer(issuer: &str) -> bool {
    issuer.starts_with("https://")
        && !issuer.ends_with('/')
        && !issuer.contains('?')
        && !issuer.contains('#')
}

fn valid_browser_authorization(challenge: &DesktopAuthorizationChallenge) -> bool {
    challenge
        .authorization_url
        .starts_with(&format!("{}/", challenge.issuer))
        && challenge.authorization_url.contains("response_type=code")
        && challenge
            .authorization_url
            .contains("client_id=liiiraa-windows-public-client")
        && challenge
            .authorization_url
            .contains(&format!("state={}", challenge.state))
        && challenge
            .authorization_url
            .contains(&format!("code_challenge={}", challenge.code_challenge))
        && challenge
            .authorization_url
            .contains("code_challenge_method=S256")
}

pub fn begin_desktop_sign_in(
    browser: &impl SystemBrowserLauncher,
    challenge: DesktopAuthorizationChallenge,
) -> Result<PendingDesktopSignIn, DesktopIdentityError> {
    if challenge.challenge_id.is_empty()
        || challenge.challenge_id.len() > 128
        || !exact_issuer(&challenge.issuer)
        || !exact_loopback_redirect(&challenge.redirect_uri)
        || challenge.code_challenge_method != "S256"
        || !is_base64url_value(&challenge.state)
        || !is_base64url_value(&challenge.code_challenge)
        || !valid_browser_authorization(&challenge)
    {
        return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
    }

    browser.open(&challenge.authorization_url)?;
    Ok(PendingDesktopSignIn {
        challenge,
        callback_consumed: false,
    })
}

pub fn complete_desktop_callback(
    pending: &mut PendingDesktopSignIn,
    callback: DesktopCallbackEvidence,
) -> Result<DesktopExchangeRequest, DesktopIdentityError> {
    if pending.callback_consumed {
        return Err(DesktopIdentityError::CallbackConsumed);
    }
    pending.callback_consumed = true;

    let expected_state = pending.challenge.state.as_bytes();
    let state_matches = expected_state.len() == callback.state.len()
        && expected_state.ct_eq(callback.state.as_bytes()).unwrap_u8() == 1;
    let authorization_code_is_bounded = !callback.authorization_code.is_empty()
        && callback.authorization_code.len() <= MAXIMUM_AUTHORIZATION_CODE_LENGTH
        && !callback.authorization_code.chars().any(char::is_control);
    if !state_matches
        || callback.issuer != pending.challenge.issuer
        || callback.redirect_uri != pending.challenge.redirect_uri
        || callback.remote_address != "127.0.0.1"
        || !authorization_code_is_bounded
    {
        return Err(DesktopIdentityError::CallbackMismatch);
    }

    Ok(DesktopExchangeRequest {
        challenge_id: pending.challenge.challenge_id.clone(),
        authorization_code: callback.authorization_code,
        state: callback.state,
        issuer: callback.issuer,
        redirect_uri: callback.redirect_uri,
    })
}

pub fn accept_desktop_exchange(
    store: &impl CredentialStore,
    response: DesktopExchangeResponse,
) -> Result<SessionProjection, DesktopIdentityError> {
    let custody = response.credential_custody;
    let credential_is_bounded = !custody.credential.is_empty()
        && custody.credential.len() <= 4_096
        && !custody.credential.chars().any(char::is_control);
    if custody.kind != CredentialCustody::WindowsCredentialManager
        || !credential_is_bounded
        || custody.expires_at != response.session.expires_at
        || matches!(
            response.session.state,
            SessionState::Revoked | SessionState::Expired
        )
    {
        return Err(DesktopIdentityError::InvalidExchangeResponse);
    }

    store.write_rotated_credential(&custody.credential)?;
    Ok(response.session)
}

pub fn reconcile_authenticated_contact(
    store: &impl CredentialStore,
    contact: DesktopSessionContact,
) -> Result<AuthenticatedContactDisposition, DesktopIdentityError> {
    if matches!(contact.state, SessionState::Revoked | SessionState::Expired) {
        store.delete_credential()?;
        return Ok(AuthenticatedContactDisposition::SignedOut);
    }
    Ok(AuthenticatedContactDisposition::Active)
}

pub fn revoke_desktop_session(store: &impl CredentialStore) -> Result<(), DesktopIdentityError> {
    store.delete_credential().map_err(Into::into)
}
