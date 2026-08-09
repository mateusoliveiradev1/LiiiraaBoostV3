use std::collections::BTreeMap;

use liiiraa_contracts_rust::{
    ControlPlaneDocument, DeviceBindingProjection, DeviceCommand, validate_control_plane_document,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use crate::{
    account_sync::{
        AccountApiResponse, AccountSyncError, get_device_evidence_context, post_device_binding,
    },
    credential_store::{CredentialStore, WindowsCredentialStore},
};

const LOCAL_DIGEST_CONTEXT: &[u8] = b"liiiraa-device-evidence-component-v1";
const MINIMUM_COMPONENT_CLASSES: usize = 3;

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ComponentClass {
    PlatformTrust,
    VirtualPlatform,
    Cpu,
    StorageController,
    Gpu,
    MemoryTopology,
}

impl ComponentClass {
    fn label(self) -> &'static str {
        match self {
            Self::PlatformTrust => "platform-trust",
            Self::VirtualPlatform => "virtual-platform",
            Self::Cpu => "cpu",
            Self::StorageController => "storage-controller",
            Self::Gpu => "gpu",
            Self::MemoryTopology => "memory-topology",
        }
    }

    const fn weight(self) -> u8 {
        match self {
            Self::PlatformTrust | Self::VirtualPlatform => 40,
            Self::Cpu => 25,
            Self::StorageController => 15,
            Self::Gpu | Self::MemoryTopology => 10,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceClass {
    Physical,
    Virtual,
}

pub struct RawComponentObservation<'a> {
    component_class: ComponentClass,
    raw_value: &'a str,
}

pub struct RawDeviceInventory {
    friendly_label: String,
    device_class: DeviceClass,
    components: Vec<(ComponentClass, String)>,
}

impl RawDeviceInventory {
    pub fn new(
        friendly_label: impl Into<String>,
        device_class: DeviceClass,
        components: Vec<(ComponentClass, String)>,
    ) -> Self {
        Self {
            friendly_label: friendly_label.into(),
            device_class,
            components,
        }
    }
}

pub trait DeviceInventoryCollector {
    fn collect(&self) -> Result<RawDeviceInventory, DeviceIdentityError>;
}

#[derive(Clone, Copy, Debug, Default)]
pub struct WindowsDeviceInventoryCollector;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceBindingReadiness {
    Ready,
    Unavailable,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceBindingReadinessError {
    InventoryUnavailable,
    EvidenceInsufficient,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBindingPreview {
    pub readiness: DeviceBindingReadiness,
    pub device_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub device_class: Option<DeviceClass>,
    pub admitted_components: Vec<ComponentClass>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<DeviceBindingReadinessError>,
}

impl<'a> RawComponentObservation<'a> {
    pub const fn new(component_class: ComponentClass, raw_value: &'a str) -> Self {
        Self {
            component_class,
            raw_value,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtectedComponentEvidence {
    pub component_class: ComponentClass,
    pub local_digest: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProtectedDeviceEvidence {
    pub device_class: DeviceClass,
    pub components: Vec<ProtectedComponentEvidence>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DeviceEvidenceOutcome {
    SamePc,
    RevalidationRequired,
    Replacement,
    Rejected,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DeviceEvidenceComparison {
    pub outcome: DeviceEvidenceOutcome,
    pub score: u8,
    pub matched_components: Vec<ComponentClass>,
    pub changed_components: Vec<ComponentClass>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DeviceIdentityError {
    EvidenceEmpty,
    EvidenceBelowMinimum,
    MissingAnchor,
    InvalidAccountSalt,
    InvalidComponent(ComponentClass),
    ContradictoryComponent(ComponentClass),
    DeviceClassMismatch,
    InventoryUnavailable,
    CredentialUnavailable,
    NetworkUnavailable,
    Unauthorized,
    InvalidResponse,
}

const PREVIEW_READINESS_SALT: &[u8] = b"liiiraa-preview-readiness-salt-v1";

fn sanitized_label(value: &str) -> Option<String> {
    let label = value.trim();
    if label.is_empty()
        || label.chars().count() > 64
        || label.chars().any(|character| {
            character.is_control()
                || !(character.is_alphanumeric()
                    || character.is_ascii_whitespace()
                    || matches!(character, '-' | '_' | '.'))
        })
    {
        return None;
    }
    Some(label.to_owned())
}

pub fn prepare_device_binding_with_collector(
    collector: &impl DeviceInventoryCollector,
) -> DeviceBindingPreview {
    let inventory = match collector.collect() {
        Ok(inventory) => inventory,
        Err(_) => {
            return DeviceBindingPreview {
                readiness: DeviceBindingReadiness::Unavailable,
                device_label: String::new(),
                device_class: None,
                admitted_components: Vec::new(),
                error: Some(DeviceBindingReadinessError::InventoryUnavailable),
            };
        }
    };
    let label = match sanitized_label(&inventory.friendly_label) {
        Some(label) => label,
        None => {
            return DeviceBindingPreview {
                readiness: DeviceBindingReadiness::Unavailable,
                device_label: String::new(),
                device_class: None,
                admitted_components: Vec::new(),
                error: Some(DeviceBindingReadinessError::InventoryUnavailable),
            };
        }
    };
    let observations: Vec<_> = inventory
        .components
        .iter()
        .map(|(component_class, raw_value)| {
            RawComponentObservation::new(*component_class, raw_value.as_str())
        })
        .collect();
    match collect_protected_device_evidence(
        inventory.device_class,
        &observations,
        PREVIEW_READINESS_SALT,
    ) {
        Ok(evidence) => DeviceBindingPreview {
            readiness: DeviceBindingReadiness::Ready,
            device_label: label,
            device_class: Some(evidence.device_class),
            admitted_components: evidence
                .components
                .into_iter()
                .map(|component| component.component_class)
                .collect(),
            error: None,
        },
        Err(_) => DeviceBindingPreview {
            readiness: DeviceBindingReadiness::Unavailable,
            device_label: label,
            device_class: Some(inventory.device_class),
            admitted_components: Vec::new(),
            error: Some(DeviceBindingReadinessError::EvidenceInsufficient),
        },
    }
}

pub fn prepare_device_binding() -> DeviceBindingPreview {
    prepare_device_binding_with_collector(&WindowsDeviceInventoryCollector)
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DeviceBindingRequest {
    pub command: DeviceCommand,
    pub confirmed_friendly_identity: bool,
    pub confirmed_one_pc_consequences: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum DeviceBindingMutationStatus {
    Applied,
    RevalidationRequired,
    PolicyDenied,
    Conflict,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceBindingMutationResponse {
    pub status: DeviceBindingMutationStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub projection: Option<DeviceBindingProjection>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

pub trait DeviceBindingApi {
    fn evidence_context(&self, credential: &str) -> Result<AccountApiResponse, AccountSyncError>;
    fn bind(&self, credential: &str, body: &[u8]) -> Result<AccountApiResponse, AccountSyncError>;
}

struct WindowsDeviceBindingApi<'a> {
    api_origin: &'a str,
}

impl DeviceBindingApi for WindowsDeviceBindingApi<'_> {
    fn evidence_context(&self, credential: &str) -> Result<AccountApiResponse, AccountSyncError> {
        get_device_evidence_context(self.api_origin, credential)
    }

    fn bind(&self, credential: &str, body: &[u8]) -> Result<AccountApiResponse, AccountSyncError> {
        post_device_binding(self.api_origin, credential, body)
    }
}

fn map_account_error(error: AccountSyncError) -> DeviceIdentityError {
    match error {
        AccountSyncError::NativeCredential(_) => DeviceIdentityError::CredentialUnavailable,
        AccountSyncError::NetworkUnavailable => DeviceIdentityError::NetworkUnavailable,
        AccountSyncError::InvalidRequest | AccountSyncError::InvalidResponse => {
            DeviceIdentityError::InvalidResponse
        }
    }
}

fn safe_reason(value: &str) -> Option<String> {
    (!value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-'))
    .then(|| value.to_owned())
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct DeviceAuthorityErrorBody {
    code: String,
    reason: String,
    #[serde(default)]
    projection: Option<DeviceBindingProjection>,
}

pub fn bind_current_device_with(
    store: &impl CredentialStore,
    api: &impl DeviceBindingApi,
    collector: &impl DeviceInventoryCollector,
    request: DeviceBindingRequest,
) -> Result<DeviceBindingMutationResponse, DeviceIdentityError> {
    if !request.confirmed_friendly_identity || !request.confirmed_one_pc_consequences {
        return Err(DeviceIdentityError::InvalidResponse);
    }
    let credential = store
        .read_credential()
        .map_err(|_| DeviceIdentityError::CredentialUnavailable)?
        .filter(|credential| {
            !credential.is_empty()
                && credential.len() <= 4_096
                && !credential.chars().any(char::is_control)
        })
        .ok_or(DeviceIdentityError::CredentialUnavailable)?;
    let context_response = api
        .evidence_context(&credential)
        .map_err(map_account_error)?;
    if matches!(context_response.status, 401 | 403) {
        return Err(DeviceIdentityError::Unauthorized);
    }
    if context_response.status != 200 || context_response.body.is_empty() {
        return Err(DeviceIdentityError::InvalidResponse);
    }
    let context_value: serde_json::Value = serde_json::from_slice(&context_response.body)
        .map_err(|_| DeviceIdentityError::InvalidResponse)?;
    let context = match validate_control_plane_document(&context_value)
        .map_err(|_| DeviceIdentityError::InvalidResponse)?
    {
        ControlPlaneDocument::DeviceEvidenceContextProjection(context) => context,
        _ => return Err(DeviceIdentityError::InvalidResponse),
    };
    if context.account_id.as_str() != request.command.account_id.as_str() {
        return Err(DeviceIdentityError::Unauthorized);
    }

    let inventory = collector.collect()?;
    let label = sanitized_label(&inventory.friendly_label)
        .ok_or(DeviceIdentityError::InventoryUnavailable)?;
    let observations: Vec<_> = inventory
        .components
        .iter()
        .map(|(component_class, raw_value)| {
            RawComponentObservation::new(*component_class, raw_value.as_str())
        })
        .collect();
    let evidence = collect_protected_device_evidence(
        inventory.device_class,
        &observations,
        context.account_salt.as_bytes(),
    )?;
    let submission = serde_json::json!({
        "schemaVersion": "1.0",
        "kind": "device-local-evidence-submission",
        "accountId": request.command.account_id,
        "contextVersion": context.context_version,
        "deviceClass": evidence.device_class,
        "components": evidence.components,
    });
    match validate_control_plane_document(&submission)
        .map_err(|_| DeviceIdentityError::InvalidResponse)?
    {
        ControlPlaneDocument::DeviceLocalEvidenceSubmission(_) => {}
        _ => return Err(DeviceIdentityError::InvalidResponse),
    }
    let body = serde_json::to_vec(&serde_json::json!({
        "command": request.command,
        "deviceLabel": label,
        "evidenceSubmission": submission,
        "confirmedFriendlyIdentity": request.confirmed_friendly_identity,
        "confirmedOnePcConsequences": request.confirmed_one_pc_consequences,
    }))
    .map_err(|_| DeviceIdentityError::InvalidResponse)?;
    let response = api.bind(&credential, &body).map_err(map_account_error)?;
    if matches!(response.status, 401 | 403) {
        return Err(DeviceIdentityError::Unauthorized);
    }
    if matches!(response.status, 200 | 202) {
        let projection: DeviceBindingProjection = serde_json::from_slice(&response.body)
            .map_err(|_| DeviceIdentityError::InvalidResponse)?;
        return Ok(DeviceBindingMutationResponse {
            status: if response.status == 200 {
                DeviceBindingMutationStatus::Applied
            } else {
                DeviceBindingMutationStatus::RevalidationRequired
            },
            projection: Some(projection),
            reason: None,
        });
    }
    if matches!(response.status, 409 | 422) {
        let error: DeviceAuthorityErrorBody = serde_json::from_slice(&response.body)
            .map_err(|_| DeviceIdentityError::InvalidResponse)?;
        if !matches!(error.code.as_str(), "STALE" | "POLICY_DENIED") {
            return Err(DeviceIdentityError::InvalidResponse);
        }
        return Ok(DeviceBindingMutationResponse {
            status: if response.status == 409 {
                DeviceBindingMutationStatus::Conflict
            } else {
                DeviceBindingMutationStatus::PolicyDenied
            },
            projection: error.projection,
            reason: safe_reason(&error.reason),
        });
    }
    Err(DeviceIdentityError::InvalidResponse)
}

pub fn bind_current_device(
    api_origin: &str,
    request: DeviceBindingRequest,
) -> Result<DeviceBindingMutationResponse, DeviceIdentityError> {
    let store =
        WindowsCredentialStore::for_account(crate::account_sync::DESKTOP_ACCOUNT_CREDENTIAL_SLOT);
    bind_current_device_with(
        &store,
        &WindowsDeviceBindingApi { api_origin },
        &WindowsDeviceInventoryCollector,
        request,
    )
}

#[cfg(target_os = "windows")]
impl DeviceInventoryCollector for WindowsDeviceInventoryCollector {
    fn collect(&self) -> Result<RawDeviceInventory, DeviceIdentityError> {
        collect_windows_inventory()
    }
}

#[cfg(not(target_os = "windows"))]
impl DeviceInventoryCollector for WindowsDeviceInventoryCollector {
    fn collect(&self) -> Result<RawDeviceInventory, DeviceIdentityError> {
        Err(DeviceIdentityError::InventoryUnavailable)
    }
}

#[cfg(target_os = "windows")]
fn collect_windows_inventory() -> Result<RawDeviceInventory, DeviceIdentityError> {
    use windows::{
        Win32::System::SystemInformation::{
            ComputerNamePhysicalDnsHostname, FIRMWARE_TABLE_PROVIDER, GetComputerNameExW,
            GetSystemFirmwareTable,
        },
        core::PWSTR,
    };

    let mut label_length = 0_u32;
    // SAFETY: This first call obtains the required UTF-16 buffer length.
    let _ = unsafe { GetComputerNameExW(ComputerNamePhysicalDnsHostname, None, &mut label_length) };
    if label_length == 0 || label_length > 256 {
        return Err(DeviceIdentityError::InventoryUnavailable);
    }
    let mut label = vec![0_u16; label_length as usize];
    // SAFETY: `label` owns the requested writable UTF-16 capacity for the complete call.
    unsafe {
        GetComputerNameExW(
            ComputerNamePhysicalDnsHostname,
            Some(PWSTR(label.as_mut_ptr())),
            &mut label_length,
        )
    }
    .map_err(|_| DeviceIdentityError::InventoryUnavailable)?;
    label.truncate(label_length as usize);
    let label =
        String::from_utf16(&label).map_err(|_| DeviceIdentityError::InventoryUnavailable)?;

    let provider = FIRMWARE_TABLE_PROVIDER(u32::from_be_bytes(*b"RSMB"));
    // SAFETY: A null buffer is the documented size query for the read-only firmware table.
    let table_length = unsafe { GetSystemFirmwareTable(provider, 0, None) };
    if table_length < 8 || table_length > 4 * 1_024 * 1_024 {
        return Err(DeviceIdentityError::InventoryUnavailable);
    }
    let mut table = vec![0_u8; table_length as usize];
    // SAFETY: `table` is an owned writable buffer sized by the preceding system query.
    let written = unsafe { GetSystemFirmwareTable(provider, 0, Some(&mut table)) };
    if written < 8 || written as usize > table.len() {
        return Err(DeviceIdentityError::InventoryUnavailable);
    }
    table.truncate(written as usize);
    let structures_length = u32::from_le_bytes(
        table[4..8]
            .try_into()
            .map_err(|_| DeviceIdentityError::InventoryUnavailable)?,
    ) as usize;
    if structures_length == 0 || 8 + structures_length > table.len() {
        return Err(DeviceIdentityError::InventoryUnavailable);
    }
    let structures = &table[8..8 + structures_length];
    let parsed = parse_smbios_components(structures)?;
    let device_class = if parsed.virtual_platform {
        DeviceClass::Virtual
    } else {
        DeviceClass::Physical
    };
    let mut components = Vec::new();
    if let Some(platform) = parsed.platform {
        components.push((
            if device_class == DeviceClass::Virtual {
                ComponentClass::VirtualPlatform
            } else {
                ComponentClass::PlatformTrust
            },
            platform,
        ));
    }
    if let Some(cpu) = parsed.cpu {
        components.push((ComponentClass::Cpu, cpu));
    }
    if let Some(memory) = parsed.memory {
        components.push((ComponentClass::MemoryTopology, memory));
    }
    Ok(RawDeviceInventory::new(label, device_class, components))
}

#[cfg(target_os = "windows")]
struct ParsedSmbiosComponents {
    platform: Option<String>,
    cpu: Option<String>,
    memory: Option<String>,
    virtual_platform: bool,
}

#[cfg(target_os = "windows")]
fn parse_smbios_components(
    structures: &[u8],
) -> Result<ParsedSmbiosComponents, DeviceIdentityError> {
    let mut offset = 0_usize;
    let mut platform_parts = Vec::new();
    let mut cpu_parts = Vec::new();
    let mut memory_parts = Vec::new();
    while offset + 4 <= structures.len() {
        let structure_type = structures[offset];
        let formatted_length = structures[offset + 1] as usize;
        if formatted_length < 4 || offset + formatted_length > structures.len() {
            return Err(DeviceIdentityError::InventoryUnavailable);
        }
        let formatted = &structures[offset..offset + formatted_length];
        let strings_start = offset + formatted_length;
        let mut end = strings_start;
        while end + 1 < structures.len() && !(structures[end] == 0 && structures[end + 1] == 0) {
            end += 1;
        }
        if end + 1 >= structures.len() {
            return Err(DeviceIdentityError::InventoryUnavailable);
        }
        let string_bytes = &structures[strings_start..end];
        let strings: Vec<_> = string_bytes
            .split(|byte| *byte == 0)
            .filter(|value| !value.is_empty())
            .map(String::from_utf8_lossy)
            .map(|value| value.into_owned())
            .collect();
        let formatted_hex = encode_hex(formatted);
        match structure_type {
            1 | 2 => {
                platform_parts.push(formatted_hex);
                platform_parts.extend(strings);
            }
            4 => {
                cpu_parts.push(formatted_hex);
                cpu_parts.extend(strings);
            }
            17 => {
                memory_parts.push(formatted_hex);
                memory_parts.extend(strings);
            }
            _ => {}
        }
        offset = end + 2;
        if structure_type == 127 {
            break;
        }
    }
    let platform = (!platform_parts.is_empty()).then(|| platform_parts.join("|"));
    let virtual_platform = platform.as_ref().is_some_and(|value| {
        let value = value.to_ascii_lowercase();
        [
            "vmware",
            "virtualbox",
            "hyper-v",
            "qemu",
            "kvm",
            "parallels",
        ]
        .iter()
        .any(|marker| value.contains(marker))
    });
    Ok(ParsedSmbiosComponents {
        platform,
        cpu: (!cpu_parts.is_empty()).then(|| cpu_parts.join("|")),
        memory: (!memory_parts.is_empty()).then(|| memory_parts.join("|")),
        virtual_platform,
    })
}

fn normalize_component(raw_value: &str) -> Option<String> {
    let normalized: String = raw_value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .map(|character| character.to_ascii_lowercase())
        .collect();
    let rejected_placeholder = matches!(
        normalized.as_str(),
        "unknown"
            | "none"
            | "notavailable"
            | "defaultstring"
            | "tobefilledbyoem"
            | "systemserialnumber"
    ) || normalized.bytes().all(|byte| byte == b'0');

    (!normalized.is_empty() && !rejected_placeholder).then_some(normalized)
}

fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }
    encoded
}

fn derive_component_digest(
    account_salt: &[u8],
    component_class: ComponentClass,
    normalized_value: &str,
) -> String {
    let mut digest = Sha256::new();
    digest.update(LOCAL_DIGEST_CONTEXT);
    digest.update([0]);
    digest.update(account_salt);
    digest.update([0]);
    digest.update(component_class.label().as_bytes());
    digest.update([0]);
    digest.update(normalized_value.as_bytes());
    encode_hex(&digest.finalize())
}

pub fn collect_protected_device_evidence(
    device_class: DeviceClass,
    observations: &[RawComponentObservation<'_>],
    account_salt: &[u8],
) -> Result<ProtectedDeviceEvidence, DeviceIdentityError> {
    if observations.is_empty() {
        return Err(DeviceIdentityError::EvidenceEmpty);
    }
    if account_salt.len() < 16 {
        return Err(DeviceIdentityError::InvalidAccountSalt);
    }

    let mut components = BTreeMap::<ComponentClass, String>::new();
    for observation in observations {
        let normalized = normalize_component(observation.raw_value).ok_or(
            DeviceIdentityError::InvalidComponent(observation.component_class),
        )?;
        let digest = derive_component_digest(
            account_salt,
            observation.component_class,
            normalized.as_str(),
        );
        if let Some(existing) = components.get(&observation.component_class) {
            if existing.as_bytes().ct_eq(digest.as_bytes()).unwrap_u8() != 1 {
                return Err(DeviceIdentityError::ContradictoryComponent(
                    observation.component_class,
                ));
            }
        } else {
            components.insert(observation.component_class, digest);
        }
    }

    let has_platform = components.contains_key(&ComponentClass::PlatformTrust);
    let has_virtual_platform = components.contains_key(&ComponentClass::VirtualPlatform);
    let has_cpu = components.contains_key(&ComponentClass::Cpu);
    let device_class_matches = match device_class {
        DeviceClass::Physical => !has_virtual_platform,
        DeviceClass::Virtual => has_virtual_platform && !has_platform,
    };
    if !device_class_matches {
        return Err(DeviceIdentityError::DeviceClassMismatch);
    }
    if components.len() < MINIMUM_COMPONENT_CLASSES {
        return Err(DeviceIdentityError::EvidenceBelowMinimum);
    }
    if !has_platform && !has_virtual_platform && !has_cpu {
        return Err(DeviceIdentityError::MissingAnchor);
    }

    Ok(ProtectedDeviceEvidence {
        device_class,
        components: components
            .into_iter()
            .map(
                |(component_class, local_digest)| ProtectedComponentEvidence {
                    component_class,
                    local_digest,
                },
            )
            .collect(),
    })
}

pub fn compare_device_evidence(
    expected: &ProtectedDeviceEvidence,
    observed: &ProtectedDeviceEvidence,
) -> DeviceEvidenceComparison {
    if expected.device_class != observed.device_class {
        return DeviceEvidenceComparison {
            outcome: DeviceEvidenceOutcome::Rejected,
            score: 0,
            matched_components: Vec::new(),
            changed_components: Vec::new(),
        };
    }

    let expected_by_class: BTreeMap<_, _> = expected
        .components
        .iter()
        .map(|component| (component.component_class, component.local_digest.as_bytes()))
        .collect();
    let observed_by_class: BTreeMap<_, _> = observed
        .components
        .iter()
        .map(|component| (component.component_class, component.local_digest.as_bytes()))
        .collect();
    let mut component_classes: Vec<_> = expected_by_class
        .keys()
        .chain(observed_by_class.keys())
        .copied()
        .collect();
    component_classes.sort_unstable();
    component_classes.dedup();

    let mut score = 0_u8;
    let mut matched_components = Vec::new();
    let mut changed_components = Vec::new();
    for component_class in component_classes {
        match (
            expected_by_class.get(&component_class),
            observed_by_class.get(&component_class),
        ) {
            (Some(expected_digest), Some(observed_digest))
                if expected_digest.ct_eq(observed_digest).unwrap_u8() == 1 =>
            {
                score += component_class.weight();
                matched_components.push(component_class);
            }
            _ => changed_components.push(component_class),
        }
    }

    let outcome = if score >= 65 {
        DeviceEvidenceOutcome::SamePc
    } else if score >= 40 {
        DeviceEvidenceOutcome::RevalidationRequired
    } else {
        DeviceEvidenceOutcome::Replacement
    };
    DeviceEvidenceComparison {
        outcome,
        score,
        matched_components,
        changed_components,
    }
}
