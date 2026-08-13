use std::fmt;

use crate::credential_store::{CredentialStore, CredentialStoreError};

pub const PLAN_PROOF_CONSUME_PATH: &str = "/v1/identity/strong-auth/plan-proof/consume";

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OperationVersion {
    pub operation_id: String,
    pub version: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceAction {
    Enable,
    Revoke,
}

#[derive(Clone, Eq, PartialEq)]
pub struct OpaqueApprovalReceipt(String);

impl OpaqueApprovalReceipt {
    pub fn from_native_response(value: String) -> Result<Self, PlanAuthError> {
        if (43..=256).contains(&value.len())
            && value.bytes().all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
        {
            Ok(Self(value))
        } else {
            Err(PlanAuthError::InvalidRequest)
        }
    }
}

impl fmt::Debug for OpaqueApprovalReceipt {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("OpaqueApprovalReceipt([REDACTED])")
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApplyPlanApprovalRequest {
    pub authorization_context_id: String,
    pub device_id: String,
    pub operation_versions: Vec<OperationVersion>,
    pub plan_fingerprint: String,
    pub receipt: OpaqueApprovalReceipt,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceApprovalRequest {
    pub action: AdvancedPreferenceAction,
    pub authorization_context_id: String,
    pub device_id: String,
    pub hardware_fingerprint: String,
    pub receipt: OpaqueApprovalReceipt,
    pub security_posture_fingerprint: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConsumedPlanApprovalProof {
    action: &'static str,
    evidence_id: String,
}

impl ConsumedPlanApprovalProof {
    pub fn action(&self) -> &str {
        self.action
    }

    pub fn evidence_id(&self) -> &str {
        &self.evidence_id
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConsumedAdvancedPreferenceProof {
    action: AdvancedPreferenceAction,
    evidence_id: String,
}

impl ConsumedAdvancedPreferenceProof {
    pub fn action(&self) -> AdvancedPreferenceAction {
        self.action
    }

    pub fn evidence_id(&self) -> &str {
        &self.evidence_id
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct LocalRecoveryAdmission;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlanApprovalApiResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub trait PlanApprovalApi {
    fn consume(
        &self,
        credential: &str,
        body: &[u8],
    ) -> Result<PlanApprovalApiResponse, PlanAuthError>;
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlanAuthError {
    InvalidRequest,
    InvalidResponse,
    NativeCredentialUnavailable,
    NetworkUnavailable,
    ProofRejected,
    SignedOut,
}

impl fmt::Display for PlanAuthError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::InvalidRequest => "plan approval request was rejected",
            Self::InvalidResponse => "plan approval response was rejected",
            Self::NativeCredentialUnavailable => "native account credential is unavailable",
            Self::NetworkUnavailable => "plan approval service is unavailable",
            Self::ProofRejected => "plan approval proof was rejected",
            Self::SignedOut => "authenticated account session is required",
        })
    }
}

impl std::error::Error for PlanAuthError {}

impl From<CredentialStoreError> for PlanAuthError {
    fn from(_: CredentialStoreError) -> Self {
        Self::NativeCredentialUnavailable
    }
}

pub fn consume_plan_approval(
    _store: &impl CredentialStore,
    _api: &impl PlanApprovalApi,
    _request: ApplyPlanApprovalRequest,
    _now_unix_ms: u64,
) -> Result<ConsumedPlanApprovalProof, PlanAuthError> {
    Err(PlanAuthError::ProofRejected)
}

pub fn consume_advanced_preference_approval(
    _store: &impl CredentialStore,
    _api: &impl PlanApprovalApi,
    _request: AdvancedPreferenceApprovalRequest,
    _now_unix_ms: u64,
) -> Result<ConsumedAdvancedPreferenceProof, PlanAuthError> {
    Err(PlanAuthError::ProofRejected)
}

pub fn admit_local_recovery() -> LocalRecoveryAdmission {
    LocalRecoveryAdmission
}
