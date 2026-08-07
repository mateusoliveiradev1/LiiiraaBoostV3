use std::{
    fmt,
    io::{Read, Write},
    net::{Ipv4Addr, SocketAddrV4, TcpListener},
    thread,
    time::Duration,
    time::Instant,
};

use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use liiiraa_contracts_rust::{SessionProjection, SessionState};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::credential_store::{CredentialStore, CredentialStoreError};

pub const DESKTOP_AUTHORIZATION_PATH: &str = "/v1/identity/desktop/authorizations";
pub const DESKTOP_EXCHANGE_PATH: &str = "/v1/identity/desktop/exchanges";
pub const DESKTOP_SIGN_OUT_PATH: &str = "/v1/identity/desktop/sign-out";

const MINIMUM_PKCE_VALUE_LENGTH: usize = 43;
const MAXIMUM_PKCE_VALUE_LENGTH: usize = 128;
const MAXIMUM_AUTHORIZATION_CODE_LENGTH: usize = 2_048;
const MAXIMUM_CALLBACK_REQUEST_BYTES: usize = 8_192;
const MAXIMUM_IDENTITY_RESPONSE_BYTES: usize = 1_048_576;
const DESKTOP_CALLBACK_TIMEOUT: Duration = Duration::from_secs(120);

#[derive(Clone, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAuthorizationRequest {
    pub email: String,
    pub code_challenge: String,
    pub issuer: String,
    pub redirect_uri: String,
}

impl fmt::Debug for DesktopAuthorizationRequest {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("DesktopAuthorizationRequest")
            .field("email", &"[redacted]")
            .field("code_challenge", &"[redacted]")
            .field("issuer", &self.issuer)
            .field("redirect_uri", &self.redirect_uri)
            .finish()
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct DesktopPkceProof {
    verifier: String,
    code_challenge: String,
}

impl DesktopPkceProof {
    pub fn from_verifier(verifier: &str) -> Result<Self, DesktopIdentityError> {
        if !is_base64url_value(verifier) {
            return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
        }
        let digest = Sha256::digest(verifier.as_bytes());
        Ok(Self {
            verifier: verifier.to_owned(),
            code_challenge: URL_SAFE_NO_PAD.encode(digest),
        })
    }

    #[cfg(target_os = "windows")]
    pub fn generate() -> Result<Self, DesktopIdentityError> {
        use windows::Win32::Security::Cryptography::{
            BCRYPT_USE_SYSTEM_PREFERRED_RNG, BCryptGenRandom,
        };

        let mut random = [0_u8; 64];
        // SAFETY: The system-preferred RNG does not require an algorithm handle, and the owned
        // output buffer remains valid for the complete call.
        let status = unsafe { BCryptGenRandom(None, &mut random, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
        if !status.is_ok() {
            return Err(DesktopIdentityError::AuthorizationUnavailable);
        }
        Self::from_verifier(&URL_SAFE_NO_PAD.encode(random))
    }

    #[cfg(not(target_os = "windows"))]
    pub fn generate() -> Result<Self, DesktopIdentityError> {
        Err(DesktopIdentityError::AuthorizationUnavailable)
    }

    pub fn code_challenge(&self) -> &str {
        &self.code_challenge
    }

    fn verifier(&self) -> &str {
        &self.verifier
    }
}

impl fmt::Debug for DesktopPkceProof {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("DesktopPkceProof")
            .field("verifier", &"[redacted]")
            .field("code_challenge", &"[redacted]")
            .finish()
    }
}

pub trait DesktopIdentityApi {
    fn account_origin(&self) -> &str;
    fn issuer(&self) -> &str;
    fn request_authorization(
        &self,
        request: &DesktopAuthorizationRequest,
    ) -> Result<DesktopAuthorizationChallenge, DesktopIdentityError>;
    fn exchange(
        &self,
        request: &DesktopExchangeRequest,
    ) -> Result<DesktopExchangeResponse, DesktopIdentityError>;
    fn revoke(&self, credential: &str) -> Result<(), DesktopIdentityError>;
}

pub trait DesktopCallbackReceiver {
    fn redirect_uri(&self) -> &str;
    fn receive(
        &mut self,
        expected_issuer: &str,
        timeout: Duration,
    ) -> Result<DesktopCallbackEvidence, DesktopIdentityError>;
}

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

#[derive(Clone, Deserialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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
    code_verifier: String,
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
            .field("code_verifier", &"[redacted]")
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
        self.receive_with_timeout(expected_issuer, DESKTOP_CALLBACK_TIMEOUT)
    }

    pub fn receive_with_timeout(
        &mut self,
        expected_issuer: &str,
        timeout: Duration,
    ) -> Result<DesktopCallbackEvidence, DesktopIdentityError> {
        let listener = self
            .listener
            .take()
            .ok_or(DesktopIdentityError::CallbackConsumed)?;
        listener
            .set_nonblocking(true)
            .map_err(|_| DesktopIdentityError::CallbackUnavailable)?;
        let deadline = Instant::now() + timeout;
        let (mut stream, peer) = loop {
            match listener.accept() {
                Ok(connection) => break connection,
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    if Instant::now() >= deadline {
                        return Err(DesktopIdentityError::CallbackTimeout);
                    }
                    thread::sleep(Duration::from_millis(25));
                }
                Err(_) => return Err(DesktopIdentityError::CallbackUnavailable),
            }
        };
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
        const SUCCESS_HTML: &str = r#"<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <title>Login concluído · Liiiraa Boost</title>
  <style>
    :root{color-scheme:dark;font-family:Inter,Segoe UI,system-ui,sans-serif;background:#070a0e;color:#f1f6f8}
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:#070a0e}
    main{width:min(100%,560px);padding:40px;border:1px solid #20313a;background:#0a1015}
    .brand{display:flex;align-items:center;gap:10px;margin:0 0 56px;font-weight:700}.mark{color:#76d5f4;font-size:22px}.brand b{color:#76d5f4}
    .status{display:inline-flex;align-items:center;gap:8px;color:#65f0c2;font:700 11px ui-monospace,Consolas,monospace;letter-spacing:.09em;text-transform:uppercase}
    .status::before{content:'✓';display:grid;place-items:center;width:22px;height:22px;border:1px solid #3fc99e;border-radius:50%}
    h1{max-width:12ch;margin:22px 0 14px;font-size:clamp(34px,8vw,52px);line-height:1.02;letter-spacing:-.035em;text-wrap:balance}
    p{max-width:48ch;margin:0;color:#a9bac3;font-size:15px;line-height:1.7}.hint{margin-top:32px;padding-top:24px;border-top:1px solid #20313a;color:#dce7eb}
    small{display:block;margin-top:12px;color:#72838c;font-size:12px}
    @media(max-width:520px){main{padding:28px}.brand{margin-bottom:42px}}
  </style>
</head>
<body>
  <main>
    <p class="brand"><span class="mark">ϟ</span><span>Liiiraa <b>Boost</b></span></p>
    <span class="status">Conexão protegida</span>
    <h1>Login concluído.</h1>
    <p>O aplicativo já recebeu a confirmação e está abrindo sua conta com segurança.</p>
    <p class="hint">Você já pode fechar esta aba e voltar ao Liiiraa Boost.</p>
    <small>You can close this tab and return to the desktop app.</small>
  </main>
</body>
</html>"#;
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nContent-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n{}",
            SUCCESS_HTML.len(),
            SUCCESS_HTML,
        );
        let _ = stream.write_all(response.as_bytes());
        Ok(evidence)
    }
}

impl DesktopCallbackReceiver for LoopbackCallbackListener {
    fn redirect_uri(&self) -> &str {
        self.redirect_uri()
    }

    fn receive(
        &mut self,
        expected_issuer: &str,
        timeout: Duration,
    ) -> Result<DesktopCallbackEvidence, DesktopIdentityError> {
        self.receive_with_timeout(expected_issuer, timeout)
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
    code_verifier: String,
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
            .field("code_verifier", &"[redacted]")
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
    AuthorizationUnavailable,
    SystemBrowserUnavailable,
    CallbackUnavailable,
    CallbackTimeout,
    CallbackConsumed,
    CallbackMismatch,
    InvalidExchangeResponse,
    CredentialCustody(CredentialStoreError),
}

impl fmt::Display for DesktopIdentityError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidAuthorizationChallenge => "desktop authorization could not begin",
            Self::AuthorizationUnavailable => "desktop authorization service is unavailable",
            Self::SystemBrowserUnavailable => "system browser could not open",
            Self::CallbackUnavailable => "desktop authorization callback is unavailable",
            Self::CallbackTimeout => "desktop authorization callback timed out",
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
    challenge.authorization_url.starts_with("https://")
        && !challenge.authorization_url.contains(['\r', '\n', '#'])
        && !challenge.authorization_url.contains('@')
        && challenge
            .authorization_url
            .contains(&format!("state={}", challenge.state))
        && (challenge
            .authorization_url
            .contains(&format!("desktop_challenge={}", challenge.challenge_id))
            || (challenge.authorization_url.contains("response_type=code")
                && challenge
                    .authorization_url
                    .contains("client_id=liiiraa-windows-public-client")
                && challenge
                    .authorization_url
                    .contains(&format!("code_challenge={}", challenge.code_challenge))
                && challenge
                    .authorization_url
                    .contains("code_challenge_method=S256")))
}

pub fn begin_desktop_sign_in(
    browser: &impl SystemBrowserLauncher,
    challenge: DesktopAuthorizationChallenge,
    code_verifier: &str,
) -> Result<PendingDesktopSignIn, DesktopIdentityError> {
    let proof = DesktopPkceProof::from_verifier(code_verifier)?;
    if challenge.challenge_id.is_empty()
        || challenge.challenge_id.len() > 128
        || !exact_issuer(&challenge.issuer)
        || !exact_loopback_redirect(&challenge.redirect_uri)
        || challenge.code_challenge_method != "S256"
        || !is_base64url_value(&challenge.state)
        || !is_base64url_value(&challenge.code_challenge)
        || challenge.code_challenge != proof.code_challenge
        || !valid_browser_authorization(&challenge)
    {
        return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
    }

    browser.open(&challenge.authorization_url)?;
    Ok(PendingDesktopSignIn {
        challenge,
        callback_consumed: false,
        code_verifier: proof.verifier,
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
        code_verifier: pending.code_verifier.clone(),
        state: callback.state,
        issuer: callback.issuer,
        redirect_uri: callback.redirect_uri,
    })
}

pub fn perform_desktop_sign_in(
    api: &impl DesktopIdentityApi,
    browser: &impl SystemBrowserLauncher,
    store: &impl CredentialStore,
    callback: &mut impl DesktopCallbackReceiver,
    email: &str,
    proof: DesktopPkceProof,
) -> Result<SessionProjection, DesktopIdentityError> {
    let email = email.trim().to_ascii_lowercase();
    if email.len() > 254
        || !email.contains('@')
        || email.chars().any(char::is_whitespace)
        || !exact_issuer(api.issuer())
        || !exact_issuer(api.account_origin())
        || !exact_loopback_redirect(callback.redirect_uri())
    {
        return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
    }
    let request = DesktopAuthorizationRequest {
        email,
        code_challenge: proof.code_challenge().to_owned(),
        issuer: api.issuer().to_owned(),
        redirect_uri: callback.redirect_uri().to_owned(),
    };
    let challenge = api.request_authorization(&request)?;
    if challenge.issuer != request.issuer
        || challenge.redirect_uri != request.redirect_uri
        || challenge.code_challenge != request.code_challenge
        || !challenge
            .authorization_url
            .starts_with(&format!("{}/", api.account_origin()))
    {
        return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
    }
    let mut pending = begin_desktop_sign_in(browser, challenge, proof.verifier())?;
    let callback = callback.receive(api.issuer(), DESKTOP_CALLBACK_TIMEOUT)?;
    let exchange = complete_desktop_callback(&mut pending, callback)?;
    let response = api.exchange(&exchange)?;
    accept_desktop_exchange(store, response)
}

pub fn sign_out_desktop(
    api: &impl DesktopIdentityApi,
    store: &impl CredentialStore,
) -> Result<(), DesktopIdentityError> {
    if let Some(credential) = store.read_credential()? {
        api.revoke(&credential)?;
    }
    revoke_desktop_session(store)
}

#[derive(Clone, Debug)]
struct HttpsOrigin {
    host: String,
    port: u16,
    serialized: String,
}

impl HttpsOrigin {
    fn parse(value: &str) -> Result<Self, DesktopIdentityError> {
        let authority = value
            .strip_prefix("https://")
            .ok_or(DesktopIdentityError::InvalidAuthorizationChallenge)?;
        if authority.is_empty()
            || authority.contains(['/', '?', '#', '@'])
            || authority.chars().any(char::is_whitespace)
        {
            return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
        }
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port)) => (
                host,
                port.parse::<u16>()
                    .map_err(|_| DesktopIdentityError::InvalidAuthorizationChallenge)?,
            ),
            None => (authority, 443),
        };
        if host.is_empty()
            || !host
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-'))
        {
            return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
        }
        Ok(Self {
            host: host.to_owned(),
            port,
            serialized: value.to_owned(),
        })
    }
}

pub fn validate_https_origin(value: &str) -> Result<(), DesktopIdentityError> {
    HttpsOrigin::parse(value).map(|_| ())
}

pub fn open_admin_in_system_browser(
    browser: &impl SystemBrowserLauncher,
    configured_admin_origin: &str,
) -> Result<(), DesktopIdentityError> {
    let origin = HttpsOrigin::parse(configured_admin_origin)?;
    browser.open(&origin.serialized)
}

#[derive(Clone, Debug)]
pub struct WindowsDesktopIdentityApi {
    account_origin: HttpsOrigin,
    api_origin: HttpsOrigin,
}

impl WindowsDesktopIdentityApi {
    pub fn from_origins(
        api_origin: &str,
        account_origin: &str,
    ) -> Result<Self, DesktopIdentityError> {
        Ok(Self {
            account_origin: HttpsOrigin::parse(account_origin)?,
            api_origin: HttpsOrigin::parse(api_origin)?,
        })
    }
}

impl DesktopIdentityApi for WindowsDesktopIdentityApi {
    fn account_origin(&self) -> &str {
        &self.account_origin.serialized
    }

    fn issuer(&self) -> &str {
        &self.api_origin.serialized
    }

    fn request_authorization(
        &self,
        request: &DesktopAuthorizationRequest,
    ) -> Result<DesktopAuthorizationChallenge, DesktopIdentityError> {
        let body = serde_json::to_vec(request)
            .map_err(|_| DesktopIdentityError::InvalidAuthorizationChallenge)?;
        let response = winhttp_identity_request(
            &self.api_origin,
            "POST",
            DESKTOP_AUTHORIZATION_PATH,
            None,
            Some(&body),
        )?;
        if response.status != 201 {
            return Err(DesktopIdentityError::InvalidAuthorizationChallenge);
        }
        serde_json::from_slice(&response.body)
            .map_err(|_| DesktopIdentityError::InvalidAuthorizationChallenge)
    }

    fn exchange(
        &self,
        request: &DesktopExchangeRequest,
    ) -> Result<DesktopExchangeResponse, DesktopIdentityError> {
        let body = serde_json::to_vec(request)
            .map_err(|_| DesktopIdentityError::InvalidExchangeResponse)?;
        let response = winhttp_identity_request(
            &self.api_origin,
            "POST",
            DESKTOP_EXCHANGE_PATH,
            None,
            Some(&body),
        )?;
        if response.status != 201 {
            return Err(DesktopIdentityError::InvalidExchangeResponse);
        }
        serde_json::from_slice(&response.body)
            .map_err(|_| DesktopIdentityError::InvalidExchangeResponse)
    }

    fn revoke(&self, credential: &str) -> Result<(), DesktopIdentityError> {
        let response = winhttp_identity_request(
            &self.api_origin,
            "POST",
            DESKTOP_SIGN_OUT_PATH,
            Some(credential),
            None,
        )?;
        if matches!(response.status, 204 | 401 | 403) {
            Ok(())
        } else {
            Err(DesktopIdentityError::AuthorizationUnavailable)
        }
    }
}

struct IdentityApiResponse {
    status: u16,
    body: Vec<u8>,
}

#[cfg(target_os = "windows")]
fn winhttp_identity_request(
    origin: &HttpsOrigin,
    method: &str,
    path: &str,
    credential: Option<&str>,
    body: Option<&[u8]>,
) -> Result<IdentityApiResponse, DesktopIdentityError> {
    use std::{ffi::c_void, ptr};
    use windows::{
        Win32::Networking::WinHttp::{
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_FLAG_SECURE, WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_QUERY_STATUS_CODE, WinHttpCloseHandle, WinHttpConnect, WinHttpOpen,
            WinHttpOpenRequest, WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse,
            WinHttpSendRequest, WinHttpSetTimeouts,
        },
        core::{HSTRING, PCWSTR},
    };

    struct InternetHandle(*mut c_void);
    impl Drop for InternetHandle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                // SAFETY: The handle was returned by WinHTTP and is closed exactly once here.
                let _ = unsafe { WinHttpCloseHandle(self.0) };
            }
        }
    }

    let user_agent = HSTRING::from("LiiiraaBoost/1.0");
    let host = HSTRING::from(origin.host.as_str());
    let method = HSTRING::from(method);
    let path = HSTRING::from(path);
    // SAFETY: Inputs are owned UTF-16 strings, handles are checked, and all buffers remain alive
    // for each synchronous WinHTTP call.
    unsafe {
        let session = InternetHandle(WinHttpOpen(
            &user_agent,
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
            PCWSTR::null(),
            PCWSTR::null(),
            0,
        ));
        if session.0.is_null() {
            return Err(DesktopIdentityError::AuthorizationUnavailable);
        }
        WinHttpSetTimeouts(session.0, 5_000, 5_000, 5_000, 10_000)
            .map_err(|_| DesktopIdentityError::AuthorizationUnavailable)?;
        let connection = InternetHandle(WinHttpConnect(session.0, &host, origin.port, 0));
        if connection.0.is_null() {
            return Err(DesktopIdentityError::AuthorizationUnavailable);
        }
        let request = InternetHandle(WinHttpOpenRequest(
            connection.0,
            &method,
            &path,
            PCWSTR::null(),
            PCWSTR::null(),
            ptr::null(),
            WINHTTP_FLAG_SECURE,
        ));
        if request.0.is_null() {
            return Err(DesktopIdentityError::AuthorizationUnavailable);
        }
        let mut headers = "Accept: application/json\r\n".to_owned();
        if let Some(credential) = credential {
            headers.push_str(&format!("Authorization: {} {credential}\r\n", "Bearer"));
        }
        if body.is_some() {
            headers.push_str("Content-Type: application/json\r\n");
        }
        let headers: Vec<u16> = headers.encode_utf16().collect();
        let body_pointer = body.map(|bytes| bytes.as_ptr().cast::<c_void>());
        let body_length = body.map_or(0, |bytes| bytes.len() as u32);
        WinHttpSendRequest(
            request.0,
            Some(&headers),
            body_pointer,
            body_length,
            body_length,
            0,
        )
        .and_then(|()| WinHttpReceiveResponse(request.0, ptr::null_mut()))
        .map_err(|_| DesktopIdentityError::AuthorizationUnavailable)?;

        let mut status = 0_u32;
        let mut status_length = std::mem::size_of::<u32>() as u32;
        let mut header_index = 0_u32;
        WinHttpQueryHeaders(
            request.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            PCWSTR::null(),
            Some((&mut status as *mut u32).cast()),
            &mut status_length,
            &mut header_index,
        )
        .map_err(|_| DesktopIdentityError::AuthorizationUnavailable)?;

        let mut response_body = Vec::new();
        loop {
            let mut chunk = [0_u8; 8_192];
            let mut read = 0_u32;
            WinHttpReadData(
                request.0,
                chunk.as_mut_ptr().cast(),
                chunk.len() as u32,
                &mut read,
            )
            .map_err(|_| DesktopIdentityError::AuthorizationUnavailable)?;
            if read == 0 {
                break;
            }
            if response_body.len() + read as usize > MAXIMUM_IDENTITY_RESPONSE_BYTES {
                return Err(DesktopIdentityError::InvalidExchangeResponse);
            }
            response_body.extend_from_slice(&chunk[..read as usize]);
        }
        Ok(IdentityApiResponse {
            status: status as u16,
            body: response_body,
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn winhttp_identity_request(
    _origin: &HttpsOrigin,
    _method: &str,
    _path: &str,
    _credential: Option<&str>,
    _body: Option<&[u8]>,
) -> Result<IdentityApiResponse, DesktopIdentityError> {
    Err(DesktopIdentityError::AuthorizationUnavailable)
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
