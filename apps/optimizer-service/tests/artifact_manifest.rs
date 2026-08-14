#[path = "../src/main.rs"]
mod service;

use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
    process::Command,
};

use serde_json::{Value, json};
use service::{
    artifact_manifest::{
        parse_artifact_verifier_args, verify_artifact_manifest_with_backend,
        verify_friends_roster_with_backend,
    },
    installation_manifest::{
        AuthenticodeEvidence, CustodyBackend, CustodyError, InstalledAdmissionState,
        SignerEvidence, TRUSTED_INSTALLER_SPKI_SHA256, canonical_json_bytes,
    },
};
use sha2::{Digest, Sha256};

const ROOT: &str = r"C:\phase6\artifact";
const THUMBPRINT: &str = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

#[derive(Default)]
struct FakeBackend {
    files: BTreeMap<PathBuf, Vec<u8>>,
    cms: BTreeMap<PathBuf, (Vec<u8>, String)>,
    authenticode: BTreeMap<PathBuf, AuthenticodeEvidence>,
    versions: BTreeMap<PathBuf, String>,
    reparse: BTreeSet<PathBuf>,
    portable_custody: bool,
    authenticode_calls: usize,
    version_calls: Vec<PathBuf>,
}

impl FakeBackend {
    fn root(&self) -> PathBuf {
        PathBuf::from(ROOT)
    }

    fn path(&self, relative: &str) -> PathBuf {
        self.root().join(relative.replace('/', "\\"))
    }

    fn set_signed_json(&mut self, relative: &str, value: &Value) {
        let path = self.path(relative);
        let signature_path = self.path(&format!("{relative}.p7s"));
        let bytes = serde_json::to_vec_pretty(value).unwrap();
        let canonical = canonical_json_bytes(&bytes).unwrap();
        self.files.insert(path, bytes);
        self.files
            .entry(signature_path.clone())
            .or_insert_with(|| format!("cms:{relative}").into_bytes());
        self.cms.insert(
            signature_path,
            (canonical, TRUSTED_INSTALLER_SPKI_SHA256.to_owned()),
        );
    }
}

impl CustodyBackend for FakeBackend {
    fn program_files_root(&mut self) -> Result<PathBuf, CustodyError> {
        Err(CustodyError::path("not-installed"))
    }

    fn canonicalize(&mut self, path: &Path) -> Result<PathBuf, CustodyError> {
        if path == self.root() || self.files.contains_key(path) {
            Ok(path.to_path_buf())
        } else {
            Err(CustodyError::missing("path"))
        }
    }

    fn read_file(&mut self, path: &Path) -> Result<Vec<u8>, CustodyError> {
        self.files
            .get(path)
            .cloned()
            .ok_or_else(|| CustodyError::missing("file"))
    }

    fn is_reparse_point(&mut self, path: &Path) -> Result<bool, CustodyError> {
        Ok(self.reparse.contains(path))
    }

    fn verify_detached_cms(
        &mut self,
        content: &[u8],
        signature_path: &Path,
    ) -> Result<SignerEvidence, CustodyError> {
        let (expected, spki) = self
            .cms
            .get(signature_path)
            .ok_or_else(|| CustodyError::signature("cms-missing"))?;
        if expected != content {
            return Err(CustodyError::signature("cms-content-mismatch"));
        }
        Ok(SignerEvidence {
            spki_sha256: spki.clone(),
        })
    }

    fn verify_authenticode(&mut self, path: &Path) -> Result<AuthenticodeEvidence, CustodyError> {
        self.authenticode_calls += 1;
        self.authenticode
            .get(path)
            .cloned()
            .ok_or_else(|| CustodyError::signature("authenticode-invalid"))
    }

    fn file_version(&mut self, path: &Path) -> Result<String, CustodyError> {
        self.version_calls.push(path.to_path_buf());
        self.versions
            .get(path)
            .cloned()
            .ok_or_else(|| CustodyError::version("version-unavailable"))
    }

    fn verify_installed_acl(
        &mut self,
        _root: &Path,
        _files: &[PathBuf],
    ) -> Result<(), CustodyError> {
        Err(CustodyError::acl("not-installed"))
    }

    fn verify_portable_root_custody(&mut self, _root: &Path) -> Result<(), CustodyError> {
        if self.portable_custody {
            Ok(())
        } else {
            Err(CustodyError::acl("portable-root-not-create-once"))
        }
    }

    fn last_admitted_installation(
        &mut self,
    ) -> Result<Option<InstalledAdmissionState>, CustodyError> {
        Ok(None)
    }
}

fn sha256(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn tauri_commands() -> Value {
    json!({
        "composePlan": "compose_plan", "revisePlan": "revise_plan",
        "approvePlan": "approve_plan", "applyPlan": "apply_plan",
        "restorePlanOperation": "restore_plan_operation", "restorePlan": "restore_plan",
        "restoreRecoveryCheckpoint": "restore_recovery_checkpoint",
        "readPlanExecution": "read_plan_execution",
        "subscribePlanExecution": "subscribe_plan_execution",
        "previewPlanDiagnostic": "preview_plan_diagnostic",
        "exportPlanDiagnostic": "export_plan_diagnostic",
        "readAdvancedPreference": "read_advanced_preference",
        "enableAdvancedPreference": "enable_advanced_preference",
        "revokeAdvancedPreference": "revoke_advanced_preference"
    })
}

fn config(stage: &str) -> Value {
    let (config_id, config_path, state_path) = match stage {
        "clean-windows-vm" => (
            "clean-windows-vm-config-0001",
            "configs/clean-windows-vm.run-config.json",
            "clean-windows-vm",
        ),
        "owner-pc" => (
            "owner-pc-config-0001",
            "configs/owner-pc.run-config.json",
            "owner-pc",
        ),
        "friends-pc" => (
            "friends-pc-config-0001",
            "configs/friends-pc.run-config.json",
            "friends-pc",
        ),
        _ => unreachable!(),
    };
    let mut value = json!({
        "kind": "physical-run-config", "schemaVersion": "1.0",
        "configId": config_id, "stage": stage, "configPath": config_path,
        "artifactManifestPath": "artifact-manifest.json",
        "operationVersionId": "managed-power-scheme-v3", "buildId": "physical-build-0001",
        "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "participantIdentityMode": "purpose-bound-local-hash",
        "scenarios": { "prepareRecovery": true, "apply": true, "verifyApplied": true,
            "rebootWhenRequired": true, "restore": true, "verifyRestored": true },
        "paths": {
            "runRecordPath": format!("state/{state_path}/run-record.json"),
            "installedReadyRecordPath": format!("state/{state_path}/installed-ready.json"),
            "checkpointReadyRecordPath": format!("state/{state_path}/checkpoint-ready.json"),
            "continuationPath": format!("state/{state_path}/physical-continuation.json"),
            "rawEnvelopePath": format!("evidence/{state_path}/raw-run-envelope.json")
        },
        "tauriCommands": tauri_commands()
    });
    if stage == "friends-pc" {
        value["friendsRosterPath"] = json!("friends/friends-roster.json");
        value["friendsRosterSignaturePath"] = json!("friends/friends-roster.json.p7s");
    }
    value
}

fn installed_manifest() -> Value {
    json!({
        "kind": "installation-manifest", "schemaVersion": "1.0",
        "manifestId": "installation-manifest-0001",
        "productCode": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "packageVersion": "1.2.0",
        "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "inputTreeHash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "buildId": "physical-build-0001", "operationVersionId": "managed-power-scheme-v3",
        "createdAt": "2026-08-13T13:00:00Z", "signerSpkiSha256": TRUSTED_INSTALLER_SPKI_SHA256,
        "files": {
            "desktop": { "role": "desktop", "relativePath": "liiiraa-desktop.exe", "sizeBytes": 1,
                "sha256": sha256(b"d"), "version": "1.2.0", "authenticodePublisher": "Liiiraa Boost Local Development", "authenticodeThumbprint": THUMBPRINT },
            "service": { "role": "service", "relativePath": "liiiraa-optimizer-service.exe", "sizeBytes": 1,
                "sha256": sha256(b"s"), "version": "1.2.0", "authenticodePublisher": "Liiiraa Boost Local Development", "authenticodeThumbprint": THUMBPRINT },
            "runner": { "role": "runner", "relativePath": "phase6-physical-runner.exe", "sizeBytes": 1,
                "sha256": sha256(b"r"), "version": "1.2.0", "authenticodePublisher": "Liiiraa Boost Local Development", "authenticodeThumbprint": THUMBPRINT }
        }
    })
}

fn fixture() -> FakeBackend {
    let mut backend = FakeBackend {
        portable_custody: true,
        ..FakeBackend::default()
    };
    let base_files = [
        ("liiiraa-boost.msi", b"msi".as_slice(), "1.2.0", true),
        (
            "phase6-physical-runner.exe",
            b"runner".as_slice(),
            "1.2.0",
            true,
        ),
        ("tauri-driver.exe", b"tauri".as_slice(), "2.0.6", true),
        ("msedgedriver.exe", b"edge".as_slice(), "stable", true),
    ];
    for (relative, bytes, version, signed) in base_files {
        let path = backend.path(relative);
        backend.files.insert(path.clone(), bytes.to_vec());
        backend.versions.insert(path.clone(), version.to_owned());
        if signed {
            backend.authenticode.insert(
                path,
                AuthenticodeEvidence {
                    publisher: "signed-publisher".to_owned(),
                    certificate_sha256: THUMBPRINT.to_owned(),
                    spki_sha256: TRUSTED_INSTALLER_SPKI_SHA256.to_owned(),
                },
            );
        }
    }

    let installation = installed_manifest();
    backend.set_signed_json("installation-manifest.json", &installation);
    for stage in ["clean-windows-vm", "owner-pc", "friends-pc"] {
        let value = config(stage);
        let relative = value["configPath"].as_str().unwrap().to_owned();
        backend.files.insert(
            backend.path(&relative),
            serde_json::to_vec_pretty(&value).unwrap(),
        );
    }

    let role = |relative: &str,
                version: &str,
                version_policy: &str,
                signature_policy: &str,
                bytes: &[u8]| {
        json!({ "relativePath": relative, "sizeBytes": bytes.len(), "sha256": sha256(bytes),
            "version": version, "versionPolicy": version_policy, "signaturePolicy": signature_policy })
    };
    let install_bytes = backend
        .files
        .get(&backend.path("installation-manifest.json"))
        .unwrap();
    let install_sig = backend
        .files
        .get(&backend.path("installation-manifest.json.p7s"))
        .unwrap();
    let clean = backend
        .files
        .get(&backend.path("configs/clean-windows-vm.run-config.json"))
        .unwrap();
    let owner = backend
        .files
        .get(&backend.path("configs/owner-pc.run-config.json"))
        .unwrap();
    let friends = backend
        .files
        .get(&backend.path("configs/friends-pc.run-config.json"))
        .unwrap();
    let mut manifest = json!({
        "kind": "artifact-manifest", "schemaVersion": "1.0", "manifestId": "artifact-manifest-0001",
        "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "inputTreeHash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "buildId": "physical-build-0001", "operationVersionId": "managed-power-scheme-v3",
        "createdAt": "2026-08-13T13:01:00Z",
        "files": {
            "msi": role("liiiraa-boost.msi", "1.2.0", "package-version", "authenticode-required", b"msi"),
            "installationManifest": role("installation-manifest.json", "1.0", "schema-version", "detached-cms-required", install_bytes),
            "installationManifestSignature": role("installation-manifest.json.p7s", "1.0", "not-applicable", "manifest-authenticated", install_sig),
            "cleanWindowsVmConfig": role("configs/clean-windows-vm.run-config.json", "1.0", "schema-version", "manifest-authenticated", clean),
            "ownerPcConfig": role("configs/owner-pc.run-config.json", "1.0", "schema-version", "manifest-authenticated", owner),
            "friendsPcConfig": role("configs/friends-pc.run-config.json", "1.0", "schema-version", "manifest-authenticated", friends),
            "runner": role("phase6-physical-runner.exe", "1.2.0", "file-version", "authenticode-required", b"runner"),
            "tauriDriver": {
                "role": "tauri-driver", "relativePath": "tauri-driver.exe", "sizeBytes": b"tauri".len(),
                "sha256": sha256(b"tauri"), "version": "2.0.6",
                "versionPolicy": "cargo-install-receipt", "signaturePolicy": "authenticode-required",
                "cargoInstallReceipt": {
                    "schemaVersion": "1.0", "packageName": "tauri-driver", "packageVersion": "2.0.6",
                    "versionRequirement": "=2.0.6", "source": "registry+https://github.com/rust-lang/crates.io-index",
                    "binaryName": "tauri-driver.exe"
                }
            },
            "msedgeDriver": role("msedgedriver.exe", "stable", "file-version", "authenticode-required", b"edge")
        }
    });
    for (key, role_name) in [
        ("msi", "msi"),
        ("installationManifest", "installation-manifest"),
        (
            "installationManifestSignature",
            "installation-manifest-signature",
        ),
        ("cleanWindowsVmConfig", "clean-windows-vm-config"),
        ("ownerPcConfig", "owner-pc-config"),
        ("friendsPcConfig", "friends-pc-config"),
        ("runner", "runner"),
        ("tauriDriver", "tauri-driver"),
        ("msedgeDriver", "msedgedriver"),
    ] {
        manifest["files"][key]["role"] = json!(role_name);
    }
    backend.set_signed_json("artifact-manifest.json", &manifest);
    backend
}

fn artifact_value(backend: &FakeBackend) -> Value {
    serde_json::from_slice(
        backend
            .files
            .get(&backend.path("artifact-manifest.json"))
            .unwrap(),
    )
    .unwrap()
}

#[test]
fn authenticates_exact_portable_roles_live_bytes_configs_and_both_drivers() {
    let mut backend = fixture();
    let path = backend.path("artifact-manifest.json");
    let verified = verify_artifact_manifest_with_backend(&path, &mut backend).unwrap();

    assert_eq!(verified.files().len(), 9);
    assert_eq!(verified.operation_version_id(), "managed-power-scheme-v3");
    assert_eq!(backend.authenticode_calls, 4);
    assert_eq!(backend.version_calls.len(), 3);
    assert!(!backend.version_calls.contains(&backend.path("tauri-driver.exe")));
    assert_eq!(verified.friends_config().config_sha256().len(), 71);
}

#[test]
fn cargo_receipt_policy_is_closed_to_exact_portable_tauri_driver_identity() {
    for mutation in [
        "missing-receipt",
        "receipt-version",
        "identity-version",
        "receipt-source",
        "legacy-file-version",
        "msedge-policy",
    ] {
        let mut backend = fixture();
        let mut value = artifact_value(&backend);
        match mutation {
            "missing-receipt" => {
                value["files"]["tauriDriver"].as_object_mut().unwrap().remove("cargoInstallReceipt");
            }
            "receipt-version" => value["files"]["tauriDriver"]["cargoInstallReceipt"]["packageVersion"] = json!("2.0.5"),
            "identity-version" => value["files"]["tauriDriver"]["version"] = json!("2.0.5"),
            "receipt-source" => value["files"]["tauriDriver"]["cargoInstallReceipt"]["source"] = json!("git+https://example.invalid/tauri-driver"),
            "legacy-file-version" => value["files"]["tauriDriver"]["versionPolicy"] = json!("file-version"),
            "msedge-policy" => value["files"]["msedgeDriver"]["versionPolicy"] = json!("cargo-install-receipt"),
            _ => unreachable!(),
        }
        backend.set_signed_json("artifact-manifest.json", &value);
        let path = backend.path("artifact-manifest.json");
        assert!(verify_artifact_manifest_with_backend(&path, &mut backend).is_err(), "{mutation}");
    }
}

#[test]
fn absent_or_swapped_roles_and_driver_as_installed_role_are_schema_invalid() {
    let mutations = [
        "missing-tauri",
        "missing-edge",
        "swapped",
        "extra",
        "installed-driver",
    ];
    for mutation in mutations {
        let mut backend = fixture();
        let mut value = artifact_value(&backend);
        match mutation {
            "missing-tauri" => {
                value["files"]
                    .as_object_mut()
                    .unwrap()
                    .remove("tauriDriver");
            }
            "missing-edge" => {
                value["files"]
                    .as_object_mut()
                    .unwrap()
                    .remove("msedgeDriver");
            }
            "swapped" => value["files"]["tauriDriver"]["relativePath"] = json!("msedgedriver.exe"),
            "extra" => value["files"]["helper"] = value["files"]["runner"].clone(),
            "installed-driver" => {
                let install_path = backend.path("installation-manifest.json");
                let mut install: Value =
                    serde_json::from_slice(backend.files.get(&install_path).unwrap()).unwrap();
                install["files"]["tauriDriver"] =
                    json!({"role":"tauri-driver","relativePath":"tauri-driver.exe"});
                backend.set_signed_json("installation-manifest.json", &install);
                let install_bytes = backend
                    .files
                    .get(&backend.path("installation-manifest.json"))
                    .unwrap();
                value["files"]["installationManifest"]["sizeBytes"] = json!(install_bytes.len());
                value["files"]["installationManifest"]["sha256"] = json!(sha256(install_bytes));
            }
            _ => unreachable!(),
        }
        backend.set_signed_json("artifact-manifest.json", &value);
        let path = backend.path("artifact-manifest.json");
        assert!(
            verify_artifact_manifest_with_backend(&path, &mut backend).is_err(),
            "{mutation}"
        );
        assert_eq!(backend.authenticode_calls, 0);
    }
}

#[test]
fn cms_spki_hash_version_authenticode_reparse_and_root_custody_mutations_fail_closed() {
    let mutations: Vec<Box<dyn FnOnce(&mut FakeBackend)>> = vec![
        Box::new(|backend| {
            backend
                .cms
                .remove(&backend.path("artifact-manifest.json.p7s"));
        }),
        Box::new(|backend| {
            backend
                .cms
                .get_mut(&backend.path("artifact-manifest.json.p7s"))
                .unwrap()
                .0 = b"swapped".to_vec();
        }),
        Box::new(|backend| {
            backend
                .cms
                .get_mut(&backend.path("artifact-manifest.json.p7s"))
                .unwrap()
                .1 = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                .to_owned();
        }),
        Box::new(|backend| {
            backend
                .files
                .insert(backend.path("tauri-driver.exe"), b"tampered".to_vec());
        }),
        Box::new(|backend| {
            backend
                .versions
                .insert(backend.path("tauri-driver.exe"), "1.0.0".to_owned());
        }),
        Box::new(|backend| {
            backend
                .authenticode
                .remove(&backend.path("msedgedriver.exe"));
        }),
        Box::new(|backend| {
            backend
                .authenticode
                .get_mut(&backend.path("phase6-physical-runner.exe"))
                .unwrap()
                .spki_sha256 =
                "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned();
        }),
        Box::new(|backend| {
            backend
                .reparse
                .insert(backend.path("configs/friends-pc.run-config.json"));
        }),
        Box::new(|backend| backend.portable_custody = false),
    ];
    for mutate in mutations {
        let mut backend = fixture();
        mutate(&mut backend);
        let path = backend.path("artifact-manifest.json");
        assert!(verify_artifact_manifest_with_backend(&path, &mut backend).is_err());
    }
}

fn add_roster(backend: &mut FakeBackend, verified_artifact_hash: &str, friends_config_hash: &str) {
    backend.set_signed_json(
        "friends/friends-roster.json",
        &json!({
            "kind": "friends-roster", "schemaVersion": "1.0", "rosterId": "friends-roster-0001",
            "artifactManifestSha256": verified_artifact_hash, "friendsConfigSha256": friends_config_hash,
            "operationVersionId": "managed-power-scheme-v3", "buildId": "physical-build-0001",
            "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "purpose": "phase6-friends-physical-validation", "createdAt": "2026-08-13T13:02:00Z",
            "participants": [
                { "participantId": "sha256:1111111111111111111111111111111111111111111111111111111111111111", "machineSlot": "friend-01" },
                { "participantId": "sha256:2222222222222222222222222222222222222222222222222222222222222222", "machineSlot": "friend-02" }
            ]
        }),
    );
}

#[test]
fn roster_uses_only_verified_config_paths_and_exact_artifact_config_source_bindings() {
    let mut backend = fixture();
    let artifact_path = backend.path("artifact-manifest.json");
    let verified = verify_artifact_manifest_with_backend(&artifact_path, &mut backend).unwrap();
    add_roster(
        &mut backend,
        verified.manifest_sha256(),
        verified.friends_config().config_sha256(),
    );

    let roster =
        verify_friends_roster_with_backend(&verified, verified.friends_config(), &mut backend)
            .unwrap();
    assert_eq!(roster.participants().len(), 2);
    assert_eq!(
        roster.roster_path(),
        backend.path("friends/friends-roster.json")
    );
}

#[test]
fn roster_signature_binding_duplicate_participant_and_duplicate_slot_mutations_fail() {
    for mutation in [
        "wrong-artifact",
        "wrong-config",
        "wrong-version",
        "wrong-build",
        "wrong-source",
        "duplicate-participant",
        "duplicate-slot",
        "wrong-spki",
        "cms-swap",
    ] {
        let mut backend = fixture();
        let artifact_path = backend.path("artifact-manifest.json");
        let verified = verify_artifact_manifest_with_backend(&artifact_path, &mut backend).unwrap();
        add_roster(
            &mut backend,
            verified.manifest_sha256(),
            verified.friends_config().config_sha256(),
        );
        let roster_path = backend.path("friends/friends-roster.json");
        let mut roster: Value =
            serde_json::from_slice(backend.files.get(&roster_path).unwrap()).unwrap();
        match mutation {
            "wrong-artifact" => {
                roster["artifactManifestSha256"] =
                    json!("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
            }
            "wrong-config" => {
                roster["friendsConfigSha256"] =
                    json!("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
            }
            "wrong-version" => roster["operationVersionId"] = json!("managed-power-scheme-v4"),
            "wrong-build" => roster["buildId"] = json!("physical-build-9999"),
            "wrong-source" => {
                roster["sourceCommit"] = json!("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
            }
            "duplicate-participant" => {
                roster["participants"][1]["participantId"] =
                    roster["participants"][0]["participantId"].clone()
            }
            "duplicate-slot" => {
                roster["participants"][1]["machineSlot"] =
                    roster["participants"][0]["machineSlot"].clone()
            }
            "wrong-spki" => {
                backend
                    .cms
                    .get_mut(&backend.path("friends/friends-roster.json.p7s"))
                    .unwrap()
                    .1 = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                    .to_owned()
            }
            "cms-swap" => {
                backend
                    .cms
                    .get_mut(&backend.path("friends/friends-roster.json.p7s"))
                    .unwrap()
                    .0 = b"swapped".to_vec()
            }
            _ => unreachable!(),
        }
        if !matches!(mutation, "wrong-spki" | "cms-swap") {
            backend.set_signed_json("friends/friends-roster.json", &roster);
        }
        assert!(
            verify_friends_roster_with_backend(&verified, verified.friends_config(), &mut backend)
                .is_err(),
            "{mutation}"
        );
    }
}

#[test]
fn host_cli_accepts_only_one_absolute_canonical_artifact_manifest_argument() {
    let valid = vec![
        "phase6-artifact-verifier".to_owned(),
        "--artifact-manifest".to_owned(),
        format!(r"{ROOT}\artifact-manifest.json"),
    ];
    assert!(parse_artifact_verifier_args(&valid).is_ok());

    for extra in [
        "--trust-pin",
        "--roster",
        "--stage",
        "--expected-hash",
        "--executable",
    ] {
        let mut args = valid.clone();
        args.extend([extra.to_owned(), "attacker-input".to_owned()]);
        assert!(
            parse_artifact_verifier_args(&args).is_err(),
            "accepted {extra}"
        );
    }
    let relative = vec![
        "phase6-artifact-verifier".to_owned(),
        "--artifact-manifest".to_owned(),
        "artifact-manifest.json".to_owned(),
    ];
    assert!(parse_artifact_verifier_args(&relative).is_err());
}

#[test]
fn host_cli_rejects_widened_arguments_with_bounded_diagnostics() {
    let binary = std::env::var("CARGO_BIN_EXE_phase6-artifact-verifier")
        .expect("Cargo exposes the fixed verifier binary to integration tests");
    let output = Command::new(binary)
        .args(["--trust-pin", "attacker-controlled"])
        .output()
        .unwrap();
    assert!(!output.status.success());
    assert!(output.stdout.len() + output.stderr.len() <= 1024);
    let diagnostic = String::from_utf8_lossy(&output.stderr);
    assert!(!diagnostic.contains("attacker-controlled"));
}
