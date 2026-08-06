use std::fmt;

use liiiraa_contracts_rust::{
    AccountCommand, AccountCommandAction, AccountProjection, AccountState, DeviceBindingProjection,
    InvoiceProjection, SessionProjection, SubscriptionProjection, SupportCaseProjection,
};
use serde::{Deserialize, Serialize};

use crate::credential_store::{CredentialStore, CredentialStoreError, WindowsCredentialStore};

pub const DESKTOP_ACCOUNT_CREDENTIAL_SLOT: &str = "desktop-account-session";
const ACCOUNT_PATH: &str = "/v1/account";
const MAXIMUM_RESPONSE_BYTES: usize = 1_048_576;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AccountSyncTrigger {
    Launch,
    Resume,
    Reconnection,
    Mutation,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AccountAuthorityState {
    Online,
    Offline,
    Stale,
    Pending,
    Conflict,
    Revoked,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountProfileDraft {
    pub display_name: String,
    pub locale: liiiraa_contracts_rust::ShellLocale,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountProfileMutation {
    pub command: AccountCommand,
    pub draft: AccountProfileDraft,
    pub local_draft_token: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountSyncRequest {
    pub trigger: AccountSyncTrigger,
    #[serde(default)]
    pub mutation: Option<AccountProfileMutation>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SecurityMethodProjection {
    pub method_id: String,
    pub factor: String,
    pub verified_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SharedAccountProjection {
    pub account: AccountProjection,
    pub provenance: AccountAuthorityState,
    pub security_methods: Vec<SecurityMethodProjection>,
    pub sessions: Vec<SessionProjection>,
    pub subscription: SubscriptionProjection,
    pub invoices: Vec<InvoiceProjection>,
    pub support_cases: Vec<SupportCaseProjection>,
    pub active_device: Option<DeviceBindingProjection>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountSyncResponse {
    pub state: AccountAuthorityState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projection: Option<SharedAccountProjection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_draft: Option<AccountProfileDraft>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AccountSyncErrorCode>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AccountSyncErrorCode {
    InvalidRequest,
    InvalidResponse,
    NativeCredentialUnavailable,
    NetworkUnavailable,
    Unauthorized,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AccountSyncError {
    InvalidRequest,
    InvalidResponse,
    NativeCredential(CredentialStoreError),
    NetworkUnavailable,
}

impl fmt::Display for AccountSyncError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidRequest => "account synchronization request was rejected",
            Self::InvalidResponse => "account synchronization response was rejected",
            Self::NativeCredential(_) => "native account credential is unavailable",
            Self::NetworkUnavailable => "account synchronization is unavailable",
        })
    }
}

impl std::error::Error for AccountSyncError {}

impl From<CredentialStoreError> for AccountSyncError {
    fn from(error: CredentialStoreError) -> Self {
        Self::NativeCredential(error)
    }
}

#[derive(Clone, Debug, Default)]
pub struct AccountSyncState {
    last_projection: Option<SharedAccountProjection>,
}

#[derive(Clone, Debug)]
pub struct AccountApiResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub trait AccountAuthorityApi {
    fn get_account(&self, credential: &str) -> Result<AccountApiResponse, AccountSyncError>;
    fn update_account(
        &self,
        credential: &str,
        mutation: &AccountProfileMutation,
    ) -> Result<AccountApiResponse, AccountSyncError>;
}

fn bounded_draft(draft: &AccountProfileDraft) -> bool {
    let display_name = draft.display_name.trim();
    (2..=40).contains(&display_name.chars().count()) && !display_name.chars().any(char::is_control)
}

fn projection_is_consistent(projection: &SharedAccountProjection) -> bool {
    let account_id = projection.account.account_id.as_str();
    if account_id.is_empty()
        || matches!(projection.account.state, AccountState::Disabled)
        || projection.security_methods.len() > 16
        || projection.sessions.len() > 16
        || projection.invoices.len() > 100
        || projection.support_cases.len() > 100
    {
        return false;
    }
    let same_owner = projection
        .sessions
        .iter()
        .all(|session| session.account_id.as_str() == account_id)
        && projection.subscription.account_id.as_str() == account_id
        && projection
            .invoices
            .iter()
            .all(|invoice| invoice.account_id.as_str() == account_id)
        && projection
            .support_cases
            .iter()
            .all(|support| support.account_id.as_str() == account_id)
        && projection
            .active_device
            .as_ref()
            .is_none_or(|device| device.account_id.as_str() == account_id);
    same_owner
        && projection.security_methods.iter().all(|method| {
            !method.method_id.is_empty()
                && method.method_id.len() <= 128
                && matches!(method.factor.as_str(), "passkey" | "totp" | "recovery-code")
        })
}

fn decode_projection(body: &[u8]) -> Result<SharedAccountProjection, AccountSyncError> {
    if body.is_empty() || body.len() > MAXIMUM_RESPONSE_BYTES {
        return Err(AccountSyncError::InvalidResponse);
    }
    let projection: SharedAccountProjection =
        serde_json::from_slice(body).map_err(|_| AccountSyncError::InvalidResponse)?;
    projection_is_consistent(&projection)
        .then_some(projection)
        .ok_or(AccountSyncError::InvalidResponse)
}

fn response(
    state: AccountAuthorityState,
    projection: Option<SharedAccountProjection>,
    local_draft: Option<AccountProfileDraft>,
    error: Option<AccountSyncErrorCode>,
) -> AccountSyncResponse {
    AccountSyncResponse {
        state,
        projection,
        local_draft,
        error,
    }
}

fn degraded_response(state: &AccountSyncState, error: AccountSyncError) -> AccountSyncResponse {
    let code = match error {
        AccountSyncError::InvalidRequest => AccountSyncErrorCode::InvalidRequest,
        AccountSyncError::InvalidResponse => AccountSyncErrorCode::InvalidResponse,
        AccountSyncError::NativeCredential(_) => AccountSyncErrorCode::NativeCredentialUnavailable,
        AccountSyncError::NetworkUnavailable => AccountSyncErrorCode::NetworkUnavailable,
    };
    response(
        if state.last_projection.is_some() {
            AccountAuthorityState::Stale
        } else {
            AccountAuthorityState::Offline
        },
        state.last_projection.clone(),
        None,
        Some(code),
    )
}

fn degraded_mutation_response(
    state: &AccountSyncState,
    draft: AccountProfileDraft,
    error: AccountSyncError,
) -> AccountSyncResponse {
    let mut degraded = degraded_response(state, error);
    degraded.local_draft = Some(draft);
    degraded
}

pub fn unavailable_account_response() -> AccountSyncResponse {
    response(
        AccountAuthorityState::Offline,
        None,
        None,
        Some(AccountSyncErrorCode::NetworkUnavailable),
    )
}

pub fn sync_account_from_native(
    state: &mut AccountSyncState,
    request: AccountSyncRequest,
    api_origin: &str,
) -> AccountSyncResponse {
    let api = match WindowsAccountAuthorityApi::from_origin(api_origin) {
        Ok(api) => api,
        Err(error) => return degraded_response(state, error),
    };
    let store = WindowsCredentialStore::for_account(DESKTOP_ACCOUNT_CREDENTIAL_SLOT);
    sync_account(&store, &api, state, request)
}

fn revoked_response(
    store: &impl CredentialStore,
    state: &mut AccountSyncState,
) -> AccountSyncResponse {
    let deletion = store.delete_credential();
    state.last_projection = None;
    response(
        AccountAuthorityState::Revoked,
        None,
        None,
        Some(if deletion.is_ok() {
            AccountSyncErrorCode::Unauthorized
        } else {
            AccountSyncErrorCode::NativeCredentialUnavailable
        }),
    )
}

fn admit_projection(
    state: &mut AccountSyncState,
    api_response: AccountApiResponse,
) -> Result<AccountSyncResponse, AccountSyncError> {
    if api_response.status != 200 {
        return Err(AccountSyncError::InvalidResponse);
    }
    let projection = decode_projection(&api_response.body)?;
    let authority_state = projection.provenance;
    state.last_projection = Some(projection.clone());
    Ok(response(authority_state, Some(projection), None, None))
}

pub fn sync_account(
    store: &impl CredentialStore,
    api: &impl AccountAuthorityApi,
    state: &mut AccountSyncState,
    request: AccountSyncRequest,
) -> AccountSyncResponse {
    let credential = match store.read_credential() {
        Ok(Some(credential))
            if !credential.is_empty()
                && credential.len() <= 4_096
                && !credential.chars().any(char::is_control) =>
        {
            credential
        }
        Ok(_) => return revoked_response(store, state),
        Err(error) => return degraded_response(state, AccountSyncError::NativeCredential(error)),
    };

    if let Some(mutation) = request.mutation.as_ref() {
        let current = match state.last_projection.as_ref() {
            Some(projection) => projection,
            None => return degraded_response(state, AccountSyncError::InvalidRequest),
        };
        if request.trigger != AccountSyncTrigger::Mutation
            || mutation.command.action != AccountCommandAction::UpdateProfile
            || mutation.command.account_id.as_str() != current.account.account_id.as_str()
            || mutation.command.expected_version != current.account.aggregate_version
            || mutation.local_draft_token.is_empty()
            || mutation.local_draft_token.len() > 128
            || !bounded_draft(&mutation.draft)
        {
            return response(
                AccountAuthorityState::Conflict,
                state.last_projection.clone(),
                Some(mutation.draft.clone()),
                Some(AccountSyncErrorCode::InvalidRequest),
            );
        }

        let update = match api.update_account(&credential, mutation) {
            Ok(update) => update,
            Err(error) => {
                return degraded_mutation_response(state, mutation.draft.clone(), error);
            }
        };
        if update.status == 401 {
            return revoked_response(store, state);
        }
        if update.status == 403 {
            return degraded_mutation_response(
                state,
                mutation.draft.clone(),
                AccountSyncError::InvalidResponse,
            );
        }
        if update.status == 409 {
            return match decode_projection_from_conflict(&update.body) {
                Ok(remote) => {
                    state.last_projection = Some(remote.clone());
                    response(
                        AccountAuthorityState::Conflict,
                        Some(remote),
                        Some(mutation.draft.clone()),
                        None,
                    )
                }
                Err(error) => degraded_response(state, error),
            };
        }
        if update.status != 200 {
            return degraded_mutation_response(
                state,
                mutation.draft.clone(),
                AccountSyncError::InvalidResponse,
            );
        }
        let updated_projection = match decode_projection(&update.body) {
            Ok(projection) => projection,
            Err(error) => {
                return degraded_mutation_response(state, mutation.draft.clone(), error);
            }
        };
        if updated_projection.account.account_id.as_str() != mutation.command.account_id.as_str()
            || updated_projection.account.aggregate_version == mutation.command.expected_version
            || updated_projection.account.display_name.trim() != mutation.draft.display_name.trim()
            || updated_projection.account.locale != mutation.draft.locale
        {
            return degraded_mutation_response(
                state,
                mutation.draft.clone(),
                AccountSyncError::InvalidResponse,
            );
        }
        let authority_state = updated_projection.provenance;
        state.last_projection = Some(updated_projection.clone());
        return response(authority_state, Some(updated_projection), None, None);
    }

    match api.get_account(&credential) {
        Ok(api_response) if matches!(api_response.status, 401 | 403) => {
            revoked_response(store, state)
        }
        Ok(api_response) => admit_projection(state, api_response)
            .unwrap_or_else(|error| degraded_response(state, error)),
        Err(error) => degraded_response(state, error),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ConflictBody {
    projection: SharedAccountProjection,
}

fn decode_projection_from_conflict(
    body: &[u8],
) -> Result<SharedAccountProjection, AccountSyncError> {
    if body.is_empty() || body.len() > MAXIMUM_RESPONSE_BYTES {
        return Err(AccountSyncError::InvalidResponse);
    }
    let conflict: ConflictBody =
        serde_json::from_slice(body).map_err(|_| AccountSyncError::InvalidResponse)?;
    projection_is_consistent(&conflict.projection)
        .then_some(conflict.projection)
        .ok_or(AccountSyncError::InvalidResponse)
}

#[derive(Clone, Debug)]
pub struct WindowsAccountAuthorityApi {
    origin: HttpsOrigin,
}

#[derive(Clone, Debug)]
struct HttpsOrigin {
    host: String,
    port: u16,
}

impl WindowsAccountAuthorityApi {
    pub fn from_origin(origin: &str) -> Result<Self, AccountSyncError> {
        Ok(Self {
            origin: HttpsOrigin::parse(origin)?,
        })
    }
}

impl HttpsOrigin {
    fn parse(value: &str) -> Result<Self, AccountSyncError> {
        let authority = value
            .strip_prefix("https://")
            .ok_or(AccountSyncError::InvalidRequest)?;
        if authority.is_empty()
            || authority.contains(['/', '?', '#', '@'])
            || authority.chars().any(char::is_whitespace)
        {
            return Err(AccountSyncError::InvalidRequest);
        }
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port)) => (
                host,
                port.parse::<u16>()
                    .map_err(|_| AccountSyncError::InvalidRequest)?,
            ),
            None => (authority, 443),
        };
        if host.is_empty()
            || !host
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'-'))
        {
            return Err(AccountSyncError::InvalidRequest);
        }
        Ok(Self {
            host: host.to_owned(),
            port,
        })
    }
}

impl AccountAuthorityApi for WindowsAccountAuthorityApi {
    fn get_account(&self, credential: &str) -> Result<AccountApiResponse, AccountSyncError> {
        winhttp_request(&self.origin, "GET", credential, None, None)
    }

    fn update_account(
        &self,
        credential: &str,
        mutation: &AccountProfileMutation,
    ) -> Result<AccountApiResponse, AccountSyncError> {
        let body = serde_json::to_vec(&serde_json::json!({
            "command": mutation.command,
            "patch": {
                "displayName": mutation.draft.display_name,
                "locale": mutation.draft.locale,
            },
            "localDraftToken": mutation.local_draft_token,
        }))
        .map_err(|_| AccountSyncError::InvalidRequest)?;
        winhttp_request(
            &self.origin,
            "PATCH",
            credential,
            Some(&body),
            Some(mutation.command.expected_version.as_str()),
        )
    }
}

fn account_request_headers(
    credential: &str,
    has_body: bool,
    expected_version: Option<&str>,
) -> Result<String, AccountSyncError> {
    if credential.is_empty() || credential.len() > 4_096 || credential.chars().any(char::is_control)
    {
        return Err(AccountSyncError::InvalidRequest);
    }
    if expected_version.is_some_and(|version| {
        version.is_empty()
            || version.len() > 20
            || !version.bytes().all(|byte| byte.is_ascii_digit())
    }) {
        return Err(AccountSyncError::InvalidRequest);
    }

    let mut headers = format!("Authorization: Bearer {credential}\r\nAccept: application/json\r\n");
    if has_body {
        headers.push_str("Content-Type: application/json\r\n");
    }
    if let Some(version) = expected_version {
        headers.push_str(&format!("If-Match: \"{version}\"\r\n"));
    }
    Ok(headers)
}

#[cfg(target_os = "windows")]
fn winhttp_request(
    origin: &HttpsOrigin,
    method: &str,
    credential: &str,
    body: Option<&[u8]>,
    expected_version: Option<&str>,
) -> Result<AccountApiResponse, AccountSyncError> {
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
    let path = HSTRING::from(ACCOUNT_PATH);
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
            return Err(AccountSyncError::NetworkUnavailable);
        }
        WinHttpSetTimeouts(session.0, 5_000, 5_000, 5_000, 10_000)
            .map_err(|_| AccountSyncError::NetworkUnavailable)?;
        let connection = InternetHandle(WinHttpConnect(session.0, &host, origin.port, 0));
        if connection.0.is_null() {
            return Err(AccountSyncError::NetworkUnavailable);
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
            return Err(AccountSyncError::NetworkUnavailable);
        }
        let headers = account_request_headers(credential, body.is_some(), expected_version)?;
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
        .map_err(|_| AccountSyncError::NetworkUnavailable)?;

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
        .map_err(|_| AccountSyncError::NetworkUnavailable)?;

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
            .map_err(|_| AccountSyncError::NetworkUnavailable)?;
            if read == 0 {
                break;
            }
            if response_body.len() + read as usize > MAXIMUM_RESPONSE_BYTES {
                return Err(AccountSyncError::InvalidResponse);
            }
            response_body.extend_from_slice(&chunk[..read as usize]);
        }
        Ok(AccountApiResponse {
            status: status as u16,
            body: response_body,
        })
    }
}

#[cfg(not(target_os = "windows"))]
fn winhttp_request(
    _origin: &HttpsOrigin,
    _method: &str,
    _credential: &str,
    _body: Option<&[u8]>,
    _expected_version: Option<&str>,
) -> Result<AccountApiResponse, AccountSyncError> {
    Err(AccountSyncError::NetworkUnavailable)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{cell::RefCell, collections::VecDeque};

    #[derive(Default)]
    struct MemoryCredentialStore {
        credential: RefCell<Option<String>>,
    }

    impl CredentialStore for MemoryCredentialStore {
        fn write_rotated_credential(&self, credential: &str) -> Result<(), CredentialStoreError> {
            *self.credential.borrow_mut() = Some(credential.to_owned());
            Ok(())
        }

        fn read_credential(&self) -> Result<Option<String>, CredentialStoreError> {
            Ok(self.credential.borrow().clone())
        }

        fn delete_credential(&self) -> Result<(), CredentialStoreError> {
            *self.credential.borrow_mut() = None;
            Ok(())
        }
    }

    struct SequenceApi {
        get: RefCell<VecDeque<AccountApiResponse>>,
        update: RefCell<VecDeque<AccountApiResponse>>,
    }

    impl AccountAuthorityApi for SequenceApi {
        fn get_account(&self, _credential: &str) -> Result<AccountApiResponse, AccountSyncError> {
            self.get
                .borrow_mut()
                .pop_front()
                .ok_or(AccountSyncError::NetworkUnavailable)
        }

        fn update_account(
            &self,
            _credential: &str,
            _mutation: &AccountProfileMutation,
        ) -> Result<AccountApiResponse, AccountSyncError> {
            self.update
                .borrow_mut()
                .pop_front()
                .ok_or(AccountSyncError::NetworkUnavailable)
        }
    }

    fn projection_body(name: &str, version: &str, provenance: &str) -> Vec<u8> {
        serde_json::to_vec(&serde_json::json!({
            "account": {
                "schemaVersion": "1.0", "aggregateVersion": version,
                "etag": format!("account-account-01-v{version}"),
                "correlationId": "account-sync-test", "provenance": "postgres-authority",
                "kind": "account-projection", "accountId": "account-01", "state": "active",
                "displayName": name, "emailRedacted": "a***@example.com", "locale": "en",
                "createdAt": "2030-01-01T00:00:00.000Z", "updatedAt": "2030-01-15T00:00:00.000Z"
            },
            "provenance": provenance,
            "securityMethods": [{"methodId":"passkey-01","factor":"passkey","verifiedAt":"2030-01-15T00:00:00.000Z"}],
            "sessions": [{
                "schemaVersion":"1.0","aggregateVersion":"1","etag":"session-01-v1",
                "correlationId":"account-sync-test","provenance":"postgres-authority",
                "kind":"session-projection","sessionId":"session-01","accountId":"account-01",
                "state":"active","authenticationStrength":"passkey","scopes":["session-desktop"],
                "authenticatedAt":"2030-01-15T00:00:00.000Z","expiresAt":"2030-01-16T00:00:00.000Z",
                "lastSeenAt":"2030-01-15T00:00:00.000Z"
            }],
            "subscription": {
                "schemaVersion":"1.0","aggregateVersion":"1","etag":"subscription-01-v1",
                "correlationId":"account-sync-test","provenance":"postgres-authority",
                "kind":"subscription-projection","subscriptionId":"subscription-01","accountId":"account-01",
                "state":"active","plan":"premium","entitlements":["premium-actions"],"cancelAtPeriodEnd":false
            },
            "invoices": [], "supportCases": [],
            "activeDevice": {
                "schemaVersion":"1.0","aggregateVersion":"1","etag":"device-01-v1",
                "correlationId":"account-sync-test","provenance":"device-verified",
                "kind":"device-binding-projection","deviceBindingId":"device-01","accountId":"account-01",
                "state":"active","deviceLabel":"Astra-PC","evidenceVersion":"2"
            }
        })).expect("projection fixture serializes")
    }

    fn store() -> MemoryCredentialStore {
        MemoryCredentialStore {
            credential: RefCell::new(Some("credential-in-native-custody".to_owned())),
        }
    }

    fn profile_mutation() -> AccountProfileMutation {
        serde_json::from_value(serde_json::json!({
            "command": {
                "schemaVersion": "1.0",
                "accountId": "account-01",
                "action": "update-profile",
                "commandId": "command-profile-01",
                "correlationId": "account-sync-test",
                "expectedVersion": "7",
                "kind": "account-command",
                "requestedAt": "2030-01-15T00:00:00.000Z"
            },
            "draft": { "displayName": "Mateus Winchester", "locale": "pt-BR" },
            "localDraftToken": "draft-token-profile-01"
        }))
        .expect("valid profile mutation")
    }

    #[test]
    fn synchronizes_generated_projection_and_keeps_stale_copy_offline() {
        let store = store();
        let api = SequenceApi {
            get: RefCell::new(VecDeque::from([AccountApiResponse {
                status: 200,
                body: projection_body("Astra Player", "7", "online"),
            }])),
            update: RefCell::new(VecDeque::new()),
        };
        let mut sync_state = AccountSyncState::default();
        let online = sync_account(
            &store,
            &api,
            &mut sync_state,
            AccountSyncRequest {
                trigger: AccountSyncTrigger::Launch,
                mutation: None,
            },
        );
        assert_eq!(online.state, AccountAuthorityState::Online);
        let stale = sync_account(
            &store,
            &api,
            &mut sync_state,
            AccountSyncRequest {
                trigger: AccountSyncTrigger::Resume,
                mutation: None,
            },
        );
        assert_eq!(stale.state, AccountAuthorityState::Stale);
        assert!(stale.projection.is_some());
    }

    #[test]
    fn next_contact_revocation_deletes_only_the_native_credential() {
        let store = store();
        let api = SequenceApi {
            get: RefCell::new(VecDeque::from([AccountApiResponse {
                status: 401,
                body: Vec::new(),
            }])),
            update: RefCell::new(VecDeque::new()),
        };
        let result = sync_account(
            &store,
            &api,
            &mut AccountSyncState::default(),
            AccountSyncRequest {
                trigger: AccountSyncTrigger::Reconnection,
                mutation: None,
            },
        );
        assert_eq!(result.state, AccountAuthorityState::Revoked);
        assert_eq!(store.read_credential().expect("store available"), None);
    }

    #[test]
    fn forbidden_profile_mutation_preserves_credential_projection_and_draft() {
        let store = store();
        let api = SequenceApi {
            get: RefCell::new(VecDeque::from([AccountApiResponse {
                status: 200,
                body: projection_body("Mateus Oliveira", "7", "online"),
            }])),
            update: RefCell::new(VecDeque::from([AccountApiResponse {
                status: 403,
                body: Vec::new(),
            }])),
        };
        let mut sync_state = AccountSyncState::default();
        let _ = sync_account(
            &store,
            &api,
            &mut sync_state,
            AccountSyncRequest {
                trigger: AccountSyncTrigger::Launch,
                mutation: None,
            },
        );
        let result = sync_account(
            &store,
            &api,
            &mut sync_state,
            AccountSyncRequest {
                trigger: AccountSyncTrigger::Mutation,
                mutation: Some(profile_mutation()),
            },
        );

        assert_ne!(result.state, AccountAuthorityState::Revoked);
        assert_eq!(
            store.read_credential().expect("store available").as_deref(),
            Some("credential-in-native-custody")
        );
        assert_eq!(
            result.local_draft.expect("draft preserved").display_name,
            "Mateus Winchester"
        );
        assert_eq!(
            result
                .projection
                .expect("last projection preserved")
                .account
                .display_name
                .as_str(),
            "Mateus Oliveira"
        );
    }

    #[test]
    fn committed_profile_mutation_is_not_replaced_by_an_immediately_stale_read() {
        let store = store();
        let mut committed: serde_json::Value =
            serde_json::from_slice(&projection_body("Mateus Winchester", "8", "online"))
                .expect("committed projection fixture decodes");
        committed["account"]["locale"] = serde_json::json!("pt-BR");
        let api = SequenceApi {
            get: RefCell::new(VecDeque::from([
                AccountApiResponse {
                    status: 200,
                    body: projection_body("Mateus Oliveira", "7", "online"),
                },
                AccountApiResponse {
                    status: 200,
                    body: projection_body("Mateus Oliveira", "7", "online"),
                },
            ])),
            update: RefCell::new(VecDeque::from([AccountApiResponse {
                status: 200,
                body: serde_json::to_vec(&committed).expect("committed projection serializes"),
            }])),
        };
        let mut sync_state = AccountSyncState::default();
        let _ = sync_account(
            &store,
            &api,
            &mut sync_state,
            AccountSyncRequest {
                trigger: AccountSyncTrigger::Launch,
                mutation: None,
            },
        );

        let result = sync_account(
            &store,
            &api,
            &mut sync_state,
            AccountSyncRequest {
                trigger: AccountSyncTrigger::Mutation,
                mutation: Some(profile_mutation()),
            },
        );

        assert_eq!(result.state, AccountAuthorityState::Online);
        assert_eq!(
            result
                .projection
                .expect("committed projection returned")
                .account
                .display_name
                .as_str(),
            "Mateus Winchester"
        );
        assert_eq!(
            api.get.borrow().len(),
            1,
            "mutation must not perform a stale follow-up GET"
        );
    }

    #[test]
    fn native_patch_headers_include_the_expected_aggregate_version() {
        let headers = account_request_headers("credential-in-native-custody", true, Some("7"))
            .expect("valid native headers");

        assert!(headers.contains("If-Match: \"7\"\r\n"));
        assert!(headers.contains("Authorization: Bearer credential-in-native-custody\r\n"));
    }
}
