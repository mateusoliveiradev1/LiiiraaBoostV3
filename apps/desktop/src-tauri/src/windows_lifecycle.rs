#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WindowsEdition {
    Home,
    Professional,
    Enterprise,
    EnterpriseLtsc,
    IoTEnterpriseLtsc,
    Education,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ServicingChannel {
    GeneralAvailability,
    LongTermServicing,
    Esu,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum WindowsLifecycle {
    SupportedWindows11,
    Windows10LtscEsu,
    UnsupportedWindows10Consumer,
    Unknown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LifecycleReason {
    Windows11BuildAdmitted,
    LongTermServicingAdmitted,
    ExtendedSecurityUpdatesAdmitted,
    ConsumerSupportEnded,
    UnsupportedPolicyVersion,
    ContradictoryEvidence,
    UnrecognizedVersion,
    UnrecognizedEditionOrChannel,
}

impl LifecycleReason {
    pub const fn contract_value(self) -> &'static str {
        match self {
            Self::Windows11BuildAdmitted => "windows-11-build-admitted",
            Self::LongTermServicingAdmitted => "long-term-servicing-admitted",
            Self::ExtendedSecurityUpdatesAdmitted => "extended-security-updates-admitted",
            Self::ConsumerSupportEnded => "consumer-support-ended",
            Self::UnsupportedPolicyVersion => "unsupported-policy-version",
            Self::ContradictoryEvidence => "contradictory-evidence",
            Self::UnrecognizedVersion => "unrecognized-version",
            Self::UnrecognizedEditionOrChannel => "unrecognized-edition-or-channel",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LifecycleAssessment {
    pub lifecycle: WindowsLifecycle,
    pub reason: LifecycleReason,
    pub policy_version: u32,
    pub evaluated_on: u32,
}

impl LifecycleAssessment {
    const fn new(lifecycle: WindowsLifecycle, reason: LifecycleReason, evaluated_on: u32) -> Self {
        Self {
            lifecycle,
            reason,
            policy_version: LIFECYCLE_POLICY_VERSION,
            evaluated_on,
        }
    }
}

const LIFECYCLE_POLICY_VERSION: u32 = 1;
const WINDOWS_11_BUILD_FLOOR: u32 = 22_000;
const WINDOWS_10_LTSC_BUILD_FLOOR: u32 = 17_763;
const WINDOWS_10_ESU_BUILD_FLOOR: u32 = 19_044;
const WINDOWS_10_CONSUMER_END_OF_SUPPORT: u32 = 20_251_014;

impl WindowsLifecycle {
    pub const fn contract_value(self) -> &'static str {
        match self {
            Self::SupportedWindows11 => "supported-windows-11",
            Self::Windows10LtscEsu => "windows-10-ltsc-esu",
            Self::UnsupportedWindows10Consumer => "unsupported-windows-10-consumer",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WindowsVersionEvidence {
    pub major: u32,
    pub minor: u32,
    pub build: u32,
    pub edition: WindowsEdition,
    pub channel: ServicingChannel,
    pub esu_enrolled: bool,
    pub contradictory: bool,
    pub policy_version: u32,
}

/// Classifies only version evidence admitted at the native boundary. Marketing
/// names are intentionally absent because they are presentation data, not a
/// trustworthy lifecycle signal.
pub fn classify_windows_lifecycle(
    evidence: &WindowsVersionEvidence,
    policy_date: u32,
) -> WindowsLifecycle {
    assess_windows_lifecycle(evidence, policy_date).lifecycle
}

/// Returns both the classification and its stable policy reason so later UI
/// layers can explain a decision without reverse-engineering native values.
/// Unknown evidence never inherits support from a display name or optimistic
/// default.
pub fn assess_windows_lifecycle(
    evidence: &WindowsVersionEvidence,
    policy_date: u32,
) -> LifecycleAssessment {
    if evidence.policy_version != LIFECYCLE_POLICY_VERSION {
        return LifecycleAssessment::new(
            WindowsLifecycle::Unknown,
            LifecycleReason::UnsupportedPolicyVersion,
            policy_date,
        );
    }

    if evidence.contradictory {
        return LifecycleAssessment::new(
            WindowsLifecycle::Unknown,
            LifecycleReason::ContradictoryEvidence,
            policy_date,
        );
    }

    if evidence.major != 10 || evidence.build == 0 {
        return LifecycleAssessment::new(
            WindowsLifecycle::Unknown,
            LifecycleReason::UnrecognizedVersion,
            policy_date,
        );
    }

    if evidence.build >= WINDOWS_11_BUILD_FLOOR {
        return LifecycleAssessment::new(
            WindowsLifecycle::SupportedWindows11,
            LifecycleReason::Windows11BuildAdmitted,
            policy_date,
        );
    }

    let admitted_ltsc = matches!(
        evidence.edition,
        WindowsEdition::EnterpriseLtsc | WindowsEdition::IoTEnterpriseLtsc
    ) && evidence.channel == ServicingChannel::LongTermServicing
        && evidence.build >= WINDOWS_10_LTSC_BUILD_FLOOR;
    let admitted_esu = evidence.channel == ServicingChannel::Esu
        && evidence.esu_enrolled
        && evidence.build >= WINDOWS_10_ESU_BUILD_FLOOR;
    if admitted_ltsc {
        return LifecycleAssessment::new(
            WindowsLifecycle::Windows10LtscEsu,
            LifecycleReason::LongTermServicingAdmitted,
            policy_date,
        );
    }
    if admitted_esu {
        return LifecycleAssessment::new(
            WindowsLifecycle::Windows10LtscEsu,
            LifecycleReason::ExtendedSecurityUpdatesAdmitted,
            policy_date,
        );
    }

    let consumer_edition = matches!(
        evidence.edition,
        WindowsEdition::Home | WindowsEdition::Professional
    );
    if consumer_edition
        && evidence.channel == ServicingChannel::GeneralAvailability
        && policy_date >= WINDOWS_10_CONSUMER_END_OF_SUPPORT
    {
        return LifecycleAssessment::new(
            WindowsLifecycle::UnsupportedWindows10Consumer,
            LifecycleReason::ConsumerSupportEnded,
            policy_date,
        );
    }

    LifecycleAssessment::new(
        WindowsLifecycle::Unknown,
        LifecycleReason::UnrecognizedEditionOrChannel,
        policy_date,
    )
}
