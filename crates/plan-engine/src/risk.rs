//! Evidence admission, immutable technical risk, and proportional consent.

use liiiraa_contracts_rust::{
    CompatibilityAssessment, EvidenceReference, RiskClass, TransactionIdentifier,
};

use crate::domain::PlanEngineResult;
use crate::revision::RegisteredOperationVersion;

/// User-configurable maximum executable risk. Extreme is intentionally absent.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum RiskCeiling {
    Verified,
    Advanced,
    Experimental,
}

/// Technical operation risk. The locked extreme level has no executable form.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OperationRisk {
    Executable(ExecutableRisk),
    ExtremeLocked,
}

/// Risk values for which an execution admission can exist.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum ExecutableRisk {
    Verified,
    Advanced,
    Experimental,
}

/// Why Phase 5 evidence cannot admit an operation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EvidenceBlockReason {
    Missing,
    Degraded,
    Contradictory,
    Incompatible,
    UnknownCompatibility,
    Stale,
    DeviceMismatch,
}

/// Explicit non-admission; unknown evidence can never be represented as success.
#[derive(Clone, Debug)]
pub struct EvidenceBlock {
    operation_version_id: TransactionIdentifier,
    reason: EvidenceBlockReason,
}

impl EvidenceBlock {
    pub(crate) const fn new(
        operation_version_id: TransactionIdentifier,
        reason: EvidenceBlockReason,
    ) -> Self {
        Self {
            operation_version_id,
            reason,
        }
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn reason(&self) -> EvidenceBlockReason {
        self.reason
    }
}

/// Generated Phase 5 evidence and native compatibility accepted by authority.
#[derive(Clone, Debug)]
pub struct AdmittedEvidence {
    references: Vec<EvidenceReference>,
    compatibility: CompatibilityAssessment,
}

impl AdmittedEvidence {
    pub(crate) const fn from_parts(
        references: Vec<EvidenceReference>,
        compatibility: CompatibilityAssessment,
    ) -> Self {
        Self {
            references,
            compatibility,
        }
    }

    pub fn references(&self) -> &[EvidenceReference] {
        &self.references
    }

    pub const fn compatibility(&self) -> &CompatibilityAssessment {
        &self.compatibility
    }
}

/// Closed result of evidence admission.
#[derive(Clone, Debug)]
pub enum EvidenceAdmission {
    Admitted(AdmittedEvidence),
    NotAdmitted(EvidenceBlock),
}

/// Proportional confirmation required for an executable risk class.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApprovalRequirement {
    VerifiedReviewAndConfirm,
    AdvancedDetailedReviewAndStrongAuth,
    ExperimentalPerVersionStrongAuthRecoveryAndTypedPhrase,
}

/// Successful risk assessment always contains an executable class and the
/// proportional requirement still to be satisfied by native approval policy.
#[derive(Clone, Debug)]
pub struct EligibleRisk {
    risk: ExecutableRisk,
    requirement: ApprovalRequirement,
}

impl EligibleRisk {
    pub(crate) const fn new(risk: ExecutableRisk, requirement: ApprovalRequirement) -> Self {
        Self { risk, requirement }
    }

    pub const fn risk(&self) -> ExecutableRisk {
        self.risk
    }

    pub const fn requirement(&self) -> ApprovalRequirement {
        self.requirement
    }
}

/// A fail-closed risk assessment. Extreme can only appear in `Denied`.
#[derive(Clone, Debug)]
pub enum RiskAssessment {
    Eligible(EligibleRisk),
    Denied(RiskDenial),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RiskDenial {
    EvidenceNotAdmitted,
    AboveConfiguredCeiling,
    AdvancedPreferenceUnavailable,
    ExperimentalCohortUnavailable,
    ProportionalApprovalMissing,
    ExtremeLocked,
}

/// Native policy owns risk conversion and admission. No method accepts a desired
/// lower risk or mutates the registered operation version.
pub trait RiskPolicy {
    fn technical_risk(&self, operation: &RegisteredOperationVersion) -> OperationRisk;

    fn assess(
        &self,
        operation: &RegisteredOperationVersion,
        evidence: &EvidenceAdmission,
        ceiling: RiskCeiling,
    ) -> PlanEngineResult<RiskAssessment>;

    fn generated_risk(&self, eligible: &EligibleRisk) -> RiskClass;
}
