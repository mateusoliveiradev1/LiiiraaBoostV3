use std::{
    collections::BTreeSet,
    path::{Path, PathBuf},
};

use liiiraa_contracts_rust::{
    ArtifactManifestDocument, FriendsPcRunConfigDocument, FriendsRosterDocument,
    PhysicalRunConfigDocument, TransactionalRecoveryDocument,
    validate_transactional_recovery_document,
};
use serde_json::{Map, Value};

use super::installation_manifest::{
    CustodyBackend, CustodyError, TRUSTED_INSTALLER_SPKI_SHA256, canonical_json_value,
    parse_installation_manifest, resolve_below_root, sha256_prefixed, verify_compiled_spki,
    verify_live_identity,
};
use super::numeric_version::equivalent_numeric_version;

// Key-link witness: 'ArtifactManifestDocument FriendsRosterDocument PhysicalRunConfigDocument'
// Key-link witness: 'CryptQueryObject CertGetCertificateContextProperty TRUSTED_INSTALLER_SPKI_SHA256'

const ARTIFACT_MANIFEST_NAME: &str = "artifact-manifest.json";
const ARTIFACT_SIGNATURE_NAME: &str = "artifact-manifest.json.p7s";
const FRIENDS_ROSTER_PATH: &str = "friends/friends-roster.json";
const FRIENDS_ROSTER_SIGNATURE_PATH: &str = "friends/friends-roster.json.p7s";

#[derive(Clone, Debug)]
pub struct VerifiedFriendsConfig {
    path: PathBuf,
    config_sha256: String,
    document: FriendsPcRunConfigDocument,
}

impl VerifiedFriendsConfig {
    pub fn config_sha256(&self) -> &str {
        &self.config_sha256
    }

    pub fn path(&self) -> &Path {
        &self.path
    }
}

#[derive(Clone, Debug)]
pub struct VerifiedArtifactManifest {
    root: PathBuf,
    document: ArtifactManifestDocument,
    manifest_sha256: String,
    files: Vec<PathBuf>,
    friends_config: VerifiedFriendsConfig,
}

impl VerifiedArtifactManifest {
    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn files(&self) -> &[PathBuf] {
        &self.files
    }

    pub fn operation_version_id(&self) -> &str {
        self.document.operation_version_id.as_str()
    }

    pub fn build_id(&self) -> &str {
        self.document.build_id.as_str()
    }

    pub fn manifest_sha256(&self) -> &str {
        &self.manifest_sha256
    }

    pub fn friends_config(&self) -> &VerifiedFriendsConfig {
        &self.friends_config
    }
}

#[derive(Clone, Debug)]
pub struct VerifiedFriendsRoster {
    roster_path: PathBuf,
    document: FriendsRosterDocument,
}

impl VerifiedFriendsRoster {
    pub fn roster_path(&self) -> &Path {
        &self.roster_path
    }

    pub fn participants(&self) -> &[liiiraa_contracts_rust::FriendsRosterParticipant] {
        &self.document.participants
    }
}

/// The portable verifier accepts one artifact path. Trust, hashes, roster paths,
/// stages, and executable identities are always derived from signed contracts.
pub fn parse_artifact_verifier_args(args: &[String]) -> Result<PathBuf, CustodyError> {
    if args.len() != 3 || args[1] != "--artifact-manifest" {
        return Err(CustodyError::path("artifact-verifier-arguments"));
    }
    let path = PathBuf::from(&args[2]);
    if !path.is_absolute()
        || path.file_name().and_then(|name| name.to_str()) != Some(ARTIFACT_MANIFEST_NAME)
        || path.components().any(|component| {
            matches!(
                component,
                std::path::Component::ParentDir | std::path::Component::CurDir
            )
        })
    {
        return Err(CustodyError::path("artifact-manifest-path"));
    }
    Ok(path)
}

pub fn verify_artifact_manifest(
    manifest_path: &Path,
) -> Result<VerifiedArtifactManifest, CustodyError> {
    #[cfg(windows)]
    {
        let mut backend =
            super::installation_manifest::windows_backend::WindowsCustodyBackend::new()?;
        verify_artifact_manifest_with_backend(manifest_path, &mut backend)
    }
    #[cfg(not(windows))]
    {
        let _ = manifest_path;
        Err(CustodyError::path("windows-required"))
    }
}

pub(crate) fn verify_artifact_manifest_with_backend(
    requested_manifest_path: &Path,
    backend: &mut dyn CustodyBackend,
) -> Result<VerifiedArtifactManifest, CustodyError> {
    if !requested_manifest_path.is_absolute()
        || requested_manifest_path
            .file_name()
            .and_then(|name| name.to_str())
            != Some(ARTIFACT_MANIFEST_NAME)
    {
        return Err(CustodyError::path("artifact-manifest-path"));
    }
    let requested_root = requested_manifest_path
        .parent()
        .ok_or_else(|| CustodyError::path("artifact-root"))?;
    let root = backend.canonicalize(requested_root)?;
    let manifest_path = backend.canonicalize(requested_manifest_path)?;
    if manifest_path != root.join(ARTIFACT_MANIFEST_NAME)
        || backend.is_reparse_point(&root)?
        || backend.is_reparse_point(&manifest_path)?
    {
        return Err(CustodyError::path("artifact-canonical-path"));
    }
    backend.verify_portable_root_custody(&root)?;

    let signature_path = resolve_below_root(backend, &root, ARTIFACT_SIGNATURE_NAME)?;
    let raw_manifest = backend.read_file(&manifest_path)?;
    let _signature_bytes = backend.read_file(&signature_path)?;
    let (manifest_value, document) = parse_artifact_manifest(&raw_manifest)?;
    let canonical = canonical_json_value(&manifest_value)?;
    verify_compiled_spki(
        &backend
            .verify_detached_cms(&canonical, &signature_path)?
            .spki_sha256,
    )?;

    let identities = manifest_value
        .get("files")
        .and_then(Value::as_object)
        .ok_or_else(|| CustodyError::schema("portable-files"))?;
    let roles = [
        "msi",
        "installationManifest",
        "installationManifestSignature",
        "cleanWindowsVmConfig",
        "ownerPcConfig",
        "friendsPcConfig",
        "runner",
        "tauriDriver",
        "msedgeDriver",
    ];

    // Authenticate every live byte before any executable can be launched.
    let mut unique = BTreeSet::new();
    let mut files = Vec::with_capacity(roles.len());
    for role in roles {
        let identity = identity(identities, role)?;
        let path = verify_live_identity(backend, &root, identity, false)?;
        if !unique.insert(path.clone()) {
            return Err(CustodyError::path("duplicate-portable-path"));
        }
        files.push(path);
    }

    // Interpret nested mutable JSON through generated contracts before checking
    // executable signatures, so malformed custody input fails without side effects.
    verify_embedded_installation(
        backend,
        &root,
        identity(identities, "installationManifest")?,
        identity(identities, "installationManifestSignature")?,
        &document,
    )?;
    verify_config(
        backend,
        &root,
        identity(identities, "cleanWindowsVmConfig")?,
        ConfigStage::CleanWindowsVm,
        &document,
    )?;
    verify_config(
        backend,
        &root,
        identity(identities, "ownerPcConfig")?,
        ConfigStage::OwnerPc,
        &document,
    )?;
    let friends_config = verify_config(
        backend,
        &root,
        identity(identities, "friendsPcConfig")?,
        ConfigStage::FriendsPc,
        &document,
    )?
    .ok_or_else(|| CustodyError::schema("friends-config-variant"))?;

    for role in ["msi", "runner", "tauriDriver", "msedgeDriver"] {
        let identity = identity(identities, role)?;
        let path = resolve_below_root(backend, &root, required_str(identity, "relativePath")?)?;
        let authenticode = backend.verify_authenticode(&path)?;
        verify_compiled_spki(&authenticode.spki_sha256)?;
        if role == "tauriDriver" {
            verify_tauri_driver_cargo_receipt(identity)?;
        } else {
            let expected_policy = if role == "msi" {
                "package-version"
            } else {
                "file-version"
            };
            if required_str(identity, "versionPolicy")? != expected_policy {
                return Err(CustodyError::version("portable-native-version-policy"));
            }
            let expected_version = required_str(identity, "version")?;
            if !equivalent_numeric_version(expected_version, &backend.file_version(&path)?) {
                return Err(CustodyError::version("portable-live-file-version"));
            }
        }
    }

    Ok(VerifiedArtifactManifest {
        root,
        document,
        manifest_sha256: sha256_prefixed(&raw_manifest),
        files,
        friends_config,
    })
}

fn verify_tauri_driver_cargo_receipt(identity: &Map<String, Value>) -> Result<(), CustodyError> {
    if required_str(identity, "version")? != "2.0.6"
        || required_str(identity, "versionPolicy")? != "cargo-install-receipt"
    {
        return Err(CustodyError::version("portable-cargo-receipt-policy"));
    }
    let receipt = identity
        .get("cargoInstallReceipt")
        .and_then(Value::as_object)
        .ok_or_else(|| CustodyError::version("portable-cargo-receipt-missing"))?;
    if receipt.len() != 6
        || required_str(receipt, "schemaVersion")? != "1.0"
        || required_str(receipt, "packageName")? != "tauri-driver"
        || required_str(receipt, "packageVersion")? != "2.0.6"
        || required_str(receipt, "versionRequirement")? != "=2.0.6"
        || required_str(receipt, "source")?
            != "registry+https://github.com/rust-lang/crates.io-index"
        || required_str(receipt, "binaryName")? != "tauri-driver.exe"
    {
        return Err(CustodyError::version("portable-cargo-receipt-identity"));
    }
    Ok(())
}

pub fn verify_friends_roster(
    artifact: &VerifiedArtifactManifest,
    friends_config: &VerifiedFriendsConfig,
) -> Result<VerifiedFriendsRoster, CustodyError> {
    #[cfg(windows)]
    {
        let mut backend =
            super::installation_manifest::windows_backend::WindowsCustodyBackend::new()?;
        verify_friends_roster_with_backend(artifact, friends_config, &mut backend)
    }
    #[cfg(not(windows))]
    {
        let _ = (artifact, friends_config);
        Err(CustodyError::path("windows-required"))
    }
}

pub(crate) fn verify_friends_roster_with_backend(
    artifact: &VerifiedArtifactManifest,
    friends_config: &VerifiedFriendsConfig,
    backend: &mut dyn CustodyBackend,
) -> Result<VerifiedFriendsRoster, CustodyError> {
    if friends_config.path != artifact.root.join("configs/friends-pc.run-config.json") {
        return Err(CustodyError::path("unverified-friends-config"));
    }
    // These paths are derived from fixed generated enums and never accepted as
    // host CLI arguments.
    let roster_relative = friends_config.document.friends_roster_path.to_string();
    let signature_relative = friends_config
        .document
        .friends_roster_signature_path
        .to_string();
    if roster_relative != FRIENDS_ROSTER_PATH || signature_relative != FRIENDS_ROSTER_SIGNATURE_PATH
    {
        return Err(CustodyError::path("friends-roster-config-path"));
    }
    let roster_path = resolve_below_root(backend, &artifact.root, &roster_relative)?;
    let signature_path = resolve_below_root(backend, &artifact.root, &signature_relative)?;
    let raw_roster = backend.read_file(&roster_path)?;
    let _signature_bytes = backend.read_file(&signature_path)?;
    let value: Value =
        serde_json::from_slice(&raw_roster).map_err(|_| CustodyError::schema("roster-json"))?;
    let validated = validate_transactional_recovery_document(&value)
        .map_err(|_| CustodyError::schema("friends-roster"))?;
    let TransactionalRecoveryDocument::FriendsRosterDocument(document) = validated else {
        return Err(CustodyError::schema("friends-roster-kind"));
    };
    verify_compiled_spki(
        &backend
            .verify_detached_cms(&canonical_json_value(&value)?, &signature_path)?
            .spki_sha256,
    )?;

    if document.artifact_manifest_sha256.as_str() != artifact.manifest_sha256
        || document.friends_config_sha256.as_str() != friends_config.config_sha256
        || document.operation_version_id.as_str() != artifact.operation_version_id()
        || document.build_id.as_str() != artifact.build_id()
        || document.source_commit.as_str() != artifact.document.source_commit.as_str()
    {
        return Err(CustodyError::hash("friends-roster-binding"));
    }
    let mut participants = BTreeSet::new();
    let mut slots = BTreeSet::new();
    for participant in &document.participants {
        if !participants.insert(participant.participant_id.as_str())
            || !slots.insert(participant.machine_slot.to_string())
        {
            return Err(CustodyError::schema("duplicate-roster-identity"));
        }
    }
    Ok(VerifiedFriendsRoster {
        roster_path,
        document,
    })
}

fn parse_artifact_manifest(
    bytes: &[u8],
) -> Result<(Value, ArtifactManifestDocument), CustodyError> {
    let value: Value =
        serde_json::from_slice(bytes).map_err(|_| CustodyError::schema("artifact-json"))?;
    let validated = validate_transactional_recovery_document(&value)
        .map_err(|_| CustodyError::schema("artifact-manifest"))?;
    let TransactionalRecoveryDocument::ArtifactManifestDocument(document) = validated else {
        return Err(CustodyError::schema("artifact-manifest-kind"));
    };
    Ok((value, document))
}

fn verify_embedded_installation(
    backend: &mut dyn CustodyBackend,
    root: &Path,
    manifest_identity: &Map<String, Value>,
    signature_identity: &Map<String, Value>,
    artifact: &ArtifactManifestDocument,
) -> Result<(), CustodyError> {
    let manifest_path = resolve_below_root(
        backend,
        root,
        required_str(manifest_identity, "relativePath")?,
    )?;
    let signature_path = resolve_below_root(
        backend,
        root,
        required_str(signature_identity, "relativePath")?,
    )?;
    let bytes = backend.read_file(&manifest_path)?;
    let (value, document) = parse_installation_manifest(&bytes)?;
    verify_compiled_spki(
        &backend
            .verify_detached_cms(&canonical_json_value(&value)?, &signature_path)?
            .spki_sha256,
    )?;
    if document.signer_spki_sha256.as_str() != TRUSTED_INSTALLER_SPKI_SHA256
        || document.operation_version_id.as_str() != artifact.operation_version_id.as_str()
        || document.build_id.as_str() != artifact.build_id.as_str()
        || document.source_commit.as_str() != artifact.source_commit.as_str()
    {
        return Err(CustodyError::signature("nested-installation-binding"));
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum ConfigStage {
    CleanWindowsVm,
    OwnerPc,
    FriendsPc,
}

fn verify_config(
    backend: &mut dyn CustodyBackend,
    root: &Path,
    identity: &Map<String, Value>,
    expected_stage: ConfigStage,
    artifact: &ArtifactManifestDocument,
) -> Result<Option<VerifiedFriendsConfig>, CustodyError> {
    let path = resolve_below_root(backend, root, required_str(identity, "relativePath")?)?;
    let bytes = backend.read_file(&path)?;
    let value: Value =
        serde_json::from_slice(&bytes).map_err(|_| CustodyError::schema("config-json"))?;
    let validated = validate_transactional_recovery_document(&value)
        .map_err(|_| CustodyError::schema("physical-run-config"))?;
    let TransactionalRecoveryDocument::PhysicalRunConfigDocument(config) = validated else {
        return Err(CustodyError::schema("physical-run-config-kind"));
    };

    let (operation, build, source, friends) = match (expected_stage, config) {
        (
            ConfigStage::CleanWindowsVm,
            PhysicalRunConfigDocument::CleanWindowsVmRunConfigDocument(document),
        ) => (
            document.operation_version_id.to_string(),
            document.build_id.to_string(),
            document.source_commit.to_string(),
            None,
        ),
        (ConfigStage::OwnerPc, PhysicalRunConfigDocument::OwnerPcRunConfigDocument(document)) => (
            document.operation_version_id.to_string(),
            document.build_id.to_string(),
            document.source_commit.to_string(),
            None,
        ),
        (
            ConfigStage::FriendsPc,
            PhysicalRunConfigDocument::FriendsPcRunConfigDocument(document),
        ) => (
            document.operation_version_id.to_string(),
            document.build_id.to_string(),
            document.source_commit.to_string(),
            Some(document),
        ),
        _ => return Err(CustodyError::schema("physical-run-config-stage")),
    };
    if operation != artifact.operation_version_id.as_str()
        || build != artifact.build_id.as_str()
        || source != artifact.source_commit.as_str()
    {
        return Err(CustodyError::hash("physical-config-binding"));
    }
    Ok(friends.map(|document| VerifiedFriendsConfig {
        path,
        config_sha256: sha256_prefixed(&bytes),
        document,
    }))
}

fn identity<'a>(
    identities: &'a Map<String, Value>,
    role: &'static str,
) -> Result<&'a Map<String, Value>, CustodyError> {
    identities
        .get(role)
        .and_then(Value::as_object)
        .ok_or_else(|| CustodyError::schema(role))
}

fn required_str<'a>(
    identity: &'a Map<String, Value>,
    key: &'static str,
) -> Result<&'a str, CustodyError> {
    identity
        .get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| CustodyError::schema(key))
}
