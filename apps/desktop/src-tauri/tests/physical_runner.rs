#[path = "../src/physical_runner.rs"]
mod physical_runner;

use std::{
    collections::{BTreeMap, VecDeque},
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use physical_runner::{
    ArtifactCustody, FriendsRosterBinding, PhysicalGuestRunner, PhysicalRunConfig,
    PhysicalRunnerError, PhysicalRunnerIo, PhysicalRunnerState, PhysicalStage, RecordKind,
    RunPaths, TRUSTED_INSTALLER_SPKI_SHA256, TauriCommandSet, load_run_config, parse_runner_args,
};
use serde_json::json;
use sha2::{Digest, Sha256};

#[derive(Default)]
struct FakeIo {
    events: Vec<String>,
    records: BTreeMap<RecordKind, Vec<u8>>,
    artifact_error: Option<PhysicalRunnerError>,
    roster: Option<FriendsRosterBinding>,
    observations: VecDeque<String>,
    self_path: Option<PathBuf>,
    self_sha256: Option<String>,
    approval_error: Option<PhysicalRunnerError>,
    consent_error: Option<PhysicalRunnerError>,
    exported: bool,
}

impl FakeIo {
    fn event(&mut self, value: impl Into<String>) {
        self.events.push(value.into());
    }
}

impl PhysicalRunnerIo for FakeIo {
    fn verify_artifact_custody(
        &mut self,
        config: &PhysicalRunConfig,
        trusted_spki_sha256: &str,
    ) -> Result<ArtifactCustody, PhysicalRunnerError> {
        self.event(format!("verify-artifact:{trusted_spki_sha256}"));
        if let Some(error) = self.artifact_error.clone() {
            return Err(error);
        }
        assert_eq!(trusted_spki_sha256, TRUSTED_INSTALLER_SPKI_SHA256);
        Ok(ArtifactCustody::test_fixture(config))
    }

    fn verify_friends_roster(
        &mut self,
        _artifact: &ArtifactCustody,
        roster_path: &str,
        signature_path: &str,
    ) -> Result<FriendsRosterBinding, PhysicalRunnerError> {
        self.event(format!("verify-roster:{roster_path}:{signature_path}"));
        self.roster
            .clone()
            .ok_or_else(|| PhysicalRunnerError::blocked("friends-roster-invalid"))
    }

    fn current_executable_sha256(&mut self) -> Result<String, PhysicalRunnerError> {
        self.event("verify-self");
        Ok(self
            .self_sha256
            .clone()
            .unwrap_or_else(|| format!("sha256:{}", "c".repeat(64))))
    }

    fn current_executable_path(&mut self) -> Result<PathBuf, PhysicalRunnerError> {
        self.event("verify-self-path");
        Ok(self
            .self_path
            .clone()
            .unwrap_or_else(|| PathBuf::from(r"C:\phase6\phase6-physical-runner.exe")))
    }

    fn local_device_binding_id(&mut self) -> Result<String, PhysicalRunnerError> {
        self.event("derive-local-device-binding");
        Ok(format!("sha256:{}", "e".repeat(64)))
    }

    fn install_msi(
        &mut self,
        executable: &str,
        args: &[String],
    ) -> Result<(), PhysicalRunnerError> {
        self.event(format!("install:{executable}:{}", args.join("|")));
        Ok(())
    }

    fn verify_installed(&mut self, _artifact: &ArtifactCustody) -> Result<(), PhysicalRunnerError> {
        self.event("verify-installed");
        Ok(())
    }

    fn create_local_recovery_checkpoint(&mut self) -> Result<String, PhysicalRunnerError> {
        self.event("create-checkpoint");
        Ok("checkpoint-observed-0001".to_owned())
    }

    fn launch_webdriver(
        &mut self,
        tauri_driver: &str,
        msedge_driver: &str,
    ) -> Result<(), PhysicalRunnerError> {
        self.event(format!("webdriver:{tauri_driver}:{msedge_driver}"));
        Ok(())
    }

    fn invoke_tauri(
        &mut self,
        command: &str,
        _payload: &serde_json::Value,
    ) -> Result<serde_json::Value, PhysicalRunnerError> {
        self.event(format!("tauri:{command}"));
        Ok(serde_json::json!({"accepted": true}))
    }

    fn observe_windows_state(&mut self) -> Result<String, PhysicalRunnerError> {
        self.event("observe");
        Ok(self
            .observations
            .pop_front()
            .unwrap_or_else(|| "00000000-0000-0000-0000-000000000001".to_owned()))
    }

    fn confirm_plan_apply(
        &mut self,
        plan_id: &str,
        operation_version_id: &str,
    ) -> Result<String, PhysicalRunnerError> {
        self.event(format!("confirm-apply:{plan_id}:{operation_version_id}"));
        if let Some(error) = self.approval_error.clone() {
            return Err(error);
        }
        Ok("2026-08-14T01:00:00Z".to_owned())
    }

    fn preview_redacted(&mut self, value: &str) -> Result<(), PhysicalRunnerError> {
        self.event(format!("preview:{}", value.len()));
        Ok(())
    }

    fn confirm_friends_export(
        &mut self,
        binding: &FriendsRosterBinding,
        preview_sha256: &str,
    ) -> Result<String, PhysicalRunnerError> {
        self.event(format!(
            "consent:{}:{}:{}",
            binding.participant_id, binding.machine_slot, preview_sha256
        ));
        if let Some(error) = self.consent_error.clone() {
            return Err(error);
        }
        Ok("2026-08-14T01:00:00Z".to_owned())
    }

    fn export_raw_envelope(&mut self, bytes: &[u8]) -> Result<(), PhysicalRunnerError> {
        self.event(format!("export:{}", bytes.len()));
        self.exported = true;
        Ok(())
    }

    fn read_record(&mut self, kind: RecordKind) -> Result<Option<Vec<u8>>, PhysicalRunnerError> {
        self.event(format!("read-record:{kind:?}"));
        Ok(self.records.get(&kind).cloned())
    }

    fn write_record_exclusive(
        &mut self,
        kind: RecordKind,
        bytes: &[u8],
    ) -> Result<(), PhysicalRunnerError> {
        self.event(format!("write-record:{kind:?}"));
        if self.records.contains_key(&kind) {
            return Err(PhysicalRunnerError::blocked("record-already-exists"));
        }
        self.records.insert(kind, bytes.to_vec());
        Ok(())
    }
}

fn lifecycle_observations() -> VecDeque<String> {
    [
        "00000000-0000-0000-0000-000000000001",
        "22222222-2222-4222-8222-222222222222",
        "22222222-2222-4222-8222-222222222222",
        "00000000-0000-0000-0000-000000000001",
    ]
    .into_iter()
    .map(str::to_owned)
    .collect()
}

fn config(stage: PhysicalStage) -> PhysicalRunConfig {
    PhysicalRunConfig {
        stage,
        config_path: PathBuf::from(r"C:\phase6\configs\run-config.json"),
        artifact_manifest_path: PathBuf::from(r"C:\phase6\artifact-manifest.json"),
        config_sha256: format!("sha256:{}", "b".repeat(64)),
        operation_version_id: "managed-power-scheme-v3".to_owned(),
        build_id: "physical-build-0001".to_owned(),
        source_commit: "a".repeat(40),
        paths: RunPaths::for_stage(stage),
        commands: TauriCommandSet::closed(),
        friends_roster_paths: (stage == PhysicalStage::FriendsPc).then(|| {
            (
                "friends/friends-roster.json".to_owned(),
                "friends/friends-roster.json.p7s".to_owned(),
            )
        }),
    }
}

fn unique_artifact_root(test_name: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock should follow the Unix epoch")
        .as_nanos();
    std::env::temp_dir().join(format!(
        "liiiraa-phase6-physical-runner-{test_name}-{}-{nonce}",
        std::process::id()
    ))
}

fn valid_clean_vm_config_bytes() -> Vec<u8> {
    serde_json::to_vec(&json!({
        "kind": "physical-run-config",
        "schemaVersion": "1.0",
        "configId": "clean-windows-vm-config-0001",
        "stage": "clean-windows-vm",
        "configPath": "configs/clean-windows-vm.run-config.json",
        "artifactManifestPath": "artifact-manifest.json",
        "operationVersionId": "managed-power-scheme-v46",
        "buildId": "physical-build-v46",
        "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "participantIdentityMode": "purpose-bound-local-hash",
        "scenarios": {
            "prepareRecovery": true,
            "apply": true,
            "verifyApplied": true,
            "rebootWhenRequired": true,
            "restore": true,
            "verifyRestored": true
        },
        "paths": {
            "runRecordPath": "state/clean-windows-vm/run-record.json",
            "installedReadyRecordPath": "state/clean-windows-vm/installed-ready.json",
            "checkpointReadyRecordPath": "state/clean-windows-vm/checkpoint-ready.json",
            "continuationPath": "state/clean-windows-vm/physical-continuation.json",
            "rawEnvelopePath": "evidence/clean-windows-vm/raw-run-envelope.json"
        },
        "tauriCommands": {
            "composePlan": "compose_plan",
            "revisePlan": "revise_plan",
            "approvePlan": "approve_plan",
            "applyPlan": "apply_plan",
            "restorePlanOperation": "restore_plan_operation",
            "restorePlan": "restore_plan",
            "restoreRecoveryCheckpoint": "restore_recovery_checkpoint",
            "readPlanExecution": "read_plan_execution",
            "subscribePlanExecution": "subscribe_plan_execution",
            "previewPlanDiagnostic": "preview_plan_diagnostic",
            "exportPlanDiagnostic": "export_plan_diagnostic",
            "readAdvancedPreference": "read_advanced_preference",
            "enableAdvancedPreference": "enable_advanced_preference",
            "revokeAdvancedPreference": "revoke_advanced_preference"
        }
    }))
    .expect("valid config fixture should serialize")
}

#[test]
fn cli_accepts_only_one_absolute_run_config_argument() {
    let parsed = parse_runner_args(&[
        "phase6-physical-runner.exe".to_owned(),
        "--run-config".to_owned(),
        r"C:\phase6\configs\owner-pc.run-config.json".to_owned(),
    ])
    .expect("closed CLI should accept one absolute config");
    assert!(parsed.is_absolute());

    for args in [
        vec!["runner.exe", "--stage", "owner-pc"],
        vec!["runner.exe", "--run-config", r"relative\config.json"],
        vec![
            "runner.exe",
            "--run-config",
            r"C:\phase6\configs\.\owner-pc.run-config.json",
        ],
        vec![
            "runner.exe",
            "--run-config",
            r"C:\phase6\configs\..\owner-pc.run-config.json",
        ],
        vec![
            "runner.exe",
            "--run-config",
            r"C:\phase6\configs\owner-pc.run-config.txt",
        ],
        vec![
            "runner.exe",
            "--run-config",
            r"C:\phase6\config.json",
            "--participant",
            "friend-01",
        ],
        vec![
            "runner.exe",
            "--run-config",
            r"C:\phase6\config.json",
            "--executable",
            "powershell.exe",
        ],
    ] {
        assert!(
            parse_runner_args(&args.into_iter().map(str::to_owned).collect::<Vec<_>>()).is_err()
        );
    }
}

#[cfg(windows)]
#[test]
fn load_run_config_accepts_normal_windows_path_but_uses_canonical_io_and_exact_bytes() {
    let root = unique_artifact_root("normal-extended");
    let configs = root.join("configs");
    fs::create_dir_all(&configs).expect("test config directory should be created");
    let path = configs.join("clean-windows-vm.run-config.json");
    let bytes = valid_clean_vm_config_bytes();
    fs::write(&path, &bytes).expect("test config should be written");
    let canonical = fs::canonicalize(&path).expect("test config should canonicalize");
    assert_ne!(
        canonical, path,
        "Windows should expose the extended canonical form"
    );

    let loaded = load_run_config(&path).expect("normal and extended forms identify the same file");
    assert_eq!(loaded.config_path, canonical);
    assert_eq!(
        loaded.artifact_manifest_path,
        loaded
            .config_path
            .parent()
            .and_then(Path::parent)
            .expect("canonical config should retain its artifact root")
            .join("artifact-manifest.json")
    );
    assert_eq!(
        loaded.config_sha256,
        format!("sha256:{:x}", Sha256::digest(&bytes))
    );

    fs::remove_dir_all(root).expect("test artifact root should be removed");
}

#[cfg(windows)]
#[test]
fn load_run_config_rejects_a_different_existing_config_path() {
    let root = unique_artifact_root("different-existing-path");
    let configs = root.join("configs");
    fs::create_dir_all(&configs).expect("test config directory should be created");
    let different = configs.join("different.run-config.json");
    fs::write(&different, valid_clean_vm_config_bytes()).expect("test config should be written");

    assert!(load_run_config(&different).is_err());

    fs::remove_dir_all(root).expect("test artifact root should be removed");
}

#[cfg(windows)]
#[test]
fn load_run_config_rejects_symlink_alias_ambiguity() {
    use std::os::windows::fs::symlink_file;

    let root = unique_artifact_root("symlink-alias");
    let configs = root.join("configs");
    fs::create_dir_all(&configs).expect("test config directory should be created");
    let target = configs.join("clean-windows-vm.run-config.json");
    let alias = configs.join("alias.run-config.json");
    fs::write(&target, valid_clean_vm_config_bytes()).expect("test config should be written");
    match symlink_file(&target, &alias) {
        Ok(()) => {
            assert!(load_run_config(&alias).is_err());
            fs::remove_file(&alias).expect("test alias should be removed");
        }
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => {}
        Err(error) => panic!("test symlink should be created or require privilege: {error}"),
    }
    fs::remove_dir_all(root).expect("test artifact root should be removed");
}

#[test]
fn custody_failure_blocks_before_install_or_process_launch() {
    let mut io = FakeIo {
        artifact_error: Some(PhysicalRunnerError::blocked("signature-invalid")),
        ..FakeIo::default()
    };
    let result = PhysicalGuestRunner::new(config(PhysicalStage::CleanWindowsVm)).run(&mut io);
    assert!(result.is_err());
    assert_eq!(
        io.events,
        vec![format!("verify-artifact:{TRUSTED_INSTALLER_SPKI_SHA256}")]
    );
}

#[test]
fn first_invocation_installs_with_fixed_array_and_stops_at_installed_ready() {
    let mut io = FakeIo::default();
    let state = PhysicalGuestRunner::new(config(PhysicalStage::CleanWindowsVm))
        .run(&mut io)
        .expect("installation boundary should complete");
    assert_eq!(state, PhysicalRunnerState::InstalledReady);
    assert!(io.events.iter().any(|event| {
        event == "install:msiexec.exe:/i|C:\\phase6\\liiiraa-boost.msi|/qn|/norestart"
    }));
    assert!(io.events.contains(&"verify-installed".to_owned()));
    assert!(
        io.events
            .contains(&"write-record:InstalledReady".to_owned())
    );
    assert!(
        !io.events
            .iter()
            .any(|event| event.starts_with("webdriver:"))
    );
}

#[test]
fn clean_vm_refuses_cycle_until_bridge_checkpoint_record_exists() {
    let mut io = FakeIo::default();
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    let error = PhysicalGuestRunner::new(config(PhysicalStage::CleanWindowsVm))
        .run(&mut io)
        .expect_err("VM must wait for bridge checkpoint");
    assert_eq!(error.code(), "checkpoint-required");
    assert!(
        !io.events
            .iter()
            .any(|event| event.starts_with("webdriver:"))
    );
}

#[test]
fn owner_cycle_is_checkpointed_and_writes_reboot_continuation_before_returning() {
    let mut io = FakeIo {
        observations: lifecycle_observations(),
        ..FakeIo::default()
    };
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    let state = PhysicalGuestRunner::new(config(PhysicalStage::OwnerPc))
        .run(&mut io)
        .expect("owner cycle should reach reboot boundary");
    assert_eq!(state, PhysicalRunnerState::RebootPending);

    let expected_order = [
        "create-checkpoint",
        "write-record:CheckpointReady",
        "observe",
        "confirm-apply:phase6-physical-plan:managed-power-scheme-v3",
        "tauri:compose_plan",
        "tauri:approve_plan",
        "tauri:apply_plan",
        "tauri:read_plan_execution",
        "tauri:subscribe_plan_execution",
        "write-record:Continuation",
    ];
    let mut cursor = 0;
    for event in &io.events {
        if cursor < expected_order.len() && event == expected_order[cursor] {
            cursor += 1;
        }
    }
    assert_eq!(cursor, expected_order.len(), "events: {:?}", io.events);
    assert!(!io.exported);
}

#[test]
fn resume_verifies_identity_and_observes_before_restore_without_apply_redispatch() {
    let mut io = FakeIo {
        observations: lifecycle_observations(),
        ..FakeIo::default()
    };
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    io.records
        .insert(RecordKind::CheckpointReady, b"checkpoint".to_vec());
    PhysicalGuestRunner::new(config(PhysicalStage::OwnerPc))
        .run(&mut io)
        .expect("first pass should write the reboot continuation");
    io.events.clear();
    let state = PhysicalGuestRunner::new(config(PhysicalStage::OwnerPc))
        .run(&mut io)
        .expect("resume should restore after observation");
    assert_eq!(state, PhysicalRunnerState::Completed);

    let verify_self = io
        .events
        .iter()
        .position(|event| event == "verify-self")
        .unwrap();
    let observation = io
        .events
        .iter()
        .position(|event| event == "observe")
        .unwrap();
    let restore = io
        .events
        .iter()
        .position(|event| event == "tauri:restore_plan")
        .unwrap();
    assert!(verify_self < observation && observation < restore);
    assert!(!io.events.iter().any(|event| event == "tauri:apply_plan"));
}

#[test]
fn friends_requires_one_local_roster_match_and_consent_precedes_export() {
    let mut io = FakeIo {
        roster: Some(FriendsRosterBinding {
            roster_sha256: format!("sha256:{}", "d".repeat(64)),
            participant_id: format!("sha256:{}", "e".repeat(64)),
            machine_slot: "friend-01".to_owned(),
            match_count: 1,
        }),
        observations: lifecycle_observations(),
        ..FakeIo::default()
    };
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    io.records
        .insert(RecordKind::CheckpointReady, b"checkpoint".to_vec());
    PhysicalGuestRunner::new(config(PhysicalStage::FriendsPc))
        .run(&mut io)
        .expect("first pass should write the reboot continuation");
    io.events.clear();

    let state = PhysicalGuestRunner::new(config(PhysicalStage::FriendsPc))
        .run(&mut io)
        .expect("one signed local roster match should complete");
    assert_eq!(state, PhysicalRunnerState::Completed);
    let roster = io
        .events
        .iter()
        .position(|event| event.starts_with("verify-roster:"))
        .unwrap();
    let preview = io
        .events
        .iter()
        .position(|event| event.starts_with("preview:"))
        .unwrap();
    let consent = io
        .events
        .iter()
        .position(|event| event.starts_with("consent:"))
        .unwrap();
    let export = io
        .events
        .iter()
        .position(|event| event.starts_with("export:"))
        .unwrap();
    assert!(roster < preview && preview < consent && consent < export);
    let envelope = String::from_utf8(io.records[&RecordKind::RawEnvelope].clone()).unwrap();
    assert!(envelope.contains("phase6-physical-runner-rust-1"));
    assert!(envelope.contains("\"observation\""));
    assert!(envelope.contains("friendsRosterSha256"));
    assert!(envelope.contains("physical-security-drills-unmeasured"));
    assert!(!envelope.contains("\"status\":\"PASS\""));
    assert!(!envelope.contains("runEvidenceSha256"));
    assert!(!envelope.contains("reviewStatus"));
    assert!(!envelope.contains("promotionApproved"));
}

#[test]
fn ambiguous_friends_identity_blocks_before_preview_consent_or_export() {
    let mut io = FakeIo {
        roster: Some(FriendsRosterBinding {
            roster_sha256: format!("sha256:{}", "d".repeat(64)),
            participant_id: format!("sha256:{}", "e".repeat(64)),
            machine_slot: "friend-01".to_owned(),
            match_count: 2,
        }),
        ..FakeIo::default()
    };
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    io.records
        .insert(RecordKind::CheckpointReady, b"checkpoint".to_vec());
    io.records
        .insert(RecordKind::Continuation, b"continuation".to_vec());

    let error = PhysicalGuestRunner::new(config(PhysicalStage::FriendsPc))
        .run(&mut io)
        .expect_err("ambiguous roster identity must block");
    assert_eq!(error.code(), "friends-participant-cardinality");
    assert!(!io.events.iter().any(|event| event.starts_with("preview:")));
    assert!(!io.events.iter().any(|event| event.starts_with("consent:")));
    assert!(!io.exported);
}

#[test]
fn invalid_continuation_blocks_before_webdriver_or_restore() {
    let mut io = FakeIo::default();
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    io.records
        .insert(RecordKind::CheckpointReady, b"checkpoint".to_vec());
    io.records
        .insert(RecordKind::Continuation, b"not-json".to_vec());

    let error = PhysicalGuestRunner::new(config(PhysicalStage::OwnerPc))
        .run(&mut io)
        .expect_err("mutable continuation bytes must be schema-valid");
    assert_eq!(error.code(), "continuation-json");
    assert!(
        !io.events
            .iter()
            .any(|event| event.starts_with("webdriver:"))
    );
    assert!(!io.events.iter().any(|event| event == "tauri:restore_plan"));
}

#[test]
fn live_runner_hash_mismatch_blocks_before_install_or_webdriver() {
    let mut io = FakeIo {
        self_sha256: Some(format!("sha256:{}", "f".repeat(64))),
        ..FakeIo::default()
    };
    let error = PhysicalGuestRunner::new(config(PhysicalStage::OwnerPc))
        .run(&mut io)
        .expect_err("the running executable must match the signed runner role");
    assert_eq!(error.code(), "runner-live-byte-mismatch");
    assert!(!io.events.iter().any(|event| event.starts_with("install:")));
    assert!(
        !io.events
            .iter()
            .any(|event| event.starts_with("webdriver:"))
    );
}

#[test]
fn copied_runner_path_blocks_even_when_live_bytes_match() {
    let mut io = FakeIo {
        self_path: Some(PathBuf::from(r"C:\Temp\phase6-physical-runner.exe")),
        ..FakeIo::default()
    };
    let error = PhysicalGuestRunner::new(config(PhysicalStage::OwnerPc))
        .run(&mut io)
        .expect_err("the exact manifest runner path is part of resume authority");
    assert_eq!(error.code(), "runner-live-path-mismatch");
    assert!(!io.events.iter().any(|event| event == "verify-self"));
    assert!(!io.events.iter().any(|event| event.starts_with("install:")));
}

#[test]
fn friends_consent_refusal_blocks_raw_envelope_export() {
    let mut io = FakeIo {
        roster: Some(FriendsRosterBinding {
            roster_sha256: format!("sha256:{}", "d".repeat(64)),
            participant_id: format!("sha256:{}", "e".repeat(64)),
            machine_slot: "friend-01".to_owned(),
            match_count: 1,
        }),
        observations: lifecycle_observations(),
        consent_error: Some(PhysicalRunnerError::blocked("friends-consent-refused")),
        ..FakeIo::default()
    };
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    io.records
        .insert(RecordKind::CheckpointReady, b"checkpoint".to_vec());
    PhysicalGuestRunner::new(config(PhysicalStage::FriendsPc))
        .run(&mut io)
        .expect("first pass should write the reboot continuation");
    io.events.clear();

    let error = PhysicalGuestRunner::new(config(PhysicalStage::FriendsPc))
        .run(&mut io)
        .expect_err("explicit export refusal must fail closed");
    assert_eq!(error.code(), "friends-consent-refused");
    assert!(!io.exported);
    assert!(!io.records.contains_key(&RecordKind::RawEnvelope));
}

#[test]
fn physical_apply_refusal_blocks_before_compose_or_broker_dispatch() {
    let mut io = FakeIo {
        observations: lifecycle_observations(),
        approval_error: Some(PhysicalRunnerError::blocked("plan-approval-refused")),
        ..FakeIo::default()
    };
    io.records
        .insert(RecordKind::InstalledReady, b"installed".to_vec());
    io.records
        .insert(RecordKind::CheckpointReady, b"checkpoint".to_vec());

    let error = PhysicalGuestRunner::new(config(PhysicalStage::OwnerPc))
        .run(&mut io)
        .expect_err("physical apply must never auto-approve");
    assert_eq!(error.code(), "plan-approval-refused");
    assert!(!io.events.iter().any(|event| event.starts_with("tauri:")));
    assert!(!io.records.contains_key(&RecordKind::Continuation));
}
