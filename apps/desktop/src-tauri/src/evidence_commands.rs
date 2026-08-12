use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::comparison::{ComparisonDecision, ComparisonRequest, SessionEvidence, compare};
use crate::evidence_report::{EvidenceReportBundle, ReportError, render_report, verify_report};
use crate::hardware_inventory::{
    CollectionRequest, HardwareInventorySource, InventoryCollectionError, InventoryCollector,
};
use crate::measurement::{CaptureMetadata, CaptureSession, MeasurementError, SchedulerLimits};

const COMMAND_SCHEMA_VERSION: &str = "1.0";
const SALT_FILE_NAME: &str = "inventory-salt-v1";
const EXPORT_DIRECTORY_NAME: &str = "evidence-exports";
const MAX_FILE_NAME_BYTES: usize = 128;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CommandError {
    InvalidRequest,
    AlreadyActive,
    NotFound,
    AuthorityUnavailable,
    ComparisonRejected,
    PathRejected,
    OperationRejected,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InventoryRefreshRequest {
    pub schema_version: String,
    pub evidence_id: String,
    pub evidence_version: u32,
    pub collected_at: String,
    pub deadline_at: String,
    pub per_source_timeout_ms: u64,
    pub policy_date: u32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CaptureStartRequest {
    pub schema_version: String,
    pub session_id: String,
    pub evidence_version: u32,
    pub started_at: String,
    pub deadline_at: String,
    pub baseline_id: String,
    pub inventory_evidence_id: String,
    pub inventory_evidence_hash: String,
    pub collector_version: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CancelCaptureRequest {
    pub schema_version: String,
    pub monotonic_ns: u64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FinishCaptureRequest {
    pub schema_version: String,
    pub completed_at: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ComparisonCommandRequest {
    pub schema_version: String,
    pub comparison_id: String,
    pub before: SessionEvidence,
    pub after: SessionEvidence,
    pub compared_at: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RenderReportRequest {
    pub schema_version: String,
    pub report_id: String,
    pub comparison_id: String,
    pub generated_at: String,
    pub limitations: Vec<String>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExportFormat {
    Json,
    Html,
}

impl ExportFormat {
    const fn extension(self) -> &'static str {
        match self {
            Self::Json => "json",
            Self::Html => "html",
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ExportReportRequest {
    pub schema_version: String,
    pub report_id: String,
    pub format: ExportFormat,
    pub file_name: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CancellationReceipt {
    pub state: &'static str,
    pub latency_ms: u64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportReceipt {
    pub report_id: String,
    pub format: ExportFormat,
    pub file_name: String,
    pub stored: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceOverhead {
    pub counter_poll_ceiling_hz: u8,
    pub cancellation_budget_ms: u64,
    pub elevated: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceHealth {
    pub authority: &'static str,
    pub inventory: &'static str,
    pub capture: &'static str,
    pub comparisons: usize,
    pub reports: usize,
    pub overhead: EvidenceOverhead,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CaptureAuthorityState {
    Idle,
    Active,
    Cancelled,
}

/// The sole native authority admitted to the renderer. Raw inventory, salts,
/// capture state, comparison decisions and report bytes stay inside Rust.
pub struct EvidenceAuthority {
    export_root: PathBuf,
    stable_id_salt: Vec<u8>,
    latest_inventory: Option<Value>,
    active_capture: Option<CaptureSession>,
    active_capture_id: Option<String>,
    active_capture_document: Option<Value>,
    capture_state: CaptureAuthorityState,
    comparisons: BTreeMap<String, ComparisonDecision>,
    reports: BTreeMap<String, EvidenceReportBundle>,
}

impl EvidenceAuthority {
    pub fn new(export_root: PathBuf, stable_id_salt: Vec<u8>) -> Result<Self, CommandError> {
        if stable_id_salt.len() < 16 {
            return Err(CommandError::InvalidRequest);
        }
        fs::create_dir_all(&export_root).map_err(|_| CommandError::AuthorityUnavailable)?;
        Ok(Self {
            export_root,
            stable_id_salt,
            latest_inventory: None,
            active_capture: None,
            active_capture_id: None,
            active_capture_document: None,
            capture_state: CaptureAuthorityState::Idle,
            comparisons: BTreeMap::new(),
            reports: BTreeMap::new(),
        })
    }

    /// Opens the durable app-owned boundary. The purpose-bound salt is created
    /// locally once and is never serialized to the WebView.
    pub fn open(app_data_root: PathBuf) -> Result<Self, CommandError> {
        fs::create_dir_all(&app_data_root).map_err(|_| CommandError::AuthorityUnavailable)?;
        let salt = load_or_create_salt(&app_data_root.join(SALT_FILE_NAME))?;
        Self::new(app_data_root.join(EXPORT_DIRECTORY_NAME), salt)
    }

    pub fn refresh_inventory<S: HardwareInventorySource>(
        &mut self,
        request: InventoryRefreshRequest,
        source: S,
    ) -> Result<Value, CommandError> {
        validate_schema(&request.schema_version)?;
        let request = CollectionRequest {
            evidence_id: request.evidence_id,
            evidence_version: request.evidence_version,
            collected_at: request.collected_at,
            deadline_at: request.deadline_at,
            per_source_timeout_ms: request.per_source_timeout_ms,
            cancelled: false,
            stable_id_salt: self.stable_id_salt.clone(),
            policy_date: request.policy_date,
        };
        let collection = InventoryCollector::new(source)
            .collect(&request)
            .map_err(map_inventory_error)?;
        self.latest_inventory = Some(collection.document.clone());
        Ok(collection.document)
    }

    pub fn read_inventory(&self) -> Result<Value, CommandError> {
        self.latest_inventory.clone().ok_or(CommandError::NotFound)
    }

    pub fn start_capture(&mut self, request: CaptureStartRequest) -> Result<Value, CommandError> {
        validate_schema(&request.schema_version)?;
        if self.active_capture.is_some() {
            return if self.active_capture_id.as_deref() == Some(request.session_id.as_str()) {
                self.active_capture_document
                    .clone()
                    .ok_or(CommandError::AuthorityUnavailable)
            } else {
                Err(CommandError::AlreadyActive)
            };
        }
        let session_id = request.session_id.clone();
        let capture = CaptureSession::new(
            CaptureMetadata {
                session_id: request.session_id,
                evidence_version: request.evidence_version,
                started_at: request.started_at,
                deadline_at: request.deadline_at,
                baseline_id: request.baseline_id,
                inventory_evidence_id: request.inventory_evidence_id,
                inventory_evidence_hash: request.inventory_evidence_hash,
                collector_version: request.collector_version,
            },
            SchedulerLimits::default(),
        )
        .map_err(map_measurement_error)?;
        let document = capture
            .incomplete_document()
            .map_err(map_measurement_error)?;
        self.active_capture = Some(capture);
        self.active_capture_id = Some(session_id);
        self.active_capture_document = Some(document.clone());
        self.capture_state = CaptureAuthorityState::Active;
        Ok(document)
    }

    pub fn cancel_capture(
        &mut self,
        request: CancelCaptureRequest,
    ) -> Result<CancellationReceipt, CommandError> {
        validate_schema(&request.schema_version)?;
        let capture = self.active_capture.as_mut().ok_or(CommandError::NotFound)?;
        if capture.cancellation_latency_ms().is_none() {
            let requested = capture.request_cancel(request.monotonic_ns);
            if requested {
                capture.acknowledge_cancel(request.monotonic_ns.saturating_add(100_000_000));
            }
        }
        let latency_ms = capture
            .cancellation_latency_ms()
            .ok_or(CommandError::AuthorityUnavailable)?;
        self.capture_state = CaptureAuthorityState::Cancelled;
        Ok(CancellationReceipt {
            state: "acknowledged",
            latency_ms,
        })
    }

    pub fn finish_capture(&mut self, request: FinishCaptureRequest) -> Result<Value, CommandError> {
        validate_schema(&request.schema_version)?;
        if request.completed_at.trim().is_empty() {
            return Err(CommandError::InvalidRequest);
        }
        let capture = self.active_capture.take().ok_or(CommandError::NotFound)?;
        let result = capture
            .finalize(&request.completed_at)
            .map_err(map_measurement_error)?;
        self.active_capture_id = None;
        self.active_capture_document = None;
        self.capture_state = CaptureAuthorityState::Idle;
        Ok(result.document)
    }

    pub fn compare_measurements(
        &mut self,
        request: ComparisonCommandRequest,
    ) -> Result<Value, CommandError> {
        validate_schema(&request.schema_version)?;
        let comparison_id = request.comparison_id.clone();
        let decision = compare(&ComparisonRequest {
            comparison_id: request.comparison_id,
            before: request.before,
            after: request.after,
            compared_at: request.compared_at,
        });
        let document = decision.document.clone();
        self.comparisons.insert(comparison_id, decision);
        Ok(document)
    }

    pub fn render_report(&mut self, request: RenderReportRequest) -> Result<Value, CommandError> {
        validate_schema(&request.schema_version)?;
        let comparison = self
            .comparisons
            .get(&request.comparison_id)
            .ok_or(CommandError::NotFound)?;
        let bundle = render_report(
            comparison,
            &request.report_id,
            &request.generated_at,
            &request.limitations,
        )
        .map_err(map_report_error)?;
        verify_report(&bundle).map_err(|_| CommandError::AuthorityUnavailable)?;
        let document = bundle.document.clone();
        self.reports.insert(request.report_id, bundle);
        Ok(document)
    }

    pub fn export_report(
        &self,
        request: ExportReportRequest,
    ) -> Result<ExportReceipt, CommandError> {
        validate_schema(&request.schema_version)?;
        let bundle = self
            .reports
            .get(&request.report_id)
            .ok_or(CommandError::NotFound)?;
        verify_report(bundle).map_err(|_| CommandError::AuthorityUnavailable)?;
        validate_export_name(&request)?;
        let destination = self.export_root.join(&request.file_name);
        let destination_parent = destination.parent().ok_or(CommandError::PathRejected)?;
        if destination_parent != self.export_root {
            return Err(CommandError::PathRejected);
        }
        let bytes = match request.format {
            ExportFormat::Json => bundle.json.as_bytes(),
            ExportFormat::Html => bundle.html.as_bytes(),
        };
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&destination)
            .map_err(|_| CommandError::AuthorityUnavailable)?;
        file.write_all(bytes)
            .and_then(|()| file.sync_all())
            .map_err(|_| CommandError::AuthorityUnavailable)?;
        Ok(ExportReceipt {
            report_id: request.report_id,
            format: request.format,
            file_name: request.file_name,
            stored: true,
        })
    }

    pub fn read_health(&self) -> EvidenceHealth {
        EvidenceHealth {
            authority: "available",
            inventory: if self.latest_inventory.is_some() {
                "ready"
            } else {
                "not-collected"
            },
            capture: match self.capture_state {
                CaptureAuthorityState::Idle => "idle",
                CaptureAuthorityState::Active => "active",
                CaptureAuthorityState::Cancelled => "cancelled",
            },
            comparisons: self.comparisons.len(),
            reports: self.reports.len(),
            overhead: EvidenceOverhead {
                counter_poll_ceiling_hz: 1,
                cancellation_budget_ms: 250,
                elevated: false,
            },
        }
    }

    pub fn admit_operation(operation: &str) -> Result<(), CommandError> {
        if matches!(
            operation,
            "refresh-inventory"
                | "read-inventory"
                | "start-capture"
                | "cancel-capture"
                | "finish-capture"
                | "compare-measurements"
                | "render-report"
                | "export-report"
                | "read-health"
        ) {
            Ok(())
        } else {
            Err(CommandError::OperationRejected)
        }
    }
}

fn validate_schema(schema_version: &str) -> Result<(), CommandError> {
    (schema_version == COMMAND_SCHEMA_VERSION)
        .then_some(())
        .ok_or(CommandError::InvalidRequest)
}

fn validate_export_name(request: &ExportReportRequest) -> Result<(), CommandError> {
    if request.file_name.is_empty()
        || request.file_name.len() > MAX_FILE_NAME_BYTES
        || request
            .file_name
            .chars()
            .any(|character| character.is_control())
    {
        return Err(CommandError::PathRejected);
    }
    let mut components = Path::new(&request.file_name).components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return Err(CommandError::PathRejected);
    }
    let expected = format!("{}.{}", request.report_id, request.format.extension());
    if request.file_name != expected {
        return Err(CommandError::PathRejected);
    }
    Ok(())
}

fn load_or_create_salt(path: &Path) -> Result<Vec<u8>, CommandError> {
    if let Ok(existing) = fs::read(path) {
        return (existing.len() == 32)
            .then_some(existing)
            .ok_or(CommandError::AuthorityUnavailable);
    }
    let salt = generate_private_salt()?;
    match OpenOptions::new().write(true).create_new(true).open(path) {
        Ok(mut file) => {
            file.write_all(&salt)
                .and_then(|()| file.sync_all())
                .map_err(|_| CommandError::AuthorityUnavailable)?;
            Ok(salt)
        }
        Err(_) => {
            let existing = fs::read(path).map_err(|_| CommandError::AuthorityUnavailable)?;
            (existing.len() == 32)
                .then_some(existing)
                .ok_or(CommandError::AuthorityUnavailable)
        }
    }
}

#[cfg(target_os = "windows")]
fn generate_private_salt() -> Result<Vec<u8>, CommandError> {
    use windows::Win32::Security::Cryptography::{
        BCRYPT_USE_SYSTEM_PREFERRED_RNG, BCryptGenRandom,
    };

    let mut salt = vec![0_u8; 32];
    // SAFETY: The system-preferred RNG needs no algorithm handle, and the owned
    // output buffer remains valid for the complete call.
    let status = unsafe { BCryptGenRandom(None, &mut salt, BCRYPT_USE_SYSTEM_PREFERRED_RNG) };
    status
        .is_ok()
        .then_some(salt)
        .ok_or(CommandError::AuthorityUnavailable)
}

#[cfg(not(target_os = "windows"))]
fn generate_private_salt() -> Result<Vec<u8>, CommandError> {
    Err(CommandError::AuthorityUnavailable)
}

fn map_inventory_error(error: InventoryCollectionError) -> CommandError {
    match error {
        InventoryCollectionError::InvalidRequest => CommandError::InvalidRequest,
        InventoryCollectionError::ContractRejected | InventoryCollectionError::Persistence(_) => {
            CommandError::AuthorityUnavailable
        }
    }
}

fn map_measurement_error(error: MeasurementError) -> CommandError {
    match error {
        MeasurementError::InvalidConfiguration => CommandError::InvalidRequest,
        MeasurementError::ContractRejected
        | MeasurementError::InvalidTransition
        | MeasurementError::Persistence(_) => CommandError::AuthorityUnavailable,
    }
}

fn map_report_error(error: ReportError) -> CommandError {
    match error {
        ReportError::ComparisonRejected => CommandError::ComparisonRejected,
        ReportError::InvalidInput => CommandError::InvalidRequest,
        ReportError::ContractRejected | ReportError::HashMismatch => {
            CommandError::AuthorityUnavailable
        }
    }
}
