#[path = "../src/account_sync.rs"]
mod account_sync;
#[path = "../src/credential_store.rs"]
mod credential_store;
#[path = "../src/device_identity.rs"]
mod device_identity;

use device_identity::{
    ComponentClass, DeviceBindingApi, DeviceBindingMutationStatus, DeviceBindingReadiness,
    DeviceBindingRequest, DeviceClass, DeviceEvidenceOutcome, DeviceIdentityError,
    DeviceInventoryCollector, RawComponentObservation, RawDeviceInventory,
    WindowsDeviceInventoryCollector, bind_current_device_with, collect_protected_device_evidence,
    compare_device_evidence, prepare_device_binding_with_collector,
};
use std::cell::RefCell;

use account_sync::{AccountApiResponse, AccountSyncError};
use credential_store::{CredentialStore, CredentialStoreError};

const ACCOUNT_SALT_ALPHA: &[u8] = b"synthetic-account-salt-alpha";

fn canonical_observations() -> Vec<RawComponentObservation<'static>> {
    vec![
        RawComponentObservation::new(
            ComponentClass::PlatformTrust,
            "  SMBIOS-BOARD-SERIAL-RAW-9001  ",
        ),
        RawComponentObservation::new(ComponentClass::Cpu, "PROCESSOR-ID-RAW-9002"),
        RawComponentObservation::new(ComponentClass::StorageController, "NVME-SERIAL-RAW-9003"),
        RawComponentObservation::new(ComponentClass::Gpu, "GPU-PNP-ID-RAW-9004"),
        RawComponentObservation::new(ComponentClass::MemoryTopology, "DIMM-SERIAL-RAW-9005"),
    ]
}

#[test]
fn device_identity_collector_normalizes_components_before_producing_account_scoped_digests() {
    let canonical = collect_protected_device_evidence(
        DeviceClass::Physical,
        &canonical_observations(),
        ACCOUNT_SALT_ALPHA,
    )
    .expect("canonical synthetic observations should be accepted");
    let normalized = collect_protected_device_evidence(
        DeviceClass::Physical,
        &[
            RawComponentObservation::new(
                ComponentClass::PlatformTrust,
                "smbios board serial raw 9001",
            ),
            RawComponentObservation::new(ComponentClass::Cpu, "processor-id-raw-9002"),
            RawComponentObservation::new(ComponentClass::StorageController, "nvme serial raw 9003"),
            RawComponentObservation::new(ComponentClass::Gpu, "gpu_pnp_id_raw_9004"),
            RawComponentObservation::new(ComponentClass::MemoryTopology, "dimm-serial-raw-9005"),
        ],
        ACCOUNT_SALT_ALPHA,
    )
    .expect("equivalent normalized observations should be accepted");

    assert_eq!(canonical, normalized);
    assert_eq!(canonical.components.len(), 5);
    assert!(canonical.components.iter().all(|component| {
        component.local_digest.len() == 64
            && component
                .local_digest
                .bytes()
                .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
    }));
}

#[test]
fn device_identity_raw_identifiers_never_leave_the_collector_boundary() {
    let protected = collect_protected_device_evidence(
        DeviceClass::Physical,
        &canonical_observations(),
        ACCOUNT_SALT_ALPHA,
    )
    .expect("canonical synthetic observations should be accepted");
    let serialized =
        serde_json::to_string(&protected).expect("protected evidence should serialize");

    for sentinel in [
        "SMBIOS-BOARD-SERIAL-RAW-9001",
        "PROCESSOR-ID-RAW-9002",
        "NVME-SERIAL-RAW-9003",
        "GPU-PNP-ID-RAW-9004",
        "DIMM-SERIAL-RAW-9005",
    ] {
        assert!(!serialized.contains(sentinel));
    }
}

#[test]
fn device_identity_account_salt_changes_make_local_evidence_unlinkable() {
    let observations = canonical_observations();
    let alpha =
        collect_protected_device_evidence(DeviceClass::Physical, &observations, ACCOUNT_SALT_ALPHA)
            .expect("alpha evidence should derive");
    let beta = collect_protected_device_evidence(
        DeviceClass::Physical,
        &observations,
        b"synthetic-account-salt-beta",
    )
    .expect("beta evidence should derive");

    assert_ne!(alpha.components, beta.components);
}

#[test]
fn device_identity_empty_contradictory_and_cross_platform_evidence_fail_closed() {
    assert_eq!(
        collect_protected_device_evidence(DeviceClass::Physical, &[], ACCOUNT_SALT_ALPHA),
        Err(DeviceIdentityError::EvidenceEmpty),
    );
    assert_eq!(
        collect_protected_device_evidence(
            DeviceClass::Physical,
            &[
                RawComponentObservation::new(ComponentClass::Cpu, "cpu-a"),
                RawComponentObservation::new(ComponentClass::Cpu, "cpu-b"),
            ],
            ACCOUNT_SALT_ALPHA,
        ),
        Err(DeviceIdentityError::ContradictoryComponent(
            ComponentClass::Cpu
        )),
    );
    assert_eq!(
        collect_protected_device_evidence(
            DeviceClass::Physical,
            &[
                RawComponentObservation::new(ComponentClass::VirtualPlatform, "vm-a"),
                RawComponentObservation::new(ComponentClass::Cpu, "cpu-a"),
                RawComponentObservation::new(ComponentClass::MemoryTopology, "memory-a"),
            ],
            ACCOUNT_SALT_ALPHA,
        ),
        Err(DeviceIdentityError::DeviceClassMismatch),
    );
}

#[test]
fn device_identity_score_matrix_matches_the_typescript_threshold_policy() {
    let before = collect_protected_device_evidence(
        DeviceClass::Physical,
        &canonical_observations(),
        ACCOUNT_SALT_ALPHA,
    )
    .expect("baseline evidence should derive");
    let mut gpu_change = canonical_observations();
    gpu_change[3] = RawComponentObservation::new(ComponentClass::Gpu, "GPU-CHANGED");
    let gpu_change =
        collect_protected_device_evidence(DeviceClass::Physical, &gpu_change, ACCOUNT_SALT_ALPHA)
            .expect("minor-change evidence should derive");
    let mut platform_change = canonical_observations();
    platform_change[0] =
        RawComponentObservation::new(ComponentClass::PlatformTrust, "PLATFORM-CHANGED");
    let platform_change = collect_protected_device_evidence(
        DeviceClass::Physical,
        &platform_change,
        ACCOUNT_SALT_ALPHA,
    )
    .expect("revalidation evidence should derive");
    let mut replacement = canonical_observations();
    replacement[0] =
        RawComponentObservation::new(ComponentClass::PlatformTrust, "PLATFORM-CHANGED");
    replacement[1] = RawComponentObservation::new(ComponentClass::Cpu, "CPU-CHANGED");
    let replacement =
        collect_protected_device_evidence(DeviceClass::Physical, &replacement, ACCOUNT_SALT_ALPHA)
            .expect("replacement evidence should derive");

    assert_eq!(
        compare_device_evidence(&before, &before).outcome,
        DeviceEvidenceOutcome::SamePc,
    );
    assert_eq!(compare_device_evidence(&before, &gpu_change).score, 90);
    assert_eq!(
        compare_device_evidence(&before, &gpu_change).outcome,
        DeviceEvidenceOutcome::SamePc,
    );
    assert_eq!(compare_device_evidence(&before, &platform_change).score, 60);
    assert_eq!(
        compare_device_evidence(&before, &platform_change).outcome,
        DeviceEvidenceOutcome::RevalidationRequired,
    );
    assert_eq!(compare_device_evidence(&before, &replacement).score, 35);
    assert_eq!(
        compare_device_evidence(&before, &replacement).outcome,
        DeviceEvidenceOutcome::Replacement,
    );
    assert_eq!(
        compare_device_evidence(&before, &replacement).changed_components,
        vec![ComponentClass::PlatformTrust, ComponentClass::Cpu],
    );
}

struct SyntheticInventoryCollector;

impl DeviceInventoryCollector for SyntheticInventoryCollector {
    fn collect(&self) -> Result<RawDeviceInventory, DeviceIdentityError> {
        Ok(RawDeviceInventory::new(
            "Astra-PC",
            DeviceClass::Physical,
            vec![
                (
                    ComponentClass::PlatformTrust,
                    "SMBIOS-BOARD-SERIAL-RAW-9001".to_owned(),
                ),
                (ComponentClass::Cpu, "PROCESSOR-ID-RAW-9002".to_owned()),
                (
                    ComponentClass::MemoryTopology,
                    "DIMM-SERIAL-RAW-9005".to_owned(),
                ),
            ],
        ))
    }
}

#[test]
fn device_identity_prepared_preview_exposes_only_friendly_readiness_metadata() {
    let preview = prepare_device_binding_with_collector(&SyntheticInventoryCollector);
    assert_eq!(preview.readiness, DeviceBindingReadiness::Ready);
    assert_eq!(preview.device_label, "Astra-PC");
    assert_eq!(preview.admitted_components.len(), 3);

    let serialized = serde_json::to_string(&preview).expect("preview should serialize");
    assert!(!serialized.contains("RAW-9001"));
    assert!(!serialized.contains("RAW-9002"));
    assert!(!serialized.contains("RAW-9005"));
    assert!(!serialized.contains("localDigest"));
}

#[cfg(target_os = "windows")]
#[test]
fn device_identity_current_windows_inventory_produces_a_privacy_safe_ready_preview() {
    let preview = prepare_device_binding_with_collector(&WindowsDeviceInventoryCollector);

    assert_eq!(preview.readiness, DeviceBindingReadiness::Ready);
    assert!(preview.admitted_components.len() >= 3);
    let serialized = serde_json::to_string(&preview).expect("preview should serialize");
    assert!(!serialized.contains("localDigest"));
    assert!(!serialized.contains("rawValue"));
}

struct MemoryCredentialStore;

impl CredentialStore for MemoryCredentialStore {
    fn write_rotated_credential(&self, _credential: &str) -> Result<(), CredentialStoreError> {
        Ok(())
    }

    fn read_credential(&self) -> Result<Option<String>, CredentialStoreError> {
        Ok(Some("credential-remains-in-native-custody".to_owned()))
    }

    fn delete_credential(&self) -> Result<(), CredentialStoreError> {
        Ok(())
    }
}

struct CapturingDeviceApi {
    submitted_body: RefCell<Option<Vec<u8>>>,
}

impl DeviceBindingApi for CapturingDeviceApi {
    fn evidence_context(&self, _credential: &str) -> Result<AccountApiResponse, AccountSyncError> {
        Ok(AccountApiResponse {
            status: 200,
            body: serde_json::to_vec(&serde_json::json!({
                "schemaVersion": "1.0",
                "kind": "device-evidence-context-projection",
                "accountId": "account-01",
                "contextVersion": "1",
                "accountSalt": "a".repeat(64),
            }))
            .expect("context fixture serializes"),
        })
    }

    fn bind(&self, _credential: &str, body: &[u8]) -> Result<AccountApiResponse, AccountSyncError> {
        *self.submitted_body.borrow_mut() = Some(body.to_vec());
        Ok(AccountApiResponse {
            status: 200,
            body: serde_json::to_vec(&serde_json::json!({
                "schemaVersion": "1.0",
                "aggregateVersion": "2",
                "etag": "device-binding-01-v2",
                "correlationId": "device-binding-test",
                "provenance": "device-verified",
                "kind": "device-binding-projection",
                "deviceBindingId": "binding-01",
                "accountId": "account-01",
                "state": "active",
                "deviceLabel": "Astra-PC",
                "evidenceVersion": "1",
                "boundAt": "2030-02-01T12:00:00.000Z",
            }))
            .expect("binding fixture serializes"),
        })
    }
}

#[test]
fn device_identity_native_bind_keeps_raw_and_local_evidence_out_of_renderer_results() {
    let api = CapturingDeviceApi {
        submitted_body: RefCell::new(None),
    };
    let request: DeviceBindingRequest = serde_json::from_value(serde_json::json!({
        "command": {
            "schemaVersion": "1.0",
            "kind": "device-command",
            "commandId": "bind-command-01",
            "accountId": "account-01",
            "deviceBindingId": "binding-01",
            "action": "bind",
            "expectedVersion": "1",
            "correlationId": "device-binding-test",
            "requestedAt": "2030-02-01T12:00:00.000Z"
        },
        "confirmedFriendlyIdentity": true,
        "confirmedOnePcConsequences": true,
    }))
    .expect("binding request fixture decodes");

    let response = bind_current_device_with(
        &MemoryCredentialStore,
        &api,
        &SyntheticInventoryCollector,
        request,
    )
    .expect("native binding should succeed");

    assert_eq!(response.status, DeviceBindingMutationStatus::Applied);
    let renderer_json = serde_json::to_string(&response).expect("renderer response serializes");
    assert!(!renderer_json.contains("localDigest"));
    assert!(!renderer_json.contains("RAW-9001"));
    let submitted = api
        .submitted_body
        .borrow()
        .clone()
        .expect("native API body captured");
    let submitted = String::from_utf8(submitted).expect("body is utf-8 JSON");
    assert!(submitted.contains("localDigest"));
    assert!(!submitted.contains("RAW-9001"));
    assert!(!submitted.contains("protectedDigest"));
    assert!(!submitted.contains("deviceDigest"));
}
