use std::fmt;

use serde::Deserialize;
use sha2::{Digest, Sha256};

use crate::credential_store::{CredentialStore, CredentialStoreError, WindowsCredentialStore};

pub const PLAN_PROOF_CONSUME_PATH: &str = "/v1/identity/strong-auth/plan-proof/consume";
const DESKTOP_ACCOUNT_CREDENTIAL_SLOT: &str = "desktop-account-session";
const MAXIMUM_REQUEST_BYTES: usize = 65_536;
const MAXIMUM_RESPONSE_BYTES: usize = 65_536;
const MAXIMUM_PROOF_FRESHNESS_MS: u64 = 5 * 60_000;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OperationVersion {
    pub operation_id: String,
    pub version: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceAction {
    Enable,
    Revoke,
}

impl AdvancedPreferenceAction {
    fn as_str(self) -> &'static str {
        match self {
            Self::Enable => "enable-advanced-preference",
            Self::Revoke => "revoke-advanced-preference",
        }
    }
}

#[derive(Eq, PartialEq)]
pub struct OpaqueApprovalReceipt(String);

impl OpaqueApprovalReceipt {
    pub fn from_native_response(value: String) -> Result<Self, PlanAuthError> {
        if (43..=256).contains(&value.len())
            && value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
        {
            Ok(Self(value))
        } else {
            Err(PlanAuthError::InvalidRequest)
        }
    }

    fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Debug for OpaqueApprovalReceipt {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("OpaqueApprovalReceipt([REDACTED])")
    }
}

#[derive(Debug, Eq, PartialEq)]
pub struct ApplyPlanApprovalRequest {
    pub authorization_context_id: String,
    pub device_id: String,
    pub operation_versions: Vec<OperationVersion>,
    pub plan_fingerprint: String,
    pub receipt: OpaqueApprovalReceipt,
}

#[derive(Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceApprovalRequest {
    pub action: AdvancedPreferenceAction,
    pub authorization_context_id: String,
    pub device_id: String,
    pub hardware_fingerprint: String,
    pub receipt: OpaqueApprovalReceipt,
    pub security_posture_fingerprint: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConsumedPlanApprovalProof {
    action: &'static str,
    authorization_context_id: String,
    device_id: String,
    evidence_id: String,
    expires_at_unix_ms: u64,
    target_fingerprint: String,
}

impl ConsumedPlanApprovalProof {
    pub fn action(&self) -> &str {
        self.action
    }

    pub fn evidence_id(&self) -> &str {
        &self.evidence_id
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConsumedAdvancedPreferenceProof {
    action: AdvancedPreferenceAction,
    authorization_context_id: String,
    device_id: String,
    evidence_id: String,
    expires_at_unix_ms: u64,
    target_fingerprint: String,
}

impl ConsumedAdvancedPreferenceProof {
    pub fn action(&self) -> AdvancedPreferenceAction {
        self.action
    }

    pub fn evidence_id(&self) -> &str {
        &self.evidence_id
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LocalRecoveryAdmission;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlanApprovalApiResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub trait PlanApprovalApi {
    fn consume(
        &self,
        credential: &str,
        body: &[u8],
    ) -> Result<PlanApprovalApiResponse, PlanAuthError>;
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlanAuthError {
    InvalidRequest,
    InvalidResponse,
    NativeCredentialUnavailable,
    NetworkUnavailable,
    ProofRejected,
    SignedOut,
}

impl fmt::Display for PlanAuthError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidRequest => "plan approval request was rejected",
            Self::InvalidResponse => "plan approval response was rejected",
            Self::NativeCredentialUnavailable => "native account credential is unavailable",
            Self::NetworkUnavailable => "plan approval service is unavailable",
            Self::ProofRejected => "plan approval proof was rejected",
            Self::SignedOut => "authenticated account session is required",
        })
    }
}

impl std::error::Error for PlanAuthError {}

impl From<CredentialStoreError> for PlanAuthError {
    fn from(_: CredentialStoreError) -> Self {
        Self::NativeCredentialUnavailable
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConsumedProofEnvelope {
    ok: bool,
    proof: ConsumedProofWire,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConsumedProofWire {
    kind: String,
    action: String,
    resource: String,
    authorization_context_id: String,
    evidence_id: String,
    device_id: String,
    target_fingerprint: String,
    verified_at_unix_ms: u64,
    expires_at_unix_ms: u64,
    consumed_at_unix_ms: u64,
}

fn bounded_value(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b':' | b'-'))
}

fn sorted_operation_versions(
    versions: &[OperationVersion],
) -> Result<Vec<OperationVersion>, PlanAuthError> {
    if versions.is_empty() || versions.len() > 64 {
        return Err(PlanAuthError::InvalidRequest);
    }
    let mut sorted = versions.to_vec();
    sorted.sort_by(|left, right| left.operation_id.cmp(&right.operation_id));
    if sorted
        .iter()
        .any(|version| !bounded_value(&version.operation_id) || !bounded_value(&version.version))
        || sorted
            .windows(2)
            .any(|pair| pair[0].operation_id == pair[1].operation_id)
    {
        return Err(PlanAuthError::InvalidRequest);
    }
    Ok(sorted)
}

fn target_fingerprint(parts: &[&str]) -> String {
    let mut digest = Sha256::new();
    digest.update(parts.join("|").as_bytes());
    format!("{:x}", digest.finalize())
}

fn admitted_credential(store: &impl CredentialStore) -> Result<String, PlanAuthError> {
    match store.read_credential()? {
        Some(credential)
            if !credential.is_empty()
                && credential.len() <= 4_096
                && !credential.chars().any(char::is_control) =>
        {
            Ok(credential)
        }
        _ => Err(PlanAuthError::SignedOut),
    }
}

fn consume(
    store: &impl CredentialStore,
    api: &impl PlanApprovalApi,
    mut body: Vec<u8>,
) -> Result<PlanApprovalApiResponse, PlanAuthError> {
    if body.is_empty() || body.len() > MAXIMUM_REQUEST_BYTES {
        body.fill(0);
        return Err(PlanAuthError::InvalidRequest);
    }
    let credential = admitted_credential(store)?;
    let response = api.consume(&credential, &body);
    body.fill(0);
    let response = response?;
    match response.status {
        200 => Ok(response),
        401 | 403 => Err(PlanAuthError::SignedOut),
        422 => Err(PlanAuthError::ProofRejected),
        _ => Err(PlanAuthError::InvalidResponse),
    }
}

fn decode_proof(
    response: PlanApprovalApiResponse,
    now_unix_ms: u64,
) -> Result<ConsumedProofWire, PlanAuthError> {
    if response.body.is_empty() || response.body.len() > MAXIMUM_RESPONSE_BYTES {
        return Err(PlanAuthError::InvalidResponse);
    }
    let envelope: ConsumedProofEnvelope =
        serde_json::from_slice(&response.body).map_err(|_| PlanAuthError::InvalidResponse)?;
    let proof = envelope.proof;
    if !envelope.ok
        || !bounded_value(&proof.authorization_context_id)
        || !bounded_value(&proof.device_id)
        || !bounded_value(&proof.evidence_id)
        || proof.target_fingerprint.len() != 64
        || !proof
            .target_fingerprint
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
        || proof.verified_at_unix_ms > proof.consumed_at_unix_ms
        || proof.consumed_at_unix_ms > now_unix_ms.saturating_add(30_000)
        || now_unix_ms >= proof.expires_at_unix_ms
        || proof.expires_at_unix_ms <= proof.verified_at_unix_ms
        || proof.expires_at_unix_ms - proof.verified_at_unix_ms > MAXIMUM_PROOF_FRESHNESS_MS
        || now_unix_ms.saturating_sub(proof.verified_at_unix_ms) > MAXIMUM_PROOF_FRESHNESS_MS
    {
        return Err(PlanAuthError::InvalidResponse);
    }
    Ok(proof)
}

pub fn consume_plan_approval(
    store: &impl CredentialStore,
    api: &impl PlanApprovalApi,
    request: ApplyPlanApprovalRequest,
    now_unix_ms: u64,
) -> Result<ConsumedPlanApprovalProof, PlanAuthError> {
    if !bounded_value(&request.authorization_context_id)
        || !bounded_value(&request.device_id)
        || !bounded_value(&request.plan_fingerprint)
    {
        return Err(PlanAuthError::InvalidRequest);
    }
    let operation_versions = sorted_operation_versions(&request.operation_versions)?;
    let operation_set = operation_versions
        .iter()
        .map(|version| format!("{}@{}", version.operation_id, version.version))
        .collect::<Vec<_>>()
        .join(";");
    let expected_target = target_fingerprint(&[
        "apply-transactional-plan",
        &request.device_id,
        &request.plan_fingerprint,
        &operation_set,
    ]);
    let body = serde_json::to_vec(&serde_json::json!({
        "action": "apply-transactional-plan",
        "authorizationContextId": request.authorization_context_id,
        "resource": "desktop-plan",
        "binding": {
            "kind": "transactional-plan",
            "deviceId": request.device_id,
            "planFingerprint": request.plan_fingerprint,
            "operationVersions": operation_versions.iter().map(|version| serde_json::json!({
                "operationId": version.operation_id,
                "version": version.version,
            })).collect::<Vec<_>>(),
        },
        "receipt": request.receipt.as_str(),
    }))
    .map_err(|_| PlanAuthError::InvalidRequest)?;
    let proof = decode_proof(consume(store, api, body)?, now_unix_ms)?;
    if proof.kind != "consumed-plan-approval"
        || proof.action != "apply-transactional-plan"
        || proof.resource != "desktop-plan"
        || proof.authorization_context_id != request.authorization_context_id
        || proof.device_id != request.device_id
        || proof.target_fingerprint != expected_target
    {
        return Err(PlanAuthError::InvalidResponse);
    }
    Ok(ConsumedPlanApprovalProof {
        action: "apply-transactional-plan",
        authorization_context_id: proof.authorization_context_id,
        device_id: proof.device_id,
        evidence_id: proof.evidence_id,
        expires_at_unix_ms: proof.expires_at_unix_ms,
        target_fingerprint: proof.target_fingerprint,
    })
}

pub fn consume_advanced_preference_approval(
    store: &impl CredentialStore,
    api: &impl PlanApprovalApi,
    request: AdvancedPreferenceApprovalRequest,
    now_unix_ms: u64,
) -> Result<ConsumedAdvancedPreferenceProof, PlanAuthError> {
    if !bounded_value(&request.authorization_context_id)
        || !bounded_value(&request.device_id)
        || !bounded_value(&request.hardware_fingerprint)
        || !bounded_value(&request.security_posture_fingerprint)
    {
        return Err(PlanAuthError::InvalidRequest);
    }
    let action = request.action.as_str();
    let expected_target = target_fingerprint(&[
        action,
        &request.device_id,
        &request.hardware_fingerprint,
        &request.security_posture_fingerprint,
    ]);
    let body = serde_json::to_vec(&serde_json::json!({
        "action": action,
        "authorizationContextId": request.authorization_context_id,
        "resource": "desktop-risk-preference",
        "binding": {
            "kind": "advanced-preference",
            "deviceId": request.device_id,
            "hardwareFingerprint": request.hardware_fingerprint,
            "securityPostureFingerprint": request.security_posture_fingerprint,
        },
        "receipt": request.receipt.as_str(),
    }))
    .map_err(|_| PlanAuthError::InvalidRequest)?;
    let proof = decode_proof(consume(store, api, body)?, now_unix_ms)?;
    if proof.kind != "consumed-advanced-preference"
        || proof.action != action
        || proof.resource != "desktop-risk-preference"
        || proof.authorization_context_id != request.authorization_context_id
        || proof.device_id != request.device_id
        || proof.target_fingerprint != expected_target
    {
        return Err(PlanAuthError::InvalidResponse);
    }
    Ok(ConsumedAdvancedPreferenceProof {
        action: request.action,
        authorization_context_id: proof.authorization_context_id,
        device_id: proof.device_id,
        evidence_id: proof.evidence_id,
        expires_at_unix_ms: proof.expires_at_unix_ms,
        target_fingerprint: proof.target_fingerprint,
    })
}

pub fn admit_local_recovery() -> LocalRecoveryAdmission {
    LocalRecoveryAdmission
}

#[derive(Clone, Debug)]
pub struct WindowsPlanApprovalApi {
    origin: HttpsOrigin,
}

#[derive(Clone, Debug)]
struct HttpsOrigin {
    host: String,
    port: u16,
}

impl WindowsPlanApprovalApi {
    pub fn from_origin(origin: &str) -> Result<Self, PlanAuthError> {
        Ok(Self {
            origin: HttpsOrigin::parse(origin)?,
        })
    }
}

impl HttpsOrigin {
    fn parse(value: &str) -> Result<Self, PlanAuthError> {
        let authority = value
            .strip_prefix("https://")
            .ok_or(PlanAuthError::InvalidRequest)?;
        if authority.is_empty()
            || authority.contains(['/', '?', '#', '@'])
            || authority.chars().any(char::is_whitespace)
        {
            return Err(PlanAuthError::InvalidRequest);
        }
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port)) => (
                host,
                port.parse::<u16>()
                    .map_err(|_| PlanAuthError::InvalidRequest)?,
            ),
            None => (authority, 443),
        };
        if host.is_empty()
            || !host
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-'))
        {
            return Err(PlanAuthError::InvalidRequest);
        }
        Ok(Self {
            host: host.to_owned(),
            port,
        })
    }
}

impl PlanApprovalApi for WindowsPlanApprovalApi {
    fn consume(
        &self,
        credential: &str,
        body: &[u8],
    ) -> Result<PlanApprovalApiResponse, PlanAuthError> {
        winhttp_consume(&self.origin, credential, body)
    }
}

pub fn consume_plan_approval_from_native(
    api_origin: &str,
    request: ApplyPlanApprovalRequest,
    now_unix_ms: u64,
) -> Result<ConsumedPlanApprovalProof, PlanAuthError> {
    let store = WindowsCredentialStore::for_account(DESKTOP_ACCOUNT_CREDENTIAL_SLOT);
    let api = WindowsPlanApprovalApi::from_origin(api_origin)?;
    consume_plan_approval(&store, &api, request, now_unix_ms)
}

pub fn consume_advanced_preference_approval_from_native(
    api_origin: &str,
    request: AdvancedPreferenceApprovalRequest,
    now_unix_ms: u64,
) -> Result<ConsumedAdvancedPreferenceProof, PlanAuthError> {
    let store = WindowsCredentialStore::for_account(DESKTOP_ACCOUNT_CREDENTIAL_SLOT);
    let api = WindowsPlanApprovalApi::from_origin(api_origin)?;
    consume_advanced_preference_approval(&store, &api, request, now_unix_ms)
}

#[cfg(target_os = "windows")]
fn winhttp_consume(
    origin: &HttpsOrigin,
    credential: &str,
    body: &[u8],
) -> Result<PlanApprovalApiResponse, PlanAuthError> {
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

    if credential.is_empty()
        || credential.len() > 4_096
        || credential.chars().any(char::is_control)
        || body.is_empty()
        || body.len() > MAXIMUM_REQUEST_BYTES
    {
        return Err(PlanAuthError::InvalidRequest);
    }
    let headers = format!(
        "Authorization: Bearer {credential}\r\nAccept: application/json\r\nContent-Type: application/json\r\n"
    );
    let headers: Vec<u16> = headers.encode_utf16().collect();
    let user_agent = HSTRING::from("LiiiraaBoost/1.0");
    let host = HSTRING::from(origin.host.as_str());
    let method = HSTRING::from("POST");
    let path = HSTRING::from(PLAN_PROOF_CONSUME_PATH);
    // SAFETY: Inputs are owned UTF-16 strings, handles are checked, and buffers remain alive
    // for every synchronous WinHTTP call.
    unsafe {
        let session = InternetHandle(WinHttpOpen(
            &user_agent,
            WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY,
            PCWSTR::null(),
            PCWSTR::null(),
            0,
        ));
        if session.0.is_null() {
            return Err(PlanAuthError::NetworkUnavailable);
        }
        WinHttpSetTimeouts(session.0, 5_000, 5_000, 5_000, 10_000)
            .map_err(|_| PlanAuthError::NetworkUnavailable)?;
        let connection = InternetHandle(WinHttpConnect(session.0, &host, origin.port, 0));
        if connection.0.is_null() {
            return Err(PlanAuthError::NetworkUnavailable);
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
            return Err(PlanAuthError::NetworkUnavailable);
        }
        WinHttpSendRequest(
            request.0,
            Some(&headers),
            Some(body.as_ptr().cast::<c_void>()),
            body.len() as u32,
            body.len() as u32,
            0,
        )
        .and_then(|()| WinHttpReceiveResponse(request.0, ptr::null_mut()))
        .map_err(|_| PlanAuthError::NetworkUnavailable)?;

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
        .map_err(|_| PlanAuthError::NetworkUnavailable)?;

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
            .map_err(|_| PlanAuthError::NetworkUnavailable)?;
            if read == 0 {
                break;
            }
            if response_body.len() + read as usize > MAXIMUM_RESPONSE_BYTES {
                return Err(PlanAuthError::InvalidResponse);
            }
            response_body.extend_from_slice(&chunk[..read as usize]);
        }
        Ok(PlanApprovalApiResponse {
            status: status as u16,
            body: response_body,
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn winhttp_consume(
    _origin: &HttpsOrigin,
    _credential: &str,
    _body: &[u8],
) -> Result<PlanApprovalApiResponse, PlanAuthError> {
    Err(PlanAuthError::NetworkUnavailable)
}
