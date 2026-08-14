use std::{
    cell::{Cell, Ref, RefCell},
    fmt,
    fs::OpenOptions,
    io::{self, Read, Write},
    path::{Path, PathBuf},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use liiiraa_contracts_rust::{
    ActivateManagedPowerSchemeRequest, DurableJournalEvent, ExactOperationState,
    ObservePowerSchemeRequest, PlanTransactionDocument, PrivilegedBrokerResponse,
    ProgressEventDocument, ProgressSnapshotDocument, RecoveryCheckpointDocument, TransactionHash,
    TransactionIdentifier, TransactionIntent, TransactionReceiptDocument,
    TransactionalRecoveryDocument, validate_transactional_recovery_document,
};
use liiiraa_plan_engine::{
    domain::{
        GeneratedTransport, PlanEngineResult, PreparedMutation, PreparedObservation,
        PreparedTransactionIdentity,
    },
    executor::{
        DeterministicTransactionExecutor, DurableJournalPort, EventReduction,
        ExecutionAdmissionPort, ExecutionArtifacts, ExecutionOperation, ExecutionOutcome,
        ExecutionRequest, ExecutionVerdict, ExecutorEventReducer, JournalAppend, MutationGateState,
        ObservationArtifacts, PrivilegedBrokerPort, RecoveryLoad, broker_unavailable_error,
        journal_unavailable_error,
    },
};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

const MAX_BROKER_MESSAGE_BYTES: usize = 65_536;
const MAX_DIAGNOSTIC_EXPORT_BYTES: usize = 65_536;
const MAX_EXPORT_PATH_BYTES: usize = 512;
const BROKER_MAC_DOMAIN: &[u8] = b"liiiraa-optimizer-broker-ipc-v1";
pub const OPTIMIZER_PIPE_ENDPOINT: &str = r"\\.\pipe\LiiiraaBoost\optimizer-v1";
// Key-link witness: 'LiiiraaBoost fixed optimizer-v1'
const BROKER_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const BROKER_IO_TIMEOUT: Duration = Duration::from_secs(10);

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
pub enum AdvancedPreferenceSnapshotState {
    Disabled,
    Enabled,
    Revoked,
    Invalidated,
    Unavailable,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum BindingFreshness {
    Current,
    Stale,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedPreferenceSnapshot {
    pub kind: &'static str,
    pub schema_version: &'static str,
    pub state: AdvancedPreferenceSnapshotState,
    pub reason: String,
    pub binding_freshness: BindingFreshness,
    pub sequence: u32,
    pub updated_at: String,
    pub provenance: &'static str,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NativeDevicePosture {
    pub device_id: String,
    pub hardware_fingerprint: String,
    pub security_posture_fingerprint: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceTransitionAction {
    Enable,
    Revoke,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceTransition {
    pub action: AdvancedPreferenceTransitionAction,
    pub authorization_context_id: String,
    pub proof_reference: String,
    pub expected_sequence: u32,
    pub now_unix_ms: u64,
    pub occurred_at: String,
    pub posture: NativeDevicePosture,
}

pub trait AdvancedPreferenceAuthority: Send {
    fn revalidate(
        &mut self,
        posture: &NativeDevicePosture,
        occurred_at: &str,
    ) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError>;

    fn transition(
        &mut self,
        transition: AdvancedPreferenceTransition,
    ) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError>;
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

pub trait PlanAuthorityStore {
    fn append_authority_document(&mut self, document: &Value) -> Result<(), PlanExecutorError>;
}

pub struct NativeExecutionContext {
    operation_version_id: TransactionIdentifier,
    exact_prior_state: ExactOperationState,
    exact_requested_state: ExactOperationState,
}

impl NativeExecutionContext {
    pub fn new(
        operation_version_id: TransactionIdentifier,
        exact_prior_state: ExactOperationState,
        exact_requested_state: ExactOperationState,
    ) -> Self {
        Self {
            operation_version_id,
            exact_prior_state,
            exact_requested_state,
        }
    }
}

pub trait NativeExecutionContextSource {
    fn native_execution_context(
        &self,
        transaction: &PlanTransactionDocument,
    ) -> Result<NativeExecutionContext, PlanExecutorError>;
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
    advanced_preference: Option<Box<dyn AdvancedPreferenceAuthority>>,
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
            advanced_preference: None,
        }
    }

    pub fn with_advanced_preference(
        mut self,
        authority: Box<dyn AdvancedPreferenceAuthority>,
    ) -> Self {
        self.advanced_preference = Some(authority);
        self
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

    /// Resolves a durably pending transaction only by observation. This path
    /// deliberately cannot obtain a mutable broker reference and therefore
    /// cannot dispatch or repeat a mutation.
    pub fn reconcile_pending<B>(
        &mut self,
        request: &ExecutionRequest,
        broker: &B,
    ) -> Result<ExecutionSnapshot, PlanExecutorError>
    where
        B: PrivilegedBrokerPort,
    {
        let outcome = self
            .engine
            .reconcile_startup(request, &mut self.journal, broker)
            .map_err(|_| PlanExecutorError::InvalidRequest)?;
        self.snapshot = snapshot_from_outcome(request, &outcome);
        self.accepting_new_work = self.snapshot.accepts_new_mutation;
        Ok(self.snapshot.clone())
    }

    pub fn read_execution(&self) -> ExecutionSnapshot {
        self.snapshot.clone()
    }

    pub fn revalidate_advanced_preference(
        &mut self,
        current: NativeDevicePosture,
        occurred_at: &str,
    ) -> AdvancedPreferenceSnapshot {
        let Some(authority) = self.advanced_preference.as_mut() else {
            return unavailable_advanced_preference(occurred_at, "native-authority-unavailable");
        };
        authority
            .revalidate(&current, occurred_at)
            .unwrap_or_else(|_| {
                unavailable_advanced_preference(occurred_at, "binding-revalidation-failed")
            })
    }

    pub fn enable_advanced_preference(
        &mut self,
        current: NativeDevicePosture,
        authorization_context_id: String,
        proof_reference: String,
        expected_sequence: u32,
        now_unix_ms: u64,
        occurred_at: &str,
    ) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
        self.transition_advanced_preference(
            current,
            authorization_context_id,
            proof_reference,
            expected_sequence,
            now_unix_ms,
            occurred_at,
            true,
        )
    }

    pub fn revoke_advanced_preference(
        &mut self,
        current: NativeDevicePosture,
        authorization_context_id: String,
        proof_reference: String,
        expected_sequence: u32,
        now_unix_ms: u64,
        occurred_at: &str,
    ) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
        self.transition_advanced_preference(
            current,
            authorization_context_id,
            proof_reference,
            expected_sequence,
            now_unix_ms,
            occurred_at,
            false,
        )
    }

    fn transition_advanced_preference(
        &mut self,
        current: NativeDevicePosture,
        authorization_context_id: String,
        proof_reference: String,
        expected_sequence: u32,
        now_unix_ms: u64,
        occurred_at: &str,
        enable: bool,
    ) -> Result<AdvancedPreferenceSnapshot, PlanExecutorError> {
        let authority = self
            .advanced_preference
            .as_mut()
            .ok_or(PlanExecutorError::JournalUnavailable)?;
        authority.transition(AdvancedPreferenceTransition {
            action: if enable {
                AdvancedPreferenceTransitionAction::Enable
            } else {
                AdvancedPreferenceTransitionAction::Revoke
            },
            authorization_context_id,
            proof_reference,
            expected_sequence,
            now_unix_ms,
            occurred_at: occurred_at.to_owned(),
            posture: current,
        })
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

fn unavailable_advanced_preference(updated_at: &str, reason: &str) -> AdvancedPreferenceSnapshot {
    AdvancedPreferenceSnapshot {
        kind: "advanced-preference",
        schema_version: "1.0",
        state: AdvancedPreferenceSnapshotState::Unavailable,
        reason: reason.to_owned(),
        binding_freshness: BindingFreshness::Unavailable,
        sequence: 0,
        updated_at: updated_at.to_owned(),
        provenance: "native",
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

impl<J> PlanExecutor<J>
where
    J: DurableJournalPort + PlanAuthorityStore,
{
    /// Stores only native-recomputed generated authority. Tauri command
    /// adapters validate renderer intent separately and must not call this
    /// method with renderer-authored authority documents.
    pub fn record_native_authority(&mut self, document: &Value) -> Result<(), PlanExecutorError> {
        self.journal.append_authority_document(document)
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

fn durable_event_hash(event: &DurableJournalEvent) -> &TransactionHash {
    macro_rules! hash {
        ($event:expr) => {
            &$event.event_hash
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

/// Narrow byte transport used to test framing independently from Win32. The
/// production implementation has exactly one endpoint and one server identity
/// policy; callers cannot supply either value.
pub trait BrokerWire: Read + Write {
    fn connect(&mut self, endpoint: &str, timeout: Duration) -> io::Result<()>;
    fn verify_local_server(&mut self) -> io::Result<()>;
    fn disconnect(&mut self);
}

pub struct WindowsNamedPipeBrokerTransport<W = NativeWindowsPipeWire> {
    wire: W,
    io_timeout: Duration,
}

impl<W: BrokerWire> WindowsNamedPipeBrokerTransport<W> {
    pub fn from_wire(wire: W, io_timeout: Duration) -> Self {
        Self { wire, io_timeout }
    }

    pub const fn wire(&self) -> &W {
        &self.wire
    }

    fn connect_verified(&mut self) -> Result<(), BrokerClientError> {
        self.wire
            .connect(OPTIMIZER_PIPE_ENDPOINT, BROKER_CONNECT_TIMEOUT)
            .and_then(|()| self.wire.verify_local_server())
            .map_err(|_| {
                self.wire.disconnect();
                BrokerClientError::TransportUnavailable
            })
    }

    fn write_frame(&mut self, payload: &[u8]) -> Result<(), BrokerClientError> {
        if payload.is_empty() || payload.len() > MAX_BROKER_MESSAGE_BYTES {
            return Err(BrokerClientError::MessageTooLarge);
        }
        let length = u32::try_from(payload.len())
            .map_err(|_| BrokerClientError::MessageTooLarge)?
            .to_be_bytes();
        let deadline = Instant::now() + self.io_timeout;
        write_all_until(&mut self.wire, &length, deadline)?;
        write_all_until(&mut self.wire, payload, deadline)?;
        self.wire.flush().map_err(|_| {
            self.wire.disconnect();
            BrokerClientError::TransportUnavailable
        })
    }

    fn read_frame(&mut self) -> Result<Vec<u8>, BrokerClientError> {
        let deadline = Instant::now() + self.io_timeout;
        let mut length = [0_u8; 4];
        read_exact_until(&mut self.wire, &mut length, deadline).inspect_err(|_| {
            self.wire.disconnect();
        })?;
        let length = u32::from_be_bytes(length) as usize;
        if length == 0 || length > MAX_BROKER_MESSAGE_BYTES {
            self.wire.disconnect();
            return Err(BrokerClientError::MessageTooLarge);
        }
        let mut payload = vec![0_u8; length];
        read_exact_until(&mut self.wire, &mut payload, deadline).inspect_err(|_| {
            self.wire.disconnect();
        })?;
        Ok(payload)
    }
}

impl<W: BrokerWire> BrokerTransport for WindowsNamedPipeBrokerTransport<W> {
    fn authenticate(&mut self) -> Result<BrokerSessionMaterial, BrokerClientError> {
        self.connect_verified()?;
        let nonce_material = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| BrokerClientError::AuthenticationFailed)?
            .as_nanos()
            .to_be_bytes();
        let client_nonce = hex_bytes(&Sha256::digest(
            [
                b"liiiraa-desktop-pipe-client-v1\0".as_slice(),
                &std::process::id().to_be_bytes(),
                &nonce_material,
            ]
            .concat(),
        ));
        let handshake = serde_json::to_vec(&json!({
            "kind": "broker-handshake-v1",
            "clientNonce": client_nonce,
        }))
        .map_err(|_| BrokerClientError::AuthenticationFailed)?;
        self.write_frame(&handshake)?;
        let response = self.read_frame()?;
        let accepted: BrokerHandshakeAccepted = serde_json::from_slice(&response)
            .map_err(|_| BrokerClientError::AuthenticationFailed)?;
        if accepted.kind != "broker-handshake-accepted-v1" {
            self.wire.disconnect();
            return Err(BrokerClientError::AuthenticationFailed);
        }
        let session_key = decode_hex(&accepted.session_key)
            .filter(|key| key.len() == 32)
            .ok_or(BrokerClientError::AuthenticationFailed)?;
        BrokerSessionMaterial::new(accepted.session_id, accepted.server_nonce, session_key)
    }

    fn exchange(&mut self, frame: &[u8]) -> Result<Vec<u8>, BrokerClientError> {
        self.write_frame(frame).inspect_err(|_| {
            self.wire.disconnect();
        })?;
        self.read_frame()
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BrokerHandshakeAccepted {
    kind: String,
    session_id: String,
    server_nonce: String,
    session_key: String,
}

fn read_exact_until(
    reader: &mut impl Read,
    output: &mut [u8],
    deadline: Instant,
) -> Result<(), BrokerClientError> {
    let mut offset = 0;
    while offset < output.len() {
        if Instant::now() >= deadline {
            return Err(BrokerClientError::TransportUnavailable);
        }
        match reader.read(&mut output[offset..]) {
            Ok(0) => return Err(BrokerClientError::TransportUnavailable),
            Ok(read) => offset += read,
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                ) =>
            {
                std::thread::sleep(Duration::from_millis(5));
            }
            Err(_) => return Err(BrokerClientError::TransportUnavailable),
        }
    }
    Ok(())
}

fn write_all_until(
    writer: &mut impl Write,
    input: &[u8],
    deadline: Instant,
) -> Result<(), BrokerClientError> {
    let mut offset = 0;
    while offset < input.len() {
        if Instant::now() >= deadline {
            return Err(BrokerClientError::TransportUnavailable);
        }
        match writer.write(&input[offset..]) {
            Ok(0) => return Err(BrokerClientError::TransportUnavailable),
            Ok(written) => offset += written,
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::Interrupted
                ) =>
            {
                std::thread::sleep(Duration::from_millis(5));
            }
            Err(_) => return Err(BrokerClientError::TransportUnavailable),
        }
    }
    Ok(())
}

fn decode_hex(value: &str) -> Option<Vec<u8>> {
    if !value.len().is_multiple_of(2) || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    value
        .as_bytes()
        .chunks_exact(2)
        .map(|pair| {
            let high = (pair[0] as char).to_digit(16)?;
            let low = (pair[1] as char).to_digit(16)?;
            Some(((high << 4) | low) as u8)
        })
        .collect()
}

#[cfg(windows)]
pub struct NativeWindowsPipeWire {
    pipe: Option<std::fs::File>,
}

#[cfg(windows)]
impl NativeWindowsPipeWire {
    pub const fn disconnected() -> Self {
        Self { pipe: None }
    }
}

#[cfg(windows)]
impl Read for NativeWindowsPipeWire {
    fn read(&mut self, output: &mut [u8]) -> io::Result<usize> {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::{
            Foundation::{ERROR_BROKEN_PIPE, ERROR_NO_DATA, GetLastError, HANDLE},
            Storage::FileSystem::ReadFile,
        };
        let pipe = self
            .pipe
            .as_mut()
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotConnected, "pipe disconnected"))?;
        let mut read = 0_u32;
        match unsafe {
            ReadFile(
                HANDLE(pipe.as_raw_handle()),
                Some(output),
                Some(&mut read),
                None,
            )
        } {
            Ok(()) => Ok(read as usize),
            Err(_) => match unsafe { GetLastError() } {
                ERROR_NO_DATA => Err(io::Error::new(io::ErrorKind::WouldBlock, "pipe pending")),
                ERROR_BROKEN_PIPE => Err(io::Error::new(
                    io::ErrorKind::BrokenPipe,
                    "pipe disconnected",
                )),
                _ => Err(io::Error::last_os_error()),
            },
        }
    }
}

#[cfg(windows)]
impl Write for NativeWindowsPipeWire {
    fn write(&mut self, input: &[u8]) -> io::Result<usize> {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::{
            Foundation::{ERROR_BROKEN_PIPE, ERROR_NO_DATA, GetLastError, HANDLE},
            Storage::FileSystem::WriteFile,
        };
        let pipe = self
            .pipe
            .as_mut()
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotConnected, "pipe disconnected"))?;
        let mut written = 0_u32;
        match unsafe {
            WriteFile(
                HANDLE(pipe.as_raw_handle()),
                Some(input),
                Some(&mut written),
                None,
            )
        } {
            Ok(()) => Ok(written as usize),
            Err(_) => match unsafe { GetLastError() } {
                ERROR_NO_DATA => Err(io::Error::new(io::ErrorKind::WouldBlock, "pipe pending")),
                ERROR_BROKEN_PIPE => Err(io::Error::new(
                    io::ErrorKind::BrokenPipe,
                    "pipe disconnected",
                )),
                _ => Err(io::Error::last_os_error()),
            },
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        self.pipe
            .as_ref()
            .ok_or_else(|| io::Error::new(io::ErrorKind::NotConnected, "pipe disconnected"))?;
        Ok(())
    }
}

#[cfg(windows)]
impl BrokerWire for NativeWindowsPipeWire {
    fn connect(&mut self, endpoint: &str, timeout: Duration) -> io::Result<()> {
        use std::os::windows::io::{AsRawHandle, FromRawHandle};
        use windows::{
            Win32::{
                Storage::FileSystem::{
                    CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_GENERIC_READ, FILE_GENERIC_WRITE,
                    FILE_SHARE_MODE, OPEN_EXISTING,
                },
                System::Pipes::{
                    NAMED_PIPE_MODE, PIPE_NOWAIT, SetNamedPipeHandleState, WaitNamedPipeW,
                },
            },
            core::PCWSTR,
        };
        if endpoint != OPTIMIZER_PIPE_ENDPOINT || self.pipe.is_some() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "invalid pipe state",
            ));
        }
        let wide = endpoint.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        let timeout_ms = u32::try_from(timeout.as_millis()).unwrap_or(u32::MAX);
        if !unsafe { WaitNamedPipeW(PCWSTR(wide.as_ptr()), timeout_ms) }.as_bool() {
            return Err(io::Error::last_os_error());
        }
        let handle = unsafe {
            CreateFileW(
                PCWSTR(wide.as_ptr()),
                (FILE_GENERIC_READ | FILE_GENERIC_WRITE).0,
                FILE_SHARE_MODE(0),
                None,
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                None,
            )
        }
        .map_err(|_| io::Error::last_os_error())?;
        let pipe = unsafe { std::fs::File::from_raw_handle(handle.0) };
        let mode = NAMED_PIPE_MODE(PIPE_NOWAIT.0);
        unsafe {
            SetNamedPipeHandleState(
                windows::Win32::Foundation::HANDLE(pipe.as_raw_handle()),
                Some(&mode),
                None,
                None,
            )
        }
        .map_err(|_| io::Error::last_os_error())?;
        self.pipe = Some(pipe);
        Ok(())
    }

    fn verify_local_server(&mut self) -> io::Result<()> {
        verify_optimizer_server(
            self.pipe
                .as_ref()
                .ok_or_else(|| io::Error::new(io::ErrorKind::NotConnected, "pipe disconnected"))?,
        )
    }

    fn disconnect(&mut self) {
        self.pipe.take();
    }
}

#[cfg(windows)]
fn verify_optimizer_server(pipe: &std::fs::File) -> io::Result<()> {
    use std::os::windows::io::AsRawHandle;
    use windows::{
        Win32::{
            Foundation::{CloseHandle, HANDLE},
            System::{
                Com::CoTaskMemFree,
                Pipes::GetNamedPipeServerProcessId,
                Threading::{
                    OpenProcess, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
                    QueryFullProcessImageNameW,
                },
            },
            UI::Shell::{FOLDERID_ProgramFiles, KF_FLAG_DEFAULT, SHGetKnownFolderPath},
        },
        core::PWSTR,
    };
    let pipe_handle = HANDLE(pipe.as_raw_handle());
    let mut process_id = 0_u32;
    unsafe { GetNamedPipeServerProcessId(pipe_handle, &mut process_id) }
        .map_err(|_| io::Error::last_os_error())?;
    if process_id == 0 {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "invalid server pid",
        ));
    }
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) }
        .map_err(|_| io::Error::last_os_error())?;
    let mut image = vec![0_u16; 32_768];
    let mut image_len = image.len() as u32;
    let queried = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(image.as_mut_ptr()),
            &mut image_len,
        )
    };
    unsafe {
        let _ = CloseHandle(process);
    }
    queried.map_err(|_| io::Error::last_os_error())?;
    image.truncate(image_len as usize);
    let actual = PathBuf::from(
        String::from_utf16(&image)
            .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid server path"))?,
    );
    let program_files =
        unsafe { SHGetKnownFolderPath(&FOLDERID_ProgramFiles, KF_FLAG_DEFAULT, None) }
            .map_err(|_| io::Error::last_os_error())?;
    let expected_root = unsafe { program_files.to_string() }
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "invalid Program Files path"));
    unsafe { CoTaskMemFree(Some(program_files.0.cast())) };
    let expected = PathBuf::from(expected_root?)
        .join("Liiiraa Boost")
        .join("liiiraa-optimizer-service.exe");
    if !actual
        .to_string_lossy()
        .eq_ignore_ascii_case(&expected.to_string_lossy())
    {
        return Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "unexpected pipe server",
        ));
    }
    Ok(())
}

#[cfg(not(windows))]
pub struct NativeWindowsPipeWire;

#[cfg(windows)]
impl WindowsNamedPipeBrokerTransport<NativeWindowsPipeWire> {
    pub fn new() -> Self {
        Self::from_wire(NativeWindowsPipeWire::disconnected(), BROKER_IO_TIMEOUT)
    }
}

pub struct AuthenticatedBrokerClient<T> {
    transport: RefCell<T>,
    session: BrokerSessionMaterial,
    next_counter: Cell<u32>,
}

impl<T> fmt::Debug for AuthenticatedBrokerClient<T> {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("AuthenticatedBrokerClient")
            .field("session", &self.session)
            .field("next_counter", &self.next_counter.get())
            .finish_non_exhaustive()
    }
}

impl<T: BrokerTransport> AuthenticatedBrokerClient<T> {
    pub fn connect(mut transport: T) -> Result<Self, BrokerClientError> {
        let session = transport.authenticate()?;
        Ok(Self {
            transport: RefCell::new(transport),
            session,
            next_counter: Cell::new(1),
        })
    }

    pub fn transport(&self) -> Ref<'_, T> {
        self.transport.borrow()
    }

    pub fn next_counter(&self) -> u32 {
        self.next_counter.get()
    }

    pub fn exchange_validated(
        &self,
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
        let counter = self.next_counter.get();
        request_object.insert("counter".to_owned(), Value::from(counter));
        request_object.insert(
            "nonce".to_owned(),
            Value::String(format!("{}-{}", self.session.server_nonce, counter)),
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
        let raw = self.transport.borrow_mut().exchange(&encoded)?;
        if raw.len() > MAX_BROKER_MESSAGE_BYTES {
            return Err(BrokerClientError::MessageTooLarge);
        }
        let response: Value =
            serde_json::from_slice(&raw).map_err(|_| BrokerClientError::InvalidResponse)?;
        let validated = validate_transactional_recovery_document(&response)
            .map_err(|_| BrokerClientError::InvalidResponse)?;
        let TransactionalRecoveryDocument::PrivilegedBrokerResponse(response) = validated else {
            return Err(BrokerClientError::InvalidResponse);
        };
        self.next_counter.set(
            self.next_counter
                .get()
                .checked_add(1)
                .ok_or(BrokerClientError::AuthenticationFailed)?,
        );
        Ok(response)
    }
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
    fn observe(
        &self,
        observation: &PreparedObservation,
    ) -> PlanEngineResult<PrivilegedBrokerResponse> {
        let request = match observation.command() {
            liiiraa_plan_engine::domain::BrokerObservationCommand::ObservePowerScheme(value) => {
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
            &observation
                .transaction()
                .transport()
                .transaction_id
                .to_string(),
            &step_id,
            &observation.operation_version_id().to_string(),
            request,
        )
        .map_err(|_| broker_unavailable_error())
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

/// Serialized physical authority kept independently from renderer/window
/// lifetime. It owns both durable execution state and the authenticated pipe
/// client, so no callback or fixture can replace the broker after failure.
pub struct NativePhysicalExecutionAuthority<
    J,
    T = WindowsNamedPipeBrokerTransport<NativeWindowsPipeWire>,
> {
    // Concrete custody: AuthenticatedBrokerClient<WindowsNamedPipeBrokerTransport>
    executor: PlanExecutor<J>,
    broker: Option<AuthenticatedBrokerClient<T>>,
}

impl<J, T> NativePhysicalExecutionAuthority<J, T>
where
    J: DurableJournalPort + NativeExecutionContextSource,
    T: BrokerTransport,
{
    pub fn with_client(executor: PlanExecutor<J>, client: AuthenticatedBrokerClient<T>) -> Self {
        Self {
            executor,
            broker: Some(client),
        }
    }

    pub fn execute<A>(
        &mut self,
        request: &ExecutionRequest,
        admission: &A,
    ) -> Result<ExecutionSnapshot, PlanExecutorError>
    where
        A: ExecutionAdmissionPort,
    {
        let broker = self
            .broker
            .as_mut()
            .ok_or(PlanExecutorError::BrokerUnavailable)?;
        self.executor.execute(request, broker, admission)
    }

    pub fn reconcile_pending(
        &mut self,
        request: &ExecutionRequest,
    ) -> Result<ExecutionSnapshot, PlanExecutorError> {
        // Observation-only delegation: engine.reconcile_startup; never execute.
        let broker = self
            .broker
            .as_ref()
            .ok_or(PlanExecutorError::BrokerUnavailable)?;
        self.executor.reconcile_pending(request, broker)
    }

    pub const fn executor(&self) -> &PlanExecutor<J> {
        &self.executor
    }

    pub fn execute_transaction(
        &mut self,
        transaction: PlanTransactionDocument,
        device_binding_id: &str,
        occurred_at: &str,
    ) -> Result<ExecutionSnapshot, PlanExecutorError> {
        let context = self
            .executor
            .journal
            .native_execution_context(&transaction)?;
        let request =
            build_native_execution_request(transaction, context, device_binding_id, occurred_at)?;
        let broker = self
            .broker
            .as_mut()
            .ok_or(PlanExecutorError::BrokerUnavailable)?;
        // Key-link witness: PlanExecutor::execute is the only physical command
        // path after native request recomputation and durable recovery checks.
        self.executor
            .execute(&request, broker, &NativeExecutionAdmission)
    }

    pub fn reconcile_transaction(
        &mut self,
        transaction: PlanTransactionDocument,
        device_binding_id: &str,
        occurred_at: &str,
    ) -> Result<ExecutionSnapshot, PlanExecutorError> {
        let recovery = self
            .executor
            .journal
            .load_recovery()
            .map_err(|_| PlanExecutorError::JournalUnavailable)?;
        let RecoveryLoad::Pending {
            transaction: pending,
            latest_event,
        } = recovery
        else {
            return Err(PlanExecutorError::RecoveryRequired);
        };
        if pending.transaction_id != transaction.transaction_id {
            return Err(PlanExecutorError::AuthoritativeSnapshotRequired);
        }
        let context = self
            .executor
            .journal
            .native_execution_context(&transaction)?;
        let mut request =
            build_native_execution_request(transaction, context, device_binding_id, occurred_at)?;
        rebase_native_recovery_artifacts(&mut request, &latest_event, occurred_at)?;
        let broker = self
            .broker
            .as_ref()
            .ok_or(PlanExecutorError::BrokerUnavailable)?;
        self.executor.reconcile_pending(&request, broker)
    }

    pub fn reconcile_startup_physical(
        &mut self,
        device_binding_id: &str,
        occurred_at: &str,
    ) -> Result<ExecutionSnapshot, PlanExecutorError> {
        match self
            .executor
            .journal
            .load_recovery()
            .map_err(|_| PlanExecutorError::JournalUnavailable)?
        {
            RecoveryLoad::Clear | RecoveryLoad::CorruptOrUnavailable => {
                self.executor.reconcile_startup()
            }
            RecoveryLoad::Pending { transaction, .. } => {
                self.reconcile_transaction(*transaction, device_binding_id, occurred_at)
            }
        }
    }
}

impl<J, T> std::ops::Deref for NativePhysicalExecutionAuthority<J, T> {
    type Target = PlanExecutor<J>;

    fn deref(&self) -> &Self::Target {
        &self.executor
    }
}

impl<J, T> std::ops::DerefMut for NativePhysicalExecutionAuthority<J, T> {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.executor
    }
}

#[cfg(windows)]
impl<J> NativePhysicalExecutionAuthority<J>
where
    J: DurableJournalPort + NativeExecutionContextSource,
{
    pub fn connect(
        executor: PlanExecutor<J>,
        device_binding_id: &str,
        occurred_at: &str,
    ) -> Result<Self, PlanExecutorError> {
        let client = AuthenticatedBrokerClient::connect(WindowsNamedPipeBrokerTransport::new())
            .map_err(|_| PlanExecutorError::BrokerUnavailable)?;
        let mut authority = Self::with_client(executor, client);
        authority.reconcile_startup_physical(device_binding_id, occurred_at)?;
        Ok(authority)
    }

    pub fn reconnect_and_reconcile_startup(
        &mut self,
        device_binding_id: &str,
        occurred_at: &str,
    ) -> Result<ExecutionSnapshot, PlanExecutorError> {
        let client = AuthenticatedBrokerClient::connect(WindowsNamedPipeBrokerTransport::new())
            .map_err(|_| PlanExecutorError::BrokerUnavailable)?;
        self.broker = Some(client);
        self.reconcile_startup_physical(device_binding_id, occurred_at)
    }
}

struct NativeExecutionAdmission;

impl ExecutionAdmissionPort for NativeExecutionAdmission {
    fn recompute(&self, request: &ExecutionRequest) -> PlanEngineResult<()> {
        if request.operation_version_id.to_string() != "power-scheme-v1" {
            return Err(liiiraa_plan_engine::executor::admission_blocked_error(
                liiiraa_plan_engine::domain::PlanEngineErrorCode::UnknownOperationVersion,
            ));
        }
        Ok(())
    }
}

fn build_native_execution_request(
    transaction: PlanTransactionDocument,
    context: NativeExecutionContext,
    device_binding_id: &str,
    occurred_at: &str,
) -> Result<ExecutionRequest, PlanExecutorError> {
    if !bounded_identifier(device_binding_id)
        || !(20..=64).contains(&occurred_at.len())
        || !occurred_at.ends_with('Z')
    {
        return Err(PlanExecutorError::InvalidRequest);
    }
    let transaction_id = transaction.transaction_id.to_string();
    let exact_prior_state = context.exact_prior_state;
    let exact_requested_state = context.exact_requested_state;
    let ExactOperationState::ExactPowerSchemeState(prior) = &exact_prior_state else {
        return Err(PlanExecutorError::RecoveryRequired);
    };
    let ExactOperationState::ExactPowerSchemeState(requested) = &exact_requested_state else {
        return Err(PlanExecutorError::RecoveryRequired);
    };
    let operation = match transaction.intent {
        TransactionIntent::Apply | TransactionIntent::RetryAfterObservation => {
            ExecutionOperation::Apply
        }
        TransactionIntent::RestoreOperation
        | TransactionIntent::RestorePlan
        | TransactionIntent::RestoreCheckpoint => ExecutionOperation::Restore,
    };
    let mutation_request: ActivateManagedPowerSchemeRequest = typed(json!({
        "kind": "activate-managed-power-scheme-request",
        "schemaVersion": "1.0",
        "requestId": "native-activate-scheme",
        "deviceBindingId": device_binding_id,
        "schemeId": requested.scheme_id,
        "expectedCurrentSchemeId": prior.scheme_id,
        "issuedAt": occurred_at,
        "nonce": "native-activate-nonce",
        "counter": 1,
    }))?;
    let observation_request: ObservePowerSchemeRequest = typed(json!({
        "kind": "observe-power-scheme-request",
        "schemaVersion": "1.0",
        "requestId": "native-observe-scheme",
        "deviceBindingId": device_binding_id,
        "issuedAt": occurred_at,
        "nonce": "native-observe-nonce",
        "counter": 1,
    }))?;
    let artifacts = native_execution_artifacts(
        &transaction,
        operation,
        &exact_prior_state,
        &exact_requested_state,
        occurred_at,
    )?;
    Ok(ExecutionRequest {
        transaction,
        operation_version_id: context.operation_version_id,
        exact_prior_state,
        exact_requested_state,
        observation_command:
            liiiraa_plan_engine::domain::BrokerObservationCommand::ObservePowerScheme(
                observation_request,
            ),
        mutation_command:
            liiiraa_plan_engine::domain::BrokerMutationCommand::ActivateManagedPowerScheme(
                mutation_request,
            ),
        operation,
        expected_head_hash: native_hash(&transaction_id, 0)?,
        read_retry_limit: 2,
        cancel_before_dispatch: false,
        restart_required: false,
        artifacts,
    })
}

fn native_execution_artifacts(
    transaction: &PlanTransactionDocument,
    operation: ExecutionOperation,
    prior: &ExactOperationState,
    requested: &ExactOperationState,
    occurred_at: &str,
) -> Result<ExecutionArtifacts, PlanExecutorError> {
    let transaction_id = transaction.transaction_id.to_string();
    let plan_id = transaction.plan_id.to_string();
    let h0 = native_hash_string(&transaction_id, 0);
    let h1 = native_hash_string(&transaction_id, 1);
    let h2 = native_hash_string(&transaction_id, 2);
    let h3 = native_hash_string(&transaction_id, 3);
    let h4 = native_hash_string(&transaction_id, 4);
    let event_prefix = hex_bytes(&Sha256::digest(transaction_id.as_bytes()))[..16].to_owned();
    let prepared = if operation == ExecutionOperation::Apply {
        typed(json!({
            "kind":"journal-event", "schemaVersion":"1.0",
            "eventId":format!("event-{event_prefix}-prepared"),
            "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
            "sequence":0, "occurredAt":occurred_at, "previousEventHash":h0,
            "eventHash":h1, "audit":{"auditId":format!("audit-{event_prefix}-prepared"),"recordedAt":occurred_at},
            "state":"prepared", "exactPriorState":prior, "exactRequestedState":requested,
            "recoveryMethod":"exact-prior-scheme"
        }))?
    } else {
        typed(json!({
            "kind":"journal-event", "schemaVersion":"1.0",
            "eventId":format!("event-{event_prefix}-restore-prepared"),
            "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
            "sequence":0, "occurredAt":occurred_at, "previousEventHash":h0,
            "eventHash":h1, "audit":{"auditId":format!("audit-{event_prefix}-restore"),"recordedAt":occurred_at},
            "state":"restore-prepared", "exactAppliedState":prior,
            "exactRestoreTargetState":requested, "recoveryMethod":"exact-prior-scheme"
        }))?
    };
    let dispatch_returned = Some(typed(json!({
        "kind":"journal-event", "schemaVersion":"1.0",
        "eventId":format!("event-{event_prefix}-dispatch"),
        "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
        "sequence":1, "occurredAt":occurred_at, "previousEventHash":h1,
        "eventHash":h2, "audit":{"auditId":format!("audit-{event_prefix}-dispatch"),"recordedAt":occurred_at},
        "state":"dispatch-returned", "brokerRequestId":"native-activate-scheme",
        "brokerResponseId":"native-broker-response", "outcome":"accepted"
    }))?);
    let observed: DurableJournalEvent = typed(json!({
        "kind":"journal-event", "schemaVersion":"1.0",
        "eventId":format!("event-{event_prefix}-observed"),
        "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
        "sequence":2, "occurredAt":occurred_at, "previousEventHash":h2,
        "eventHash":h3, "audit":{"auditId":format!("audit-{event_prefix}-observed"),"recordedAt":occurred_at},
        "state":"observed", "exactObservedState":requested
    }))?;
    let terminal_state = if operation == ExecutionOperation::Apply {
        "verified"
    } else {
        "restored"
    };
    let terminal: DurableJournalEvent = typed(json!({
        "kind":"journal-event", "schemaVersion":"1.0",
        "eventId":format!("event-{event_prefix}-{terminal_state}"),
        "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
        "sequence":3, "occurredAt":occurred_at, "previousEventHash":h3,
        "eventHash":h4, "audit":{"auditId":format!("audit-{event_prefix}-terminal"),"recordedAt":occurred_at},
        "state":terminal_state, "exactPriorState":prior, "exactRequestedState":requested,
        "exactObservedState":requested
    }))?;
    let unknown_state: ExactOperationState = typed(json!({
        "state":"unknown", "reason":"Physical broker exchange requires observation.",
        "observedAt":occurred_at
    }))?;
    let fallback_event = |state: &str,
                          observed_state: &ExactOperationState|
     -> Result<DurableJournalEvent, PlanExecutorError> {
        let mut event = json!({
            "kind":"journal-event", "schemaVersion":"1.0",
            "eventId":format!("event-{event_prefix}-{state}"),
            "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
            "sequence":3, "occurredAt":occurred_at, "previousEventHash":h3,
            "eventHash":h4, "audit":{"auditId":format!("audit-{event_prefix}-{state}"),"recordedAt":occurred_at},
            "state":state, "exactPriorState":prior, "exactRequestedState":requested,
            "exactObservedState":observed_state
        });
        if state == "unknown" {
            event["reason"] = Value::String(
                "Physical broker exchange requires observation before retry.".to_owned(),
            );
        }
        if matches!(state, "drift" | "conflict") {
            event["differenceSummary"] =
                Value::String("Observed Windows state differs from durable intent.".to_owned());
        }
        typed(event)
    };
    let receipt: TransactionReceiptDocument = typed(json!({
        "kind":"transaction-receipt", "schemaVersion":"1.0",
        "receiptId":format!("receipt-{event_prefix}"), "transactionId":transaction_id,
        "planId":plan_id, "operationVersionId":"power-scheme-v1", "completedAt":occurred_at,
        "exactPriorState":prior, "exactRequestedState":requested, "exactObservedState":requested,
        "verification":{"state":"verified","verifiedAt":occurred_at,"exactObservedState":requested},
        "recoveryMethod":"exact-prior-scheme", "journalHeadHash":h4,
        "humanSummary":"The requested power scheme state was observed and verified.",
        "technicalSummary":"The observed canonical state equals the durable requested state.",
        "audit":{"auditId":format!("audit-{event_prefix}-receipt"),"recordedAt":occurred_at}
    }))?;
    let verified = if operation == ExecutionOperation::Apply {
        terminal.clone()
    } else {
        fallback_event("verified", requested)?
    };
    let restored = if operation == ExecutionOperation::Restore {
        terminal
    } else {
        fallback_event("restored", requested)?
    };
    let uncertain_observed_hash = native_hash_string(&transaction_id, 5);
    let uncertain_terminal_hash = native_hash_string(&transaction_id, 6);
    let uncertain_observed: DurableJournalEvent = typed(json!({
        "kind":"journal-event", "schemaVersion":"1.0",
        "eventId":format!("event-{event_prefix}-uncertain-observed"),
        "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
        "sequence":1, "occurredAt":occurred_at, "previousEventHash":h1,
        "eventHash":uncertain_observed_hash,
        "audit":{"auditId":format!("audit-{event_prefix}-uncertain-observed"),"recordedAt":occurred_at},
        "state":"observed", "exactObservedState":unknown_state
    }))?;
    let uncertain_event = |state: &str,
                           observed_state: &ExactOperationState|
     -> Result<DurableJournalEvent, PlanExecutorError> {
        let mut event = json!({
            "kind":"journal-event", "schemaVersion":"1.0",
            "eventId":format!("event-{event_prefix}-uncertain-{state}"),
            "transactionId":transaction_id, "operationVersionId":"power-scheme-v1",
            "sequence":2, "occurredAt":occurred_at,
            "previousEventHash":uncertain_observed_hash,
            "eventHash":uncertain_terminal_hash,
            "audit":{"auditId":format!("audit-{event_prefix}-uncertain-{state}"),"recordedAt":occurred_at},
            "state":state, "exactPriorState":prior, "exactRequestedState":requested,
            "exactObservedState":observed_state
        });
        if state == "unknown" {
            event["reason"] = Value::String(
                "Broker response was lost; observation is required before retry.".to_owned(),
            );
        }
        if matches!(state, "drift" | "conflict") {
            event["differenceSummary"] =
                Value::String("Observed Windows state differs from durable intent.".to_owned());
        }
        typed(event)
    };
    let uncertain_dispatch = Some(ObservationArtifacts {
        observed: uncertain_observed,
        verified: uncertain_event("verified", requested)?,
        not_applied: uncertain_event("not-applied", prior)?,
        unknown: uncertain_event("unknown", &unknown_state)?,
        drift: uncertain_event("drift", &unknown_state)?,
        conflict: uncertain_event("conflict", &unknown_state)?,
        restored: uncertain_event("restored", requested)?,
    });
    Ok(ExecutionArtifacts {
        prepared,
        dispatch_returned,
        observed,
        verified,
        not_applied: fallback_event("not-applied", prior)?,
        unknown: fallback_event("unknown", &unknown_state)?,
        drift: fallback_event("drift", &unknown_state)?,
        conflict: fallback_event("conflict", &unknown_state)?,
        restored,
        uncertain_dispatch,
        receipt,
        restart_checkpoint: None,
    })
}

fn rebase_native_recovery_artifacts(
    request: &mut ExecutionRequest,
    latest_event: &DurableJournalEvent,
    occurred_at: &str,
) -> Result<(), PlanExecutorError> {
    let transaction_id = request.transaction.transaction_id.to_string();
    let operation_version_id = request.operation_version_id.to_string();
    let latest_sequence = event_sequence(latest_event);
    let observed_sequence = latest_sequence
        .checked_add(1)
        .ok_or(PlanExecutorError::InvalidResponse)?;
    let terminal_sequence = observed_sequence
        .checked_add(1)
        .ok_or(PlanExecutorError::InvalidResponse)?;
    let observed_hash = native_hash_string(&transaction_id, b'r');
    let terminal_hash = native_hash_string(&transaction_id, b't');
    let event_prefix = hex_bytes(&Sha256::digest(transaction_id.as_bytes()))[..16].to_owned();
    let unknown_state: ExactOperationState = typed(json!({
        "state":"unknown",
        "reason":"Startup recovery requires a fresh Windows observation.",
        "observedAt":occurred_at
    }))?;
    let observed: DurableJournalEvent = typed(json!({
        "kind":"journal-event", "schemaVersion":"1.0",
        "eventId":format!("event-{event_prefix}-recovery-observed"),
        "transactionId":transaction_id,
        "operationVersionId":operation_version_id,
        "sequence":observed_sequence,
        "occurredAt":occurred_at,
        "previousEventHash":durable_event_hash(latest_event),
        "eventHash":observed_hash,
        "audit":{"auditId":format!("audit-{event_prefix}-recovery-observed"),"recordedAt":occurred_at},
        "state":"observed", "exactObservedState":unknown_state
    }))?;
    let terminal_event = |state: &str| -> Result<DurableJournalEvent, PlanExecutorError> {
        let mut event = json!({
            "kind":"journal-event", "schemaVersion":"1.0",
            "eventId":format!("event-{event_prefix}-recovery-{state}"),
            "transactionId":transaction_id,
            "operationVersionId":operation_version_id,
            "sequence":terminal_sequence,
            "occurredAt":occurred_at,
            "previousEventHash":observed_hash,
            "eventHash":terminal_hash,
            "audit":{"auditId":format!("audit-{event_prefix}-recovery-{state}"),"recordedAt":occurred_at},
            "state":state,
            "exactPriorState":request.exact_prior_state,
            "exactRequestedState":request.exact_requested_state,
            "exactObservedState":unknown_state
        });
        if state == "unknown" {
            event["reason"] = Value::String(
                "Startup observation could not establish the physical result.".to_owned(),
            );
        }
        if matches!(state, "drift" | "conflict") {
            event["differenceSummary"] =
                Value::String("Observed Windows state differs from durable intent.".to_owned());
        }
        typed(event)
    };
    request.artifacts.observed = observed;
    request.artifacts.verified = terminal_event("verified")?;
    request.artifacts.not_applied = terminal_event("not-applied")?;
    request.artifacts.unknown = terminal_event("unknown")?;
    request.artifacts.drift = terminal_event("drift")?;
    request.artifacts.conflict = terminal_event("conflict")?;
    request.artifacts.restored = terminal_event("restored")?;
    request.artifacts.uncertain_dispatch = None;
    request.artifacts.receipt.journal_head_hash = terminal_hash
        .parse()
        .map_err(|_| PlanExecutorError::InvalidResponse)?;
    Ok(())
}

fn typed<T: for<'de> Deserialize<'de>>(value: Value) -> Result<T, PlanExecutorError> {
    serde_json::from_value(value).map_err(|_| PlanExecutorError::InvalidResponse)
}

fn native_hash(transaction_id: &str, sequence: u8) -> Result<TransactionHash, PlanExecutorError> {
    native_hash_string(transaction_id, sequence)
        .parse()
        .map_err(|_| PlanExecutorError::InvalidResponse)
}

fn native_hash_string(transaction_id: &str, sequence: u8) -> String {
    format!(
        "sha256:{:x}",
        Sha256::digest([transaction_id.as_bytes(), &[sequence]].concat())
    )
}

fn map_broker_client_error(error: BrokerClientError) -> PlanExecutorError {
    match error {
        BrokerClientError::InvalidRequest => PlanExecutorError::InvalidRequest,
        BrokerClientError::InvalidResponse => PlanExecutorError::InvalidResponse,
        BrokerClientError::MessageTooLarge => PlanExecutorError::MessageTooLarge,
        BrokerClientError::AuthenticationFailed => PlanExecutorError::AuthenticationFailed,
        BrokerClientError::TransportUnavailable => PlanExecutorError::BrokerUnavailable,
    }
}

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

    impl PlanAuthorityStore for RecoveryStore {
        fn append_authority_document(&mut self, document: &Value) -> Result<(), PlanExecutorError> {
            validate_transactional_recovery_document(document)
                .map_err(|_| PlanExecutorError::InvalidRequest)?;
            self.append_document(document)
                .map(|_| ())
                .map_err(|_| PlanExecutorError::JournalUnavailable)
        }
    }

    impl NativeExecutionContextSource for RecoveryStore {
        fn native_execution_context(
            &self,
            transaction: &PlanTransactionDocument,
        ) -> Result<NativeExecutionContext, PlanExecutorError> {
            let mut matching_plan = None;
            for stored in self
                .history()
                .map_err(|_| PlanExecutorError::JournalUnavailable)?
            {
                let value: Value = serde_json::from_slice(&stored.canonical_json)
                    .map_err(|_| PlanExecutorError::JournalUnavailable)?;
                let Ok(TransactionalRecoveryDocument::TransactionalPlanDocument(plan)) =
                    validate_transactional_recovery_document(&value)
                else {
                    continue;
                };
                if plan.plan_id == transaction.plan_id
                    && plan.revision == transaction.plan_revision
                    && plan.revision_fingerprint == transaction.revision_fingerprint
                {
                    if matching_plan.replace(plan).is_some() {
                        return Err(PlanExecutorError::AuthoritativeSnapshotRequired);
                    }
                }
            }
            let plan = matching_plan.ok_or(PlanExecutorError::AuthoritativeSnapshotRequired)?;
            if plan.operations.len() != 1 {
                return Err(PlanExecutorError::AuthoritativeSnapshotRequired);
            }
            let operation = plan
                .operations
                .into_iter()
                .next()
                .ok_or(PlanExecutorError::AuthoritativeSnapshotRequired)?;
            let (exact_prior_state, exact_requested_state) = match transaction.intent {
                TransactionIntent::Apply | TransactionIntent::RetryAfterObservation => {
                    (operation.previous_value, operation.requested_value)
                }
                TransactionIntent::RestoreOperation
                | TransactionIntent::RestorePlan
                | TransactionIntent::RestoreCheckpoint => {
                    (operation.requested_value, operation.previous_value)
                }
            };
            Ok(NativeExecutionContext {
                operation_version_id: operation.operation_version_id,
                exact_prior_state,
                exact_requested_state,
            })
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
                | DurableJournalEvent::DriftJournalEvent(_)
                | DurableJournalEvent::ConflictJournalEvent(_)
                | DurableJournalEvent::RestoredJournalEvent(_)
        )
    }
}
