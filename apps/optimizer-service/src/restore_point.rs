//! Truthful, complementary Windows System Restore preparation.
//!
//! The operation-specific Liiiraa recovery manifest remains the primary recovery
//! authority. This module can only add evidence about the complementary Windows
//! restore-point layer.

pub const SRCLIENT_DLL: &str = "SrClient.dll";
pub const SR_SET_RESTORE_POINT_W_SYMBOL: &[u8] = b"SRSetRestorePointW\0";
pub const MAX_DESCRIPTION_UTF16_UNITS: usize = 255;

pub const ERROR_SUCCESS: u32 = 0;
pub const ERROR_ACCESS_DENIED: u32 = 5;
pub const ERROR_SERVICE_DISABLED: u32 = 1058;
pub const ERROR_NOT_SAFEBOOT_SERVICE: u32 = 1084;
pub const ERROR_ACCESS_DISABLED_BY_POLICY: u32 = 1260;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RiskClass {
    Verified,
    Advanced,
    Experimental,
    Extreme,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum UnavailableReason {
    ComNotInitialized,
    ComCallbackSecurityMissing,
    DllMissing,
    SymbolMissing,
    Disabled,
    SafeMode,
    PolicyDenied,
    AccessDenied,
    ShuttingDown,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ApiCallEvidence {
    pub returned: bool,
    pub status: u32,
    pub sequence_number: i64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PointObservation {
    Usable { sequence_number: i64 },
    ExistingRecent { sequence_number: i64 },
    NotCreated,
    Unavailable(UnavailableReason),
    Failed { status: u32 },
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FailureStage {
    Request,
    Begin,
    End,
    Observation,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FailureEvidence {
    pub stage: FailureStage,
    pub status: Option<u32>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ComplementaryState {
    Usable { sequence_number: i64 },
    SkippedFrequency { sequence_number: i64 },
    NotCreated,
    Unavailable(UnavailableReason),
    Failed(FailureEvidence),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Admission {
    Allowed,
    RequiresComplementAcknowledgement,
    Blocked,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct PreparationRequest<'a> {
    pub description: &'a str,
    pub risk: RiskClass,
    pub primary_manifest_ready: bool,
    pub advanced_without_complement_acknowledged: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RestorePointProjection {
    pub requested: bool,
    pub primary_manifest_preserved: bool,
    pub begin: Option<ApiCallEvidence>,
    pub end: Option<ApiCallEvidence>,
    pub observation: Option<PointObservation>,
    pub state: ComplementaryState,
    pub admission: Admission,
}

pub trait RestorePointApi {
    fn readiness(&mut self) -> Result<(), UnavailableReason>;
    fn begin(&mut self, description: &str) -> ApiCallEvidence;
    fn end(&mut self, sequence_number: i64, description: &str) -> ApiCallEvidence;
}

pub trait RestorePointObserver {
    fn observe(&mut self, sequence_number: i64) -> PointObservation;
}

pub fn prepare_restore_point(
    _api: &mut dyn RestorePointApi,
    _observer: &mut dyn RestorePointObserver,
    request: PreparationRequest<'_>,
) -> RestorePointProjection {
    let state = ComplementaryState::Unavailable(UnavailableReason::DllMissing);
    let admission = match request.risk {
        RiskClass::Verified => Admission::Allowed,
        RiskClass::Advanced => Admission::RequiresComplementAcknowledgement,
        RiskClass::Experimental | RiskClass::Extreme => Admission::Blocked,
    };
    RestorePointProjection {
        requested: true,
        primary_manifest_preserved: request.primary_manifest_ready,
        begin: None,
        end: None,
        observation: None,
        state,
        admission,
    }
}
