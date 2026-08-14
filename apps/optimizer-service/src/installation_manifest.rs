use std::{
    collections::BTreeSet,
    path::{Component, Path, PathBuf},
};

use liiiraa_contracts_rust::{
    InstallationManifestDocument, TransactionalRecoveryDocument,
    validate_transactional_recovery_document,
};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};

use super::numeric_version::{equivalent_numeric_version, parse_bounded_numeric_version};

/// SHA-256 of the DER SubjectPublicKeyInfo from the reviewed Phase 2 development
/// signing certificate embedded in `quality/evidence/phase-02/staged/liiiraa-desktop.exe`.
/// The private key is not present in the repository and no runtime input can replace this pin.
pub const TRUSTED_INSTALLER_SPKI_SHA256: &str =
    "sha256:1951cb0610550369bdffafffaec6ed48bb7c5e7ddbf9b99733cfbd288e86fdf2";

// Key-link witness: 'WinVerifyTrust authenticates verify_installed_manifest'

const INSTALLATION_MANIFEST_NAME: &str = "installation-manifest.json";
const INSTALLATION_SIGNATURE_NAME: &str = "installation-manifest.json.p7s";

#[cfg(windows)]
pub(crate) fn local_msi_database_path(path: &Path) -> Result<PathBuf, CustodyError> {
    use std::ffi::OsString;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};

    let wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    let is_ascii_drive = wide
        .get(4)
        .is_some_and(|value| matches!(*value, 0x41..=0x5a | 0x61..=0x7a));
    if wide.len() < 8
        || wide[..4] != [b'\\' as u16, b'\\' as u16, b'?' as u16, b'\\' as u16]
        || !is_ascii_drive
        || wide[5] != b':' as u16
        || wide[6] != b'\\' as u16
    {
        return Err(CustodyError::path("msi-local-verbatim-disk"));
    }

    for segment in wide[7..].split(|value| *value == b'\\' as u16) {
        if segment.is_empty()
            || segment == [b'.' as u16]
            || segment == [b'.' as u16, b'.' as u16]
            || segment
                .iter()
                .any(|value| *value == 0 || *value == b':' as u16 || *value == b'/' as u16)
        {
            return Err(CustodyError::path("msi-local-canonical-shape"));
        }
    }

    Ok(PathBuf::from(OsString::from_wide(&wide[4..])))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CustodyErrorCode {
    Acl,
    Authenticode,
    Hash,
    Missing,
    Path,
    Schema,
    Signature,
    Version,
}

impl CustodyErrorCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Acl => "acl-invalid",
            Self::Authenticode => "authenticode-invalid",
            Self::Hash => "live-byte-mismatch",
            Self::Missing => "required-byte-missing",
            Self::Path => "canonical-path-invalid",
            Self::Schema => "generated-schema-invalid",
            Self::Signature => "signature-invalid",
            Self::Version => "version-invalid",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CustodyError {
    pub code: CustodyErrorCode,
    detail: &'static str,
}

impl CustodyError {
    pub fn acl(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Acl, detail)
    }

    pub fn authenticode(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Authenticode, detail)
    }

    pub fn hash(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Hash, detail)
    }

    pub fn missing(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Missing, detail)
    }

    pub fn path(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Path, detail)
    }

    pub fn schema(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Schema, detail)
    }

    pub fn signature(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Signature, detail)
    }

    pub fn version(detail: &'static str) -> Self {
        Self::new(CustodyErrorCode::Version, detail)
    }

    fn new(code: CustodyErrorCode, detail: &'static str) -> Self {
        Self { code, detail }
    }
}

impl std::fmt::Display for CustodyError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(formatter, "{}:{}", self.code.as_str(), self.detail)
    }
}

impl std::error::Error for CustodyError {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SignerEvidence {
    pub spki_sha256: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AuthenticodeEvidence {
    pub publisher: String,
    pub certificate_sha256: String,
    pub spki_sha256: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InstalledAdmissionState {
    pub product_code: String,
    pub package_version: String,
    pub manifest_sha256: String,
}

/// Narrow operating-system seam. It supplies bytes and observations, never a
/// signer selection, trust pin, expected hash, or caller-controlled verification policy.
pub(crate) trait CustodyBackend {
    fn program_files_root(&mut self) -> Result<PathBuf, CustodyError>;
    fn canonicalize(&mut self, path: &Path) -> Result<PathBuf, CustodyError>;
    fn read_file(&mut self, path: &Path) -> Result<Vec<u8>, CustodyError>;
    fn is_reparse_point(&mut self, path: &Path) -> Result<bool, CustodyError>;
    fn verify_detached_cms(
        &mut self,
        content: &[u8],
        signature_path: &Path,
    ) -> Result<SignerEvidence, CustodyError>;
    fn verify_authenticode(&mut self, path: &Path) -> Result<AuthenticodeEvidence, CustodyError>;
    fn file_version(&mut self, path: &Path) -> Result<String, CustodyError>;
    fn verify_installed_acl(&mut self, root: &Path, files: &[PathBuf]) -> Result<(), CustodyError>;
    fn verify_portable_root_custody(&mut self, root: &Path) -> Result<(), CustodyError>;
    fn last_admitted_installation(
        &mut self,
    ) -> Result<Option<InstalledAdmissionState>, CustodyError>;
}

#[derive(Clone, Debug)]
pub struct VerifiedInstallationManifest {
    root: PathBuf,
    manifest: InstallationManifestDocument,
    manifest_sha256: String,
    files: Vec<PathBuf>,
}

impl VerifiedInstallationManifest {
    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn package_version(&self) -> &str {
        &self.manifest.package_version
    }

    pub fn manifest_sha256(&self) -> &str {
        &self.manifest_sha256
    }

    pub fn files(&self) -> &[PathBuf] {
        &self.files
    }

    pub fn document(&self) -> &InstallationManifestDocument {
        &self.manifest
    }
}

pub fn verify_installed_manifest() -> Result<VerifiedInstallationManifest, CustodyError> {
    #[cfg(windows)]
    {
        let mut backend = windows_backend::WindowsCustodyBackend::new()?;
        verify_installed_manifest_with_backend(&mut backend)
    }
    #[cfg(not(windows))]
    {
        Err(CustodyError::path("windows-required"))
    }
}

pub(crate) fn verify_installed_manifest_with_backend(
    backend: &mut dyn CustodyBackend,
) -> Result<VerifiedInstallationManifest, CustodyError> {
    let requested_root = backend.program_files_root()?;
    let root = backend.canonicalize(&requested_root)?;
    if backend.is_reparse_point(&requested_root)? {
        return Err(CustodyError::path("program-files-reparse"));
    }

    let manifest_path = resolve_below_root(backend, &root, INSTALLATION_MANIFEST_NAME)?;
    let signature_path = resolve_below_root(backend, &root, INSTALLATION_SIGNATURE_NAME)?;
    let raw_manifest = backend.read_file(&manifest_path)?;
    let _signature_bytes = backend.read_file(&signature_path)?;

    // Generated schema is always the first interpretation of mutable JSON.
    let (manifest_value, manifest) = parse_installation_manifest(&raw_manifest)?;
    let canonical = canonical_json_value(&manifest_value)?;
    verify_compiled_pin(backend.verify_detached_cms(&canonical, &signature_path)?)?;
    if manifest.signer_spki_sha256.as_str() != TRUSTED_INSTALLER_SPKI_SHA256 {
        return Err(CustodyError::signature("manifest-spki-evidence-mismatch"));
    }

    let manifest_sha256 = sha256_prefixed(&raw_manifest);
    verify_monotonic_admission(
        backend.last_admitted_installation()?,
        manifest.product_code.as_str(),
        manifest.package_version.as_str(),
        &manifest_sha256,
    )?;

    let identities = manifest_value
        .get("files")
        .and_then(Value::as_object)
        .ok_or_else(|| CustodyError::schema("installed-files"))?;
    let mut unique = BTreeSet::new();
    let mut verified_files = Vec::with_capacity(3);
    for role in ["desktop", "service", "runner"] {
        let identity = identities
            .get(role)
            .and_then(Value::as_object)
            .ok_or_else(|| CustodyError::schema("installed-role"))?;
        let path = verify_live_identity(backend, &root, identity, true)?;
        if !unique.insert(path.clone()) {
            return Err(CustodyError::path("duplicate-installed-path"));
        }
        verified_files.push(path);
    }
    let mut acl_paths = Vec::with_capacity(verified_files.len() + 2);
    acl_paths.push(manifest_path);
    acl_paths.push(signature_path);
    acl_paths.extend(verified_files.iter().cloned());
    backend.verify_installed_acl(&root, &acl_paths)?;

    Ok(VerifiedInstallationManifest {
        root,
        manifest,
        manifest_sha256,
        files: verified_files,
    })
}

pub(crate) fn parse_installation_manifest(
    bytes: &[u8],
) -> Result<(Value, InstallationManifestDocument), CustodyError> {
    let value: Value = serde_json::from_slice(bytes).map_err(|_| CustodyError::schema("json"))?;
    let validated = validate_transactional_recovery_document(&value)
        .map_err(|_| CustodyError::schema("installation-manifest"))?;
    let TransactionalRecoveryDocument::InstallationManifestDocument(document) = validated else {
        return Err(CustodyError::schema("installation-kind"));
    };
    Ok((value, document))
}

pub(crate) fn verify_live_identity(
    backend: &mut dyn CustodyBackend,
    root: &Path,
    identity: &Map<String, Value>,
    require_authenticode: bool,
) -> Result<PathBuf, CustodyError> {
    let relative_path = required_str(identity, "relativePath")?;
    let expected_hash = required_str(identity, "sha256")?;
    let expected_size = identity
        .get("sizeBytes")
        .and_then(Value::as_u64)
        .ok_or_else(|| CustodyError::schema("size"))?;
    let path = resolve_below_root(backend, root, relative_path)?;
    let bytes = backend.read_file(&path)?;
    if bytes.len() as u64 != expected_size || sha256_prefixed(&bytes) != expected_hash {
        return Err(CustodyError::hash("size-or-sha256"));
    }

    if require_authenticode {
        let expected_publisher = identity
            .get("authenticodePublisher")
            .and_then(Value::as_str);
        let expected_thumbprint = identity
            .get("authenticodeThumbprint")
            .and_then(Value::as_str);
        let actual = backend.verify_authenticode(&path)?;
        verify_compiled_spki(&actual.spki_sha256)?;
        if expected_publisher.is_some_and(|value| value != actual.publisher)
            || expected_thumbprint.is_some_and(|value| value != actual.certificate_sha256)
        {
            return Err(CustodyError::authenticode("publisher-or-certificate"));
        }
        let expected_version = required_str(identity, "version")?;
        if !equivalent_numeric_version(expected_version, &backend.file_version(&path)?) {
            return Err(CustodyError::version("live-file-version"));
        }
    }
    Ok(path)
}

pub(crate) fn resolve_below_root(
    backend: &mut dyn CustodyBackend,
    root: &Path,
    relative: &str,
) -> Result<PathBuf, CustodyError> {
    let relative_path = Path::new(relative);
    if relative_path.is_absolute()
        || relative_path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(CustodyError::path("relative-path"));
    }
    let candidate = root.join(relative_path);
    let mut current = root.to_path_buf();
    if backend.is_reparse_point(&current)? {
        return Err(CustodyError::path("root-reparse"));
    }
    for component in relative_path.components() {
        if let Component::Normal(name) = component {
            current.push(name);
            if backend.is_reparse_point(&current)? {
                return Err(CustodyError::path("reparse-component"));
            }
        }
    }
    let canonical = backend.canonicalize(&candidate)?;
    if !canonical.starts_with(root) || canonical == root {
        return Err(CustodyError::path("root-escape"));
    }
    Ok(canonical)
}

pub(crate) fn canonical_json_bytes(bytes: &[u8]) -> Result<Vec<u8>, CustodyError> {
    let value: Value = serde_json::from_slice(bytes).map_err(|_| CustodyError::schema("json"))?;
    canonical_json_value(&value)
}

pub(crate) fn canonical_json_value(value: &Value) -> Result<Vec<u8>, CustodyError> {
    serde_json::to_vec(&sort_json(value)).map_err(|_| CustodyError::schema("canonical-json"))
}

pub(crate) fn sha256_prefixed(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn sort_json(value: &Value) -> Value {
    match value {
        Value::Object(input) => {
            let mut keys: Vec<_> = input.keys().collect();
            keys.sort();
            let mut output = Map::new();
            for key in keys {
                output.insert(key.clone(), sort_json(&input[key]));
            }
            Value::Object(output)
        }
        Value::Array(items) => Value::Array(items.iter().map(sort_json).collect()),
        other => other.clone(),
    }
}

fn verify_compiled_pin(evidence: SignerEvidence) -> Result<(), CustodyError> {
    verify_compiled_spki(&evidence.spki_sha256)
}

pub(crate) fn verify_compiled_spki(spki: &str) -> Result<(), CustodyError> {
    if spki == TRUSTED_INSTALLER_SPKI_SHA256 {
        Ok(())
    } else {
        Err(CustodyError::signature("compiled-spki-mismatch"))
    }
}

fn verify_monotonic_admission(
    previous: Option<InstalledAdmissionState>,
    product_code: &str,
    package_version: &str,
    manifest_sha256: &str,
) -> Result<(), CustodyError> {
    let Some(previous) = previous else {
        parse_numeric_version(package_version)?;
        return Ok(());
    };
    if previous.product_code != product_code {
        return Err(CustodyError::version("product-code-drift"));
    }
    let current = parse_numeric_version(package_version)?;
    let admitted = parse_numeric_version(&previous.package_version)?;
    match current.cmp(&admitted) {
        std::cmp::Ordering::Less => Err(CustodyError::version("downgrade")),
        std::cmp::Ordering::Equal if previous.manifest_sha256 != manifest_sha256 => {
            Err(CustodyError::version("same-version-replay"))
        }
        _ => Ok(()),
    }
}

fn parse_numeric_version(value: &str) -> Result<Vec<u64>, CustodyError> {
    parse_bounded_numeric_version(value)
        .ok_or_else(|| CustodyError::version("non-numeric-package-version"))
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

#[cfg(windows)]
pub(crate) mod windows_backend {
    use std::{
        ffi::c_void,
        os::windows::{ffi::OsStrExt, fs::MetadataExt},
        path::{Path, PathBuf},
        ptr::null_mut,
    };

    use windows::{
        Win32::{
            Foundation::{ERROR_SUCCESS, HANDLE, HLOCAL, LocalFree},
            Security::{
                Authorization::{
                    ConvertSecurityDescriptorToStringSecurityDescriptorW, GetNamedSecurityInfoW,
                    SE_FILE_OBJECT,
                },
                Cryptography::{
                    CERT_CONTEXT, CERT_NAME_SIMPLE_DISPLAY_TYPE,
                    CERT_QUERY_CONTENT_FLAG_PKCS7_SIGNED_EMBED, CERT_QUERY_FORMAT_FLAG_BINARY,
                    CERT_QUERY_OBJECT_FILE, CERT_SHA256_HASH_PROP_ID, CRYPT_VERIFY_MESSAGE_PARA,
                    CertCloseStore, CertFreeCertificateContext, CertGetCertificateContextProperty,
                    CertGetNameStringW, CryptEncodeObjectEx, CryptMsgClose,
                    CryptMsgGetAndVerifySigner, CryptQueryObject,
                    CryptVerifyDetachedMessageSignature, HCERTSTORE, PKCS_7_ASN_ENCODING,
                    X509_ASN_ENCODING, X509_PUBLIC_KEY_INFO,
                },
                DACL_SECURITY_INFORMATION, OWNER_SECURITY_INFORMATION,
                PROTECTED_DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR,
                WinTrust::{
                    WINTRUST_ACTION_GENERIC_VERIFY_V2, WINTRUST_DATA, WINTRUST_DATA_0,
                    WINTRUST_FILE_INFO, WTD_CHOICE_FILE, WTD_REVOKE_NONE, WTD_STATEACTION_CLOSE,
                    WTD_STATEACTION_VERIFY, WTD_UI_NONE, WinVerifyTrust,
                },
            },
            Storage::FileSystem::{
                GetFileVersionInfoSizeW, GetFileVersionInfoW, VS_FIXEDFILEINFO, VerQueryValueW,
            },
            System::{
                ApplicationInstallationAndServicing::{
                    MSIDBOPEN_READONLY, MSIHANDLE, MsiCloseHandle, MsiDatabaseOpenViewW,
                    MsiOpenDatabaseW, MsiRecordGetStringW, MsiViewExecute, MsiViewFetch,
                },
                Com::CoTaskMemFree,
            },
            UI::Shell::{
                FOLDERID_ProgramData, FOLDERID_ProgramFiles, KF_FLAG_DEFAULT, SHGetKnownFolderPath,
            },
        },
        core::{PCWSTR, PWSTR},
    };

    use super::{
        AuthenticodeEvidence, CustodyBackend, CustodyError, INSTALLATION_MANIFEST_NAME,
        INSTALLATION_SIGNATURE_NAME, InstalledAdmissionState, SignerEvidence, sha256_prefixed,
    };

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    const SERVICE_SID_MARKER: &str = "S-1-5-80-";
    const CERT_E_UNTRUSTEDROOT: i32 = 0x800B0109_u32 as i32;

    pub struct WindowsCustodyBackend {
        program_files_root: PathBuf,
        last_admitted_path: PathBuf,
    }

    impl WindowsCustodyBackend {
        pub fn new() -> Result<Self, CustodyError> {
            let program_files_root = known_program_files()?.join("Liiiraa Boost");
            let last_admitted_path = known_program_data()?
                .join("Liiiraa Boost")
                .join("custody")
                .join("last-admitted-installation.json");
            Ok(Self {
                program_files_root,
                last_admitted_path,
            })
        }
    }

    impl CustodyBackend for WindowsCustodyBackend {
        fn program_files_root(&mut self) -> Result<PathBuf, CustodyError> {
            Ok(self.program_files_root.clone())
        }

        fn canonicalize(&mut self, path: &Path) -> Result<PathBuf, CustodyError> {
            std::fs::canonicalize(path).map_err(|_| CustodyError::path("canonicalize"))
        }

        fn read_file(&mut self, path: &Path) -> Result<Vec<u8>, CustodyError> {
            std::fs::read(path).map_err(|_| CustodyError::missing("read"))
        }

        fn is_reparse_point(&mut self, path: &Path) -> Result<bool, CustodyError> {
            let metadata =
                std::fs::symlink_metadata(path).map_err(|_| CustodyError::missing("metadata"))?;
            Ok(metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0)
        }

        fn verify_detached_cms(
            &mut self,
            content: &[u8],
            signature_path: &Path,
        ) -> Result<SignerEvidence, CustodyError> {
            signer_from_file(signature_path, content, false).map(|signer| SignerEvidence {
                spki_sha256: signer.spki_sha256,
            })
        }

        fn verify_authenticode(
            &mut self,
            path: &Path,
        ) -> Result<AuthenticodeEvidence, CustodyError> {
            verify_wintrust(path)?;
            let signer = signer_from_file(path, &[], true)?;
            Ok(AuthenticodeEvidence {
                publisher: signer.publisher,
                certificate_sha256: signer.certificate_sha256,
                spki_sha256: signer.spki_sha256,
            })
        }

        fn file_version(&mut self, path: &Path) -> Result<String, CustodyError> {
            if path
                .extension()
                .is_some_and(|value| value.eq_ignore_ascii_case("msi"))
            {
                msi_product_version(path)
            } else {
                pe_file_version(path)
            }
        }

        fn verify_installed_acl(
            &mut self,
            root: &Path,
            files: &[PathBuf],
        ) -> Result<(), CustodyError> {
            verify_acl(root, true)?;
            for file in files {
                let require_protected = file.file_name().is_some_and(|name| {
                    name.eq_ignore_ascii_case(INSTALLATION_MANIFEST_NAME)
                        || name.eq_ignore_ascii_case(INSTALLATION_SIGNATURE_NAME)
                });
                verify_acl(file, require_protected)?;
            }
            Ok(())
        }

        fn verify_portable_root_custody(&mut self, root: &Path) -> Result<(), CustodyError> {
            verify_portable_acl(root)
        }

        fn last_admitted_installation(
            &mut self,
        ) -> Result<Option<InstalledAdmissionState>, CustodyError> {
            match std::fs::symlink_metadata(&self.last_admitted_path) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
                Err(_) => return Err(CustodyError::missing("last-admitted-metadata")),
                Ok(metadata) if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 => {
                    return Err(CustodyError::path("last-admitted-reparse"));
                }
                Ok(_) => {}
            }
            let canonical = std::fs::canonicalize(&self.last_admitted_path)
                .map_err(|_| CustodyError::path("last-admitted-canonical"))?;
            let expected = std::fs::canonicalize(
                self.last_admitted_path
                    .parent()
                    .ok_or_else(|| CustodyError::path("last-admitted-parent"))?,
            )
            .map_err(|_| CustodyError::path("last-admitted-parent"))?
            .join(
                self.last_admitted_path
                    .file_name()
                    .ok_or_else(|| CustodyError::path("last-admitted-name"))?,
            );
            if canonical != expected {
                return Err(CustodyError::path("last-admitted-path"));
            }
            verify_acl(&canonical, true)?;
            let bytes = std::fs::read(&canonical)
                .map_err(|_| CustodyError::missing("last-admitted-read"))?;
            if bytes.len() > 4096 {
                return Err(CustodyError::schema("last-admitted-size"));
            }
            let value: serde_json::Value = serde_json::from_slice(&bytes)
                .map_err(|_| CustodyError::schema("last-admitted-json"))?;
            let object = value
                .as_object()
                .filter(|object| object.len() == 3)
                .ok_or_else(|| CustodyError::schema("last-admitted-shape"))?;
            Ok(Some(InstalledAdmissionState {
                product_code: state_string(object, "productCode")?,
                package_version: state_string(object, "packageVersion")?,
                manifest_sha256: state_string(object, "manifestSha256")?,
            }))
        }
    }

    struct NativeSigner {
        publisher: String,
        certificate_sha256: String,
        spki_sha256: String,
    }

    fn signer_from_file(
        path: &Path,
        detached_content: &[u8],
        embedded: bool,
    ) -> Result<NativeSigner, CustodyError> {
        if !embedded {
            return detached_signer(path, detached_content);
        }
        let wide = wide_path(path);
        let mut store = HCERTSTORE::default();
        let mut message: *mut c_void = null_mut();
        let mut signer: *mut CERT_CONTEXT = null_mut();
        let result = unsafe {
            CryptQueryObject(
                CERT_QUERY_OBJECT_FILE,
                PCWSTR(wide.as_ptr()).0.cast(),
                CERT_QUERY_CONTENT_FLAG_PKCS7_SIGNED_EMBED,
                CERT_QUERY_FORMAT_FLAG_BINARY,
                0,
                None,
                None,
                None,
                Some(&mut store),
                Some(&mut message),
                None,
            )
            .map_err(|_| CustodyError::signature("crypt-query-object"))?;
            CryptMsgGetAndVerifySigner(message, Some(&[store]), 0, Some(&mut signer), None)
                .map_err(|_| CustodyError::signature("crypt-msg-verify"))?;
            native_signer(signer)
        };
        unsafe {
            if !signer.is_null() {
                let _ = CertFreeCertificateContext(Some(signer));
            }
            if !message.is_null() {
                let _ = CryptMsgClose(Some(message));
            }
            if !store.is_invalid() {
                let _ = CertCloseStore(Some(store), 0);
            }
        }
        result
    }

    fn detached_signer(path: &Path, content: &[u8]) -> Result<NativeSigner, CustodyError> {
        let signature =
            std::fs::read(path).map_err(|_| CustodyError::signature("detached-signature-read"))?;
        let content_size = u32::try_from(content.len())
            .map_err(|_| CustodyError::signature("detached-content-size"))?;
        let content_pointers = [content.as_ptr()];
        let content_sizes = [content_size];
        let parameters = CRYPT_VERIFY_MESSAGE_PARA {
            cbSize: size_of::<CRYPT_VERIFY_MESSAGE_PARA>() as u32,
            dwMsgAndCertEncodingType: X509_ASN_ENCODING.0 | PKCS_7_ASN_ENCODING.0,
            ..Default::default()
        };
        let mut signer: *mut CERT_CONTEXT = null_mut();
        let result = unsafe {
            CryptVerifyDetachedMessageSignature(
                &parameters,
                0,
                &signature,
                1,
                content_pointers.as_ptr(),
                content_sizes.as_ptr(),
                Some(&mut signer),
            )
            .map_err(|_| CustodyError::signature("detached-signature-verify"))?;
            native_signer(signer)
        };
        unsafe {
            if !signer.is_null() {
                let _ = CertFreeCertificateContext(Some(signer));
            }
        }
        result
    }

    unsafe fn native_signer(signer: *const CERT_CONTEXT) -> Result<NativeSigner, CustodyError> {
        let certificate_info = if signer.is_null() {
            null_mut()
        } else {
            unsafe { (*signer).pCertInfo }
        };
        if certificate_info.is_null() {
            return Err(CustodyError::signature("signer-context"));
        }
        let certificate_sha256 = unsafe { certificate_property_hash(signer)? };
        let spki_info = unsafe { &(*certificate_info).SubjectPublicKeyInfo };
        let spki = unsafe { encode_spki(spki_info)? };
        let publisher = unsafe { certificate_name(signer)? };
        Ok(NativeSigner {
            publisher,
            certificate_sha256,
            spki_sha256: sha256_prefixed(&spki),
        })
    }

    unsafe fn certificate_property_hash(
        signer: *const CERT_CONTEXT,
    ) -> Result<String, CustodyError> {
        let mut size = 0_u32;
        unsafe {
            CertGetCertificateContextProperty(signer, CERT_SHA256_HASH_PROP_ID, None, &mut size)
        }
        .map_err(|_| CustodyError::signature("cert-property-size"))?;
        let mut bytes = vec![0_u8; size as usize];
        unsafe {
            CertGetCertificateContextProperty(
                signer,
                CERT_SHA256_HASH_PROP_ID,
                Some(bytes.as_mut_ptr().cast()),
                &mut size,
            )
        }
        .map_err(|_| CustodyError::signature("cert-property"))?;
        bytes.truncate(size as usize);
        Ok(format!("sha256:{}", hex(&bytes)))
    }

    unsafe fn encode_spki(
        spki: *const windows::Win32::Security::Cryptography::CERT_PUBLIC_KEY_INFO,
    ) -> Result<Vec<u8>, CustodyError> {
        let encoding = windows::Win32::Security::Cryptography::CERT_QUERY_ENCODING_TYPE(
            X509_ASN_ENCODING.0 | PKCS_7_ASN_ENCODING.0,
        );
        let mut size = 0_u32;
        unsafe {
            CryptEncodeObjectEx(
                encoding,
                X509_PUBLIC_KEY_INFO,
                spki.cast(),
                Default::default(),
                None,
                None,
                &mut size,
            )
        }
        .map_err(|_| CustodyError::signature("spki-size"))?;
        let mut encoded = vec![0_u8; size as usize];
        unsafe {
            CryptEncodeObjectEx(
                encoding,
                X509_PUBLIC_KEY_INFO,
                spki.cast(),
                Default::default(),
                None,
                Some(encoded.as_mut_ptr().cast()),
                &mut size,
            )
        }
        .map_err(|_| CustodyError::signature("spki-encode"))?;
        encoded.truncate(size as usize);
        Ok(encoded)
    }

    unsafe fn certificate_name(signer: *const CERT_CONTEXT) -> Result<String, CustodyError> {
        let size =
            unsafe { CertGetNameStringW(signer, CERT_NAME_SIMPLE_DISPLAY_TYPE, 0, None, None) };
        if size <= 1 {
            return Err(CustodyError::signature("publisher-name"));
        }
        let mut buffer = vec![0_u16; size as usize];
        let written = unsafe {
            CertGetNameStringW(
                signer,
                CERT_NAME_SIMPLE_DISPLAY_TYPE,
                0,
                None,
                Some(&mut buffer),
            )
        };
        if written != size {
            return Err(CustodyError::signature("publisher-name-read"));
        }
        Ok(String::from_utf16_lossy(&buffer[..buffer.len() - 1]))
    }

    fn verify_wintrust(path: &Path) -> Result<(), CustodyError> {
        let wide = wide_path(path);
        let mut file = WINTRUST_FILE_INFO {
            cbStruct: size_of::<WINTRUST_FILE_INFO>() as u32,
            pcwszFilePath: PCWSTR(wide.as_ptr()),
            hFile: HANDLE::default(),
            pgKnownSubject: null_mut(),
        };
        let mut data = WINTRUST_DATA {
            cbStruct: size_of::<WINTRUST_DATA>() as u32,
            dwUIChoice: WTD_UI_NONE,
            fdwRevocationChecks: WTD_REVOKE_NONE,
            dwUnionChoice: WTD_CHOICE_FILE,
            Anonymous: WINTRUST_DATA_0 { pFile: &mut file },
            dwStateAction: WTD_STATEACTION_VERIFY,
            ..Default::default()
        };
        let mut action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
        let status = unsafe {
            WinVerifyTrust(
                windows::Win32::Foundation::HWND::default(),
                &mut action,
                (&mut data as *mut WINTRUST_DATA).cast(),
            )
        };
        data.dwStateAction = WTD_STATEACTION_CLOSE;
        unsafe {
            let _ = WinVerifyTrust(
                windows::Win32::Foundation::HWND::default(),
                &mut action,
                (&mut data as *mut WINTRUST_DATA).cast(),
            );
        }
        if status == 0 || status == CERT_E_UNTRUSTEDROOT {
            Ok(())
        } else {
            Err(CustodyError::authenticode("winverifytrust"))
        }
    }

    fn pe_file_version(path: &Path) -> Result<String, CustodyError> {
        let wide = wide_path(path);
        let size = unsafe { GetFileVersionInfoSizeW(PCWSTR(wide.as_ptr()), None) };
        if size == 0 {
            return Err(CustodyError::version("file-version-size"));
        }
        let mut bytes = vec![0_u8; size as usize];
        unsafe {
            GetFileVersionInfoW(PCWSTR(wide.as_ptr()), None, size, bytes.as_mut_ptr().cast())
                .map_err(|_| CustodyError::version("file-version-read"))?;
        }
        let root = [b'\\' as u16, 0];
        let mut value: *mut c_void = null_mut();
        let mut value_size = 0_u32;
        let ok = unsafe {
            VerQueryValueW(
                bytes.as_ptr().cast(),
                PCWSTR(root.as_ptr()),
                &mut value,
                &mut value_size,
            )
        };
        if !ok.as_bool() || value_size < size_of::<VS_FIXEDFILEINFO>() as u32 {
            return Err(CustodyError::version("file-version-query"));
        }
        let info = unsafe { &*value.cast::<VS_FIXEDFILEINFO>() };
        Ok(format!(
            "{}.{}.{}.{}",
            info.dwFileVersionMS >> 16,
            info.dwFileVersionMS & 0xffff,
            info.dwFileVersionLS >> 16,
            info.dwFileVersionLS & 0xffff
        ))
    }

    fn msi_product_version(path: &Path) -> Result<String, CustodyError> {
        let database_path = super::local_msi_database_path(path)?;
        let canonical_database_path = std::fs::canonicalize(&database_path)
            .map_err(|_| CustodyError::path("msi-database-canonicalize"))?;
        if canonical_database_path != path {
            return Err(CustodyError::path("msi-database-canonical-drift"));
        }
        let path_wide = wide_path(&database_path);
        let query = wide("SELECT `Value` FROM `Property` WHERE `Property`='ProductVersion'");
        let mut database = MSIHANDLE::default();
        let mut view = MSIHANDLE::default();
        let mut record = MSIHANDLE::default();
        let result = unsafe {
            if MsiOpenDatabaseW(
                PCWSTR(path_wide.as_ptr()),
                MSIDBOPEN_READONLY,
                &mut database,
            ) != ERROR_SUCCESS.0
            {
                return Err(CustodyError::version("msi-open"));
            }
            if MsiDatabaseOpenViewW(database, PCWSTR(query.as_ptr()), &mut view) != ERROR_SUCCESS.0
                || MsiViewExecute(view, MSIHANDLE::default()) != ERROR_SUCCESS.0
                || MsiViewFetch(view, &mut record) != ERROR_SUCCESS.0
            {
                Err(CustodyError::version("msi-product-version"))
            } else {
                let mut length = 0_u32;
                let _ = MsiRecordGetStringW(record, 1, None, Some(&mut length));
                length = length.saturating_add(1);
                let mut buffer = vec![0_u16; length as usize];
                if MsiRecordGetStringW(
                    record,
                    1,
                    Some(PWSTR(buffer.as_mut_ptr())),
                    Some(&mut length),
                ) != ERROR_SUCCESS.0
                {
                    Err(CustodyError::version("msi-product-version-read"))
                } else {
                    Ok(String::from_utf16_lossy(&buffer[..length as usize]))
                }
            }
        };
        unsafe {
            if record != MSIHANDLE::default() {
                let _ = MsiCloseHandle(record);
            }
            if view != MSIHANDLE::default() {
                let _ = MsiCloseHandle(view);
            }
            if database != MSIHANDLE::default() {
                let _ = MsiCloseHandle(database);
            }
        }
        result
    }

    fn verify_acl(path: &Path, require_protected: bool) -> Result<(), CustodyError> {
        let text = acl_sddl(path)?;
        if acl_has_hardened_owner_and_dacl(&text, require_protected)
            && text.contains(SERVICE_SID_MARKER)
        {
            Ok(())
        } else {
            Err(CustodyError::acl("owner-dacl-service-sid"))
        }
    }

    fn verify_portable_acl(path: &Path) -> Result<(), CustodyError> {
        let text = acl_sddl(path)?;
        if acl_has_hardened_owner_and_dacl(&text, true) {
            Ok(())
        } else {
            Err(CustodyError::acl("portable-owner-dacl"))
        }
    }

    fn acl_sddl(path: &Path) -> Result<String, CustodyError> {
        let wide_path = wide_path(path);
        let security_information = windows::Win32::Security::OBJECT_SECURITY_INFORMATION(
            OWNER_SECURITY_INFORMATION.0
                | DACL_SECURITY_INFORMATION.0
                | PROTECTED_DACL_SECURITY_INFORMATION.0,
        );
        let mut descriptor = PSECURITY_DESCRIPTOR::default();
        let status = unsafe {
            GetNamedSecurityInfoW(
                PCWSTR(wide_path.as_ptr()),
                SE_FILE_OBJECT,
                security_information,
                None,
                None,
                None,
                None,
                &mut descriptor,
            )
        };
        if status != ERROR_SUCCESS || descriptor.0.is_null() {
            return Err(CustodyError::acl("security-descriptor"));
        }
        let mut sddl = PWSTR::null();
        let converted = unsafe {
            ConvertSecurityDescriptorToStringSecurityDescriptorW(
                descriptor,
                1,
                security_information,
                &mut sddl,
                None,
            )
        };
        let text = if converted.is_ok() && !sddl.is_null() {
            unsafe { sddl.to_string() }.map_err(|_| CustodyError::acl("sddl-utf16"))?
        } else {
            unsafe {
                let _ = LocalFree(Some(HLOCAL(descriptor.0)));
            }
            return Err(CustodyError::acl("sddl"));
        };
        unsafe {
            let _ = LocalFree(Some(HLOCAL(sddl.0.cast())));
            let _ = LocalFree(Some(HLOCAL(descriptor.0)));
        }
        Ok(text)
    }

    fn acl_has_hardened_owner_and_dacl(text: &str, require_protected: bool) -> bool {
        let protected = !require_protected || text.contains("D:P");
        let owner_is_system_or_admin = text.contains("O:SY") || text.contains("O:BA");
        let system_full = text.contains(";;;SY)");
        let ordinary_write = [";;;BU)", ";;;AU)", ";;;WD)"].iter().any(|trustee| {
            text.split('(').any(|ace| {
                ace.contains(trustee)
                    && ["GA", "GW", "WD", "FA"]
                        .iter()
                        .any(|right| ace.contains(right))
            })
        });
        protected && owner_is_system_or_admin && system_full && !ordinary_write
    }

    fn known_program_files() -> Result<PathBuf, CustodyError> {
        let pointer =
            unsafe { SHGetKnownFolderPath(&FOLDERID_ProgramFiles, KF_FLAG_DEFAULT, None) }
                .map_err(|_| CustodyError::path("program-files-known-folder"))?;
        let value = unsafe { pointer.to_string() }
            .map(PathBuf::from)
            .map_err(|_| CustodyError::path("program-files-utf16"));
        unsafe { CoTaskMemFree(Some(pointer.0.cast())) };
        value
    }

    fn known_program_data() -> Result<PathBuf, CustodyError> {
        let pointer = unsafe { SHGetKnownFolderPath(&FOLDERID_ProgramData, KF_FLAG_DEFAULT, None) }
            .map_err(|_| CustodyError::path("program-data-known-folder"))?;
        let value = unsafe { pointer.to_string() }
            .map(PathBuf::from)
            .map_err(|_| CustodyError::path("program-data-utf16"));
        unsafe { CoTaskMemFree(Some(pointer.0.cast())) };
        value
    }

    fn state_string(
        object: &serde_json::Map<String, serde_json::Value>,
        key: &'static str,
    ) -> Result<String, CustodyError> {
        object
            .get(key)
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .ok_or_else(|| CustodyError::schema(key))
    }

    fn wide_path(path: &Path) -> Vec<u16> {
        path.as_os_str().encode_wide().chain(Some(0)).collect()
    }

    fn wide(value: &str) -> Vec<u16> {
        value.encode_utf16().chain(Some(0)).collect()
    }

    fn hex(bytes: &[u8]) -> String {
        const HEX: &[u8; 16] = b"0123456789abcdef";
        let mut output = String::with_capacity(bytes.len() * 2);
        for byte in bytes {
            output.push(HEX[(byte >> 4) as usize] as char);
            output.push(HEX[(byte & 0x0f) as usize] as char);
        }
        output
    }
}
