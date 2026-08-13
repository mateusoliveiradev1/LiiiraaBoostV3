use std::{
    fmt,
    fs::OpenOptions,
    io::Write,
    path::{Path, PathBuf},
};

use liiiraa_contracts_rust::{
    DurableJournalEvent, ExactOperationState, PlanTransactionDocument, PrivilegedBrokerRequest,
    PrivilegedBrokerResponse, ProgressEventDocument, ProgressSnapshotDocument,
    RecoveryCheckpointDocument, TransactionHash, TransactionReceiptDocument,
    TransactionalRecoveryDocument, validate_transactional_recovery_document,
};
use liiiraa_plan_engine::{
    domain::{
        GeneratedTransport, PlanEngineResult, PreparedMutation, PreparedObservation,
        PreparedTransactionIdentity,
    },
    executor::{
        DeterministicTransactionExecutor, DurableJournalPort, EventReduction,
        ExecutionAdmissionPort, ExecutionOutcome, ExecutionRequest, ExecutionVerdict,
        ExecutorEventReducer, JournalAppend, MutationGateState, PrivilegedBrokerPort, RecoveryLoad,
        broker_unavailable_error, journal_unavailable_error,
    },
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

const MAX_BROKER_MESSAGE_BYTES: usize = 65_536;
const MAX_DIAGNOSTIC_EXPORT_BYTES: usize = 65_536;
const MAX_EXPORT_PATH_BYTES: usize = 512;
const BROKER_MAC_DOMAIN: &[u8] = b"liiiraa-optimizer-broker-ipc-v1";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PlanExecutorError {
    InvalidRequest,
    InvalidResponse,
    MessageTooLarge,
    AuthenticationFailed,
    BrokerUnavailable,
    JournalUnavailable,
    RecoveryRequired,
    MutationInFlight,
    AuthoritativeSnapshotRequired,
    ConsentRequired,
    ExportFailed,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExecutionState {
    Idle,
    Applying,
    Recovering,
    Verified,
    Restored,
    RecoveryRequired,
    Unknown,
    Conflict,
    RestartVerificationRequired,
    JournalUnavailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionSnapshot {
    pub transaction_id: Option<String>,
    pub sequence: u32,
    pub state: ExecutionState,
    pub accepts_new_mutation: bool,
}

impl Default for ExecutionSnapshot {
    fn default() -> Self {
        Self {
            transaction_id: None,
            sequence: 0,
            state: ExecutionState::Idle,
            accepts_new_mutation: true,
        }
    }
}

pub trait RecoveryDiagnosticSource {
    fn redacted_diagnostics(&self) -> Result<Value, PlanExecutorError>;
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticPreview {
    pub fingerprint: String,
    pub canonical_json: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DiagnosticConsent {
    pub preview_fingerprint: String,
    pub approved: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticExportReceipt {
    pub preview_fingerprint: String,
    pub bytes_written: u32,
    pub path: String,
}

/// Native-owned coordinator. The renderer can disconnect without affecting
/// the pure executor, durable journal, or authoritative snapshot kept here.
pub struct PlanExecutor<J> {
    journal: J,
    engine: DeterministicTransactionExecutor,
    snapshot: ExecutionSnapshot,
    dispatch_count: u32,
    accepting_new_work: bool,
}

impl<J> PlanExecutor<J>
where
    J: DurableJournalPort,
{
    pub fn new(journal: J) -> Self {
        Self {
            journal,
            engine: DeterministicTransactionExecutor::new(),
            snapshot: ExecutionSnapshot::default(),
            dispatch_count: 0,
            accepting_new_work: true,
        }
    }

    /// Must run during Tauri setup before commands are registered. Pending or
    /// unverifiable state closes admission; it never redispatches a mutation.
    pub fn reconcile_startup(&mut self) -> Result<ExecutionSnapshot, PlanExecutorError> {
        self.snapshot = match self
            .journal
            .load_recovery()
            .map_err(|_| PlanExecutorError::JournalUnavailable)?
        {
            RecoveryLoad::Clear => ExecutionSnapshot::default(),
            RecoveryLoad::Pending {
                transaction,
                latest_event,
            } => {
                self.accepting_new_work = false;
                ExecutionSnapshot {
                    transaction_id: Some(transaction.transaction_id.to_string()),
                    sequence: event_sequence(&latest_event),
                    state: ExecutionState::RecoveryRequired,
                    accepts_new_mutation: false,
                }
            }
            RecoveryLoad::CorruptOrUnavailable => {
                self.accepting_new_work = false;
                ExecutionSnapshot {
                    state: ExecutionState::JournalUnavailable,
                    accepts_new_mutation: false,
                    ..ExecutionSnapshot::default()
                }
            }
        };
        Ok(self.snapshot.clone())
    }

    pub fn execute<B, A>(
        &mut self,
        request: &ExecutionRequest,
        broker: &mut B,
        admission: &A,
    ) -> Result<ExecutionSnapshot, PlanExecutorError>
    where
        B: PrivilegedBrokerPort,
        A: ExecutionAdmissionPort,
    {
        if !self.accepts_new_mutation() {
            return Err(PlanExecutorError::RecoveryRequired);
        }
        self.snapshot = ExecutionSnapshot {
            transaction_id: Some(request.transaction.transaction_id.to_string()),
            sequence: 0,
            state: ExecutionState::Applying,
            accepts_new_mutation: false,
        };
        let outcome = self
            .engine
            .execute(request, &mut self.journal, broker, admission)
            .map_err(|_| PlanExecutorError::InvalidRequest)?;
        self.dispatch_count = self.dispatch_count.saturating_add(outcome.dispatch_count());
        self.snapshot = snapshot_from_outcome(request, &outcome);
        self.accepting_new_work = self.snapshot.accepts_new_mutation;
        Ok(self.snapshot.clone())
    }

    pub fn read_execution(&self) -> ExecutionSnapshot {
        self.snapshot.clone()
    }

    pub fn accepts_new_mutation(&self) -> bool {
        self.accepting_new_work
            && self.snapshot.accepts_new_mutation
            && !self.engine.mutation_in_flight()
    }

    pub const fn dispatch_count(&self) -> u32 {
        self.dispatch_count
    }

    /// Preshutdown stops admission. Durable prepared state is intentionally
    /// retained for observation-first reconciliation on the next boot.
    pub fn begin_shutdown(&mut self) {
        self.accepting_new_work = false;
        self.snapshot.accepts_new_mutation = false;
    }

    pub fn reduce_progress(
        &self,
        snapshot: &ProgressSnapshotDocument,
        event: &ProgressEventDocument,
    ) -> Result<ProgressSnapshotDocument, PlanExecutorError> {
        match NativeProgressReducer
            .reduce(snapshot, event)
            .map_err(|_| PlanExecutorError::InvalidResponse)?
        {
            EventReduction::Applied(snapshot) => Ok(snapshot),
            EventReduction::AuthoritativeSnapshotRequired { .. } => {
                Err(PlanExecutorError::AuthoritativeSnapshotRequired)
            }
        }
    }
}

impl<J> PlanExecutor<J>
where
    J: DurableJournalPort + RecoveryDiagnosticSource,
{
    pub fn preview_diagnostics(&self) -> Result<DiagnosticPreview, PlanExecutorError> {
        let value = self.journal.redacted_diagnostics()?;
        let canonical = canonical_json(&value);
        if canonical.len() > MAX_DIAGNOSTIC_EXPORT_BYTES {
            return Err(PlanExecutorError::MessageTooLarge);
        }
        let fingerprint = format!("sha256:{:x}", Sha256::digest(&canonical));
        let canonical_json =
            String::from_utf8(canonical).map_err(|_| PlanExecutorError::ExportFailed)?;
        Ok(DiagnosticPreview {
            fingerprint,
            canonical_json,
        })
    }

    pub fn export_diagnostics(
        &self,
        destination: &Path,
        consent: DiagnosticConsent,
    ) -> Result<DiagnosticExportReceipt, PlanExecutorError> {
        let preview = self.preview_diagnostics()?;
        if !consent.approved || consent.preview_fingerprint != preview.fingerprint {
            return Err(PlanExecutorError::ConsentRequired);
        }
        let path = bounded_export_path(destination)?;
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&path)
            .map_err(|_| PlanExecutorError::ExportFailed)?;
        file.write_all(preview.canonical_json.as_bytes())
            .and_then(|_| file.sync_all())
            .map_err(|_| PlanExecutorError::ExportFailed)?;
        let bytes_written = u32::try_from(preview.canonical_json.len())
            .map_err(|_| PlanExecutorError::MessageTooLarge)?;
        Ok(DiagnosticExportReceipt {
            preview_fingerprint: preview.fingerprint,
            bytes_written,
            path: path.to_string_lossy().into_owned(),
        })
    }
}

fn bounded_export_path(path: &Path) -> Result<PathBuf, PlanExecutorError> {
    let rendered = path.to_string_lossy();
    if rendered.is_empty()
        || rendered.len() > MAX_EXPORT_PATH_BYTES
        || path.extension().and_then(|value| value.to_str()) != Some("json")
        || path.file_name().is_none()
    {
        return Err(PlanExecutorError::InvalidRequest);
    }
    Ok(path.to_path_buf())
}

fn snapshot_from_outcome(
    request: &ExecutionRequest,
    outcome: &ExecutionOutcome,
) -> ExecutionSnapshot {
    let state = match outcome.verdict() {
        ExecutionVerdict::Verified => ExecutionState::Verified,
        ExecutionVerdict::Restored => ExecutionState::Restored,
        ExecutionVerdict::RestartVerificationRequired => {
            ExecutionState::RestartVerificationRequired
        }
        ExecutionVerdict::Drift | ExecutionVerdict::Conflict => ExecutionState::Conflict,
        ExecutionVerdict::JournalFailure => ExecutionState::JournalUnavailable,
        ExecutionVerdict::Unknown => ExecutionState::Unknown,
        _ => ExecutionState::RecoveryRequired,
    };
    ExecutionSnapshot {
        transaction_id: Some(request.transaction.transaction_id.to_string()),
        sequence: outcome.durable_sequences().last().copied().unwrap_or(0),
        state,
        accepts_new_mutation: outcome.gate() == MutationGateState::Open,
    }
}

#[derive(Clone, Copy, Debug, Default)]
struct NativeProgressReducer;

impl ExecutorEventReducer for NativeProgressReducer {
    fn reduce(
        &self,
        snapshot: &ProgressSnapshotDocument,
        event: &ProgressEventDocument,
    ) -> PlanEngineResult<EventReduction> {
        let expected = snapshot.sequence.saturating_add(1);
        if event.transaction_id != snapshot.transaction_id
            || event.sequence != expected
            || event.previous_sequence != Some(snapshot.sequence)
        {
            return Ok(EventReduction::AuthoritativeSnapshotRequired {
                transaction_id: snapshot.transaction_id.clone(),
                expected_sequence: expected,
                received_sequence: event.sequence,
            });
        }
        let mut next = snapshot.clone();
        next.sequence = event.sequence;
        next.state = event.state;
        next.display_text = event.display_text.clone();
        next.current_operation_version_id = event.operation_version_id.clone();
        next.updated_at.clone_from(&event.occurred_at);
        if event.operation_version_id.is_some() {
            next.completed_operations = next
                .completed_operations
                .saturating_add(1)
                .min(next.total_operations);
        }
        Ok(EventReduction::Applied(next))
    }
}

fn event_sequence(event: &DurableJournalEvent) -> u32 {
    macro_rules! sequence {
        ($event:expr) => {
            $event.sequence
        };
    }
    match event {
        DurableJournalEvent::PreparedJournalEvent(value) => sequence!(value),
        DurableJournalEvent::DispatchReturnedJournalEvent(value) => sequence!(value),
        DurableJournalEvent::ObservedJournalEvent(value) => sequence!(value),
        DurableJournalEvent::VerifiedJournalEvent(value) => sequence!(value),
        DurableJournalEvent::NotAppliedJournalEvent(value) => sequence!(value),
        DurableJournalEvent::UnknownJournalEvent(value) => sequence!(value),
        DurableJournalEvent::DriftJournalEvent(value) => sequence!(value),
        DurableJournalEvent::ConflictJournalEvent(value) => sequence!(value),
        DurableJournalEvent::RestorePreparedJournalEvent(value) => sequence!(value),
        DurableJournalEvent::RestoredJournalEvent(value) => sequence!(value),
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum BrokerClientError {
    InvalidRequest,
    InvalidResponse,
    MessageTooLarge,
    AuthenticationFailed,
    TransportUnavailable,
}

pub struct BrokerSessionMaterial {
    session_id: String,
    server_nonce: String,
    session_key: Vec<u8>,
}

impl BrokerSessionMaterial {
    pub fn new(
        session_id: String,
        server_nonce: String,
        session_key: Vec<u8>,
    ) -> Result<Self, BrokerClientError> {
        if !bounded_identifier(&session_id)
            || !bounded_identifier(&server_nonce)
            || session_key.len() != 32
        {
            return Err(BrokerClientError::AuthenticationFailed);
        }
        Ok(Self {
            session_id,
            server_nonce,
            session_key,
        })
    }
}

impl Drop for BrokerSessionMaterial {
    fn drop(&mut self) {
        self.session_key.fill(0);
    }
}

impl fmt::Debug for BrokerSessionMaterial {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("BrokerSessionMaterial")
            .field("session_id", &self.session_id)
            .field("server_nonce", &"[redacted]")
            .field("session_key", &"[redacted]")
            .finish()
    }
}

pub trait BrokerTransport {
    fn authenticate(&mut self) -> Result<BrokerSessionMaterial, BrokerClientError>;
    fn exchange(&mut self, frame: &[u8]) -> Result<Vec<u8>, BrokerClientError>;
}

pub struct AuthenticatedBrokerClient<T> {
    transport: T,
    session: BrokerSessionMaterial,
    next_counter: u32,
}

impl<T> fmt::Debug for AuthenticatedBrokerClient<T> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("AuthenticatedBrokerClient")
            .field("session", &self.session)
            .field("next_counter", &self.next_counter)
            .finish_non_exhaustive()
    }
}

impl<T: BrokerTransport> AuthenticatedBrokerClient<T> {
    pub fn connect(mut transport: T) -> Result<Self, BrokerClientError> {
        let session = transport.authenticate()?;
        Ok(Self {
            transport,
            session,
            next_counter: 1,
        })
    }

    pub const fn transport(&self) -> &T {
        &self.transport
    }

    pub const fn next_counter(&self) -> u32 {
        self.next_counter
    }

    pub fn exchange_validated(
        &mut self,
        transaction_id: &str,
        step_id: &str,
        operation_version_id: &str,
        mut request: Value,
    ) -> Result<PrivilegedBrokerResponse, BrokerClientError> {
        if !bounded_identifier(transaction_id)
            || !bounded_identifier(step_id)
            || !bounded_identifier(operation_version_id)
        {
            return Err(BrokerClientError::InvalidRequest);
        }
        let request_object = request
            .as_object_mut()
            .ok_or(BrokerClientError::InvalidRequest)?;
        request_object.insert("requestId".to_owned(), Value::String(step_id.to_owned()));
        request_object.insert("counter".to_owned(), Value::from(self.next_counter));
        request_object.insert(
            "nonce".to_owned(),
            Value::String(format!(
                "{}-{}",
                self.session.server_nonce, self.next_counter
            )),
        );
        match validate_transactional_recovery_document(&request) {
            Ok(TransactionalRecoveryDocument::PrivilegedBrokerRequest(_)) => {}
            _ => return Err(BrokerClientError::InvalidRequest),
        }
        let envelope = signed_envelope(
            &self.session,
            transaction_id,
            step_id,
            operation_version_id,
            request,
        )?;
        let encoded =
            serde_json::to_vec(&envelope).map_err(|_| BrokerClientError::InvalidRequest)?;
        if encoded.len() > MAX_BROKER_MESSAGE_BYTES {
            return Err(BrokerClientError::MessageTooLarge);
        }
        let raw = self.transport.exchange(&encoded)?;
        if raw.len() > MAX_BROKER_MESSAGE_BYTES {
            return Err(BrokerClientError::MessageTooLarge);
        }
        let response: BrokerTransportResponse =
            serde_json::from_slice(&raw).map_err(|_| BrokerClientError::InvalidResponse)?;
        let validated = validate_transactional_recovery_document(&response.document)
            .map_err(|_| BrokerClientError::InvalidResponse)?;
        let TransactionalRecoveryDocument::PrivilegedBrokerResponse(response) = validated else {
            return Err(BrokerClientError::InvalidResponse);
        };
        self.next_counter = self
            .next_counter
            .checked_add(1)
            .ok_or(BrokerClientError::AuthenticationFailed)?;
        Ok(response)
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BrokerTransportResponse {
    document: Value,
}

fn signed_envelope(
    session: &BrokerSessionMaterial,
    transaction_id: &str,
    step_id: &str,
    operation_version_id: &str,
    request: Value,
) -> Result<Value, BrokerClientError> {
    let unsigned = json!({
        "transactionId": transaction_id,
        "stepId": step_id,
        "operationVersionId": operation_version_id,
        "serverNonce": session.server_nonce,
        "request": request,
    });
    let mut message = BROKER_MAC_DOMAIN.to_vec();
    let canonical = canonical_json(&unsigned);
    message.extend_from_slice(&(canonical.len() as u64).to_be_bytes());
    message.extend_from_slice(&canonical);
    let mac_hex = hex_bytes(&hmac_sha256(&session.session_key, &message));
    let mut envelope = unsigned;
    envelope["sessionId"] = Value::String(session.session_id.clone());
    envelope["macHex"] = Value::String(mac_hex);
    Ok(envelope)
}

fn bounded_identifier(value: &str) -> bool {
    (1..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b':' | b'-'))
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

fn canonical_json(value: &Value) -> Vec<u8> {
    serde_json::to_vec(&sort_json(value)).expect("JSON value serialization is infallible")
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

impl<T: BrokerTransport> PrivilegedBrokerPort for AuthenticatedBrokerClient<T> {
    fn observe(&self, _: &PreparedObservation) -> PlanEngineResult<PrivilegedBrokerResponse> {
        // The trait requires `&self`; authenticated counters and transport IO
        // require exclusive access. Execution uses `mutate` for all exchanges
        // and performs observations through an interior-synchronized transport
        // adapter in production. Fail closed if that adapter is unavailable.
        Err(broker_unavailable_error())
    }

    fn mutate(
        &mut self,
        mutation: &PreparedMutation,
    ) -> PlanEngineResult<PrivilegedBrokerResponse> {
        let request = match mutation.command() {
            liiiraa_plan_engine::domain::BrokerMutationCommand::DuplicateManagedPowerScheme(
                value,
            ) => serde_json::to_value(value),
            liiiraa_plan_engine::domain::BrokerMutationCommand::ActivateManagedPowerScheme(
                value,
            ) => serde_json::to_value(value),
            liiiraa_plan_engine::domain::BrokerMutationCommand::DeleteOwnedPowerScheme(value) => {
                serde_json::to_value(value)
            }
            liiiraa_plan_engine::domain::BrokerMutationCommand::PrepareRestorePoint(value) => {
                serde_json::to_value(value)
            }
        }
        .map_err(|_| broker_unavailable_error())?;
        let step_id = request
            .get("requestId")
            .and_then(Value::as_str)
            .ok_or_else(broker_unavailable_error)?
            .to_owned();
        self.exchange_validated(
            &mutation
                .transaction()
                .transport()
                .transaction_id
                .to_string(),
            &step_id,
            &mutation.operation_version_id().to_string(),
            request,
        )
        .map_err(|_| broker_unavailable_error())
    }
}

#[cfg(not(test))]
mod production_store_adapter {
    use super::*;
    use crate::recovery_store::{RecoveryStore, RecoveryStoreError};

    impl DurableJournalPort for RecoveryStore {
        fn append_prepared(
            &mut self,
            transaction: &PlanTransactionDocument,
            prepared_event: &DurableJournalEvent,
        ) -> PlanEngineResult<()> {
            append_validated(self, transaction)?;
            append_validated(self, prepared_event)
        }

        fn append(&mut self, append: JournalAppend<'_>) -> PlanEngineResult<TransactionHash> {
            append_validated(self, append.event)?;
            Ok(event_hash(append.event).clone())
        }

        fn store_checkpoint(
            &mut self,
            _: &PreparedTransactionIdentity,
            _: &ExactOperationState,
            checkpoint: &RecoveryCheckpointDocument,
        ) -> PlanEngineResult<()> {
            append_validated(self, checkpoint)
        }

        fn store_receipt(
            &mut self,
            _: &PreparedTransactionIdentity,
            _: &ExactOperationState,
            receipt: &TransactionReceiptDocument,
        ) -> PlanEngineResult<()> {
            append_validated(self, receipt)
        }

        fn load_recovery(&self) -> PlanEngineResult<RecoveryLoad> {
            let history = self.history().map_err(|_| journal_unavailable_error())?;
            let mut transactions = std::collections::BTreeMap::new();
            let mut latest: Option<DurableJournalEvent> = None;
            for stored in history {
                let value: Value = serde_json::from_slice(&stored.canonical_json)
                    .map_err(|_| journal_unavailable_error())?;
                match validate_transactional_recovery_document(&value)
                    .map_err(|_| journal_unavailable_error())?
                {
                    TransactionalRecoveryDocument::PlanTransactionDocument(transaction) => {
                        transactions.insert(transaction.transaction_id.to_string(), transaction);
                    }
                    TransactionalRecoveryDocument::DurableJournalEvent(event) => {
                        if latest
                            .as_ref()
                            .is_none_or(|current| event_sequence(&event) >= event_sequence(current))
                        {
                            latest = Some(event);
                        }
                    }
                    _ => {}
                }
            }
            let Some(latest) = latest else {
                return Ok(RecoveryLoad::Clear);
            };
            if event_is_terminal(&latest) {
                return Ok(RecoveryLoad::Clear);
            }
            let transaction_id = event_transaction_id(&latest);
            let Some(transaction) = transactions.remove(transaction_id) else {
                return Ok(RecoveryLoad::CorruptOrUnavailable);
            };
            Ok(RecoveryLoad::Pending {
                transaction: Box::new(transaction),
                latest_event: Box::new(latest),
            })
        }
    }

    impl RecoveryDiagnosticSource for RecoveryStore {
        fn redacted_diagnostics(&self) -> Result<Value, PlanExecutorError> {
            let export = self
                .diagnostic_export()
                .map_err(|_| PlanExecutorError::JournalUnavailable)?;
            serde_json::to_value(json!({
                "databaseId": export.database_id,
                "mutationState": format!("{:?}", export.mutation_state),
                "events": export.retained_events.into_iter().map(|event| json!({
                    "sequence": event.sequence,
                    "eventKind": event.event_kind,
                    "contentHash": event.content_hash,
                    "keyEpoch": event.key_epoch,
                    "eventMac": event.event_mac,
                })).collect::<Vec<_>>(),
            }))
            .map_err(|_| PlanExecutorError::InvalidResponse)
        }
    }

    fn append_validated(
        store: &mut RecoveryStore,
        document: &impl Serialize,
    ) -> PlanEngineResult<()> {
        let value = serde_json::to_value(document).map_err(|_| journal_unavailable_error())?;
        validate_transactional_recovery_document(&value)
            .map_err(|_| journal_unavailable_error())?;
        store
            .append_document(&value)
            .map(|_| ())
            .map_err(map_store_error)
    }

    fn map_store_error(_: RecoveryStoreError) -> liiiraa_plan_engine::domain::PlanEngineError {
        journal_unavailable_error()
    }

    fn event_hash(event: &DurableJournalEvent) -> &TransactionHash {
        macro_rules! hash {
            ($value:expr) => {
                &$value.event_hash
            };
        }
        match event {
            DurableJournalEvent::PreparedJournalEvent(value) => hash!(value),
            DurableJournalEvent::DispatchReturnedJournalEvent(value) => hash!(value),
            DurableJournalEvent::ObservedJournalEvent(value) => hash!(value),
            DurableJournalEvent::VerifiedJournalEvent(value) => hash!(value),
            DurableJournalEvent::NotAppliedJournalEvent(value) => hash!(value),
            DurableJournalEvent::UnknownJournalEvent(value) => hash!(value),
            DurableJournalEvent::DriftJournalEvent(value) => hash!(value),
            DurableJournalEvent::ConflictJournalEvent(value) => hash!(value),
            DurableJournalEvent::RestorePreparedJournalEvent(value) => hash!(value),
            DurableJournalEvent::RestoredJournalEvent(value) => hash!(value),
        }
    }

    fn event_transaction_id(event: &DurableJournalEvent) -> &str {
        macro_rules! id {
            ($value:expr) => {
                $value.transaction_id.as_ref()
            };
        }
        match event {
            DurableJournalEvent::PreparedJournalEvent(value) => id!(value),
            DurableJournalEvent::DispatchReturnedJournalEvent(value) => id!(value),
            DurableJournalEvent::ObservedJournalEvent(value) => id!(value),
            DurableJournalEvent::VerifiedJournalEvent(value) => id!(value),
            DurableJournalEvent::NotAppliedJournalEvent(value) => id!(value),
            DurableJournalEvent::UnknownJournalEvent(value) => id!(value),
            DurableJournalEvent::DriftJournalEvent(value) => id!(value),
            DurableJournalEvent::ConflictJournalEvent(value) => id!(value),
            DurableJournalEvent::RestorePreparedJournalEvent(value) => id!(value),
            DurableJournalEvent::RestoredJournalEvent(value) => id!(value),
        }
    }

    fn event_is_terminal(event: &DurableJournalEvent) -> bool {
        matches!(
            event,
            DurableJournalEvent::VerifiedJournalEvent(_)
                | DurableJournalEvent::NotAppliedJournalEvent(_)
                | DurableJournalEvent::UnknownJournalEvent(_)
                | DurableJournalEvent::DriftJournalEvent(_)
                | DurableJournalEvent::ConflictJournalEvent(_)
                | DurableJournalEvent::RestoredJournalEvent(_)
        )
    }
}
