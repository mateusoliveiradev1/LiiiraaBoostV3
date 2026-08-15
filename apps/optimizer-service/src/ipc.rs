use std::{
    collections::HashMap,
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use liiiraa_contracts_rust::{
    PrivilegedBrokerRequest, TransactionalRecoveryDocument,
    validate_transactional_recovery_document,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use super::dedup_store::{DedupStore, FaultPoint, Reservation, ReserveRequest, StoreError};
use super::dispatcher::DispatchContext;
use super::windows_pipe::AuthenticatedClientToken;

pub const PIPE_REJECT_REMOTE_CLIENTS: u32 = 0x0000_0008;
pub const MAX_REPLAY_RETENTION_SECONDS: i64 = 180 * 24 * 60 * 60;
const MAC_DOMAIN: &[u8] = b"liiiraa-optimizer-broker-ipc-v1";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PipeSecurityPolicy {
    pub pipe_name: String,
    pub sddl: String,
    pub open_mode_flags: u32,
}

impl PipeSecurityPolicy {
    pub fn service_only(service_sid: &str) -> Self {
        Self {
            pipe_name: r"\\.\pipe\LiiiraaBoost\optimizer-v1".to_owned(),
            sddl: format!("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GRGW;;;{service_sid})(A;;GRGW;;;IU)"),
            open_mode_flags: PIPE_REJECT_REMOTE_CLIENTS,
        }
    }

    pub fn service_storage_sddl(service_sid: &str) -> String {
        format!("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;{service_sid})")
    }

    pub fn service_storage_directory_sddl(service_sid: &str) -> String {
        format!("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;{service_sid})(A;;GX;;;IU)")
    }

    pub fn service_admission_sddl(service_sid: &str) -> String {
        format!("D:P(A;;GA;;;SY)(A;;GA;;;BA)(A;;GA;;;{service_sid})(A;;GR;;;IU)")
    }
}

#[derive(Clone, Debug)]
pub struct BrokerConfig {
    pub expected_process_hash: String,
    pub service_sid: String,
    pub database_custody_verified: bool,
    pub now_unix_seconds: i64,
    pub max_message_bytes: usize,
    pub request_timeout_millis: u64,
}

#[derive(Clone, Debug)]
pub struct ClientIdentity {
    pub local_machine: bool,
    pub remote_transport: bool,
    pub impersonation_succeeded: bool,
    pub token_query_succeeded: bool,
    pub session_id: u32,
    pub logon_sid: String,
    pub process_id: u32,
    pub process_image_hash: String,
}

#[derive(Clone, Debug)]
pub struct SessionTicket {
    pub session_id: String,
    pub server_nonce: String,
    pub session_key: Vec<u8>,
    pub next_counter: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BrokerEnvelope {
    pub transaction_id: String,
    pub step_id: String,
    pub operation_version_id: String,
    pub server_nonce: String,
    pub request: Value,
    pub mac_hex: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReplyDisposition {
    Terminal,
    ObservationRequired,
}

#[derive(Clone, Debug, PartialEq)]
pub struct BrokerReply {
    pub disposition: ReplyDisposition,
    pub document: Value,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BrokerErrorCode {
    AuthenticationFailed,
    CustodyUnavailable,
    DatabaseUnavailable,
    DuplicateConflict,
    IntegrityFailure,
    InvalidMac,
    InvalidMessage,
    MessageTooLarge,
    ReplayRejected,
    ServerStopping,
    Timeout,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct BrokerError {
    pub code: BrokerErrorCode,
}

pub trait OperationDispatcher {
    fn dispatch(
        &mut self,
        request: PrivilegedBrokerRequest,
        context: &DispatchContext<'_>,
    ) -> Result<Value, BrokerError>;
}

struct SessionState {
    server_nonce: String,
    session_key: Vec<u8>,
    principal_id: String,
    interactive_session_id: u32,
    interactive_logon_sid: String,
    process_id: u32,
    process_image_hash: String,
    client_token: Option<AuthenticatedClientToken>,
}

pub struct Broker {
    config: BrokerConfig,
    install_secret: Vec<u8>,
    store: DedupStore,
    sessions: HashMap<String, SessionState>,
    session_sequence: u64,
    stopping: bool,
}

impl Broker {
    pub fn open(
        database_path: impl AsRef<Path>,
        config: BrokerConfig,
        install_secret: &[u8],
    ) -> Result<Self, BrokerError> {
        if !config.database_custody_verified
            || install_secret.len() < 16
            || config.service_sid.trim().is_empty()
        {
            return Err(error(BrokerErrorCode::CustodyUnavailable));
        }
        let store = DedupStore::open(database_path.as_ref()).map_err(map_store_error)?;
        Ok(Self {
            config,
            install_secret: install_secret.to_vec(),
            store,
            sessions: HashMap::new(),
            session_sequence: 0,
            stopping: false,
        })
    }

    #[cfg(debug_assertions)]
    pub fn authenticate_client(
        &mut self,
        identity: &ClientIdentity,
        client_nonce: &str,
    ) -> Result<SessionTicket, BrokerError> {
        self.authenticate_client_inner(identity, client_nonce, None)
    }

    pub(crate) fn authenticate_client_with_token(
        &mut self,
        identity: &ClientIdentity,
        client_nonce: &str,
        token: AuthenticatedClientToken,
    ) -> Result<SessionTicket, BrokerError> {
        if !token.is_bound_to(identity.session_id, &identity.logon_sid)
            || !token.is_interactive_client()
        {
            return Err(error(BrokerErrorCode::AuthenticationFailed));
        }
        self.authenticate_client_inner(identity, client_nonce, Some(token))
    }

    fn authenticate_client_inner(
        &mut self,
        identity: &ClientIdentity,
        client_nonce: &str,
        client_token: Option<AuthenticatedClientToken>,
    ) -> Result<SessionTicket, BrokerError> {
        if self.stopping
            || !identity.local_machine
            || identity.remote_transport
            || !identity.impersonation_succeeded
            || !identity.token_query_succeeded
            || identity.session_id == 0
            || !identity.logon_sid.starts_with("S-1-5-5-")
            || identity.process_id == 0
            || identity.process_image_hash != self.config.expected_process_hash
            || client_nonce.trim().is_empty()
        {
            return Err(error(BrokerErrorCode::AuthenticationFailed));
        }

        self.session_sequence = self.session_sequence.saturating_add(1);
        let entropy = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        let material = format!(
            "{}\0{}\0{}\0{}\0{}\0{}",
            client_nonce,
            identity.logon_sid,
            identity.session_id,
            identity.process_id,
            self.session_sequence,
            entropy
        );
        let server_nonce = hex_bytes(&hmac_sha256(&self.install_secret, material.as_bytes()));
        let session_id = hex_bytes(&hmac_sha256(
            &self.install_secret,
            format!("session\0{server_nonce}").as_bytes(),
        ));
        let session_key = hmac_sha256(
            &self.install_secret,
            format!("key\0{session_id}\0{server_nonce}").as_bytes(),
        )
        .to_vec();
        let principal_id = format!(
            "{}:{}:{}",
            identity.logon_sid, identity.session_id, identity.process_image_hash
        );
        let next_counter = self
            .store
            .next_counter(&principal_id)
            .map_err(map_store_error)?;
        self.sessions.insert(
            session_id.clone(),
            SessionState {
                server_nonce: server_nonce.clone(),
                session_key: session_key.clone(),
                principal_id,
                interactive_session_id: identity.session_id,
                interactive_logon_sid: identity.logon_sid.clone(),
                process_id: identity.process_id,
                process_image_hash: identity.process_image_hash.clone(),
                client_token,
            },
        );
        Ok(SessionTicket {
            session_id,
            server_nonce,
            session_key,
            next_counter,
        })
    }

    pub fn sign_envelope(
        ticket: &SessionTicket,
        transaction_id: &str,
        step_id: &str,
        operation_version_id: &str,
        request: Value,
    ) -> BrokerEnvelope {
        let mut envelope = BrokerEnvelope {
            transaction_id: transaction_id.to_owned(),
            step_id: step_id.to_owned(),
            operation_version_id: operation_version_id.to_owned(),
            server_nonce: ticket.server_nonce.clone(),
            request,
            mac_hex: String::new(),
        };
        envelope.mac_hex = hex_bytes(&hmac_sha256(
            &ticket.session_key,
            &canonical_envelope_bytes(&envelope),
        ));
        envelope
    }

    pub fn submit(
        &mut self,
        ticket: &SessionTicket,
        envelope: &BrokerEnvelope,
        dispatcher: &mut dyn OperationDispatcher,
        fault: FaultPoint,
    ) -> Result<BrokerReply, BrokerError> {
        self.submit_with_elapsed(ticket, envelope, dispatcher, fault, 0)
    }

    pub fn submit_with_elapsed(
        &mut self,
        ticket: &SessionTicket,
        envelope: &BrokerEnvelope,
        dispatcher: &mut dyn OperationDispatcher,
        fault: FaultPoint,
        elapsed_millis: u64,
    ) -> Result<BrokerReply, BrokerError> {
        if self.stopping {
            return Err(error(BrokerErrorCode::ServerStopping));
        }
        if elapsed_millis > self.config.request_timeout_millis {
            return Err(error(BrokerErrorCode::Timeout));
        }
        if envelope.transaction_id.trim().is_empty()
            || envelope.step_id.trim().is_empty()
            || envelope.operation_version_id.trim().is_empty()
        {
            return Err(error(BrokerErrorCode::InvalidMessage));
        }
        let encoded = serde_json::to_vec(&envelope.request)
            .map_err(|_| error(BrokerErrorCode::InvalidMessage))?;
        if encoded.len() > self.config.max_message_bytes {
            return Err(error(BrokerErrorCode::MessageTooLarge));
        }

        let session = self
            .sessions
            .get_mut(&ticket.session_id)
            .ok_or_else(|| error(BrokerErrorCode::AuthenticationFailed))?;
        if session.server_nonce != ticket.server_nonce
            || envelope.server_nonce != session.server_nonce
        {
            return Err(error(BrokerErrorCode::ReplayRejected));
        }
        if session.session_key.ct_eq(&ticket.session_key).unwrap_u8() != 1 {
            return Err(error(BrokerErrorCode::AuthenticationFailed));
        }
        let expected_mac = hmac_sha256(&session.session_key, &canonical_envelope_bytes(envelope));
        let supplied_mac =
            decode_hex_32(&envelope.mac_hex).ok_or_else(|| error(BrokerErrorCode::InvalidMac))?;
        if expected_mac.ct_eq(&supplied_mac).unwrap_u8() != 1 {
            return Err(error(BrokerErrorCode::InvalidMac));
        }

        let (request, counter, request_nonce) = validate_broker_request(
            &envelope.request,
            &envelope.transaction_id,
            &envelope.step_id,
        )?;
        let request_hash = hash_request(envelope);
        match self
            .store
            .reserve(ReserveRequest {
                transaction_id: &envelope.transaction_id,
                step_id: &envelope.step_id,
                request_hash: &request_hash,
                operation_version_id: &envelope.operation_version_id,
                principal_id: &session.principal_id,
                request_nonce: &request_nonce,
                counter,
                created_at: self.config.now_unix_seconds,
            })
            .map_err(map_store_error)?
        {
            Reservation::Terminal(document) => {
                return Ok(BrokerReply {
                    disposition: ReplyDisposition::Terminal,
                    document,
                });
            }
            Reservation::ObservationRequired => return Ok(observation_required(envelope)),
            Reservation::Conflict => return Err(error(BrokerErrorCode::DuplicateConflict)),
            Reservation::Replay => return Err(error(BrokerErrorCode::ReplayRejected)),
            Reservation::New => {}
        }
        if fault == FaultPoint::AfterReserve {
            return Err(error(BrokerErrorCode::DatabaseUnavailable));
        }

        self.store
            .mark_unknown_after_dispatch(&envelope.transaction_id, &envelope.step_id)
            .map_err(map_store_error)?;
        let context = if let Some(token) = session.client_token.as_ref() {
            DispatchContext::with_effect_lease_and_timeout(
                &envelope.transaction_id,
                &envelope.step_id,
                &envelope.operation_version_id,
                session.interactive_session_id,
                &session.interactive_logon_sid,
                session.process_id,
                &session.process_image_hash,
                Duration::from_millis(self.config.request_timeout_millis),
                token.effect_lease(),
            )
        } else {
            DispatchContext::metadata_only(
                &envelope.transaction_id,
                &envelope.step_id,
                &envelope.operation_version_id,
                session.interactive_session_id,
                &session.interactive_logon_sid,
                session.process_id,
                &session.process_image_hash,
            )
        };
        let document = dispatcher.dispatch(request, &context)?;
        if fault == FaultPoint::AfterDispatch {
            return Err(error(BrokerErrorCode::DatabaseUnavailable));
        }
        match validate_transactional_recovery_document(&document) {
            Ok(TransactionalRecoveryDocument::PrivilegedBrokerResponse(_)) => {}
            _ => return Err(error(BrokerErrorCode::InvalidMessage)),
        }
        self.store
            .record_terminal(
                &envelope.transaction_id,
                &envelope.step_id,
                &document,
                self.config.now_unix_seconds,
            )
            .map_err(map_store_error)?;
        Ok(BrokerReply {
            disposition: ReplyDisposition::Terminal,
            document,
        })
    }

    pub fn begin_preshutdown(&mut self) {
        self.stopping = true;
        self.sessions.clear();
    }

    pub(crate) fn disconnect_session(&mut self, ticket: &SessionTicket) {
        self.sessions.remove(&ticket.session_id);
    }

    pub fn prune_terminal_before(&mut self, cutoff: i64) -> Result<usize, BrokerError> {
        let horizon_cutoff = self
            .config
            .now_unix_seconds
            .saturating_sub(MAX_REPLAY_RETENTION_SECONDS);
        self.store
            .prune_terminal_before(cutoff.min(horizon_cutoff))
            .map_err(map_store_error)
    }

    pub fn retained_identity_count(&self) -> Result<usize, BrokerError> {
        self.store.count().map_err(map_store_error)
    }

    pub fn reference_for_recovery(
        &mut self,
        transaction_id: &str,
        step_id: &str,
    ) -> Result<(), BrokerError> {
        self.store
            .set_recovery_reference(transaction_id, step_id, true)
            .map_err(map_store_error)
    }
}

fn validate_broker_request(
    request: &Value,
    transaction_id: &str,
    step_id: &str,
) -> Result<(PrivilegedBrokerRequest, u32, String), BrokerError> {
    let validated = validate_transactional_recovery_document(request)
        .map_err(|_| error(BrokerErrorCode::InvalidMessage))?;
    let TransactionalRecoveryDocument::PrivilegedBrokerRequest(request) = validated else {
        return Err(error(BrokerErrorCode::InvalidMessage));
    };
    let request_json = request_value(&request);
    if request_json.get("requestId").and_then(Value::as_str) != Some(step_id) {
        return Err(error(BrokerErrorCode::InvalidMessage));
    }
    if matches!(
        request,
        PrivilegedBrokerRequest::PrepareRestorePointRequest(_)
    ) && request_json.get("transactionId").and_then(Value::as_str) != Some(transaction_id)
    {
        return Err(error(BrokerErrorCode::InvalidMessage));
    }
    let counter = request_json
        .get("counter")
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
        .ok_or_else(|| error(BrokerErrorCode::InvalidMessage))?;
    let nonce = request_json
        .get("nonce")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| error(BrokerErrorCode::InvalidMessage))?
        .to_owned();
    Ok((request, counter, nonce))
}

fn request_value(request: &PrivilegedBrokerRequest) -> Value {
    serde_json::to_value(request).expect("generated broker request serializes")
}

fn observation_required(envelope: &BrokerEnvelope) -> BrokerReply {
    BrokerReply {
        disposition: ReplyDisposition::ObservationRequired,
        document: json!({
            "kind": "broker-unavailable-response",
            "schemaVersion": "1.0",
            "responseId": format!("observation-required-{}", envelope.step_id),
            "requestId": envelope.step_id,
            "outcome": "unavailable",
            "reasonCode": "observation-required",
            "completedAt": "1970-01-01T00:00:00Z"
        }),
    }
}

fn hash_request(envelope: &BrokerEnvelope) -> String {
    let value = json!({
        "operationVersionId": envelope.operation_version_id,
        "request": envelope.request,
        "stepId": envelope.step_id,
        "transactionId": envelope.transaction_id,
    });
    hex_bytes(&Sha256::digest(canonical_json(&value)))
}

fn canonical_envelope_bytes(envelope: &BrokerEnvelope) -> Vec<u8> {
    let value = json!({
        "operationVersionId": envelope.operation_version_id,
        "request": envelope.request,
        "serverNonce": envelope.server_nonce,
        "stepId": envelope.step_id,
        "transactionId": envelope.transaction_id,
    });
    let mut message = Vec::from(MAC_DOMAIN);
    let canonical = canonical_json(&value);
    message.extend_from_slice(&(canonical.len() as u64).to_be_bytes());
    message.extend_from_slice(&canonical);
    message
}

fn canonical_json(value: &Value) -> Vec<u8> {
    serde_json::to_vec(&sort_json(value)).expect("JSON value serializes")
}

fn sort_json(value: &Value) -> Value {
    match value {
        Value::Object(input) => {
            let mut entries: Vec<_> = input.iter().collect();
            entries.sort_by_key(|(key, _)| *key);
            let mut output = Map::new();
            for (key, value) in entries {
                output.insert(key.clone(), sort_json(value));
            }
            Value::Object(output)
        }
        Value::Array(values) => Value::Array(values.iter().map(sort_json).collect()),
        other => other.clone(),
    }
}

fn hmac_sha256(key: &[u8], message: &[u8]) -> [u8; 32] {
    const BLOCK_BYTES: usize = 64;
    let mut key_block = [0_u8; BLOCK_BYTES];
    if key.len() > BLOCK_BYTES {
        key_block[..32].copy_from_slice(&Sha256::digest(key));
    } else {
        key_block[..key.len()].copy_from_slice(key);
    }
    let mut inner_pad = [0x36_u8; BLOCK_BYTES];
    let mut outer_pad = [0x5c_u8; BLOCK_BYTES];
    for index in 0..BLOCK_BYTES {
        inner_pad[index] ^= key_block[index];
        outer_pad[index] ^= key_block[index];
    }
    let mut inner = Sha256::new();
    inner.update(inner_pad);
    inner.update(message);
    let inner_hash = inner.finalize();
    let mut outer = Sha256::new();
    outer.update(outer_pad);
    outer.update(inner_hash);
    outer.finalize().into()
}

fn hex_bytes(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn decode_hex_32(value: &str) -> Option<[u8; 32]> {
    if value.len() != 64 {
        return None;
    }
    let mut output = [0_u8; 32];
    for (index, slot) in output.iter_mut().enumerate() {
        let start = index * 2;
        *slot = u8::from_str_radix(&value[start..start + 2], 16).ok()?;
    }
    Some(output)
}

fn map_store_error(store_error: StoreError) -> BrokerError {
    match store_error {
        StoreError::Integrity => error(BrokerErrorCode::IntegrityFailure),
        StoreError::Database | StoreError::Migration => error(BrokerErrorCode::DatabaseUnavailable),
    }
}

fn error(code: BrokerErrorCode) -> BrokerError {
    BrokerError { code }
}

#[cfg(windows)]
pub mod windows_pipe {
    use std::ffi::c_void;

    use windows::{
        Win32::{
            Foundation::{CloseHandle, HANDLE, HLOCAL, INVALID_HANDLE_VALUE, LocalFree},
            Security::{
                Authorization::ConvertStringSecurityDescriptorToSecurityDescriptorW,
                PSECURITY_DESCRIPTOR, SECURITY_ATTRIBUTES,
            },
            Storage::FileSystem::{FILE_FLAGS_AND_ATTRIBUTES, PIPE_ACCESS_DUPLEX},
            System::Pipes::{
                CreateNamedPipeW, NAMED_PIPE_MODE, PIPE_READMODE_MESSAGE, PIPE_TYPE_MESSAGE,
                PIPE_WAIT,
            },
        },
        core::{Error, PCWSTR, Result},
    };

    use super::PipeSecurityPolicy;

    pub struct LocalPipeServer {
        handle: HANDLE,
    }

    impl LocalPipeServer {
        pub fn create(policy: &PipeSecurityPolicy) -> Result<Self> {
            let name: Vec<u16> = policy.pipe_name.encode_utf16().chain(Some(0)).collect();
            let sddl: Vec<u16> = policy.sddl.encode_utf16().chain(Some(0)).collect();
            let mut descriptor = PSECURITY_DESCRIPTOR::default();
            unsafe {
                ConvertStringSecurityDescriptorToSecurityDescriptorW(
                    PCWSTR(sddl.as_ptr()),
                    1,
                    &mut descriptor,
                    None,
                )?;
                let attributes = SECURITY_ATTRIBUTES {
                    nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
                    lpSecurityDescriptor: descriptor.0,
                    bInheritHandle: false.into(),
                };
                let open_mode =
                    FILE_FLAGS_AND_ATTRIBUTES(PIPE_ACCESS_DUPLEX.0 | policy.open_mode_flags);
                let pipe_mode =
                    NAMED_PIPE_MODE(PIPE_TYPE_MESSAGE.0 | PIPE_READMODE_MESSAGE.0 | PIPE_WAIT.0);
                let handle = CreateNamedPipeW(
                    PCWSTR(name.as_ptr()),
                    open_mode,
                    pipe_mode,
                    1,
                    64 * 1024,
                    64 * 1024,
                    5_000,
                    Some(&attributes),
                );
                let _ = LocalFree(Some(HLOCAL(descriptor.0.cast::<c_void>())));
                if handle == INVALID_HANDLE_VALUE {
                    return Err(Error::from_thread());
                }
                Ok(Self { handle })
            }
        }
    }

    impl Drop for LocalPipeServer {
        fn drop(&mut self) {
            unsafe {
                let _ = CloseHandle(self.handle);
            }
        }
    }
}
