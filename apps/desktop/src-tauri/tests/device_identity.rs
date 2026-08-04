#[path = "../src/device_identity.rs"]
mod device_identity;

use device_identity::{
    ComponentClass, DeviceClass, DeviceEvidenceOutcome, DeviceIdentityError,
    RawComponentObservation, collect_protected_device_evidence, compare_device_evidence,
};

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
