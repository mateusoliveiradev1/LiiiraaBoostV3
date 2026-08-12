use std::collections::BTreeMap;
use std::time::Instant;

#[cfg(target_os = "windows")]
use std::{collections::BTreeSet, fs, path::PathBuf};

use liiiraa_contracts_rust::validate_hardware_evidence_document;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::evidence_store::{EvidenceLifecycle, EvidenceStore, EvidenceStoreError, StoredEvidence};
use crate::windows_lifecycle::{
    ServicingChannel, WindowsEdition, WindowsLifecycle, WindowsVersionEvidence,
    classify_windows_lifecycle,
};

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum HardwareClass {
    Cpu,
    Gpu,
    Memory,
    Storage,
    Network,
    Display,
    Audio,
    Usb,
    Windows,
    Drivers,
    Security,
    Games,
}

impl HardwareClass {
    pub const ALL: [Self; 12] = [
        Self::Cpu,
        Self::Gpu,
        Self::Memory,
        Self::Storage,
        Self::Network,
        Self::Display,
        Self::Audio,
        Self::Usb,
        Self::Windows,
        Self::Drivers,
        Self::Security,
        Self::Games,
    ];

    pub const fn contract_key(self) -> &'static str {
        match self {
            Self::Cpu => "cpu",
            Self::Gpu => "gpu",
            Self::Memory => "memory",
            Self::Storage => "storage",
            Self::Network => "network",
            Self::Display => "display",
            Self::Audio => "audio",
            Self::Usb => "usb",
            Self::Windows => "windows",
            Self::Drivers => "drivers",
            Self::Security => "security",
            Self::Games => "games",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum UnavailableReason {
    NotReported,
    NotPresent,
    PermissionDenied,
    Unsupported,
    TimedOut,
    Cancelled,
    NotDiscovered,
    CollectorUnavailable,
}

impl UnavailableReason {
    const fn contract_value(self) -> &'static str {
        match self {
            Self::NotReported => "not-reported",
            Self::NotPresent => "not-present",
            Self::PermissionDenied => "permission-denied",
            Self::Unsupported => "unsupported",
            Self::TimedOut => "timed-out",
            Self::Cancelled => "cancelled",
            Self::NotDiscovered => "not-discovered",
            Self::CollectorUnavailable => "collector-unavailable",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RawHardwareFact {
    Observed {
        value: String,
        source: String,
        observed_at: String,
        elapsed_ms: u64,
        protected_identifiers: Vec<String>,
    },
    Unavailable {
        reason: UnavailableReason,
        source: String,
        elapsed_ms: u64,
    },
    Contradictory {
        first: String,
        second: String,
        source: String,
        elapsed_ms: u64,
    },
}

impl RawHardwareFact {
    pub fn observed(
        value: impl Into<String>,
        source: impl Into<String>,
        observed_at: impl Into<String>,
        elapsed_ms: u64,
    ) -> Self {
        Self::Observed {
            value: value.into(),
            source: source.into(),
            observed_at: observed_at.into(),
            elapsed_ms,
            protected_identifiers: Vec::new(),
        }
    }

    pub fn observed_with_protected(
        value: impl Into<String>,
        source: impl Into<String>,
        observed_at: impl Into<String>,
        elapsed_ms: u64,
        protected_identifiers: Vec<String>,
    ) -> Self {
        Self::Observed {
            value: value.into(),
            source: source.into(),
            observed_at: observed_at.into(),
            elapsed_ms,
            protected_identifiers,
        }
    }

    pub fn unavailable(
        reason: UnavailableReason,
        source: impl Into<String>,
        elapsed_ms: u64,
    ) -> Self {
        Self::Unavailable {
            reason,
            source: source.into(),
            elapsed_ms,
        }
    }

    pub fn contradictory(
        first: impl Into<String>,
        second: impl Into<String>,
        source: impl Into<String>,
        elapsed_ms: u64,
    ) -> Self {
        Self::Contradictory {
            first: first.into(),
            second: second.into(),
            source: source.into(),
            elapsed_ms,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RawInventory {
    pub facts: BTreeMap<HardwareClass, RawHardwareFact>,
    pub windows_version: WindowsVersionEvidence,
}

pub trait HardwareInventorySource {
    fn collect(&self) -> RawInventory;
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CollectionRequest {
    pub evidence_id: String,
    pub evidence_version: u32,
    pub collected_at: String,
    pub deadline_at: String,
    pub per_source_timeout_ms: u64,
    pub cancelled: bool,
    pub stable_id_salt: Vec<u8>,
    pub policy_date: u32,
}

#[derive(Clone, Debug, PartialEq)]
pub struct InventoryCollection {
    pub document: Value,
    pub lifecycle: WindowsLifecycle,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum InventoryCollectionError {
    InvalidRequest,
    ContractRejected,
    Persistence(EvidenceStoreError),
}

pub struct InventoryCollector<S> {
    source: S,
}

impl<S: HardwareInventorySource> InventoryCollector<S> {
    pub const fn new(source: S) -> Self {
        Self { source }
    }

    pub fn collect(
        &self,
        request: &CollectionRequest,
    ) -> Result<InventoryCollection, InventoryCollectionError> {
        validate_request(request)?;
        let started = Instant::now();
        let raw = if request.cancelled {
            RawInventory {
                facts: BTreeMap::new(),
                windows_version: unknown_windows_version(),
            }
        } else {
            self.source.collect()
        };
        let lifecycle = classify_windows_lifecycle(&raw.windows_version, request.policy_date);
        let mut unavailable_count = 0usize;
        let mut facts = Map::new();

        for class in HardwareClass::ALL {
            let fact = if request.cancelled {
                unavailable_fact(
                    UnavailableReason::Cancelled,
                    "collection was cancelled before admission",
                )
            } else {
                admit_fact(class, raw.facts.get(&class), request)
            };
            if fact["state"] == "unavailable" {
                unavailable_count += 1;
            }
            facts.insert(class.contract_key().to_owned(), fact);
        }

        let elapsed_ms = started.elapsed().as_millis().clamp(1, 60_000) as u64;
        let health_state = match unavailable_count {
            0 => "healthy",
            12 => "unavailable",
            _ => "degraded",
        };
        let quality = if unavailable_count == 0 {
            "valid"
        } else if unavailable_count == 12 {
            "insufficient"
        } else {
            "degraded"
        };

        let mut document = json!({
            "kind": "inventory-snapshot",
            "schemaVersion": "1.0",
            "evidenceId": request.evidence_id,
            "evidenceVersion": request.evidence_version,
            "collectedAt": request.collected_at,
            "evidenceHash": format!("sha256:{}", "0".repeat(64)),
            "execution": {
                "sourceCapability": "native-readonly",
                "deadlineAt": request.deadline_at,
                "cancellationState": if request.cancelled { "acknowledged" } else { "not-requested" },
                "health": {
                    "state": health_state,
                    "checkedAt": request.collected_at,
                    "detail": format!("{} of {} hardware classes admitted", 12 - unavailable_count, 12),
                },
                "overhead": {
                    "sampleWindowMs": elapsed_ms,
                    "cpuTimeMs": elapsed_ms,
                    "peakWorkingSetBytes": "0",
                    "quality": quality,
                }
            }
        });
        let object = document
            .as_object_mut()
            .ok_or(InventoryCollectionError::ContractRejected)?;
        object.extend(facts);

        let hash = evidence_hash(&document)?;
        document["evidenceHash"] = Value::String(hash);
        validate_hardware_evidence_document(&document)
            .map_err(|_| InventoryCollectionError::ContractRejected)?;

        Ok(InventoryCollection {
            document,
            lifecycle,
        })
    }

    pub fn collect_and_persist(
        &self,
        request: &CollectionRequest,
        store: &mut EvidenceStore,
        created_order: i64,
    ) -> Result<StoredEvidence, InventoryCollectionError> {
        let collection = self.collect(request)?;
        store
            .append_document(
                &collection.document,
                EvidenceLifecycle::Immutable,
                created_order,
            )
            .map_err(InventoryCollectionError::Persistence)
    }
}

fn validate_request(request: &CollectionRequest) -> Result<(), InventoryCollectionError> {
    if request.evidence_id.is_empty()
        || request.evidence_id.len() > 128
        || request.evidence_version == 0
        || request.collected_at.is_empty()
        || request.deadline_at.is_empty()
        || request.per_source_timeout_ms == 0
        || request.stable_id_salt.len() < 16
    {
        return Err(InventoryCollectionError::InvalidRequest);
    }
    Ok(())
}

fn admit_fact(
    class: HardwareClass,
    raw: Option<&RawHardwareFact>,
    request: &CollectionRequest,
) -> Value {
    let Some(raw) = raw else {
        return unavailable_fact(
            UnavailableReason::NotDiscovered,
            "no admitted native source reported this class",
        );
    };

    let elapsed_ms = match raw {
        RawHardwareFact::Observed { elapsed_ms, .. }
        | RawHardwareFact::Unavailable { elapsed_ms, .. }
        | RawHardwareFact::Contradictory { elapsed_ms, .. } => *elapsed_ms,
    };
    if elapsed_ms > request.per_source_timeout_ms {
        return unavailable_fact(
            UnavailableReason::TimedOut,
            "native source exceeded its bounded collection time",
        );
    }

    match raw {
        RawHardwareFact::Unavailable { reason, source, .. } => unavailable_fact(
            *reason,
            &format!("{} did not admit a value", bounded_text(source)),
        ),
        RawHardwareFact::Contradictory { source, .. } => unavailable_fact(
            UnavailableReason::NotReported,
            &format!("{} returned contradictory evidence", bounded_text(source)),
        ),
        RawHardwareFact::Observed {
            value,
            source,
            observed_at,
            protected_identifiers,
            ..
        } => {
            let value = bounded_text(value);
            let source = bounded_text(source);
            if value.is_empty()
                || source.is_empty()
                || observed_at.is_empty()
                || protected_identifiers
                    .iter()
                    .any(|identifier| !identifier.is_empty() && value.contains(identifier))
            {
                return unavailable_fact(
                    UnavailableReason::NotReported,
                    "native source value failed boundary validation",
                );
            }
            let mut fact = json!({
                "state": "observed",
                "value": value,
                "source": source,
                "observedAt": request.collected_at,
            });
            if !protected_identifiers.is_empty() {
                fact["stableDerivedId"] = Value::String(stable_derived_id(
                    class,
                    protected_identifiers,
                    &request.stable_id_salt,
                ));
            }
            fact
        }
    }
}

fn unavailable_fact(reason: UnavailableReason, detail: &str) -> Value {
    json!({
        "state": "unavailable",
        "reasonCode": reason.contract_value(),
        "detail": bounded_text(detail),
    })
}

fn bounded_text(value: &str) -> String {
    value.trim().chars().take(512).collect()
}

fn stable_derived_id(class: HardwareClass, identifiers: &[String], salt: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"liiiraa-hardware-inventory-v1\0");
    hasher.update(salt);
    hasher.update([0]);
    hasher.update(class.contract_key().as_bytes());
    for identifier in identifiers {
        hasher.update([0]);
        hasher.update(identifier.as_bytes());
    }
    let digest = hasher.finalize();
    format!(
        "hardware-{}-{}",
        class.contract_key(),
        hex_lower(&digest[..16])
    )
}

fn evidence_hash(document: &Value) -> Result<String, InventoryCollectionError> {
    let mut hashable = document.clone();
    hashable
        .as_object_mut()
        .ok_or(InventoryCollectionError::ContractRejected)?
        .remove("evidenceHash");
    let bytes =
        serde_json::to_vec(&hashable).map_err(|_| InventoryCollectionError::ContractRejected)?;
    Ok(format!("sha256:{}", hex_lower(&Sha256::digest(bytes))))
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

#[derive(Clone, Copy, Debug, Default)]
pub struct WindowsInventorySource;

#[cfg(target_os = "windows")]
impl HardwareInventorySource for WindowsInventorySource {
    fn collect(&self) -> RawInventory {
        windows_native::collect()
    }
}

#[cfg(not(target_os = "windows"))]
impl HardwareInventorySource for WindowsInventorySource {
    fn collect(&self) -> RawInventory {
        let facts = HardwareClass::ALL
            .into_iter()
            .map(|class| {
                (
                    class,
                    RawHardwareFact::unavailable(
                        UnavailableReason::Unsupported,
                        "Windows native inventory",
                        0,
                    ),
                )
            })
            .collect();
        RawInventory {
            facts,
            windows_version: unknown_windows_version(),
        }
    }
}

fn unknown_windows_version() -> WindowsVersionEvidence {
    WindowsVersionEvidence {
        major: 0,
        minor: 0,
        build: 0,
        edition: WindowsEdition::Unknown,
        channel: ServicingChannel::Unknown,
        esu_enrolled: false,
        contradictory: false,
        policy_version: 1,
    }
}

#[cfg(target_os = "windows")]
mod windows_native {
    use std::mem::size_of;

    use windows::Wdk::System::SystemServices::RtlGetVersion;
    use windows::Win32::Graphics::Gdi::{
        DEVMODEW, DISPLAY_DEVICE_ACTIVE, DISPLAY_DEVICEW, ENUM_CURRENT_SETTINGS,
        EnumDisplayDevicesW, EnumDisplaySettingsW,
    };
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    use windows::Win32::System::SystemInformation::{
        FIRMWARE_TABLE_PROVIDER, GetProductInfo, GetSystemFirmwareTable, GlobalMemoryStatusEx,
        MEMORYSTATUSEX, OS_PRODUCT_TYPE, OSVERSIONINFOW, PRODUCT_CORE,
        PRODUCT_CORE_COUNTRYSPECIFIC, PRODUCT_CORE_N, PRODUCT_CORE_SINGLELANGUAGE,
        PRODUCT_EDUCATION, PRODUCT_EDUCATION_N, PRODUCT_ENTERPRISE, PRODUCT_ENTERPRISE_N,
        PRODUCT_ENTERPRISE_S, PRODUCT_ENTERPRISE_S_N, PRODUCT_HOME_BASIC, PRODUCT_HOME_BASIC_N,
        PRODUCT_HOME_PREMIUM, PRODUCT_HOME_PREMIUM_N, PRODUCT_PROFESSIONAL, PRODUCT_PROFESSIONAL_E,
        PRODUCT_PROFESSIONAL_N,
    };
    use windows::core::{PCWSTR, w};

    use super::*;

    pub(super) fn collect() -> RawInventory {
        let observed_at = native_observed_at();
        let mut facts = BTreeMap::new();
        facts.insert(HardwareClass::Cpu, cpu_fact(&observed_at));
        facts.insert(HardwareClass::Memory, memory_fact(&observed_at));
        facts.insert(HardwareClass::Gpu, gpu_fact(&observed_at));
        facts.insert(HardwareClass::Display, display_fact(&observed_at));
        facts.insert(HardwareClass::Storage, storage_fact(&observed_at));
        facts.insert(HardwareClass::Games, games_fact(&observed_at));

        for (class, source) in [
            (HardwareClass::Network, "GetAdaptersAddresses"),
            (HardwareClass::Audio, "MMDeviceEnumerator"),
            (HardwareClass::Usb, "SetupAPI"),
            (HardwareClass::Drivers, "SetupAPI"),
            (HardwareClass::Security, "Windows Security Center"),
        ] {
            facts.insert(
                class,
                RawHardwareFact::unavailable(UnavailableReason::CollectorUnavailable, source, 0),
            );
        }

        let version = windows_version();
        facts.insert(
            HardwareClass::Windows,
            if version.build == 0 {
                RawHardwareFact::unavailable(
                    UnavailableReason::CollectorUnavailable,
                    "RtlGetVersion",
                    0,
                )
            } else {
                RawHardwareFact::observed(
                    windows_display_name(&version),
                    "RtlGetVersion + GetProductInfo",
                    &observed_at,
                    1,
                )
            },
        );

        RawInventory {
            facts,
            windows_version: version,
        }
    }

    fn native_observed_at() -> String {
        // The authoritative timestamp is supplied by the bounded collection
        // request. This value is replaced at admission when sources cannot
        // provide a more precise native timestamp.
        "2026-08-12T00:00:00Z".to_owned()
    }

    fn cpu_fact(observed_at: &str) -> RawHardwareFact {
        let name = cpu_brand().unwrap_or_else(|| std::env::consts::ARCH.to_owned());
        RawHardwareFact::observed(name, "CPUID", observed_at, 1)
    }

    #[cfg(target_arch = "x86_64")]
    fn cpu_brand() -> Option<String> {
        use std::arch::x86_64::__cpuid;
        let highest = __cpuid(0x8000_0000).eax;
        if highest < 0x8000_0004 {
            return None;
        }
        let mut bytes = Vec::with_capacity(48);
        for leaf in 0x8000_0002..=0x8000_0004 {
            let result = __cpuid(leaf);
            for value in [result.eax, result.ebx, result.ecx, result.edx] {
                bytes.extend_from_slice(&value.to_le_bytes());
            }
        }
        let value = String::from_utf8_lossy(&bytes)
            .trim_matches(char::from(0))
            .trim()
            .to_owned();
        (!value.is_empty()).then_some(value)
    }

    #[cfg(not(target_arch = "x86_64"))]
    fn cpu_brand() -> Option<String> {
        None
    }

    fn memory_fact(observed_at: &str) -> RawHardwareFact {
        let mut memory = MEMORYSTATUSEX {
            dwLength: size_of::<MEMORYSTATUSEX>() as u32,
            ..Default::default()
        };
        if unsafe { GlobalMemoryStatusEx(&mut memory) }.is_err() || memory.ullTotalPhys == 0 {
            return RawHardwareFact::unavailable(
                UnavailableReason::CollectorUnavailable,
                "GlobalMemoryStatusEx",
                1,
            );
        }
        let smbios = read_memory_devices();
        let value = smbios
            .as_ref()
            .map(memory_display_value)
            .unwrap_or_else(|| {
                let gib = memory.ullTotalPhys as f64 / 1_073_741_824.0;
                format!("{gib:.1} GiB physical memory")
            });
        RawHardwareFact::observed(
            value,
            if smbios.is_some() {
                "GlobalMemoryStatusEx + SMBIOS Type 17"
            } else {
                "GlobalMemoryStatusEx"
            },
            observed_at,
            1,
        )
    }

    fn gpu_fact(observed_at: &str) -> RawHardwareFact {
        let mut device = DISPLAY_DEVICEW {
            cb: size_of::<DISPLAY_DEVICEW>() as u32,
            ..Default::default()
        };
        let mut index = 0;
        while unsafe { EnumDisplayDevicesW(PCWSTR::null(), index, &mut device, 0) }.as_bool() {
            if device.StateFlags.contains(DISPLAY_DEVICE_ACTIVE) {
                let name = wide_text(&device.DeviceString);
                let protected = [wide_text(&device.DeviceID), wide_text(&device.DeviceKey)]
                    .into_iter()
                    .filter(|value| !value.is_empty())
                    .collect();
                if !name.is_empty() {
                    return RawHardwareFact::observed_with_protected(
                        name,
                        "EnumDisplayDevicesW",
                        observed_at,
                        2,
                        protected,
                    );
                }
            }
            index += 1;
            device = DISPLAY_DEVICEW {
                cb: size_of::<DISPLAY_DEVICEW>() as u32,
                ..Default::default()
            };
        }
        RawHardwareFact::unavailable(UnavailableReason::NotDiscovered, "EnumDisplayDevicesW", 2)
    }

    fn display_fact(observed_at: &str) -> RawHardwareFact {
        let mut mode = DEVMODEW {
            dmSize: size_of::<DEVMODEW>() as u16,
            ..Default::default()
        };
        if !unsafe { EnumDisplaySettingsW(PCWSTR::null(), ENUM_CURRENT_SETTINGS, &mut mode) }
            .as_bool()
        {
            return RawHardwareFact::unavailable(
                UnavailableReason::NotDiscovered,
                "EnumDisplaySettingsW",
                1,
            );
        }
        RawHardwareFact::observed(
            format!(
                "{} x {} @ {} Hz",
                mode.dmPelsWidth, mode.dmPelsHeight, mode.dmDisplayFrequency
            ),
            "EnumDisplaySettingsW",
            observed_at,
            1,
        )
    }

    fn storage_fact(observed_at: &str) -> RawHardwareFact {
        let mut total = 0u64;
        let mut free = 0u64;
        if unsafe { GetDiskFreeSpaceExW(w!("C:\\"), None, Some(&mut total), Some(&mut free)) }
            .is_err()
            || total == 0
        {
            return RawHardwareFact::unavailable(
                UnavailableReason::CollectorUnavailable,
                "GetDiskFreeSpaceExW",
                1,
            );
        }
        RawHardwareFact::observed(
            format!(
                "System volume {:.0} GiB total, {:.0} GiB free",
                total as f64 / 1_073_741_824.0,
                free as f64 / 1_073_741_824.0
            ),
            "GetDiskFreeSpaceExW",
            observed_at,
            1,
        )
    }

    fn games_fact(observed_at: &str) -> RawHardwareFact {
        let started = Instant::now();
        let mut games = BTreeSet::new();
        let mut protected_paths = Vec::new();
        discover_steam_games(&mut games, &mut protected_paths);
        discover_epic_games(&mut games, &mut protected_paths);
        discover_directory_games(&mut games, &mut protected_paths);
        let elapsed_ms = started.elapsed().as_millis().clamp(1, 60_000) as u64;

        if games.is_empty() {
            return RawHardwareFact::unavailable(
                UnavailableReason::NotDiscovered,
                "Steam, Epic, Xbox, EA and Ubisoft local manifests",
                elapsed_ms,
            );
        }

        let total = games.len();
        let names = games.into_iter().take(8).collect::<Vec<_>>().join(" · ");
        let suffix = (total > 8)
            .then(|| format!(" · +{} more", total - 8))
            .unwrap_or_default();
        RawHardwareFact::observed_with_protected(
            format!("{total} installed games · {names}{suffix}"),
            "Steam + Epic + Xbox/EA/Ubisoft local discovery",
            observed_at,
            elapsed_ms,
            protected_paths,
        )
    }

    fn discover_steam_games(games: &mut BTreeSet<String>, protected_paths: &mut Vec<String>) {
        let mut steam_roots = BTreeSet::new();
        for variable in ["PROGRAMFILES(X86)", "PROGRAMFILES"] {
            if let Some(root) = std::env::var_os(variable) {
                steam_roots.insert(PathBuf::from(root).join("Steam"));
            }
        }
        for root in steam_roots.iter().cloned().collect::<Vec<_>>() {
            let libraries = root.join("steamapps").join("libraryfolders.vdf");
            if let Ok(contents) = fs::read_to_string(libraries) {
                for path in vdf_values(&contents, "path") {
                    steam_roots.insert(PathBuf::from(path.replace("\\\\", "\\")));
                }
            }
        }
        for root in steam_roots {
            let steamapps = root.join("steamapps");
            let Ok(entries) = fs::read_dir(&steamapps) else {
                continue;
            };
            protected_paths.push(steamapps.to_string_lossy().into_owned());
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = entry.file_name();
                let file_name = file_name.to_string_lossy();
                if !file_name.starts_with("appmanifest_")
                    || path.extension().and_then(|value| value.to_str()) != Some("acf")
                {
                    continue;
                }
                if let Ok(contents) = fs::read_to_string(path) {
                    if let Some(name) = vdf_values(&contents, "name").into_iter().next() {
                        insert_game_name(games, &name);
                    }
                }
            }
        }
    }

    fn discover_epic_games(games: &mut BTreeSet<String>, protected_paths: &mut Vec<String>) {
        let Some(program_data) = std::env::var_os("PROGRAMDATA") else {
            return;
        };
        let manifests = PathBuf::from(program_data)
            .join("Epic")
            .join("EpicGamesLauncher")
            .join("Data")
            .join("Manifests");
        let Ok(entries) = fs::read_dir(&manifests) else {
            return;
        };
        protected_paths.push(manifests.to_string_lossy().into_owned());
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("item") {
                continue;
            }
            let Ok(bytes) = fs::read(path) else {
                continue;
            };
            let Ok(manifest) = serde_json::from_slice::<Value>(&bytes) else {
                continue;
            };
            if manifest["bIsIncompleteInstall"].as_bool() == Some(true) {
                continue;
            }
            if let Some(name) = manifest["DisplayName"].as_str() {
                insert_game_name(games, name);
            }
        }
    }

    fn discover_directory_games(games: &mut BTreeSet<String>, protected_paths: &mut Vec<String>) {
        let mut roots = Vec::new();
        if let Some(system_drive) = std::env::var_os("SYSTEMDRIVE") {
            roots.push(PathBuf::from(system_drive).join("XboxGames"));
        }
        if let Some(program_files) = std::env::var_os("PROGRAMFILES") {
            roots.push(PathBuf::from(&program_files).join("EA Games"));
            roots.push(
                PathBuf::from(program_files)
                    .join("Ubisoft")
                    .join("Ubisoft Game Launcher")
                    .join("games"),
            );
        }
        if let Some(program_files_x86) = std::env::var_os("PROGRAMFILES(X86)") {
            roots.push(
                PathBuf::from(program_files_x86)
                    .join("Ubisoft")
                    .join("Ubisoft Game Launcher")
                    .join("games"),
            );
        }
        for root in roots {
            let Ok(entries) = fs::read_dir(&root) else {
                continue;
            };
            protected_paths.push(root.to_string_lossy().into_owned());
            for entry in entries.flatten() {
                if entry.file_type().is_ok_and(|kind| kind.is_dir()) {
                    insert_game_name(games, &entry.file_name().to_string_lossy());
                }
            }
        }
    }

    fn vdf_values(contents: &str, wanted_key: &str) -> Vec<String> {
        contents
            .lines()
            .filter_map(|line| {
                let quoted = line
                    .split('"')
                    .enumerate()
                    .filter_map(|(index, part)| (index % 2 == 1).then_some(part))
                    .collect::<Vec<_>>();
                (quoted.len() >= 2 && quoted[0].eq_ignore_ascii_case(wanted_key))
                    .then(|| quoted[1].trim().to_owned())
            })
            .filter(|value| !value.is_empty())
            .collect()
    }

    fn insert_game_name(games: &mut BTreeSet<String>, candidate: &str) {
        let name = candidate.trim().chars().take(96).collect::<String>();
        if name.len() >= 2 && !name.eq_ignore_ascii_case("common") {
            games.insert(name);
        }
    }

    fn windows_version() -> WindowsVersionEvidence {
        let mut info = OSVERSIONINFOW {
            dwOSVersionInfoSize: size_of::<OSVERSIONINFOW>() as u32,
            ..Default::default()
        };
        if unsafe { RtlGetVersion(&mut info) }.is_err() {
            return unknown_windows_version();
        }

        let mut product = OS_PRODUCT_TYPE::default();
        let admitted_product =
            unsafe { GetProductInfo(info.dwMajorVersion, info.dwMinorVersion, 0, 0, &mut product) }
                .as_bool();
        let edition = admitted_product
            .then(|| edition_from_product(product))
            .unwrap_or(WindowsEdition::Unknown);
        let channel = if matches!(
            edition,
            WindowsEdition::EnterpriseLtsc | WindowsEdition::IoTEnterpriseLtsc
        ) {
            ServicingChannel::LongTermServicing
        } else if edition == WindowsEdition::Unknown {
            ServicingChannel::Unknown
        } else {
            ServicingChannel::GeneralAvailability
        };

        WindowsVersionEvidence {
            major: info.dwMajorVersion,
            minor: info.dwMinorVersion,
            build: info.dwBuildNumber,
            edition,
            channel,
            esu_enrolled: false,
            contradictory: false,
            policy_version: 1,
        }
    }

    fn windows_marketing_name(major: u32, minor: u32, build: u32) -> &'static str {
        if major == 10 && minor == 0 && build >= 22_000 {
            "Windows 11"
        } else if major == 10 {
            "Windows 10"
        } else {
            "Windows"
        }
    }

    fn windows_display_name(version: &WindowsVersionEvidence) -> String {
        let edition = match version.edition {
            WindowsEdition::Professional => " Pro",
            WindowsEdition::Home => " Home",
            WindowsEdition::Enterprise => " Enterprise",
            WindowsEdition::EnterpriseLtsc => " Enterprise LTSC",
            WindowsEdition::IoTEnterpriseLtsc => " IoT Enterprise LTSC",
            WindowsEdition::Education => " Education",
            WindowsEdition::Unknown => "",
        };
        format!(
            "{}{} · build {}",
            windows_marketing_name(version.major, version.minor, version.build),
            edition,
            version.build
        )
    }

    #[derive(Clone, Debug, Eq, PartialEq)]
    struct MemoryDeviceDetails {
        memory_type: Option<String>,
        configured_speed_mt_s: Option<u32>,
        installed_mebibytes: u64,
        module_count: u32,
    }

    fn memory_display_value(details: &MemoryDeviceDetails) -> String {
        let capacity = if details.installed_mebibytes > 0 {
            format!("{} GB", (details.installed_mebibytes + 512) / 1024)
        } else {
            "Installed memory".to_owned()
        };
        let mut parts = vec![capacity];
        if let Some(memory_type) = &details.memory_type {
            parts.push(memory_type.clone());
        }
        if let Some(speed) = details.configured_speed_mt_s {
            parts.push(format!("{speed} MT/s"));
        }
        if details.module_count > 0 {
            let suffix = if details.module_count == 1 { "" } else { "s" };
            parts.push(format!("{} DIMM{suffix}", details.module_count));
        }
        parts.join(" · ")
    }

    fn read_memory_devices() -> Option<MemoryDeviceDetails> {
        // Win32 documents this as the multi-character constant 'RSMB', whose
        // numeric DWORD representation follows the character order (big-endian).
        let provider = FIRMWARE_TABLE_PROVIDER(u32::from_be_bytes(*b"RSMB"));
        // SAFETY: a null output slice is the documented size query for this provider.
        let required = unsafe { GetSystemFirmwareTable(provider, 0, None) };
        if required <= 8 || required > 16 * 1024 * 1024 {
            return None;
        }
        let mut raw = vec![0_u8; required as usize];
        // SAFETY: the buffer is writable for exactly the length passed to Windows.
        let written = unsafe { GetSystemFirmwareTable(provider, 0, Some(&mut raw)) };
        if written <= 8 || written as usize > raw.len() {
            return None;
        }
        let table_length = u32::from_le_bytes(raw[4..8].try_into().ok()?) as usize;
        let table_end = 8_usize.saturating_add(table_length).min(written as usize);
        parse_memory_devices(&raw[8..table_end])
    }

    fn parse_memory_devices(table: &[u8]) -> Option<MemoryDeviceDetails> {
        let mut cursor = 0_usize;
        let mut memory_type: Option<&'static str> = None;
        let mut configured_speed = 0_u32;
        let mut installed_mebibytes = 0_u64;
        let mut module_count = 0_u32;
        while cursor + 4 <= table.len() {
            let structure_type = table[cursor];
            let formatted_length = usize::from(table[cursor + 1]);
            if formatted_length < 4 || cursor + formatted_length > table.len() {
                break;
            }
            if structure_type == 17 && formatted_length > 0x16 {
                let size = u16::from_le_bytes([table[cursor + 0x0c], table[cursor + 0x0d]]);
                if size != 0 && size != u16::MAX {
                    module_count += 1;
                    let module_mebibytes = if size == 0x7fff && formatted_length >= 0x20 {
                        u64::from(u32::from_le_bytes([
                            table[cursor + 0x1c],
                            table[cursor + 0x1d],
                            table[cursor + 0x1e],
                            table[cursor + 0x1f],
                        ]))
                    } else if size & 0x8000 != 0 {
                        u64::from(size & 0x7fff) / 1024
                    } else {
                        u64::from(size)
                    };
                    installed_mebibytes = installed_mebibytes.saturating_add(module_mebibytes);
                    let candidate_type = match table[cursor + 0x12] {
                        0x18 => Some("DDR3"),
                        0x1a => Some("DDR4"),
                        0x1b => Some("LPDDR"),
                        0x1c => Some("LPDDR2"),
                        0x1d => Some("LPDDR3"),
                        0x1e => Some("LPDDR4"),
                        0x22 => Some("DDR5"),
                        0x23 => Some("LPDDR5"),
                        _ => None,
                    };
                    memory_type = memory_type.or(candidate_type);
                    let rated = u16::from_le_bytes([table[cursor + 0x15], table[cursor + 0x16]]);
                    let configured = if formatted_length >= 0x22 {
                        u16::from_le_bytes([table[cursor + 0x20], table[cursor + 0x21]])
                    } else {
                        0
                    };
                    let legacy_speed = if configured > 0 && configured != u16::MAX {
                        u32::from(configured)
                    } else if rated > 0 && rated != u16::MAX {
                        u32::from(rated)
                    } else {
                        0
                    };
                    let extended_speed = if formatted_length >= 0x5c {
                        let configured = u32::from_le_bytes([
                            table[cursor + 0x58],
                            table[cursor + 0x59],
                            table[cursor + 0x5a],
                            table[cursor + 0x5b],
                        ]);
                        let rated = u32::from_le_bytes([
                            table[cursor + 0x54],
                            table[cursor + 0x55],
                            table[cursor + 0x56],
                            table[cursor + 0x57],
                        ]);
                        configured.max(rated)
                    } else {
                        0
                    };
                    configured_speed = configured_speed.max(extended_speed.max(legacy_speed));
                }
            }

            let mut next = cursor + formatted_length;
            while next + 1 < table.len() && !(table[next] == 0 && table[next + 1] == 0) {
                next += 1;
            }
            cursor = next.saturating_add(2);
            if structure_type == 127 {
                break;
            }
        }
        (module_count > 0).then(|| MemoryDeviceDetails {
            memory_type: memory_type.map(str::to_owned),
            configured_speed_mt_s: (configured_speed > 0).then_some(configured_speed),
            installed_mebibytes,
            module_count,
        })
    }

    fn edition_from_product(product: OS_PRODUCT_TYPE) -> WindowsEdition {
        if [
            PRODUCT_PROFESSIONAL,
            PRODUCT_PROFESSIONAL_E,
            PRODUCT_PROFESSIONAL_N,
        ]
        .contains(&product)
        {
            WindowsEdition::Professional
        } else if [
            PRODUCT_CORE,
            PRODUCT_CORE_COUNTRYSPECIFIC,
            PRODUCT_CORE_N,
            PRODUCT_CORE_SINGLELANGUAGE,
            PRODUCT_HOME_BASIC,
            PRODUCT_HOME_BASIC_N,
            PRODUCT_HOME_PREMIUM,
            PRODUCT_HOME_PREMIUM_N,
        ]
        .contains(&product)
        {
            WindowsEdition::Home
        } else if [PRODUCT_ENTERPRISE_S, PRODUCT_ENTERPRISE_S_N].contains(&product) {
            WindowsEdition::EnterpriseLtsc
        } else if [PRODUCT_ENTERPRISE, PRODUCT_ENTERPRISE_N].contains(&product) {
            WindowsEdition::Enterprise
        } else if [PRODUCT_EDUCATION, PRODUCT_EDUCATION_N].contains(&product) {
            WindowsEdition::Education
        } else {
            WindowsEdition::Unknown
        }
    }

    fn wide_text(buffer: &[u16]) -> String {
        let length = buffer
            .iter()
            .position(|value| *value == 0)
            .unwrap_or(buffer.len());
        String::from_utf16_lossy(&buffer[..length])
            .trim()
            .to_owned()
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn names_windows_11_from_the_supported_build_boundary() {
            assert_eq!(windows_marketing_name(10, 0, 26_200), "Windows 11");
            assert_eq!(windows_marketing_name(10, 0, 19_045), "Windows 10");
        }

        #[test]
        fn parses_ddr5_and_configured_speed_from_smbios_type_17() {
            let mut structure = vec![0_u8; 0x28];
            structure[0] = 17;
            structure[1] = 0x28;
            structure[0x0c..0x0e].copy_from_slice(&16_384_u16.to_le_bytes());
            structure[0x12] = 34;
            structure[0x15..0x17].copy_from_slice(&4_800_u16.to_le_bytes());
            structure[0x20..0x22].copy_from_slice(&6_000_u16.to_le_bytes());
            structure.extend_from_slice(&[0, 0]);

            let details = parse_memory_devices(&structure).expect("DDR5 module");
            assert_eq!(details.memory_type.as_deref(), Some("DDR5"));
            assert_eq!(details.configured_speed_mt_s, Some(6_000));
            assert_eq!(details.installed_mebibytes, 16_384);
            assert_eq!(details.module_count, 1);
            assert_eq!(
                memory_display_value(&details),
                "16 GB · DDR5 · 6000 MT/s · 1 DIMM"
            );
        }

        #[test]
        fn parses_steam_vdf_fields_without_exposing_paths() {
            let manifest = r#"
                "AppState"
                {
                    "appid" "578080"
                    "name" "PUBG: BATTLEGROUNDS"
                }
            "#;
            assert_eq!(vdf_values(manifest, "name"), vec!["PUBG: BATTLEGROUNDS"]);
        }
    }
}
