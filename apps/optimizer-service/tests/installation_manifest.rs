#[path = "../src/main.rs"]
mod service;

use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
};

use serde_json::{Value, json};
use service::installation_manifest::{
    AuthenticodeEvidence, CustodyBackend, CustodyError, InstalledAdmissionState, SignerEvidence,
    TRUSTED_INSTALLER_SPKI_SHA256, canonical_json_bytes, local_msi_database_path,
    same_closed_windows_path, verify_installed_manifest_with_backend,
};
use sha2::{Digest, Sha256};

const ROOT: &str = r"C:\Program Files\Liiiraa Boost";
const PUBLISHER: &str = "Liiiraa Boost Local Development";
const THUMBPRINT: &str = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

#[test]
fn msi_database_view_accepts_only_canonical_local_verbatim_disk_paths() {
    assert_eq!(
        local_msi_database_path(Path::new(r"\\?\C:\phase6\artifact\liiiraa-boost.msi")).unwrap(),
        PathBuf::from(r"C:\phase6\artifact\liiiraa-boost.msi")
    );

    for rejected in [
        r"\\?\UNC\server\share\liiiraa-boost.msi",
        r"\\.\C:\phase6\artifact\liiiraa-boost.msi",
        r"\??\C:\phase6\artifact\liiiraa-boost.msi",
        r"C:\phase6\artifact\liiiraa-boost.msi",
        r"phase6\artifact\liiiraa-boost.msi",
        r"\\?\C:phase6\artifact\liiiraa-boost.msi",
        "\\\\?\\Ń:\\phase6\\artifact\\liiiraa-boost.msi",
        r"\\?\C:\phase6\..\liiiraa-boost.msi",
        r"\\?\C:\phase6\.\liiiraa-boost.msi",
        r"\\?\C:\phase6\\liiiraa-boost.msi",
        r"\\?\C:\phase6\liiiraa-boost.msi:payload",
    ] {
        assert!(
            local_msi_database_path(Path::new(rejected)).is_err(),
            "MSI database path {rejected:?} must fail closed"
        );
    }
}

#[cfg(windows)]
#[test]
fn installed_custody_path_equivalence_is_closed_to_normal_and_verbatim_roots() {
    assert!(same_closed_windows_path(
        Path::new(r"C:\Program Files\Liiiraa Boost\installation-manifest.json"),
        Path::new(r"\\?\C:\Program Files\Liiiraa Boost\installation-manifest.json"),
    ));
    assert!(same_closed_windows_path(
        Path::new(r"\\server\share\Liiiraa Boost\installation-manifest.json"),
        Path::new(r"\\?\UNC\server\share\Liiiraa Boost\installation-manifest.json"),
    ));
    for invalid in [
        r"installation-manifest.json",
        r"C:\Program Files\Liiiraa Boost\.\installation-manifest.json",
        r"C:\Program Files\Liiiraa Boost\..\installation-manifest.json",
        r"\\.\C:\Program Files\Liiiraa Boost\installation-manifest.json",
        r"\\?\GLOBALROOT\Device\HarddiskVolumeShadowCopy1\installation-manifest.json",
    ] {
        assert!(!same_closed_windows_path(
            Path::new(invalid),
            Path::new(invalid)
        ));
    }
    assert!(!same_closed_windows_path(
        Path::new(r"C:\Program Files\Liiiraa Boost\installation-manifest.json"),
        Path::new(r"\\?\D:\Program Files\Liiiraa Boost\installation-manifest.json"),
    ));
    assert!(!same_closed_windows_path(
        Path::new(r"\\server\share\Liiiraa Boost\installation-manifest.json"),
        Path::new(r"\\?\UNC\server\other\Liiiraa Boost\installation-manifest.json"),
    ));
}

#[derive(Default)]
struct FakeBackend {
    files: BTreeMap<PathBuf, Vec<u8>>,
    cms: BTreeMap<PathBuf, (Vec<u8>, String)>,
    authenticode: BTreeMap<PathBuf, AuthenticodeEvidence>,
    versions: BTreeMap<PathBuf, String>,
    reparse: BTreeSet<PathBuf>,
    acl_secure: bool,
    last_admitted: Option<InstalledAdmissionState>,
    authenticode_calls: usize,
}

impl FakeBackend {
    fn root(&self) -> PathBuf {
        PathBuf::from(ROOT)
    }

    fn manifest_path(&self) -> PathBuf {
        self.root().join("installation-manifest.json")
    }

    fn signature_path(&self) -> PathBuf {
        self.root().join("installation-manifest.json.p7s")
    }

    fn set_manifest(&mut self, value: Value) {
        let bytes = serde_json::to_vec_pretty(&value).unwrap();
        let canonical = canonical_json_bytes(&bytes).unwrap();
        self.files.insert(self.manifest_path(), bytes);
        self.files
            .entry(self.signature_path())
            .or_insert_with(|| b"detached-cms".to_vec());
        self.cms.insert(
            self.signature_path(),
            (canonical, TRUSTED_INSTALLER_SPKI_SHA256.to_owned()),
        );
    }
}

impl CustodyBackend for FakeBackend {
    fn program_files_root(&mut self) -> Result<PathBuf, CustodyError> {
        Ok(self.root())
    }

    fn canonicalize(&mut self, path: &Path) -> Result<PathBuf, CustodyError> {
        if self.files.contains_key(path) || path == self.root() {
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
        let (expected_content, spki) = self
            .cms
            .get(signature_path)
            .ok_or_else(|| CustodyError::signature("cms-missing"))?;
        if expected_content != content {
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
        if self.acl_secure {
            Ok(())
        } else {
            Err(CustodyError::acl("weak-dacl"))
        }
    }

    fn verify_portable_root_custody(&mut self, _root: &Path) -> Result<(), CustodyError> {
        Ok(())
    }

    fn last_admitted_installation(
        &mut self,
    ) -> Result<Option<InstalledAdmissionState>, CustodyError> {
        Ok(self.last_admitted.clone())
    }
}

fn sha256(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

fn fixture() -> FakeBackend {
    let mut backend = FakeBackend {
        acl_secure: true,
        ..FakeBackend::default()
    };
    let identities = [
        ("desktop", "liiiraa-desktop.exe", b"desktop".as_slice()),
        (
            "service",
            "liiiraa-optimizer-service.exe",
            b"service".as_slice(),
        ),
        ("runner", "phase6-physical-runner.exe", b"runner".as_slice()),
    ];
    let mut files = serde_json::Map::new();
    for (role, relative_path, bytes) in identities {
        let path = backend.root().join(relative_path);
        backend.files.insert(path.clone(), bytes.to_vec());
        backend.authenticode.insert(
            path.clone(),
            AuthenticodeEvidence {
                publisher: PUBLISHER.to_owned(),
                certificate_sha256: THUMBPRINT.to_owned(),
                spki_sha256: TRUSTED_INSTALLER_SPKI_SHA256.to_owned(),
            },
        );
        backend.versions.insert(path, "1.2.0".to_owned());
        files.insert(
            role.to_owned(),
            json!({
                "role": role,
                "relativePath": relative_path,
                "sizeBytes": bytes.len(),
                "sha256": sha256(bytes),
                "version": "1.2.0",
                "authenticodePublisher": PUBLISHER,
                "authenticodeThumbprint": THUMBPRINT
            }),
        );
    }
    backend.last_admitted = Some(InstalledAdmissionState {
        product_code: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa".to_owned(),
        package_version: "1.1.0".to_owned(),
        manifest_sha256: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            .to_owned(),
    });
    backend.set_manifest(json!({
        "kind": "installation-manifest",
        "schemaVersion": "1.0",
        "manifestId": "installation-manifest-0001",
        "productCode": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "packageVersion": "1.2.0",
        "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "inputTreeHash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "buildId": "physical-build-0001",
        "operationVersionId": "managed-power-scheme-v3",
        "createdAt": "2026-08-13T13:00:00Z",
        "signerSpkiSha256": TRUSTED_INSTALLER_SPKI_SHA256,
        "files": files
    }));
    backend
}

#[test]
fn verifies_fixed_program_files_manifest_before_live_installed_bytes() {
    let mut backend = fixture();
    let verified = verify_installed_manifest_with_backend(&mut backend).unwrap();

    assert_eq!(verified.root(), Path::new(ROOT));
    assert_eq!(verified.package_version(), "1.2.0");
    assert_eq!(verified.files().len(), 3);
    assert_eq!(backend.authenticode_calls, 3);
}

#[test]
fn accepts_equivalent_windows_four_part_file_versions() {
    let mut backend = fixture();
    for version in backend.versions.values_mut() {
        *version = "1.2.0.0".to_owned();
    }

    let verified = verify_installed_manifest_with_backend(&mut backend).unwrap();

    assert_eq!(verified.package_version(), "1.2.0");
}

#[test]
fn cms_absence_content_swap_wrong_spki_and_self_asserted_pin_fail_before_authenticode() {
    let mut cases: Vec<(&str, Box<dyn FnOnce(&mut FakeBackend)>)> = vec![
        (
            "missing signature",
            Box::new(|backend| {
                backend.files.remove(&backend.signature_path());
                backend.cms.remove(&backend.signature_path());
            }),
        ),
        (
            "content swap",
            Box::new(|backend| {
                backend.cms.get_mut(&backend.signature_path()).unwrap().0 =
                    b"other canonical content".to_vec();
            }),
        ),
        (
            "wrong signer spki",
            Box::new(|backend| {
                backend.cms.get_mut(&backend.signature_path()).unwrap().1 =
                    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                        .to_owned();
            }),
        ),
        (
            "self asserted pin",
            Box::new(|backend| {
                let mut value: Value =
                    serde_json::from_slice(backend.files.get(&backend.manifest_path()).unwrap())
                        .unwrap();
                value["signerSpkiSha256"] = json!(
                    "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
                );
                backend.set_manifest(value);
            }),
        ),
    ];

    for (name, mutate) in cases.drain(..) {
        let mut backend = fixture();
        mutate(&mut backend);
        assert!(
            verify_installed_manifest_with_backend(&mut backend).is_err(),
            "{name} unexpectedly verified"
        );
        assert_eq!(backend.authenticode_calls, 0, "{name} trusted live bytes");
    }
}

#[test]
fn schema_rejects_installed_driver_missing_role_and_extra_role() {
    for mutation in ["driver", "missing", "extra"] {
        let mut backend = fixture();
        let mut value: Value =
            serde_json::from_slice(backend.files.get(&backend.manifest_path()).unwrap()).unwrap();
        match mutation {
            "driver" => {
                value["files"]["tauriDriver"] = json!({
                    "role": "tauri-driver", "relativePath": "tauri-driver.exe",
                    "sizeBytes": 1, "sha256": sha256(b"x"), "version": "2.0.6",
                    "authenticodePublisher": PUBLISHER,
                    "authenticodeThumbprint": THUMBPRINT
                });
            }
            "missing" => {
                value["files"].as_object_mut().unwrap().remove("runner");
            }
            "extra" => {
                value["files"]["helper"] = value["files"]["runner"].clone();
            }
            _ => unreachable!(),
        }
        backend.set_manifest(value);
        assert!(verify_installed_manifest_with_backend(&mut backend).is_err());
        assert_eq!(backend.authenticode_calls, 0);
    }
}

#[test]
fn live_hash_authenticode_version_acl_reparse_downgrade_and_replay_fail_closed() {
    let mutations: Vec<Box<dyn FnOnce(&mut FakeBackend)>> = vec![
        Box::new(|backend| {
            backend.files.insert(
                backend.root().join("liiiraa-desktop.exe"),
                b"tampered".to_vec(),
            );
        }),
        Box::new(|backend| {
            backend
                .authenticode
                .remove(&backend.root().join("liiiraa-desktop.exe"));
        }),
        Box::new(|backend| {
            backend.versions.insert(
                backend.root().join("liiiraa-desktop.exe"),
                "1.1.0".to_owned(),
            );
        }),
        Box::new(|backend| backend.acl_secure = false),
        Box::new(|backend| {
            backend
                .reparse
                .insert(backend.root().join("liiiraa-desktop.exe"));
        }),
        Box::new(|backend| {
            backend.last_admitted.as_mut().unwrap().package_version = "2.0.0".to_owned();
        }),
        Box::new(|backend| {
            backend.last_admitted.as_mut().unwrap().package_version = "1.2.0".to_owned();
        }),
    ];

    for mutate in mutations {
        let mut backend = fixture();
        mutate(&mut backend);
        assert!(verify_installed_manifest_with_backend(&mut backend).is_err());
    }
}

#[cfg(windows)]
#[test]
fn windows_cryptography_and_wintrust_bindings_are_typed_and_reachable() {
    use windows::Win32::Security::{
        Cryptography::{
            CertGetCertificateContextProperty, CryptQueryObject,
            CryptVerifyDetachedMessageSignature,
        },
        WinTrust::WinVerifyTrust,
    };

    let _crypt_query_object = CryptQueryObject;
    let _crypt_verify_detached = CryptVerifyDetachedMessageSignature;
    let _cert_property = CertGetCertificateContextProperty;
    let _win_verify_trust = WinVerifyTrust;

    let source = include_str!("../src/installation_manifest.rs");
    assert!(
        source.contains("CryptVerifyDetachedMessageSignature("),
        "installed CMS must use the CryptoAPI operation dedicated to detached signatures"
    );
}
