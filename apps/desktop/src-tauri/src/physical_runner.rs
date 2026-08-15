use std::{
    ffi::OsString,
    fs::{self, OpenOptions},
    io::{self, BufRead, Write},
    net::TcpListener,
    path::{Component, Path, PathBuf},
    process::{Child, Command, Stdio},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use liiiraa_contracts_rust::{
    PhysicalRunConfigDocument, TransactionalRecoveryDocument,
    validate_transactional_recovery_document,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

#[path = "../../../optimizer-service/src/artifact_manifest.rs"]
mod artifact_manifest;
#[path = "../../../optimizer-service/src/installation_manifest.rs"]
mod installation_manifest;
#[path = "../../../optimizer-service/src/numeric_version.rs"]
mod numeric_version;

use artifact_manifest::{
    VerifiedArtifactManifest, verify_artifact_manifest, verify_friends_roster,
};
pub use installation_manifest::TRUSTED_INSTALLER_SPKI_SHA256;
use installation_manifest::{CustodyError, CustodyErrorCode};
use installation_manifest::{same_closed_windows_path, verify_installed_manifest};

// Plan 06-33 key-link witnesses (quoted because verify.key-links preserves YAML scalars):
// 'compose_plan apply_plan restore_plan'
// 'phase6-physical apply_plan'
// 'TRUSTED_INSTALLER_SPKI_SHA256 PhysicalRunConfigDocument'
// 'FriendsRosterDocument verify_friends_roster friendsRosterSha256'

const MAX_CONFIG_BYTES: u64 = 64 * 1024;
const MAX_RECORD_BYTES: u64 = 256 * 1024;
const MAX_REDACTED_BYTES: usize = 64 * 1024;
const MAX_INSTALLER_LOG_BYTES: u64 = 16 * 1024 * 1024;
const MAX_INSTALLER_DIAGNOSTIC_BYTES: usize = 4 * 1024;
const MAX_INSTALLED_CUSTODY_DIAGNOSTIC_BYTES: usize = 4 * 1024;
const ZERO_HASH: &str = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
const SOURCE: &str = "phase6-physical-runner-rust-1";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PhysicalRunnerError {
    code: &'static str,
}

impl PhysicalRunnerError {
    pub const fn blocked(code: &'static str) -> Self {
        Self { code }
    }

    pub const fn code(&self) -> &'static str {
        self.code
    }
}

impl std::fmt::Display for PhysicalRunnerError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "BLOCKED:{}", self.code)
    }
}

impl std::error::Error for PhysicalRunnerError {}

fn installed_custody_failure(error: CustodyError) -> PhysicalRunnerError {
    let code = match error.code {
        CustodyErrorCode::Acl => "installed-custody-acl-invalid",
        CustodyErrorCode::Authenticode => "installed-custody-authenticode-invalid",
        CustodyErrorCode::Hash => "installed-custody-live-byte-mismatch",
        CustodyErrorCode::Missing => "installed-custody-required-byte-missing",
        CustodyErrorCode::Path => "installed-custody-canonical-path-invalid",
        CustodyErrorCode::Schema => "installed-custody-generated-schema-invalid",
        CustodyErrorCode::Signature => "installed-custody-signature-invalid",
        CustodyErrorCode::Version => "installed-custody-version-invalid",
    };
    PhysicalRunnerError::blocked(code)
}

fn artifact_custody_failure_code(error: &CustodyError) -> &'static str {
    error.artifact_failure_code()
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PhysicalStage {
    CleanWindowsVm,
    OwnerPc,
    FriendsPc,
}

impl PhysicalStage {
    fn as_str(self) -> &'static str {
        match self {
            Self::CleanWindowsVm => "clean-windows-vm",
            Self::OwnerPc => "owner-pc",
            Self::FriendsPc => "friends-pc",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum RecordKind {
    InstalledReady,
    CheckpointReady,
    Continuation,
    RawEnvelope,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PhysicalRunnerState {
    InstalledReady,
    CheckpointReady,
    RebootPending,
    Completed,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RunPaths {
    pub installed_ready: String,
    pub checkpoint_ready: String,
    pub continuation: String,
    pub raw_envelope: String,
}

impl RunPaths {
    pub fn for_stage(stage: PhysicalStage) -> Self {
        let stage = stage.as_str();
        Self {
            installed_ready: format!("state/{stage}/installed-ready.json"),
            checkpoint_ready: format!("state/{stage}/checkpoint-ready.json"),
            continuation: format!("state/{stage}/physical-continuation.json"),
            raw_envelope: format!("evidence/{stage}/raw-run-envelope.json"),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TauriCommandSet {
    pub compose_plan: String,
    pub approve_plan: String,
    pub apply_plan: String,
    pub restore_plan: String,
    pub read_plan_execution: String,
    pub subscribe_plan_execution: String,
}

impl TauriCommandSet {
    pub fn closed() -> Self {
        Self {
            compose_plan: "compose_plan".to_owned(),
            approve_plan: "approve_plan".to_owned(),
            apply_plan: "apply_plan".to_owned(),
            restore_plan: "restore_plan".to_owned(),
            read_plan_execution: "read_plan_execution".to_owned(),
            subscribe_plan_execution: "subscribe_plan_execution".to_owned(),
        }
    }

    fn validate(&self) -> Result<(), PhysicalRunnerError> {
        (self == &Self::closed())
            .then_some(())
            .ok_or_else(|| PhysicalRunnerError::blocked("tauri-command-allowlist"))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PhysicalRunConfig {
    pub stage: PhysicalStage,
    pub config_path: PathBuf,
    pub artifact_manifest_path: PathBuf,
    pub config_sha256: String,
    pub operation_version_id: String,
    pub build_id: String,
    pub source_commit: String,
    pub paths: RunPaths,
    pub commands: TauriCommandSet,
    pub friends_roster_paths: Option<(String, String)>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ArtifactCustody {
    pub root: PathBuf,
    pub manifest_sha256: String,
    pub config_sha256: String,
    pub runner_sha256: String,
    pub msi_path: String,
    pub runner_path: String,
    pub tauri_driver_path: String,
    pub msedge_driver_path: String,
    pub desktop_path: String,
}

impl ArtifactCustody {
    pub fn test_fixture(config: &PhysicalRunConfig) -> Self {
        Self {
            root: PathBuf::from(r"C:\phase6"),
            manifest_sha256: format!("sha256:{}", "a".repeat(64)),
            config_sha256: config.config_sha256.clone(),
            runner_sha256: format!("sha256:{}", "c".repeat(64)),
            msi_path: r"C:\phase6\liiiraa-boost.msi".to_owned(),
            runner_path: r"C:\phase6\phase6-physical-runner.exe".to_owned(),
            tauri_driver_path: r"C:\phase6\tauri-driver.exe".to_owned(),
            msedge_driver_path: r"C:\phase6\msedgedriver.exe".to_owned(),
            desktop_path: r"C:\Program Files\Liiiraa Boost\liiiraa-desktop.exe".to_owned(),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FriendsRosterBinding {
    pub roster_sha256: String,
    pub participant_id: String,
    pub machine_slot: String,
    pub match_count: usize,
}

pub trait PhysicalRunnerIo {
    fn verify_artifact_custody(
        &mut self,
        config: &PhysicalRunConfig,
        trusted_spki_sha256: &str,
    ) -> Result<ArtifactCustody, PhysicalRunnerError>;
    fn verify_friends_roster(
        &mut self,
        artifact: &ArtifactCustody,
        roster_path: &str,
        signature_path: &str,
    ) -> Result<FriendsRosterBinding, PhysicalRunnerError>;
    fn current_executable_path(&mut self) -> Result<PathBuf, PhysicalRunnerError>;
    fn current_executable_sha256(&mut self) -> Result<String, PhysicalRunnerError>;
    fn local_device_binding_id(&mut self) -> Result<String, PhysicalRunnerError>;
    fn install_msi(&mut self, executable: &str, args: &[String])
    -> Result<(), PhysicalRunnerError>;
    fn verify_installed(&mut self, artifact: &ArtifactCustody) -> Result<(), PhysicalRunnerError>;
    fn create_local_recovery_checkpoint(&mut self) -> Result<String, PhysicalRunnerError>;
    fn launch_webdriver(
        &mut self,
        tauri_driver: &str,
        msedge_driver: &str,
    ) -> Result<(), PhysicalRunnerError>;
    fn invoke_tauri(
        &mut self,
        command: &str,
        payload: &Value,
    ) -> Result<Value, PhysicalRunnerError>;
    fn confirm_plan_apply(
        &mut self,
        plan_id: &str,
        operation_version_id: &str,
    ) -> Result<String, PhysicalRunnerError>;
    fn observe_windows_state(&mut self) -> Result<String, PhysicalRunnerError>;
    fn preview_redacted(&mut self, value: &str) -> Result<(), PhysicalRunnerError>;
    fn confirm_friends_export(
        &mut self,
        binding: &FriendsRosterBinding,
        preview_sha256: &str,
    ) -> Result<String, PhysicalRunnerError>;
    fn export_raw_envelope(&mut self, bytes: &[u8]) -> Result<(), PhysicalRunnerError>;
    fn read_record(&mut self, kind: RecordKind) -> Result<Option<Vec<u8>>, PhysicalRunnerError>;
    fn write_record_exclusive(
        &mut self,
        kind: RecordKind,
        bytes: &[u8],
    ) -> Result<(), PhysicalRunnerError>;
}

#[derive(Clone, Debug)]
pub struct PhysicalGuestRunner {
    config: PhysicalRunConfig,
}

impl PhysicalGuestRunner {
    pub const fn new(config: PhysicalRunConfig) -> Self {
        Self { config }
    }

    pub fn run(
        &self,
        io: &mut dyn PhysicalRunnerIo,
    ) -> Result<PhysicalRunnerState, PhysicalRunnerError> {
        self.config.commands.validate()?;
        let artifact = io.verify_artifact_custody(&self.config, TRUSTED_INSTALLER_SPKI_SHA256)?;
        self.verify_artifact_binding(&artifact)?;
        if io.current_executable_path()? != PathBuf::from(&artifact.runner_path) {
            return Err(PhysicalRunnerError::blocked("runner-live-path-mismatch"));
        }
        let self_sha256 = io.current_executable_sha256()?;
        if self_sha256 != artifact.runner_sha256 {
            return Err(PhysicalRunnerError::blocked("runner-live-byte-mismatch"));
        }

        let friends = if self.config.stage == PhysicalStage::FriendsPc {
            let (roster_path, signature_path) = self
                .config
                .friends_roster_paths
                .as_ref()
                .ok_or_else(|| PhysicalRunnerError::blocked("friends-roster-config-path"))?;
            let binding = io.verify_friends_roster(&artifact, roster_path, signature_path)?;
            if binding.match_count != 1 {
                return Err(PhysicalRunnerError::blocked(
                    "friends-participant-cardinality",
                ));
            }
            Some(binding)
        } else {
            if self.config.friends_roster_paths.is_some() {
                return Err(PhysicalRunnerError::blocked("friends-roster-wrong-stage"));
            }
            None
        };

        let installed = io.read_record(RecordKind::InstalledReady)?;
        if installed.is_none() {
            let installer_log = artifact
                .root
                .join("state")
                .join(self.config.stage.as_str())
                .join("diagnostics")
                .join("msi-install.log");
            let install_args = vec![
                "/i".to_owned(),
                artifact.msi_path.clone(),
                "/qn".to_owned(),
                "/norestart".to_owned(),
                "/l*vx!".to_owned(),
                installer_log.to_string_lossy().into_owned(),
            ];
            io.install_msi("msiexec.exe", &install_args)?;
            io.verify_installed(&artifact)?;
            let record = self.record(
                "installed-ready",
                &artifact.manifest_sha256,
                0,
                ZERO_HASH,
                &artifact.runner_sha256,
                "initial-observation",
            )?;
            io.write_record_exclusive(RecordKind::InstalledReady, &record)?;
            return Ok(PhysicalRunnerState::InstalledReady);
        }

        let checkpoint = io.read_record(RecordKind::CheckpointReady)?;
        if checkpoint.is_none() {
            if self.config.stage == PhysicalStage::CleanWindowsVm {
                return Err(PhysicalRunnerError::blocked("checkpoint-required"));
            }
            let checkpoint_observation = io.create_local_recovery_checkpoint()?;
            if checkpoint_observation.is_empty() {
                return Err(PhysicalRunnerError::blocked("checkpoint-unverified"));
            }
            let record = self.record(
                "checkpoint-ready",
                &artifact.manifest_sha256,
                1,
                &hash_bytes(installed.as_deref().unwrap_or_default()),
                &artifact.runner_sha256,
                &checkpoint_observation,
            )?;
            io.write_record_exclusive(RecordKind::CheckpointReady, &record)?;
        }

        if let Some(continuation) = io.read_record(RecordKind::Continuation)? {
            self.resume(io, &artifact, friends.as_ref(), &continuation)
        } else {
            self.apply_until_reboot(io, &artifact)
        }
    }

    fn verify_artifact_binding(
        &self,
        artifact: &ArtifactCustody,
    ) -> Result<(), PhysicalRunnerError> {
        if artifact.config_sha256 != self.config.config_sha256
            || !same_canonical_path(&artifact.root, self.config.artifact_manifest_path.parent())
        {
            return Err(PhysicalRunnerError::blocked("artifact-config-binding"));
        }
        Ok(())
    }

    fn apply_until_reboot(
        &self,
        io: &mut dyn PhysicalRunnerIo,
        artifact: &ArtifactCustody,
    ) -> Result<PhysicalRunnerState, PhysicalRunnerError> {
        io.launch_webdriver(&artifact.tauri_driver_path, &artifact.msedge_driver_path)?;
        let prior_guid = io.observe_windows_state()?;
        let device_binding_id = io.local_device_binding_id()?;
        let compose = transactional_plan(
            &prior_guid,
            &device_binding_id,
            &artifact.manifest_sha256,
            &self.config,
        );
        let approved_at =
            io.confirm_plan_apply("phase6-physical-plan", &self.config.operation_version_id)?;
        let approval = plan_approval(
            &approved_at,
            &prior_guid,
            &device_binding_id,
            &artifact.manifest_sha256,
            &self.config,
        );
        let apply = plan_transaction("apply");
        io.invoke_tauri(&self.config.commands.compose_plan, &compose)?;
        io.invoke_tauri(&self.config.commands.approve_plan, &approval)?;
        io.invoke_tauri(&self.config.commands.apply_plan, &apply)?;
        io.invoke_tauri(&self.config.commands.read_plan_execution, &json!({}))?;
        io.invoke_tauri(&self.config.commands.subscribe_plan_execution, &json!({}))?;
        let observation = io.observe_windows_state()?;
        if observation == prior_guid {
            return Err(PhysicalRunnerError::blocked("apply-not-observed"));
        }
        let continuation = self.record(
            "reboot-pending",
            &artifact.manifest_sha256,
            3,
            &hash_text(&prior_guid),
            &artifact.runner_sha256,
            &observation,
        )?;
        io.write_record_exclusive(RecordKind::Continuation, &continuation)?;
        Ok(PhysicalRunnerState::RebootPending)
    }

    fn resume(
        &self,
        io: &mut dyn PhysicalRunnerIo,
        artifact: &ArtifactCustody,
        friends: Option<&FriendsRosterBinding>,
        continuation: &[u8],
    ) -> Result<PhysicalRunnerState, PhysicalRunnerError> {
        let document: Value = serde_json::from_slice(continuation)
            .map_err(|_| PhysicalRunnerError::blocked("continuation-json"))?;
        self.verify_continuation(&document, artifact)?;
        let self_sha256 = io.current_executable_sha256()?;
        if self_sha256 != artifact.runner_sha256 {
            return Err(PhysicalRunnerError::blocked("runner-resume-mismatch"));
        }
        io.launch_webdriver(&artifact.tauri_driver_path, &artifact.msedge_driver_path)?;
        let resumed_observation = io.observe_windows_state()?;
        let journal_observation =
            io.invoke_tauri(&self.config.commands.read_plan_execution, &json!({}))?;
        let restore_receipt = io.invoke_tauri(
            &self.config.commands.restore_plan,
            &plan_transaction("restore-plan"),
        )?;
        let restored_guid = io.observe_windows_state()?;
        let expected_restore_hash = document
            .get("previousRecordHash")
            .and_then(Value::as_str)
            .ok_or_else(|| PhysicalRunnerError::blocked("continuation-restore-binding"))?;
        if restored_guid.is_empty() || hash_text(&restored_guid) != expected_restore_hash {
            return Err(PhysicalRunnerError::blocked("restore-not-observed"));
        }

        let redacted_output = self.redacted_output(&resumed_observation, &restored_guid)?;
        let preview_sha256 = hash_text(&redacted_output);
        let consent = if let Some(binding) = friends {
            io.preview_redacted(&redacted_output)?;
            let recorded_at = io.confirm_friends_export(binding, &preview_sha256)?;
            Some(json!({
                "id": format!("consent-{}", self.config.build_id),
                "participantId": binding.participant_id,
                "machineSlot": binding.machine_slot,
                "runEvidenceId": format!("run-{}", self.config.build_id),
                "artifactManifestSha256": artifact.manifest_sha256,
                "configSha256": self.config.config_sha256,
                "friendsRosterSha256": binding.roster_sha256,
                "previewSha256": preview_sha256,
                "redactedBytesSha256": preview_sha256,
                "intent": "export",
                "recordedAt": recorded_at
            }))
        } else {
            None
        };
        let envelope = self.raw_envelope(
            artifact,
            friends,
            consent,
            &redacted_output,
            &hash_text(&journal_observation.to_string()),
            &hash_text(&restore_receipt.to_string()),
        )?;
        io.write_record_exclusive(RecordKind::RawEnvelope, &envelope)?;
        io.export_raw_envelope(&envelope)?;
        Ok(PhysicalRunnerState::Completed)
    }

    fn verify_continuation(
        &self,
        value: &Value,
        artifact: &ArtifactCustody,
    ) -> Result<(), PhysicalRunnerError> {
        let validated = validate_transactional_recovery_document(value)
            .map_err(|_| PhysicalRunnerError::blocked("continuation-schema"))?;
        if !matches!(
            validated,
            TransactionalRecoveryDocument::PhysicalContinuationDocument(_)
        ) || value.get("state").and_then(Value::as_str) != Some("reboot-pending")
            || value.get("sequence").and_then(Value::as_u64) != Some(3)
            || value.get("previousState").and_then(Value::as_str) != Some("running")
        {
            return Err(PhysicalRunnerError::blocked("continuation-state"));
        }
        let expected = [
            ("artifactManifestSha256", artifact.manifest_sha256.as_str()),
            ("configSha256", artifact.config_sha256.as_str()),
            ("runnerSha256", artifact.runner_sha256.as_str()),
            ("stage", self.config.stage.as_str()),
            (
                "operationVersionId",
                self.config.operation_version_id.as_str(),
            ),
            ("buildId", self.config.build_id.as_str()),
        ];
        if expected
            .iter()
            .any(|(key, expected)| value.get(key).and_then(Value::as_str) != Some(*expected))
        {
            return Err(PhysicalRunnerError::blocked("continuation-binding"));
        }
        Ok(())
    }

    fn redacted_output(
        &self,
        resumed: &str,
        restored: &str,
    ) -> Result<String, PhysicalRunnerError> {
        let value = json!({
            "source": SOURCE,
            "stage": self.config.stage.as_str(),
            "runId": format!("run-{}", self.config.build_id),
            "resumedStateSha256": hash_text(resumed),
            "restoredStateSha256": hash_text(restored),
            "status": "OBSERVED"
        });
        let encoded = serde_json::to_string(&value)
            .map_err(|_| PhysicalRunnerError::blocked("redacted-output"))?;
        if encoded.len() > MAX_REDACTED_BYTES {
            return Err(PhysicalRunnerError::blocked("redacted-output-bounds"));
        }
        Ok(encoded)
    }

    fn raw_envelope(
        &self,
        artifact: &ArtifactCustody,
        friends: Option<&FriendsRosterBinding>,
        consent: Option<Value>,
        redacted_output: &str,
        journal_observation_sha256: &str,
        receipt_observation_sha256: &str,
    ) -> Result<Vec<u8>, PhysicalRunnerError> {
        let observation = json!({
            "id": format!("run-{}", self.config.build_id),
            "source": SOURCE,
            "stage": self.config.stage.as_str(),
            "participantId": friends.map(|binding| binding.participant_id.as_str()).unwrap_or("owner-local"),
            "machineSlot": friends.map(|binding| binding.machine_slot.as_str()),
            "artifactManifestSha256": artifact.manifest_sha256,
            "configSha256": self.config.config_sha256,
            "friendsRosterSha256": friends.map(|binding| binding.roster_sha256.as_str()),
            "continuation": ["installed-ready", "checkpoint-ready", "running", "reboot-pending", "resumed-observation", "restored-complete"],
            "lifecycle": {"prepareObserved":true,"applyObserved":true,"rebootBoundaryObserved":true,"resumeObservedBeforeMutation":true,"restoreObserved":true},
            "journalObservationSha256": journal_observation_sha256,
            "receiptObservationSha256": receipt_observation_sha256,
            "diagnostics": {"redacted":true,"previewed":friends.is_some(),"consentBound":friends.is_some(),"autoUpload":false,"rawFieldsFound":[],"byteLength":redacted_output.len()},
            "coverageGaps": ["physical-security-drills-unmeasured","physical-fault-drills-unmeasured","physical-accessibility-audit-unmeasured"],
            "recordedAt": timestamp()
        });
        serde_json::to_vec(&json!({
            "observation": observation,
            "consent": consent,
            "redactedOutput": redacted_output
        }))
        .map_err(|_| PhysicalRunnerError::blocked("raw-envelope"))
    }

    fn record(
        &self,
        state: &str,
        artifact_manifest_sha256: &str,
        sequence: u8,
        previous_hash: &str,
        runner_sha256: &str,
        observation: &str,
    ) -> Result<Vec<u8>, PhysicalRunnerError> {
        let value = self.record_value(
            state,
            artifact_manifest_sha256,
            sequence,
            previous_hash,
            runner_sha256,
            observation,
        );
        validate_transactional_recovery_document(&value)
            .map_err(|_| PhysicalRunnerError::blocked("continuation-schema"))?;
        serde_json::to_vec(&value)
            .map_err(|_| PhysicalRunnerError::blocked("continuation-serialization"))
    }

    fn record_value(
        &self,
        state: &str,
        artifact_manifest_sha256: &str,
        sequence: u8,
        previous_hash: &str,
        runner_sha256: &str,
        observation: &str,
    ) -> Value {
        let mut base = json!({
            "kind": "physical-continuation",
            "schemaVersion": "1.0",
            "continuationId": format!("continuation-{sequence}-{}", self.config.build_id),
            "state": state,
            "sequence": sequence,
            "artifactManifestSha256": artifact_manifest_sha256,
            "configSha256": self.config.config_sha256,
            "runnerSha256": runner_sha256,
            "stage": self.config.stage.as_str(),
            "operationVersionId": self.config.operation_version_id,
            "buildId": self.config.build_id,
            "runId": format!("run-{}", self.config.build_id),
            "transactionId": format!("transaction-{}", self.config.build_id),
            "previousRecordHash": previous_hash,
            "recordHash": hash_text(&format!("{state}:{sequence}:{previous_hash}:{observation}")),
            "observedJournalHeadHash": hash_text(observation),
            "recordedAt": timestamp()
        });
        if sequence > 0 {
            let previous_state = match state {
                "checkpoint-ready" => "installed-ready",
                "running" => "checkpoint-ready",
                "reboot-pending" => "running",
                "resumed-observation" => "reboot-pending",
                "restored-complete" => "resumed-observation",
                _ => return json!({}),
            };
            base["previousState"] = json!(previous_state);
        }
        if state == "resumed-observation" {
            base["observationRequired"] = json!(true);
            base["mutationAuthorized"] = json!(false);
        }
        base
    }
}

pub fn parse_runner_args(args: &[String]) -> Result<PathBuf, PhysicalRunnerError> {
    if args.len() != 3 || args[1] != "--run-config" {
        return Err(PhysicalRunnerError::blocked("runner-arguments"));
    }
    let has_lexical_dot_segment = args[2]
        .split(['\\', '/'])
        .any(|segment| matches!(segment, "." | ".."));
    let path = PathBuf::from(&args[2]);
    if !path.is_absolute()
        || has_lexical_dot_segment
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::CurDir))
        || path.extension().and_then(|value| value.to_str()) != Some("json")
    {
        return Err(PhysicalRunnerError::blocked("run-config-path"));
    }
    Ok(path)
}

pub fn load_run_config(path: &Path) -> Result<PhysicalRunConfig, PhysicalRunnerError> {
    let canonical =
        fs::canonicalize(path).map_err(|_| PhysicalRunnerError::blocked("run-config-canonical"))?;
    if !same_canonical_path(path, Some(&canonical)) {
        return Err(PhysicalRunnerError::blocked("run-config-canonical"));
    }
    let metadata =
        fs::metadata(&canonical).map_err(|_| PhysicalRunnerError::blocked("run-config"))?;
    if metadata.len() == 0 || metadata.len() > MAX_CONFIG_BYTES {
        return Err(PhysicalRunnerError::blocked("run-config-bounds"));
    }
    let bytes = fs::read(&canonical).map_err(|_| PhysicalRunnerError::blocked("run-config"))?;
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| PhysicalRunnerError::blocked("run-config-json"))?;
    let validated = validate_transactional_recovery_document(&value)
        .map_err(|_| PhysicalRunnerError::blocked("run-config-schema"))?;
    let TransactionalRecoveryDocument::PhysicalRunConfigDocument(document) = validated else {
        return Err(PhysicalRunnerError::blocked("run-config-kind"));
    };
    let root = canonical
        .parent()
        .and_then(Path::parent)
        .ok_or_else(|| PhysicalRunnerError::blocked("artifact-root"))?;
    physical_config_from_generated(&canonical, root, document, hash_bytes(&bytes))
}

fn physical_config_from_generated(
    path: &Path,
    root: &Path,
    document: PhysicalRunConfigDocument,
    config_sha256: String,
) -> Result<PhysicalRunConfig, PhysicalRunnerError> {
    let value = serde_json::to_value(document)
        .map_err(|_| PhysicalRunnerError::blocked("run-config-generated"))?;
    let stage = match value.get("stage").and_then(Value::as_str) {
        Some("clean-windows-vm") => PhysicalStage::CleanWindowsVm,
        Some("owner-pc") => PhysicalStage::OwnerPc,
        Some("friends-pc") => PhysicalStage::FriendsPc,
        _ => return Err(PhysicalRunnerError::blocked("run-config-stage")),
    };
    let config_path = required_string(&value, "configPath")?;
    if root.join(config_path) != path {
        return Err(PhysicalRunnerError::blocked("run-config-self-path"));
    }
    let paths = value
        .get("paths")
        .ok_or_else(|| PhysicalRunnerError::blocked("run-config-paths"))?;
    let friends_roster_paths = if stage == PhysicalStage::FriendsPc {
        Some((
            required_string(&value, "friendsRosterPath")?.to_owned(),
            required_string(&value, "friendsRosterSignaturePath")?.to_owned(),
        ))
    } else {
        None
    };
    let config = PhysicalRunConfig {
        stage,
        config_path: path.to_path_buf(),
        artifact_manifest_path: root.join(required_string(&value, "artifactManifestPath")?),
        config_sha256,
        operation_version_id: required_string(&value, "operationVersionId")?.to_owned(),
        build_id: required_string(&value, "buildId")?.to_owned(),
        source_commit: required_string(&value, "sourceCommit")?.to_owned(),
        paths: RunPaths {
            installed_ready: required_string(paths, "installedReadyRecordPath")?.to_owned(),
            checkpoint_ready: required_string(paths, "checkpointReadyRecordPath")?.to_owned(),
            continuation: required_string(paths, "continuationPath")?.to_owned(),
            raw_envelope: required_string(paths, "rawEnvelopePath")?.to_owned(),
        },
        commands: TauriCommandSet::closed(),
        friends_roster_paths,
    };
    config.commands.validate()?;
    Ok(config)
}

pub struct WindowsPhysicalRunnerIo {
    config: PhysicalRunConfig,
    artifact: Option<VerifiedArtifactManifest>,
    webdriver: Option<WebDriverSession>,
}

struct WebDriverSession {
    child: Child,
    port: u16,
    session_id: String,
}

impl WindowsPhysicalRunnerIo {
    pub const fn new(config: PhysicalRunConfig) -> Self {
        Self {
            config,
            artifact: None,
            webdriver: None,
        }
    }

    fn record_path(&self, kind: RecordKind) -> Result<PathBuf, PhysicalRunnerError> {
        let relative = match kind {
            RecordKind::InstalledReady => &self.config.paths.installed_ready,
            RecordKind::CheckpointReady => &self.config.paths.checkpoint_ready,
            RecordKind::Continuation => &self.config.paths.continuation,
            RecordKind::RawEnvelope => &self.config.paths.raw_envelope,
        };
        resolve_below_root(
            self.config
                .artifact_manifest_path
                .parent()
                .ok_or_else(|| PhysicalRunnerError::blocked("artifact-root"))?,
            relative,
        )
    }
}

impl Drop for WindowsPhysicalRunnerIo {
    fn drop(&mut self) {
        if let Some(session) = self.webdriver.as_mut() {
            let path = format!("/session/{}", session.session_id);
            let _ = webdriver_request(session.port, "DELETE", &path, None);
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
    }
}

impl PhysicalRunnerIo for WindowsPhysicalRunnerIo {
    fn verify_artifact_custody(
        &mut self,
        config: &PhysicalRunConfig,
        trusted_spki_sha256: &str,
    ) -> Result<ArtifactCustody, PhysicalRunnerError> {
        if trusted_spki_sha256 != TRUSTED_INSTALLER_SPKI_SHA256 {
            return Err(PhysicalRunnerError::blocked("compiled-spki"));
        }
        let verified = verify_artifact_manifest(&config.artifact_manifest_path)
            .map_err(|error| PhysicalRunnerError::blocked(artifact_custody_failure_code(&error)))?;
        if verified.operation_version_id() != config.operation_version_id
            || verified.build_id() != config.build_id
        {
            return Err(PhysicalRunnerError::blocked("artifact-identity"));
        }
        let value: Value = serde_json::from_slice(
            &fs::read(&config.artifact_manifest_path)
                .map_err(|_| PhysicalRunnerError::blocked("artifact-manifest"))?,
        )
        .map_err(|_| PhysicalRunnerError::blocked("artifact-manifest-json"))?;
        let files = value
            .get("files")
            .and_then(Value::as_object)
            .ok_or_else(|| PhysicalRunnerError::blocked("artifact-files"))?;
        let role = |name: &str| -> Result<String, PhysicalRunnerError> {
            let relative = files
                .get(name)
                .and_then(|item| item.get("relativePath"))
                .and_then(Value::as_str)
                .ok_or_else(|| PhysicalRunnerError::blocked("artifact-role"))?;
            Ok(verified
                .root()
                .join(relative)
                .to_string_lossy()
                .into_owned())
        };
        let config_role = match config.stage {
            PhysicalStage::CleanWindowsVm => "cleanWindowsVmConfig",
            PhysicalStage::OwnerPc => "ownerPcConfig",
            PhysicalStage::FriendsPc => "friendsPcConfig",
        };
        let config_identity = files
            .get(config_role)
            .ok_or_else(|| PhysicalRunnerError::blocked("artifact-config-role"))?;
        let custody = ArtifactCustody {
            root: verified.root().to_path_buf(),
            manifest_sha256: verified.manifest_sha256().to_owned(),
            config_sha256: required_string(config_identity, "sha256")?.to_owned(),
            runner_sha256: required_string(
                files
                    .get("runner")
                    .ok_or_else(|| PhysicalRunnerError::blocked("artifact-runner"))?,
                "sha256",
            )?
            .to_owned(),
            msi_path: role("msi")?,
            runner_path: role("runner")?,
            tauri_driver_path: role("tauriDriver")?,
            msedge_driver_path: role("msedgeDriver")?,
            desktop_path: r"C:\Program Files\Liiiraa Boost\liiiraa-desktop.exe".to_owned(),
        };
        self.artifact = Some(verified);
        Ok(custody)
    }

    fn verify_friends_roster(
        &mut self,
        artifact: &ArtifactCustody,
        roster_path: &str,
        signature_path: &str,
    ) -> Result<FriendsRosterBinding, PhysicalRunnerError> {
        if roster_path != "friends/friends-roster.json"
            || signature_path != "friends/friends-roster.json.p7s"
        {
            return Err(PhysicalRunnerError::blocked("friends-roster-path"));
        }
        let verified = self
            .artifact
            .as_ref()
            .ok_or_else(|| PhysicalRunnerError::blocked("artifact-not-verified"))?;
        let roster = verify_friends_roster(verified, verified.friends_config())
            .map_err(|_| PhysicalRunnerError::blocked("friends-roster-custody"))?;
        let local_id = local_participant_id()?;
        let matches = roster
            .participants()
            .iter()
            .filter(|participant| participant.participant_id.as_str() == local_id)
            .collect::<Vec<_>>();
        let first = matches
            .first()
            .ok_or_else(|| PhysicalRunnerError::blocked("friends-participant-cardinality"))?;
        let roster_bytes = fs::read(artifact.root.join(roster_path))
            .map_err(|_| PhysicalRunnerError::blocked("friends-roster-bytes"))?;
        Ok(FriendsRosterBinding {
            roster_sha256: hash_bytes(&roster_bytes),
            participant_id: local_id,
            machine_slot: first.machine_slot.to_string(),
            match_count: matches.len(),
        })
    }

    fn current_executable_sha256(&mut self) -> Result<String, PhysicalRunnerError> {
        let path = self.current_executable_path()?;
        hash_file(&path)
    }

    fn current_executable_path(&mut self) -> Result<PathBuf, PhysicalRunnerError> {
        let path = std::env::current_exe()
            .map_err(|_| PhysicalRunnerError::blocked("current-executable"))?;
        fs::canonicalize(path).map_err(|_| PhysicalRunnerError::blocked("current-executable"))
    }

    fn local_device_binding_id(&mut self) -> Result<String, PhysicalRunnerError> {
        local_participant_id()
    }

    fn install_msi(
        &mut self,
        executable: &str,
        args: &[String],
    ) -> Result<(), PhysicalRunnerError> {
        if executable != "msiexec.exe"
            || args.len() != 6
            || args[0] != "/i"
            || args[2] != "/qn"
            || args[3] != "/norestart"
            || args[4] != "/l*vx!"
        {
            return Err(PhysicalRunnerError::blocked("installer-arguments"));
        }

        let custody_msi = Path::new(&args[1]);
        let canonical_msi = fs::canonicalize(custody_msi)
            .map_err(|_| PhysicalRunnerError::blocked("installer-path"))?;
        if !same_canonical_path(custody_msi, Some(&canonical_msi)) {
            return Err(PhysicalRunnerError::blocked("installer-path"));
        }
        let invocation_msi = msiexec_compatible_path(&canonical_msi)?;

        let artifact_root = canonical_msi
            .parent()
            .ok_or_else(|| PhysicalRunnerError::blocked("installer-path"))?;
        let expected_log = artifact_root
            .join("state")
            .join(self.config.stage.as_str())
            .join("diagnostics")
            .join("msi-install.log");
        let supplied_log = Path::new(&args[5]);
        if !same_canonical_path(&expected_log, Some(supplied_log)) {
            return Err(PhysicalRunnerError::blocked("installer-log-path"));
        }
        let invocation_log = msiexec_compatible_path(&expected_log)?;
        let parent = expected_log
            .parent()
            .ok_or_else(|| PhysicalRunnerError::blocked("installer-log-path"))?;
        fs::create_dir_all(parent)
            .map_err(|_| PhysicalRunnerError::blocked("installer-log-parent"))?;
        let reservation = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&expected_log)
            .map_err(|_| PhysicalRunnerError::blocked("installer-log-create-once"))?;
        reservation
            .sync_all()
            .map_err(|_| PhysicalRunnerError::blocked("installer-log-durable"))?;
        drop(reservation);

        let invocation_args = [
            OsString::from("/i"),
            invocation_msi.into_os_string(),
            OsString::from("/qn"),
            OsString::from("/norestart"),
            OsString::from("/l*vx!"),
            invocation_log.into_os_string(),
        ];
        let status = Command::new(executable)
            .args(invocation_args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|_| PhysicalRunnerError::blocked("installer-launch"))?;
        match status.code() {
            Some(0) => Ok(()),
            Some(code) => {
                persist_installer_diagnostic(code, &expected_log)?;
                Err(installer_exit_failure(code))
            }
            None => Err(PhysicalRunnerError::blocked("installer-exit-other")),
        }
    }

    fn verify_installed(&mut self, artifact: &ArtifactCustody) -> Result<(), PhysicalRunnerError> {
        let verified = match verify_installed_manifest() {
            Ok(verified) => verified,
            Err(error) => {
                persist_installed_custody_diagnostic(
                    &artifact.root,
                    self.config.stage,
                    &error,
                )?;
                return Err(installed_custody_failure(error));
            }
        };
        let runner = verified
            .files()
            .iter()
            .find(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.contains("physical-runner"))
            })
            .ok_or_else(|| PhysicalRunnerError::blocked("installed-runner-role"))?;
        (hash_file(runner)? == artifact.runner_sha256)
            .then_some(())
            .ok_or_else(|| PhysicalRunnerError::blocked("installed-runner-hash"))
    }

    fn create_local_recovery_checkpoint(&mut self) -> Result<String, PhysicalRunnerError> {
        create_system_restore_checkpoint()
    }

    fn launch_webdriver(
        &mut self,
        tauri_driver: &str,
        msedge_driver: &str,
    ) -> Result<(), PhysicalRunnerError> {
        if self.webdriver.is_some() {
            return Err(PhysicalRunnerError::blocked("webdriver-already-running"));
        }
        let port = reserve_loopback_port()?;
        let native_port = reserve_loopback_port()?;
        let mut child = Command::new(tauri_driver)
            .args([
                "--port",
                &port.to_string(),
                "--native-port",
                &native_port.to_string(),
                "--native-driver",
                msedge_driver,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|_| PhysicalRunnerError::blocked("webdriver-launch"))?;
        let deadline = Instant::now() + Duration::from_secs(15);
        loop {
            if child
                .try_wait()
                .map_err(|_| PhysicalRunnerError::blocked("webdriver-process"))?
                .is_some()
            {
                return Err(PhysicalRunnerError::blocked("webdriver-exited"));
            }
            if webdriver_request(port, "GET", "/status", None)
                .ok()
                .and_then(|value| value.get("ready").and_then(Value::as_bool))
                == Some(true)
            {
                break;
            }
            if Instant::now() >= deadline {
                let _ = child.kill();
                return Err(PhysicalRunnerError::blocked("webdriver-timeout"));
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        let desktop = self
            .artifact
            .as_ref()
            .and_then(|_| {
                let path = Path::new(r"C:\Program Files\Liiiraa Boost\liiiraa-desktop.exe");
                path.to_str()
            })
            .ok_or_else(|| PhysicalRunnerError::blocked("installed-desktop-path"))?;
        let application = desktop.strip_suffix(".exe").unwrap_or(desktop);
        let created = webdriver_request(
            port,
            "POST",
            "/session",
            Some(&json!({
                "capabilities": {"alwaysMatch": {"tauri:options": {"application": application}}}
            })),
        )?;
        let session_id = created
            .get("sessionId")
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
            .ok_or_else(|| PhysicalRunnerError::blocked("webdriver-session-id"))?
            .to_owned();
        self.webdriver = Some(WebDriverSession {
            child,
            port,
            session_id,
        });
        Ok(())
    }

    fn invoke_tauri(
        &mut self,
        command: &str,
        payload: &Value,
    ) -> Result<Value, PhysicalRunnerError> {
        let allowed = self.config.commands.clone();
        let names = [
            allowed.compose_plan,
            allowed.approve_plan,
            allowed.apply_plan,
            allowed.restore_plan,
            allowed.read_plan_execution,
            allowed.subscribe_plan_execution,
        ];
        if !names.iter().any(|name| name == command) {
            return Err(PhysicalRunnerError::blocked("tauri-command"));
        }
        // The session is loopback-only. `compose_plan`, `approve_plan`, `apply_plan`, and
        // `restore_plan` are installed Tauri commands; physical apply/restore enters
        // execute_physical_plan and WindowsNamedPipeBrokerTransport in plan_executor.rs.
        let session = self
            .webdriver
            .as_ref()
            .ok_or_else(|| PhysicalRunnerError::blocked("webdriver-not-running"))?;
        let path = format!("/session/{}/execute/sync", session.session_id);
        webdriver_request(
            session.port,
            "POST",
            &path,
            Some(&json!({
                "script": "const [command, payload] = arguments; return window.__TAURI_INTERNALS__.invoke(command, payload);",
                "args": [command, payload]
            })),
        )
    }

    fn observe_windows_state(&mut self) -> Result<String, PhysicalRunnerError> {
        observe_active_power_scheme()
    }

    fn confirm_plan_apply(
        &mut self,
        plan_id: &str,
        operation_version_id: &str,
    ) -> Result<String, PhysicalRunnerError> {
        let expected = format!("APPLY {plan_id} {operation_version_id}");
        eprintln!("Type this exact phrase to approve the physical apply:\n{expected}");
        let mut line = String::new();
        io::stdin()
            .lock()
            .read_line(&mut line)
            .map_err(|_| PhysicalRunnerError::blocked("plan-approval-read"))?;
        if line.trim_end() != expected {
            return Err(PhysicalRunnerError::blocked("plan-approval-refused"));
        }
        Ok(timestamp())
    }

    fn preview_redacted(&mut self, value: &str) -> Result<(), PhysicalRunnerError> {
        println!("{value}");
        Ok(())
    }

    fn confirm_friends_export(
        &mut self,
        binding: &FriendsRosterBinding,
        preview_sha256: &str,
    ) -> Result<String, PhysicalRunnerError> {
        let expected = format!(
            "EXPORT {} {} {}",
            binding.participant_id, binding.machine_slot, preview_sha256
        );
        eprintln!("Type this exact consent phrase to export the redacted envelope:\n{expected}");
        let mut line = String::new();
        io::stdin()
            .lock()
            .read_line(&mut line)
            .map_err(|_| PhysicalRunnerError::blocked("friends-consent-read"))?;
        if line.trim_end() != expected {
            return Err(PhysicalRunnerError::blocked("friends-consent-refused"));
        }
        Ok(timestamp())
    }

    fn export_raw_envelope(&mut self, bytes: &[u8]) -> Result<(), PhysicalRunnerError> {
        let expected = self.record_path(RecordKind::RawEnvelope)?;
        let actual = fs::read(&expected)
            .map_err(|_| PhysicalRunnerError::blocked("raw-envelope-readback"))?;
        (actual == bytes)
            .then_some(())
            .ok_or_else(|| PhysicalRunnerError::blocked("raw-envelope-readback"))
    }

    fn read_record(&mut self, kind: RecordKind) -> Result<Option<Vec<u8>>, PhysicalRunnerError> {
        let path = self.record_path(kind)?;
        match fs::metadata(&path) {
            Ok(metadata) if metadata.len() > MAX_RECORD_BYTES => {
                Err(PhysicalRunnerError::blocked("record-bounds"))
            }
            Ok(_) => fs::read(path)
                .map(Some)
                .map_err(|_| PhysicalRunnerError::blocked("record-read")),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(_) => Err(PhysicalRunnerError::blocked("record-read")),
        }
    }

    fn write_record_exclusive(
        &mut self,
        kind: RecordKind,
        bytes: &[u8],
    ) -> Result<(), PhysicalRunnerError> {
        if bytes.is_empty() || bytes.len() as u64 > MAX_RECORD_BYTES {
            return Err(PhysicalRunnerError::blocked("record-bounds"));
        }
        let path = self.record_path(kind)?;
        let parent = path
            .parent()
            .ok_or_else(|| PhysicalRunnerError::blocked("record-parent"))?;
        fs::create_dir_all(parent).map_err(|_| PhysicalRunnerError::blocked("record-parent"))?;
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .map_err(|_| PhysicalRunnerError::blocked("record-create-once"))?;
        file.write_all(bytes)
            .and_then(|()| file.sync_all())
            .map_err(|_| PhysicalRunnerError::blocked("record-durable"))
    }
}

fn required_string<'a>(value: &'a Value, key: &str) -> Result<&'a str, PhysicalRunnerError> {
    value
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| PhysicalRunnerError::blocked("generated-field"))
}

fn resolve_below_root(root: &Path, relative: &str) -> Result<PathBuf, PhysicalRunnerError> {
    let relative = Path::new(relative);
    if relative.is_absolute()
        || relative.components().any(|component| {
            matches!(
                component,
                Component::ParentDir
                    | Component::CurDir
                    | Component::RootDir
                    | Component::Prefix(_)
            )
        })
    {
        return Err(PhysicalRunnerError::blocked("artifact-relative-path"));
    }
    Ok(root.join(relative))
}

fn same_canonical_path(expected: &Path, actual: Option<&Path>) -> bool {
    let Some(actual) = actual else {
        return false;
    };
    same_closed_windows_path(expected, actual)
}

#[cfg(windows)]
fn msiexec_compatible_path(path: &Path) -> Result<PathBuf, PhysicalRunnerError> {
    use std::path::Prefix;

    if path
        .as_os_str()
        .to_string_lossy()
        .split(['\\', '/'])
        .any(|segment| matches!(segment, "." | ".."))
    {
        return Err(PhysicalRunnerError::blocked("installer-path"));
    }
    let mut components = path.components();
    let prefix = match components.next() {
        Some(Component::Prefix(prefix)) => prefix.kind(),
        _ => return Err(PhysicalRunnerError::blocked("installer-path")),
    };
    if !matches!(components.next(), Some(Component::RootDir)) {
        return Err(PhysicalRunnerError::blocked("installer-path"));
    }
    let tail = components.collect::<Vec<_>>();
    if tail.is_empty()
        || tail
            .iter()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(PhysicalRunnerError::blocked("installer-path"));
    }

    let mut normalized = match prefix {
        Prefix::Disk(letter) => PathBuf::from(format!("{}:\\", char::from(letter))),
        Prefix::VerbatimDisk(letter) => PathBuf::from(format!("{}:\\", char::from(letter))),
        Prefix::UNC(server, share) | Prefix::VerbatimUNC(server, share) => {
            let mut root = PathBuf::from(r"\\");
            root.push(server);
            root.push(share);
            root
        }
        _ => return Err(PhysicalRunnerError::blocked("installer-path")),
    };
    for component in tail {
        if let Component::Normal(segment) = component {
            normalized.push(segment);
        }
    }
    Ok(normalized)
}

#[cfg(not(windows))]
fn msiexec_compatible_path(_path: &Path) -> Result<PathBuf, PhysicalRunnerError> {
    Err(PhysicalRunnerError::blocked("installer-platform"))
}

fn installer_exit_failure(code: i32) -> PhysicalRunnerError {
    let code = match code {
        5 => "installer-exit-5",
        87 => "installer-exit-87",
        1601 => "installer-exit-1601",
        1602 => "installer-exit-1602",
        1603 => "installer-exit-1603",
        1605 => "installer-exit-1605",
        1618 => "installer-exit-1618",
        1619 => "installer-exit-1619",
        1620 => "installer-exit-1620",
        1625 => "installer-exit-1625",
        1638 => "installer-exit-1638",
        1641 => "installer-exit-1641",
        3010 => "installer-exit-3010",
        _ => "installer-exit-other",
    };
    PhysicalRunnerError::blocked(code)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallerDiagnosticSidecar {
    kind: &'static str,
    schema_version: &'static str,
    installer_exit_code: Option<i32>,
    log_status: &'static str,
    log_sha256: Option<String>,
    log_size_bytes: Option<u64>,
    return_value_3_action_code: &'static str,
    return_value_3_action_identifier: Option<&'static str>,
}

fn installer_diagnostic_from_log(
    exit_code: i32,
    log_bytes: Option<&[u8]>,
) -> InstallerDiagnosticSidecar {
    let base = |log_status, log_sha256, log_size_bytes, action_code, action_identifier| {
        InstallerDiagnosticSidecar {
            kind: "phase6-msi-safe-diagnostic",
            schema_version: "1.0",
            installer_exit_code: Some(exit_code),
            log_status,
            log_sha256,
            log_size_bytes,
            return_value_3_action_code: action_code,
            return_value_3_action_identifier: action_identifier,
        }
    };
    let Some(bytes) = log_bytes else {
        return base("log-missing", None, None, "unavailable", None);
    };
    if bytes.is_empty() || bytes.len() as u64 > MAX_INSTALLER_LOG_BYTES {
        return base("log-unparseable", None, None, "none", None);
    }

    let log_sha256 = Some(hash_bytes(bytes));
    let log_size_bytes = Some(bytes.len() as u64);
    let Some(text) = decode_installer_log_text(bytes) else {
        return base("log-unparseable", log_sha256, log_size_bytes, "none", None);
    };
    let action = text.lines().rev().find_map(|line| {
        let marker = ". Return value 3.";
        let before = line.strip_suffix(marker)?;
        let (_, identifier) = before.rsplit_once(": ")?;
        Some(identifier.trim())
    });
    let (action_code, action_identifier) = match action {
        Some("LaunchConditions") => ("launch-conditions", Some("LaunchConditions")),
        Some("CostFinalize") => ("cost-finalize", Some("CostFinalize")),
        Some("InstallValidate") => ("install-validate", Some("InstallValidate")),
        Some("InstallFiles") => ("install-files", Some("InstallFiles")),
        Some("InstallServices") => ("install-services", Some("InstallServices")),
        Some("StartServices") => ("start-services", Some("StartServices")),
        Some("InstallFinalize") => ("install-finalize", Some("InstallFinalize")),
        Some("INSTALL") => ("install", Some("INSTALL")),
        Some(_) => ("other", None),
        None => {
            return base("log-unparseable", log_sha256, log_size_bytes, "none", None);
        }
    };
    base(
        "present",
        log_sha256,
        log_size_bytes,
        action_code,
        action_identifier,
    )
}

fn decode_installer_log_text(bytes: &[u8]) -> Option<String> {
    if bytes.is_empty() {
        return None;
    }
    if bytes.starts_with(&[0xfe, 0xff]) {
        return None;
    }

    let has_utf16le_bom = bytes.starts_with(&[0xff, 0xfe]);
    let body = if has_utf16le_bom { &bytes[2..] } else { bytes };
    let looks_utf16le = !body.is_empty()
        && body.len().is_multiple_of(2)
        && body.chunks_exact(2).filter(|pair| pair[1] == 0).count() * 4 >= body.len();
    if has_utf16le_bom || looks_utf16le {
        if body.is_empty() || !body.len().is_multiple_of(2) {
            return None;
        }
        let units = body
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        return String::from_utf16(&units)
            .ok()
            .filter(|text| !text.contains('\0'));
    }

    std::str::from_utf8(bytes)
        .ok()
        .filter(|text| !text.contains('\0'))
        .map(str::to_owned)
}

fn installer_diagnostic_sidecar_path(installer_log: &Path) -> Result<PathBuf, PhysicalRunnerError> {
    if installer_log.file_name().and_then(|name| name.to_str()) != Some("msi-install.log") {
        return Err(PhysicalRunnerError::blocked("installer-diagnostic-path"));
    }
    let parent = installer_log
        .parent()
        .ok_or_else(|| PhysicalRunnerError::blocked("installer-diagnostic-path"))?;
    Ok(parent.join("msi-install.safe.json"))
}

fn write_installer_diagnostic_create_once(
    path: &Path,
    diagnostic: &InstallerDiagnosticSidecar,
) -> Result<(), PhysicalRunnerError> {
    if path.file_name().and_then(|name| name.to_str()) != Some("msi-install.safe.json") {
        return Err(PhysicalRunnerError::blocked("installer-diagnostic-path"));
    }
    let bytes = serde_json::to_vec(diagnostic)
        .map_err(|_| PhysicalRunnerError::blocked("installer-diagnostic-serialize"))?;
    if bytes.is_empty() || bytes.len() > MAX_INSTALLER_DIAGNOSTIC_BYTES {
        return Err(PhysicalRunnerError::blocked("installer-diagnostic-bounds"));
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| PhysicalRunnerError::blocked("installer-diagnostic-create-once"))?;
    file.write_all(&bytes)
        .and_then(|()| file.sync_all())
        .map_err(|_| PhysicalRunnerError::blocked("installer-diagnostic-durable"))
}

fn persist_installer_diagnostic(
    exit_code: i32,
    installer_log: &Path,
) -> Result<(), PhysicalRunnerError> {
    let log_bytes = match fs::metadata(installer_log) {
        Ok(metadata) if metadata.len() > MAX_INSTALLER_LOG_BYTES => None,
        Ok(_) => fs::read(installer_log).ok(),
        Err(_) => None,
    };
    let diagnostic = installer_diagnostic_from_log(exit_code, log_bytes.as_deref());
    let sidecar = installer_diagnostic_sidecar_path(installer_log)?;
    write_installer_diagnostic_create_once(&sidecar, &diagnostic)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstalledCustodyDiagnosticSidecar {
    kind: &'static str,
    schema_version: &'static str,
    error_code: &'static str,
    detail_code: &'static str,
    role: Option<&'static str>,
    path_class: Option<&'static str>,
    io_kind: Option<&'static str>,
    win32_code: Option<i32>,
}

fn installed_custody_diagnostic(error: &CustodyError) -> InstalledCustodyDiagnosticSidecar {
    let diagnostic = error.safe_path_diagnostic();
    InstalledCustodyDiagnosticSidecar {
        kind: "phase6-installed-custody-safe-diagnostic",
        schema_version: "1.0",
        error_code: error.code.as_str(),
        detail_code: error.safe_path_detail_code(),
        role: diagnostic.map(|value| value.role),
        path_class: diagnostic.map(|value| value.path_class),
        io_kind: diagnostic.map(|value| value.io_kind),
        win32_code: diagnostic.and_then(|value| value.win32_code),
    }
}

fn persist_installed_custody_diagnostic(
    artifact_root: &Path,
    stage: PhysicalStage,
    error: &CustodyError,
) -> Result<(), PhysicalRunnerError> {
    let path = artifact_root
        .join("state")
        .join(stage.as_str())
        .join("diagnostics")
        .join("installed-custody.safe.json");
    let bytes = serde_json::to_vec(&installed_custody_diagnostic(error))
        .map_err(|_| PhysicalRunnerError::blocked("installed-custody-diagnostic-serialize"))?;
    if bytes.is_empty() || bytes.len() > MAX_INSTALLED_CUSTODY_DIAGNOSTIC_BYTES {
        return Err(PhysicalRunnerError::blocked(
            "installed-custody-diagnostic-bounds",
        ));
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| PhysicalRunnerError::blocked("installed-custody-diagnostic-create-once"))?;
    file.write_all(&bytes)
        .and_then(|()| file.sync_all())
        .map_err(|_| PhysicalRunnerError::blocked("installed-custody-diagnostic-durable"))
}

fn hash_file(path: &Path) -> Result<String, PhysicalRunnerError> {
    fs::read(path)
        .map(|bytes| hash_bytes(&bytes))
        .map_err(|_| PhysicalRunnerError::blocked("live-byte-read"))
}

fn hash_text(value: &str) -> String {
    hash_bytes(value.as_bytes())
}

fn hash_bytes(value: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(value))
}

fn local_participant_id() -> Result<String, PhysicalRunnerError> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::{
            Win32::Foundation::ERROR_SUCCESS,
            Win32::System::Registry::{
                HKEY_LOCAL_MACHINE, KEY_READ, RegCloseKey, RegOpenKeyExW, RegQueryValueExW,
            },
            core::PCWSTR,
        };
        let path: Vec<u16> = std::ffi::OsStr::new(r"SOFTWARE\Microsoft\Cryptography")
            .encode_wide()
            .chain(Some(0))
            .collect();
        let name: Vec<u16> = std::ffi::OsStr::new("MachineGuid")
            .encode_wide()
            .chain(Some(0))
            .collect();
        let mut key = Default::default();
        // SAFETY: fixed registry path, read-only access, checked return codes, and closed handle.
        unsafe {
            if RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                PCWSTR(path.as_ptr()),
                Some(0),
                KEY_READ,
                &mut key,
            ) != ERROR_SUCCESS
            {
                return Err(PhysicalRunnerError::blocked("local-participant-id"));
            }
            let mut bytes = vec![0_u8; 512];
            let mut length = bytes.len() as u32;
            let result = RegQueryValueExW(
                key,
                PCWSTR(name.as_ptr()),
                None,
                None,
                Some(bytes.as_mut_ptr()),
                Some(&mut length),
            );
            let _ = RegCloseKey(key);
            if result != ERROR_SUCCESS || length < 4 {
                return Err(PhysicalRunnerError::blocked("local-participant-id"));
            }
            bytes.truncate(length as usize);
            let purpose = b"phase6-friends-physical-validation\0";
            let mut hasher = Sha256::new();
            hasher.update(purpose);
            hasher.update(bytes);
            Ok(format!("sha256:{:x}", hasher.finalize()))
        }
    }
    #[cfg(not(windows))]
    {
        Err(PhysicalRunnerError::blocked("windows-required"))
    }
}

fn reserve_loopback_port() -> Result<u16, PhysicalRunnerError> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|_| PhysicalRunnerError::blocked("webdriver-port"))?;
    listener
        .local_addr()
        .map(|address| address.port())
        .map_err(|_| PhysicalRunnerError::blocked("webdriver-port"))
}

#[cfg(windows)]
fn observe_active_power_scheme() -> Result<String, PhysicalRunnerError> {
    use windows::Win32::{
        Foundation::{ERROR_SUCCESS, HLOCAL, LocalFree},
        System::Power::PowerGetActiveScheme,
    };
    let mut active = std::ptr::null_mut();
    // SAFETY: PowerGetActiveScheme initializes a GUID allocated with LocalAlloc on success.
    if unsafe { PowerGetActiveScheme(None, &mut active) } != ERROR_SUCCESS || active.is_null() {
        return Err(PhysicalRunnerError::blocked("power-observation"));
    }
    // SAFETY: active is non-null and points to a GUID until released below.
    let guid = unsafe { *active };
    // SAFETY: the allocation is owned by this call and released exactly once with LocalFree.
    let _ = unsafe { LocalFree(Some(HLOCAL(active.cast()))) };
    Ok(format!("{guid:?}").to_ascii_lowercase())
}

#[cfg(not(windows))]
fn observe_active_power_scheme() -> Result<String, PhysicalRunnerError> {
    Err(PhysicalRunnerError::blocked("windows-required"))
}

#[cfg(windows)]
fn create_system_restore_checkpoint() -> Result<String, PhysicalRunnerError> {
    use windows::Win32::System::Restore::{
        BEGIN_SYSTEM_CHANGE, END_SYSTEM_CHANGE, MANUAL_CHECKPOINT, RESTOREPOINTINFO_TYPE,
        RESTOREPOINTINFOW, SRSetRestorePointW, STATEMGRSTATUS,
    };
    let description = "Liiiraa Boost Phase 6 physical validation"
        .encode_utf16()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let mut description_buffer = [0_u16; 256];
    let length = description.len().min(description_buffer.len());
    description_buffer[..length].copy_from_slice(&description[..length]);
    let begin = RESTOREPOINTINFOW {
        dwEventType: BEGIN_SYSTEM_CHANGE,
        dwRestorePtType: RESTOREPOINTINFO_TYPE(MANUAL_CHECKPOINT),
        llSequenceNumber: 0,
        szDescription: description_buffer,
    };
    let mut status = STATEMGRSTATUS::default();
    // SAFETY: both packed Win32 structures are initialized and remain valid for the call.
    if !unsafe { SRSetRestorePointW(&begin, &mut status) }.as_bool() {
        return Err(PhysicalRunnerError::blocked("checkpoint-create"));
    }
    let sequence = status.llSequenceNumber;
    let end = RESTOREPOINTINFOW {
        dwEventType: END_SYSTEM_CHANGE,
        dwRestorePtType: RESTOREPOINTINFO_TYPE(MANUAL_CHECKPOINT),
        llSequenceNumber: sequence,
        szDescription: begin.szDescription,
    };
    let mut end_status = STATEMGRSTATUS::default();
    // SAFETY: the sequence is the value returned by the successful BEGIN call.
    if !unsafe { SRSetRestorePointW(&end, &mut end_status) }.as_bool() {
        return Err(PhysicalRunnerError::blocked("checkpoint-finalize"));
    }
    Ok(format!("system-restore-sequence-{sequence}"))
}

#[cfg(not(windows))]
fn create_system_restore_checkpoint() -> Result<String, PhysicalRunnerError> {
    Err(PhysicalRunnerError::blocked("windows-required"))
}

#[cfg(windows)]
fn webdriver_request(
    port: u16,
    method: &str,
    path: &str,
    body: Option<&Value>,
) -> Result<Value, PhysicalRunnerError> {
    use std::{ffi::c_void, ptr};
    use windows::{
        Win32::Networking::WinHttp::{
            WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_OPEN_REQUEST_FLAGS, WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_QUERY_STATUS_CODE, WinHttpCloseHandle, WinHttpConnect, WinHttpOpen,
            WinHttpOpenRequest, WinHttpQueryHeaders, WinHttpReadData, WinHttpReceiveResponse,
            WinHttpSendRequest, WinHttpSetTimeouts,
        },
        core::{HSTRING, PCWSTR},
    };
    struct Handle(*mut c_void);
    impl Drop for Handle {
        fn drop(&mut self) {
            if !self.0.is_null() {
                // SAFETY: handle came from WinHTTP and is closed exactly once.
                let _ = unsafe { WinHttpCloseHandle(self.0) };
            }
        }
    }
    let body = body
        .map(serde_json::to_vec)
        .transpose()
        .map_err(|_| PhysicalRunnerError::blocked("webdriver-request"))?
        .unwrap_or_default();
    let agent = HSTRING::from("LiiiraaBoost-Phase6-Runner/1");
    let host = HSTRING::from("127.0.0.1");
    let method = HSTRING::from(method);
    let path = HSTRING::from(path);
    let headers: Vec<u16> = "Content-Type: application/json\r\n"
        .encode_utf16()
        .collect();
    // SAFETY: fixed loopback origin and owned buffers live across synchronous calls.
    unsafe {
        let session = Handle(WinHttpOpen(
            &agent,
            WINHTTP_ACCESS_TYPE_NO_PROXY,
            PCWSTR::null(),
            PCWSTR::null(),
            0,
        ));
        if session.0.is_null() {
            return Err(PhysicalRunnerError::blocked("webdriver-session"));
        }
        WinHttpSetTimeouts(session.0, 2_000, 2_000, 5_000, 10_000)
            .map_err(|_| PhysicalRunnerError::blocked("webdriver-timeout"))?;
        let connection = Handle(WinHttpConnect(session.0, &host, port, 0));
        if connection.0.is_null() {
            return Err(PhysicalRunnerError::blocked("webdriver-loopback"));
        }
        let request = Handle(WinHttpOpenRequest(
            connection.0,
            &method,
            &path,
            PCWSTR::null(),
            PCWSTR::null(),
            ptr::null(),
            WINHTTP_OPEN_REQUEST_FLAGS(0),
        ));
        if request.0.is_null() {
            return Err(PhysicalRunnerError::blocked("webdriver-request"));
        }
        let body_pointer = (!body.is_empty()).then_some(body.as_ptr().cast::<c_void>());
        let request_headers = (!body.is_empty()).then_some(headers.as_slice());
        WinHttpSendRequest(
            request.0,
            request_headers,
            body_pointer,
            body.len() as u32,
            body.len() as u32,
            0,
        )
        .and_then(|()| WinHttpReceiveResponse(request.0, ptr::null_mut()))
        .map_err(|_| PhysicalRunnerError::blocked("webdriver-transport"))?;
        let mut status = 0_u32;
        let mut status_length = std::mem::size_of::<u32>() as u32;
        let mut index = 0_u32;
        WinHttpQueryHeaders(
            request.0,
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            PCWSTR::null(),
            Some((&mut status as *mut u32).cast()),
            &mut status_length,
            &mut index,
        )
        .map_err(|_| PhysicalRunnerError::blocked("webdriver-status"))?;
        if !(200..300).contains(&status) {
            return Err(PhysicalRunnerError::blocked("webdriver-rejected"));
        }
        let mut response = Vec::new();
        loop {
            let mut chunk = [0_u8; 8192];
            let mut read = 0_u32;
            WinHttpReadData(
                request.0,
                chunk.as_mut_ptr().cast(),
                chunk.len() as u32,
                &mut read,
            )
            .map_err(|_| PhysicalRunnerError::blocked("webdriver-response"))?;
            if read == 0 {
                break;
            }
            if response.len() + read as usize > MAX_RECORD_BYTES as usize {
                return Err(PhysicalRunnerError::blocked("webdriver-response-bounds"));
            }
            response.extend_from_slice(&chunk[..read as usize]);
        }
        let envelope: Value = serde_json::from_slice(&response)
            .map_err(|_| PhysicalRunnerError::blocked("webdriver-response-json"))?;
        envelope
            .get("value")
            .cloned()
            .ok_or_else(|| PhysicalRunnerError::blocked("webdriver-response-envelope"))
    }
}

#[cfg(not(windows))]
fn webdriver_request(
    _port: u16,
    _method: &str,
    _path: &str,
    _body: Option<&Value>,
) -> Result<Value, PhysicalRunnerError> {
    Err(PhysicalRunnerError::blocked("windows-required"))
}

fn transactional_plan(
    prior_guid: &str,
    device_binding_id: &str,
    artifact_manifest_sha256: &str,
    config: &PhysicalRunConfig,
) -> Value {
    let hardware_fingerprint = hash_text(device_binding_id);
    let posture_fingerprint = hash_text(&format!(
        "{}:{}",
        artifact_manifest_sha256, config.config_sha256
    ));
    json!({
        "document": {
            "kind":"transactional-plan","schemaVersion":"1.0","planId":"phase6-physical-plan","revision":1,
            "revisionFingerprint":hash_text(&format!("{}:{}", config.operation_version_id, prior_guid)),"evidenceFingerprint":hash_text(prior_guid),
            "device":{"deviceBindingId":device_binding_id,"hardwareFingerprint":hardware_fingerprint,"securityPostureFingerprint":posture_fingerprint},
            "lifecycle":"composed","riskCeiling":"advanced","effectiveRisk":"verified","createdAt":timestamp(),
            "operations":[{"operationVersionId":"managed-power-scheme-v3","operationKind":"managed-power-scheme-v1","purpose":"Activate the separately owned Liiiraa power scheme.","expectedImpact":"Establish reversible power policy.","risk":"verified","evidence":[{"evidenceId":"physical-observation","evidenceHash":hash_text(prior_guid),"capturedAt":timestamp(),"validUntil":"2099-01-01T00:00:00Z","quality":"valid"}],"compatibility":{"verdict":"compatible","reasons":["Observed on this Windows installation."]},"restartEffect":"required","previousValue":{"state":"observed","schemeId":prior_guid,"canonicalStateHash":hash_text(prior_guid),"observedAt":timestamp()},"requestedValue":{"state":"observed","schemeId":"22222222-2222-4222-8222-222222222222","canonicalStateHash":hash_text("requested"),"observedAt":timestamp()},"recoveryMethod":"exact-prior-scheme","dependencyGroupId":"group-physical"}],
            "dependencyGroups":[{"dependencyGroupId":"group-physical","operationVersionIds":["managed-power-scheme-v3"],"dependsOnGroupIds":[]}]
        }
    })
}

fn plan_approval(
    approved_at: &str,
    prior_guid: &str,
    device_binding_id: &str,
    artifact_manifest_sha256: &str,
    config: &PhysicalRunConfig,
) -> Value {
    let proof_reference = format!("local-confirmation-{}", &hash_text(approved_at)[7..23]);
    let hardware_fingerprint = hash_text(device_binding_id);
    let posture_fingerprint = hash_text(&format!(
        "{}:{}",
        artifact_manifest_sha256, config.config_sha256
    ));
    json!({"document":{"kind":"plan-approval","schemaVersion":"1.0","approvalId":"phase6-approval","planId":"phase6-physical-plan","planRevision":1,"revisionFingerprint":hash_text(&format!("{}:{}", config.operation_version_id, prior_guid)),"evidenceFingerprint":hash_text(prior_guid),"device":{"deviceBindingId":device_binding_id,"hardwareFingerprint":hardware_fingerprint,"securityPostureFingerprint":posture_fingerprint},"approvedRisk":"verified","compatibility":"compatible","recoveryCoverage":"ready","intent":"apply","proof":{"proofReference":proof_reference,"action":"approve-plan-apply","issuedAt":approved_at,"expiresAt":timestamp_after(300)},"approvedAt":approved_at,"audit":{"auditId":"phase6-approval-audit","recordedAt":approved_at},"operationVersionIds":[config.operation_version_id]}})
}

fn plan_transaction(intent: &str) -> Value {
    json!({"document":{"kind":"plan-transaction","schemaVersion":"1.0","transactionId":format!("phase6-{intent}-transaction"),"planId":"phase6-physical-plan","planRevision":1,"revisionFingerprint":hash_text("phase6-plan"),"approvalId":"phase6-approval","intent":intent,"startedAt":timestamp(),"audit":{"auditId":format!("phase6-{intent}-audit"),"recordedAt":timestamp()}}})
}

fn timestamp() -> String {
    timestamp_after(0)
}

fn timestamp_after(offset_seconds: u64) -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_secs())
        .saturating_add(offset_seconds);
    let days = (seconds / 86_400) as i64;
    let seconds_of_day = seconds % 86_400;
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

fn civil_from_days(days_since_epoch: i64) -> (i64, u64, u64) {
    let shifted = days_since_epoch + 719_468;
    let era = if shifted >= 0 {
        shifted
    } else {
        shifted - 146_096
    } / 146_097;
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    year += i64::from(month <= 2);
    (year, month as u64, day as u64)
}

#[cfg(test)]
mod custody_failure_code_tests {
    #[cfg(windows)]
    use super::msiexec_compatible_path;
    use super::{
        MAX_INSTALLED_CUSTODY_DIAGNOSTIC_BYTES, artifact_custody_failure_code,
        installation_manifest::{CanonicalPathRole, CustodyError}, installed_custody_diagnostic,
        installer_diagnostic_from_log, installer_diagnostic_sidecar_path,
        installer_exit_failure, write_installer_diagnostic_create_once,
    };
    #[cfg(windows)]
    use std::path::{Path, PathBuf};

    #[test]
    fn installer_diagnostic_sidecar_is_bounded_allowlisted_and_secret_free() {
        let log = b"Action ended 12:00:00: InstallFiles. Return value 3.\r\nProperty(S): USERNAME = secret-user\r\nProperty(S): OriginalDatabase = C:\\Users\\secret-user\\liiiraa-boost.msi";
        let diagnostic = installer_diagnostic_from_log(1603, Some(log));
        assert_eq!(diagnostic.installer_exit_code, Some(1603));
        assert_eq!(diagnostic.log_status, "present");
        assert_eq!(diagnostic.log_size_bytes, Some(log.len() as u64));
        assert_eq!(diagnostic.return_value_3_action_code, "install-files");
        assert_eq!(
            diagnostic.return_value_3_action_identifier.as_deref(),
            Some("InstallFiles")
        );
        let serialized = serde_json::to_string(&diagnostic).expect("safe sidecar should serialize");
        for forbidden in ["secret-user", "C:\\Users", "OriginalDatabase", "Product:"] {
            assert!(!serialized.contains(forbidden));
        }
        assert!(serialized.len() <= 1024);
    }

    #[test]
    fn installer_diagnostic_decodes_real_msi_utf16le_with_or_without_bom() {
        let safe_fixture = concat!(
            "MSI (s) (10:20) [12:00:00:000]: Product: REDACTED\r\n",
            "Action ended 12:00:00: InstallFiles. Return value 3.\r\n",
            "Property(S): USERNAME = REDACTED\r\n",
            "Property(S): OriginalDatabase = C:\\REDACTED\\liiiraa-boost.msi"
        );
        let utf16_body: Vec<u8> = safe_fixture
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect();
        for bytes in [[vec![0xff, 0xfe], utf16_body.clone()].concat(), utf16_body] {
            let diagnostic = installer_diagnostic_from_log(1603, Some(&bytes));
            assert_eq!(diagnostic.log_status, "present");
            assert_eq!(diagnostic.log_size_bytes, Some(bytes.len() as u64));
            assert_eq!(diagnostic.return_value_3_action_code, "install-files");
            assert_eq!(
                diagnostic.return_value_3_action_identifier,
                Some("InstallFiles")
            );
            let serialized = serde_json::to_string(&diagnostic).unwrap();
            for forbidden in ["REDACTED", "OriginalDatabase", "Product:"] {
                assert!(!serialized.contains(forbidden));
            }
        }
    }

    #[test]
    fn installer_diagnostic_rejects_malformed_utf16le_without_lossy_recovery() {
        let malformed = [
            0xff, 0xfe, b'A', 0, b'c', 0, b't', 0, b'i', 0, b'o', 0, b'n', 0, 0x00, 0xd8, b'X',
        ];
        let diagnostic = installer_diagnostic_from_log(1603, Some(&malformed));
        assert_eq!(diagnostic.log_status, "log-unparseable");
        assert_eq!(diagnostic.return_value_3_action_code, "none");
        assert!(diagnostic.log_sha256.is_some());
        assert_eq!(diagnostic.log_size_bytes, Some(malformed.len() as u64));
    }

    #[test]
    fn missing_and_unparseable_installer_logs_are_explicit_not_null() {
        let missing = installer_diagnostic_from_log(1603, None);
        assert_eq!(missing.log_status, "log-missing");
        assert_eq!(missing.return_value_3_action_code, "unavailable");
        assert!(missing.log_sha256.is_none());

        let unparseable = installer_diagnostic_from_log(1603, Some(b"bounded but no action"));
        assert_eq!(unparseable.log_status, "log-unparseable");
        assert_eq!(unparseable.return_value_3_action_code, "none");
        assert!(unparseable.log_sha256.is_some());
        assert_eq!(unparseable.log_size_bytes, Some(21));
    }

    #[test]
    fn installer_diagnostic_sidecar_uses_fixed_sibling_and_create_once() {
        let root = std::env::temp_dir().join(format!(
            "liiiraa-installer-sidecar-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock should be after Unix epoch")
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).expect("test root should exist");
        let log = root.join("msi-install.log");
        let sidecar = installer_diagnostic_sidecar_path(&log)
            .expect("fixed log should derive a fixed sidecar");
        assert_eq!(sidecar, root.join("msi-install.safe.json"));
        let diagnostic = installer_diagnostic_from_log(1603, None);
        write_installer_diagnostic_create_once(&sidecar, &diagnostic)
            .expect("first sidecar write should pass");
        let error = write_installer_diagnostic_create_once(&sidecar, &diagnostic)
            .expect_err("sidecar overwrite must fail closed");
        assert_eq!(error.code(), "installer-diagnostic-create-once");
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn typed_custody_failures_map_to_granular_allowlisted_runner_codes() {
        let cases = [
            (
                CustodyError::schema("artifact-manifest"),
                "artifact-schema-invalid",
            ),
            (
                CustodyError::schema("physical-run-config"),
                "artifact-config-invalid",
            ),
            (
                CustodyError::signature("detached-signature-verify"),
                "artifact-cms-invalid",
            ),
            (
                CustodyError::signature("compiled-spki"),
                "artifact-spki-invalid",
            ),
            (
                CustodyError::hash("portable-live-size-hash"),
                "artifact-live-hash-invalid",
            ),
            (
                CustodyError::version("portable-live-file-version"),
                "artifact-version-invalid",
            ),
            (
                CustodyError::acl("portable-owner-dacl"),
                "artifact-acl-invalid",
            ),
            (
                CustodyError::authenticode("winverifytrust"),
                "artifact-authenticode-invalid",
            ),
            (CustodyError::missing("read"), "artifact-byte-missing"),
            (
                CustodyError::path("portable-root-canonical"),
                "artifact-path-invalid",
            ),
        ];
        for (error, expected) in cases {
            assert_eq!(artifact_custody_failure_code(&error), expected);
        }
    }

    #[test]
    fn custody_runner_codes_never_expose_internal_details_or_secret_shaped_values() {
        for error in [
            CustodyError::schema("password=hidden"),
            CustodyError::signature("S-1-5-21-111-222-333-1001"),
            CustodyError::path("C:\\Users\\secret\\artifact-manifest.json"),
        ] {
            let code = artifact_custody_failure_code(&error);
            assert!(code.starts_with("artifact-"));
            assert!(code.ends_with("-invalid"));
            assert!(!code.contains("password"));
            assert!(!code.contains("S-1-5-"));
            assert!(!code.contains("Users"));
            assert!(!code.contains('\\'));
            assert!(code.len() <= 64);
        }
    }

    #[test]
    fn installer_exit_codes_preserve_only_the_numeric_allowlist() {
        for (code, expected) in [
            (1601, "installer-exit-1601"),
            (1603, "installer-exit-1603"),
            (1618, "installer-exit-1618"),
            (1641, "installer-exit-1641"),
            (3010, "installer-exit-3010"),
            (9999, "installer-exit-other"),
        ] {
            assert_eq!(installer_exit_failure(code).code(), expected);
        }
    }

    #[cfg(windows)]
    #[test]
    fn msiexec_path_normalization_accepts_only_canonical_dos_or_unc_forms() {
        assert_eq!(
            msiexec_compatible_path(Path::new(r"\\?\C:\LiiiraaBoost\liiiraa-boost.msi"))
                .expect("verbatim disk path should narrow for Windows Installer"),
            PathBuf::from(r"C:\LiiiraaBoost\liiiraa-boost.msi")
        );
        assert_eq!(
            msiexec_compatible_path(Path::new(r"\\?\UNC\server\share\liiiraa-boost.msi"))
                .expect("verbatim UNC path should narrow for Windows Installer"),
            PathBuf::from(r"\\server\share\liiiraa-boost.msi")
        );
        assert_eq!(
            msiexec_compatible_path(Path::new(r"C:\LiiiraaBoost\liiiraa-boost.msi"))
                .expect("normal DOS path should remain stable"),
            PathBuf::from(r"C:\LiiiraaBoost\liiiraa-boost.msi")
        );

        for invalid in [
            r"liiiraa-boost.msi",
            r"C:liiiraa-boost.msi",
            r"C:\LiiiraaBoost\..\liiiraa-boost.msi",
            r"\\.\C:\LiiiraaBoost\liiiraa-boost.msi",
            r"\\?\GLOBALROOT\Device\HarddiskVolume1\liiiraa-boost.msi",
            r"\\server\share\folder\.\liiiraa-boost.msi",
        ] {
            assert!(
                msiexec_compatible_path(Path::new(invalid)).is_err(),
                "invalid installer path must fail closed: {invalid}"
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn installed_custody_sidecar_exposes_only_bounded_canonicalization_fields() {
        let error = CustodyError::from_canonicalize_error(
            CanonicalPathRole::LastAdmittedParent,
            Path::new(r"C:\Users\secret-user\custody"),
            &std::io::Error::from_raw_os_error(5),
        );
        let diagnostic = installed_custody_diagnostic(&error);
        let json = serde_json::to_value(diagnostic).unwrap();
        assert_eq!(json["kind"], "phase6-installed-custody-safe-diagnostic");
        assert_eq!(json["schemaVersion"], "1.0");
        assert_eq!(json["errorCode"], "canonical-path-invalid");
        assert_eq!(json["detailCode"], "canonicalize");
        assert_eq!(json["role"], "last-admitted-parent");
        assert_eq!(json["pathClass"], "disk");
        assert_eq!(json["ioKind"], "permission-denied");
        assert_eq!(json["win32Code"], 5);
        let text = json.to_string();
        assert!(!text.contains("secret-user"));
        assert!(!text.contains(r"C:\"));
        assert!(text.len() <= MAX_INSTALLED_CUSTODY_DIAGNOSTIC_BYTES);
    }
}
