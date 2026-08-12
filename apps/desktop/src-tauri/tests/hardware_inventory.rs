#[path = "../src/evidence_store.rs"]
mod evidence_store;
#[path = "../src/hardware_inventory.rs"]
mod hardware_inventory;
#[path = "../src/windows_lifecycle.rs"]
mod windows_lifecycle;

use std::collections::BTreeMap;

use hardware_inventory::{
    CollectionRequest, HardwareClass, HardwareInventorySource, InventoryCollector, RawHardwareFact,
    RawInventory, UnavailableReason,
};
use liiiraa_contracts_rust::validate_hardware_evidence_document;
use windows_lifecycle::{
    ServicingChannel, WindowsEdition, WindowsLifecycle, WindowsVersionEvidence,
    classify_windows_lifecycle,
};

const NOW: &str = "2026-08-12T12:00:00Z";
const DEADLINE: &str = "2026-08-12T12:00:02Z";

fn version(
    build: u32,
    edition: WindowsEdition,
    channel: ServicingChannel,
) -> WindowsVersionEvidence {
    WindowsVersionEvidence {
        major: 10,
        minor: 0,
        build,
        edition,
        channel,
        esu_enrolled: false,
        contradictory: false,
        policy_version: 1,
    }
}

#[test]
fn lifecycle_table_distinguishes_supported_ltsc_esu_consumer_and_unknown() {
    assert_eq!(
        classify_windows_lifecycle(
            &version(
                26_100,
                WindowsEdition::Professional,
                ServicingChannel::GeneralAvailability,
            ),
            20260812,
        ),
        WindowsLifecycle::SupportedWindows11,
    );
    assert_eq!(
        classify_windows_lifecycle(
            &version(
                19_044,
                WindowsEdition::EnterpriseLtsc,
                ServicingChannel::LongTermServicing,
            ),
            20260812,
        ),
        WindowsLifecycle::Windows10LtscEsu,
    );
    let mut esu = version(
        19_045,
        WindowsEdition::Professional,
        ServicingChannel::Esu,
    );
    esu.esu_enrolled = true;
    assert_eq!(
        classify_windows_lifecycle(&esu, 20260812),
        WindowsLifecycle::Windows10LtscEsu,
    );
    assert_eq!(
        classify_windows_lifecycle(
            &version(
                19_045,
                WindowsEdition::Home,
                ServicingChannel::GeneralAvailability,
            ),
            20260812,
        ),
        WindowsLifecycle::UnsupportedWindows10Consumer,
    );

    let mut contradictory = version(
        26_100,
        WindowsEdition::Professional,
        ServicingChannel::GeneralAvailability,
    );
    contradictory.contradictory = true;
    assert_eq!(
        classify_windows_lifecycle(&contradictory, 20260812),
        WindowsLifecycle::Unknown,
    );
    assert_eq!(
        classify_windows_lifecycle(
            &version(
                0,
                WindowsEdition::Unknown,
                ServicingChannel::Unknown,
            ),
            20260812,
        ),
        WindowsLifecycle::Unknown,
    );
}

#[test]
fn lifecycle_never_depends_on_marketing_or_display_names() {
    let evidence = version(
        26_100,
        WindowsEdition::Professional,
        ServicingChannel::GeneralAvailability,
    );
    let original = classify_windows_lifecycle(&evidence, 20260812);
    for ignored_name in [
        "Windows 10 Totally Genuine",
        "Windows 12 Ultimate Gamer",
        "Unknown display label",
    ] {
        assert_eq!(
            classify_windows_lifecycle(&evidence, 20260812),
            original,
            "display label must be presentation-only: {ignored_name}",
        );
    }
}

fn all_observed_inventory() -> RawInventory {
    let mut facts = BTreeMap::new();
    for (class, value, source) in [
        (HardwareClass::Cpu, "AMD Ryzen 7", "cpuid"),
        (HardwareClass::Gpu, "NVIDIA GeForce", "EnumDisplayDevicesW"),
        (HardwareClass::Memory, "32 GiB", "GlobalMemoryStatusEx"),
        (HardwareClass::Storage, "2 fixed volumes", "GetLogicalDrives"),
        (HardwareClass::Network, "1 active adapter", "GetAdaptersAddresses"),
        (HardwareClass::Display, "2560 x 1440 @ 144 Hz", "EnumDisplaySettingsW"),
        (HardwareClass::Audio, "Default audio endpoint", "MMDeviceEnumerator"),
        (HardwareClass::Usb, "4 USB devices", "SetupAPI"),
        (HardwareClass::Windows, "build 26100", "GetVersionExW"),
        (HardwareClass::Drivers, "display driver observed", "SetupAPI"),
        (HardwareClass::Security, "security state available", "WindowsSecurity"),
        (HardwareClass::Games, "2 supported games", "installed-game-discovery"),
    ] {
        facts.insert(
            class,
            RawHardwareFact::observed(value, source, NOW, 12),
        );
    }
    RawInventory {
        facts,
        windows_version: version(
            26_100,
            WindowsEdition::Professional,
            ServicingChannel::GeneralAvailability,
        ),
    }
}

struct SyntheticSource {
    inventory: RawInventory,
}

impl HardwareInventorySource for SyntheticSource {
    fn collect(&self) -> RawInventory {
        self.inventory.clone()
    }
}

fn request() -> CollectionRequest {
    CollectionRequest {
        evidence_id: "inventory-test-1".to_owned(),
        evidence_version: 1,
        collected_at: NOW.to_owned(),
        deadline_at: DEADLINE.to_owned(),
        per_source_timeout_ms: 100,
        cancelled: false,
        stable_id_salt: b"inventory-purpose-bound-salt".to_vec(),
        policy_date: 20260812,
    }
}

#[test]
fn collector_emits_every_required_class_as_observed_or_explicitly_unavailable() {
    let mut raw = all_observed_inventory();
    raw.facts.remove(&HardwareClass::Audio);
    raw.facts.insert(
        HardwareClass::Security,
        RawHardwareFact::unavailable(
            UnavailableReason::PermissionDenied,
            "WindowsSecurity",
            4,
        ),
    );
    raw.facts.insert(
        HardwareClass::Usb,
        RawHardwareFact::observed("slow USB result", "SetupAPI", NOW, 101),
    );

    let result = InventoryCollector::new(SyntheticSource { inventory: raw })
        .collect(&request())
        .expect("complete-or-unavailable inventory");
    validate_hardware_evidence_document(&result.document).expect("generated contract accepts it");

    for class in HardwareClass::ALL {
        assert!(result.document.get(class.contract_key()).is_some());
    }
    assert_eq!(result.document["audio"]["state"], "unavailable");
    assert_eq!(result.document["audio"]["reasonCode"], "not-discovered");
    assert_eq!(result.document["security"]["reasonCode"], "permission-denied");
    assert_eq!(result.document["usb"]["reasonCode"], "timed-out");
}

#[test]
fn cancellation_is_visible_and_never_reuses_partial_values() {
    let mut cancelled = request();
    cancelled.cancelled = true;
    let result = InventoryCollector::new(SyntheticSource {
        inventory: all_observed_inventory(),
    })
    .collect(&cancelled)
    .expect("cancelled inventory remains inspectable");

    for class in HardwareClass::ALL {
        assert_eq!(result.document[class.contract_key()]["state"], "unavailable");
        assert_eq!(result.document[class.contract_key()]["reasonCode"], "cancelled");
    }
    assert_eq!(
        result.document["execution"]["cancellationState"],
        "acknowledged"
    );
}

#[test]
fn protected_identifiers_never_cross_persistence_or_projection_boundaries() {
    let sentinels = [
        "SERIAL-RAW-9001",
        "AA-BB-CC-DD-EE-FF",
        "PCI\\VEN_10DE&DEV_RAW-9003",
    ];
    let mut raw = all_observed_inventory();
    raw.facts.insert(
        HardwareClass::Gpu,
        RawHardwareFact::observed_with_protected(
            "NVIDIA GeForce RTX",
            "SetupAPI",
            NOW,
            8,
            sentinels.iter().map(|value| (*value).to_owned()).collect(),
        ),
    );

    let result = InventoryCollector::new(SyntheticSource { inventory: raw })
        .collect(&request())
        .expect("privacy-safe inventory");
    let serialized = serde_json::to_string(&result.document).expect("serialize snapshot");
    for sentinel in sentinels {
        assert!(!serialized.contains(sentinel));
    }
    let stable_id = result.document["gpu"]["stableDerivedId"]
        .as_str()
        .expect("purpose-bound stable reference");
    assert!(stable_id.starts_with("hardware-gpu-"));
    assert_eq!(stable_id.len(), "hardware-gpu-".len() + 32);
}

#[test]
fn contradictory_or_malformed_source_values_fail_closed_without_leaking() {
    let mut raw = all_observed_inventory();
    raw.facts.insert(
        HardwareClass::Gpu,
        RawHardwareFact::contradictory(
            "GPU-SECRET-A",
            "GPU-SECRET-B",
            "SetupAPI",
            8,
        ),
    );
    let result = InventoryCollector::new(SyntheticSource { inventory: raw })
        .collect(&request())
        .expect("contradiction becomes unavailable");
    assert_eq!(result.document["gpu"]["state"], "unavailable");
    assert_eq!(result.document["gpu"]["reasonCode"], "not-reported");
    let serialized = serde_json::to_string(&result.document).unwrap();
    assert!(!serialized.contains("GPU-SECRET-A"));
    assert!(!serialized.contains("GPU-SECRET-B"));
}

#[cfg(target_os = "windows")]
#[test]
fn current_windows_smoke_is_unprivileged_contract_valid_and_privacy_safe() {
    use hardware_inventory::WindowsInventorySource;

    let result = InventoryCollector::new(WindowsInventorySource)
        .collect(&request())
        .expect("Windows inventory smoke");
    validate_hardware_evidence_document(&result.document).expect("valid native snapshot");
    for class in HardwareClass::ALL {
        assert!(result.document.get(class.contract_key()).is_some());
    }
    for required_observed in ["cpu", "memory", "windows"] {
        assert_eq!(result.document[required_observed]["state"], "observed");
    }
    let serialized = serde_json::to_string(&result.document).unwrap();
    for forbidden in ["serialNumber", "macAddress", "instanceId", "rawValue"] {
        assert!(!serialized.contains(forbidden));
    }
}
