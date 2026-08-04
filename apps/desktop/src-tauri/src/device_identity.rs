use std::collections::BTreeMap;

use serde::Serialize;
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

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
