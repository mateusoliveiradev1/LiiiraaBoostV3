//! Evidence admission, immutable technical risk, and proportional consent.

use std::collections::BTreeSet;

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

/// Native evidence disposition for the exact registered operation version.
///
/// This is deliberately not a renderer boolean. Adapters construct it only
/// after admitting Phase 5 evidence and compatibility authority.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdmissionEvidence {
    Admitted,
    Missing,
    Degraded,
    Contradictory,
    Incompatible,
    Unknown,
}

/// Immutable risk and evidence authority for one selected operation version.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OperationRiskVersion {
    operation_version_id: String,
    risk: OperationRisk,
    evidence: AdmissionEvidence,
}

impl OperationRiskVersion {
    pub fn new(
        operation_version_id: impl Into<String>,
        risk: OperationRisk,
        evidence: AdmissionEvidence,
    ) -> Result<Self, AdmissionInputError> {
        let operation_version_id = operation_version_id.into();
        validate_identifier(&operation_version_id)?;
        Ok(Self {
            operation_version_id,
            risk,
            evidence,
        })
    }

    pub fn operation_version_id(&self) -> &str {
        &self.operation_version_id
    }

    pub const fn risk(&self) -> OperationRisk {
        self.risk
    }

    pub const fn evidence(&self) -> AdmissionEvidence {
        self.evidence
    }
}

/// Device-local Advanced preference state projected by native persistence.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdvancedPreferenceState {
    Disabled,
    Enabled,
    Revoked,
    RevalidationRequired,
}

/// Persisted native preference projection bound to one hardware/security
/// posture. Enable/revoke authentication and persistence belong to the native
/// preference authority; this pure policy only consumes its projection.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AdvancedPreferenceProjection {
    state: AdvancedPreferenceState,
    device_binding: String,
    hardware_fingerprint: String,
    security_posture_fingerprint: String,
}

impl AdvancedPreferenceProjection {
    pub fn new(
        state: AdvancedPreferenceState,
        device_binding: impl Into<String>,
        hardware_fingerprint: impl Into<String>,
        security_posture_fingerprint: impl Into<String>,
    ) -> Result<Self, AdmissionInputError> {
        let projection = Self {
            state,
            device_binding: device_binding.into(),
            hardware_fingerprint: hardware_fingerprint.into(),
            security_posture_fingerprint: security_posture_fingerprint.into(),
        };
        projection.validate()?;
        Ok(projection)
    }

    fn validate(&self) -> Result<(), AdmissionInputError> {
        validate_identifier(&self.device_binding)?;
        validate_fingerprint_component(&self.hardware_fingerprint)?;
        validate_fingerprint_component(&self.security_posture_fingerprint)
    }
}

/// Complementary Windows Restore state. The operation manifest remains the
/// primary rollback authority in every case.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RestorePointStatus {
    Ready,
    Unavailable,
    Failed,
    Unknown,
}

/// Native recovery preparation projected into the admission decision.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RecoveryReadiness {
    manifest_rollback_proven: bool,
    restore_point_status: RestorePointStatus,
    second_layer_unavailable_acknowledged: bool,
}

impl RecoveryReadiness {
    pub const fn new(
        manifest_rollback_proven: bool,
        restore_point_status: RestorePointStatus,
        second_layer_unavailable_acknowledged: bool,
    ) -> Self {
        Self {
            manifest_rollback_proven,
            restore_point_status,
            second_layer_unavailable_acknowledged,
        }
    }
}

/// Exact authority dimensions captured at review and strong authentication.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum ApprovalDiff {
    PlanFingerprint,
    EvidenceFingerprint,
    RecoveryFingerprint,
    DeviceBinding,
    HardwareFingerprint,
    SecurityPostureFingerprint,
    OperationVersionSet,
    Risk,
}

/// Exact current authority fingerprint. Operation identifiers are canonicalized
/// so ordering can never weaken set equality.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovalFingerprint {
    plan_fingerprint: String,
    evidence_fingerprint: String,
    recovery_fingerprint: String,
    device_binding: String,
    hardware_fingerprint: String,
    security_posture_fingerprint: String,
    operation_version_ids: Vec<String>,
    effective_risk: ExecutableRisk,
}

impl ApprovalFingerprint {
    #[allow(clippy::too_many_arguments)]
    pub fn new<I, S>(
        plan_fingerprint: impl Into<String>,
        evidence_fingerprint: impl Into<String>,
        recovery_fingerprint: impl Into<String>,
        device_binding: impl Into<String>,
        hardware_fingerprint: impl Into<String>,
        security_posture_fingerprint: impl Into<String>,
        operation_version_ids: I,
        effective_risk: ExecutableRisk,
    ) -> Result<Self, AdmissionInputError>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        let fingerprint = Self {
            plan_fingerprint: plan_fingerprint.into(),
            evidence_fingerprint: evidence_fingerprint.into(),
            recovery_fingerprint: recovery_fingerprint.into(),
            device_binding: device_binding.into(),
            hardware_fingerprint: hardware_fingerprint.into(),
            security_posture_fingerprint: security_posture_fingerprint.into(),
            operation_version_ids: canonical_operation_ids(operation_version_ids)?,
            effective_risk,
        };
        fingerprint.validate()?;
        Ok(fingerprint)
    }

    pub fn with_plan_fingerprint(&self, value: impl Into<String>) -> Self {
        Self {
            plan_fingerprint: value.into(),
            ..self.clone()
        }
    }

    pub fn with_evidence_fingerprint(&self, value: impl Into<String>) -> Self {
        Self {
            evidence_fingerprint: value.into(),
            ..self.clone()
        }
    }

    pub fn with_recovery_fingerprint(&self, value: impl Into<String>) -> Self {
        Self {
            recovery_fingerprint: value.into(),
            ..self.clone()
        }
    }

    pub fn with_device_binding(&self, value: impl Into<String>) -> Self {
        Self {
            device_binding: value.into(),
            ..self.clone()
        }
    }

    pub fn with_hardware_fingerprint(&self, value: impl Into<String>) -> Self {
        Self {
            hardware_fingerprint: value.into(),
            ..self.clone()
        }
    }

    pub fn with_security_posture_fingerprint(&self, value: impl Into<String>) -> Self {
        Self {
            security_posture_fingerprint: value.into(),
            ..self.clone()
        }
    }

    pub fn with_effective_risk(&self, effective_risk: ExecutableRisk) -> Self {
        Self {
            effective_risk,
            ..self.clone()
        }
    }

    pub fn with_operation_version_ids<I, S>(&self, values: I) -> Result<Self, AdmissionInputError>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        Ok(Self {
            operation_version_ids: canonical_operation_ids(values)?,
            ..self.clone()
        })
    }

    fn validate(&self) -> Result<(), AdmissionInputError> {
        validate_fingerprint_component(&self.plan_fingerprint)?;
        validate_fingerprint_component(&self.evidence_fingerprint)?;
        validate_fingerprint_component(&self.recovery_fingerprint)?;
        validate_identifier(&self.device_binding)?;
        validate_fingerprint_component(&self.hardware_fingerprint)?;
        validate_fingerprint_component(&self.security_posture_fingerprint)?;
        if self.operation_version_ids.is_empty() || self.operation_version_ids.len() > 64 {
            return Err(AdmissionInputError::InvalidOperationSet);
        }
        Ok(())
    }

    fn diffs(&self, other: &Self) -> Vec<ApprovalDiff> {
        let mut diffs = Vec::new();
        if self.plan_fingerprint != other.plan_fingerprint {
            diffs.push(ApprovalDiff::PlanFingerprint);
        }
        if self.evidence_fingerprint != other.evidence_fingerprint {
            diffs.push(ApprovalDiff::EvidenceFingerprint);
        }
        if self.recovery_fingerprint != other.recovery_fingerprint {
            diffs.push(ApprovalDiff::RecoveryFingerprint);
        }
        if self.device_binding != other.device_binding {
            diffs.push(ApprovalDiff::DeviceBinding);
        }
        if self.hardware_fingerprint != other.hardware_fingerprint {
            diffs.push(ApprovalDiff::HardwareFingerprint);
        }
        if self.security_posture_fingerprint != other.security_posture_fingerprint {
            diffs.push(ApprovalDiff::SecurityPostureFingerprint);
        }
        if self.operation_version_ids != other.operation_version_ids {
            diffs.push(ApprovalDiff::OperationVersionSet);
        }
        if self.effective_risk != other.effective_risk {
            diffs.push(ApprovalDiff::Risk);
        }
        diffs
    }
}

/// Closed proof actions prevent a proof for preference enable/revoke from
/// authorizing plan application.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApprovalAction {
    ApplyPlan,
    EnableAdvancedPreference,
    RevokeAdvancedPreference,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ProofDisposition {
    Available,
    Consumed,
}

/// Native-verified strong-auth proof reference. It contains no credential and
/// can authorize only one exact action/fingerprint while available and fresh.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OneUseApplyProof {
    proof_reference: String,
    action: ApprovalAction,
    binding: ApprovalFingerprint,
    expires_at_epoch_seconds: u64,
    disposition: ProofDisposition,
}

impl OneUseApplyProof {
    pub fn new(
        proof_reference: impl Into<String>,
        action: ApprovalAction,
        binding: ApprovalFingerprint,
        expires_at_epoch_seconds: u64,
        disposition: ProofDisposition,
    ) -> Result<Self, AdmissionInputError> {
        let proof_reference = proof_reference.into();
        validate_identifier(&proof_reference)?;
        binding.validate()?;
        if expires_at_epoch_seconds == 0 {
            return Err(AdmissionInputError::InvalidExpiry);
        }
        Ok(Self {
            proof_reference,
            action,
            binding,
            expires_at_epoch_seconds,
            disposition,
        })
    }
}

/// In-memory confirmation evidence. Typed phrases are compared during this
/// call and are deliberately absent from [`ExecutableAdmission`].
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfirmationEvidence {
    binding: ApprovalFingerprint,
    kind: ConfirmationKind,
}

#[derive(Clone, Debug, Eq, PartialEq)]
enum ConfirmationKind {
    Verified,
    Advanced {
        detailed_review: bool,
    },
    Experimental {
        detailed_review: bool,
        operation_version_consents: Vec<String>,
        per_apply_consent: bool,
        typed_phrase: String,
    },
}

impl ConfirmationEvidence {
    pub const fn verified(binding: ApprovalFingerprint) -> Self {
        Self {
            binding,
            kind: ConfirmationKind::Verified,
        }
    }

    pub const fn advanced(binding: ApprovalFingerprint, detailed_review: bool) -> Self {
        Self {
            binding,
            kind: ConfirmationKind::Advanced { detailed_review },
        }
    }

    pub fn experimental<I, S>(
        binding: ApprovalFingerprint,
        detailed_review: bool,
        operation_version_consents: I,
        per_apply_consent: bool,
        typed_phrase: impl Into<String>,
    ) -> Result<Self, AdmissionInputError>
    where
        I: IntoIterator<Item = S>,
        S: AsRef<str>,
    {
        Ok(Self {
            binding,
            kind: ConfirmationKind::Experimental {
                detailed_review,
                operation_version_consents: canonical_operation_ids(operation_version_consents)?,
                per_apply_consent,
                typed_phrase: typed_phrase.into(),
            },
        })
    }
}

/// Complete authoritative inputs to one pure admission decision.
pub struct AdmissionRequest<'a> {
    operations: &'a [OperationRiskVersion],
    ceiling: RiskCeiling,
    advanced_preference: Option<&'a AdvancedPreferenceProjection>,
    experimental_cohort: bool,
    recovery: &'a RecoveryReadiness,
    confirmation: Option<&'a ConfirmationEvidence>,
    proof: Option<&'a OneUseApplyProof>,
    current_fingerprint: &'a ApprovalFingerprint,
    now_epoch_seconds: u64,
}

impl<'a> AdmissionRequest<'a> {
    #[allow(clippy::too_many_arguments)]
    pub const fn new(
        operations: &'a [OperationRiskVersion],
        ceiling: RiskCeiling,
        advanced_preference: Option<&'a AdvancedPreferenceProjection>,
        experimental_cohort: bool,
        recovery: &'a RecoveryReadiness,
        confirmation: Option<&'a ConfirmationEvidence>,
        proof: Option<&'a OneUseApplyProof>,
        current_fingerprint: &'a ApprovalFingerprint,
        now_epoch_seconds: u64,
    ) -> Self {
        Self {
            operations,
            ceiling,
            advanced_preference,
            experimental_cohort,
            recovery,
            confirmation,
            proof,
            current_fingerprint,
            now_epoch_seconds,
        }
    }
}

/// Stable, localized-copy-safe denial vocabulary. Parameterized fingerprint
/// reasons preserve the exact diff without leaking credentials or raw evidence.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum AdmissionBlockReason {
    InvalidAuthority,
    NoOperationsSelected,
    EvidenceNotAdmitted,
    RiskCeilingExceeded,
    ExtremeLocked,
    ReviewConfirmationRequired,
    DetailedReviewRequired,
    AdvancedPreferenceMissing,
    AdvancedPreferenceDisabled,
    AdvancedPreferenceRevoked,
    AdvancedPreferenceRevalidationRequired,
    AdvancedPreferenceBindingMismatch,
    ExperimentalCohortRequired,
    ManifestRollbackRequired,
    SecondRecoveryLayerAcknowledgementRequired,
    ComplementaryRestoreRequired,
    ExperimentalVersionConsentRequired,
    ExperimentalApplyConsentRequired,
    ExperimentalPhraseMismatch,
    StrongAuthProofRequired,
    ProofWrongAction,
    ProofExpired,
    ProofConsumed,
    FreshReviewRequired(ApprovalDiff),
    ProofBindingMismatch(ApprovalDiff),
}

impl AdmissionBlockReason {
    pub const fn code(self) -> &'static str {
        match self {
            Self::InvalidAuthority => "invalid-authority",
            Self::NoOperationsSelected => "no-operations-selected",
            Self::EvidenceNotAdmitted => "evidence-not-admitted",
            Self::RiskCeilingExceeded => "risk-ceiling-exceeded",
            Self::ExtremeLocked => "extreme-locked",
            Self::ReviewConfirmationRequired => "review-confirmation-required",
            Self::DetailedReviewRequired => "detailed-review-required",
            Self::AdvancedPreferenceMissing => "advanced-preference-missing",
            Self::AdvancedPreferenceDisabled => "advanced-preference-disabled",
            Self::AdvancedPreferenceRevoked => "advanced-preference-revoked",
            Self::AdvancedPreferenceRevalidationRequired => {
                "advanced-preference-revalidation-required"
            }
            Self::AdvancedPreferenceBindingMismatch => "advanced-preference-binding-mismatch",
            Self::ExperimentalCohortRequired => "experimental-cohort-required",
            Self::ManifestRollbackRequired => "manifest-rollback-required",
            Self::SecondRecoveryLayerAcknowledgementRequired => {
                "second-recovery-layer-acknowledgement-required"
            }
            Self::ComplementaryRestoreRequired => "complementary-restore-required",
            Self::ExperimentalVersionConsentRequired => "experimental-version-consent-required",
            Self::ExperimentalApplyConsentRequired => "experimental-apply-consent-required",
            Self::ExperimentalPhraseMismatch => "experimental-phrase-mismatch",
            Self::StrongAuthProofRequired => "strong-auth-proof-required",
            Self::ProofWrongAction => "proof-wrong-action",
            Self::ProofExpired => "fresh-proof-required-expired",
            Self::ProofConsumed => "fresh-proof-required-consumed",
            Self::FreshReviewRequired(diff) => fresh_review_code(diff),
            Self::ProofBindingMismatch(diff) => proof_binding_code(diff),
        }
    }
}

/// The only successful output of admission. Its risk cannot represent Extreme,
/// and it intentionally excludes confirmation phrases and credentials.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ExecutableAdmission {
    risk: ExecutableRisk,
    operation_version_ids: Vec<String>,
    proof_reference: Option<String>,
}

impl ExecutableAdmission {
    pub const fn risk(&self) -> ExecutableRisk {
        self.risk
    }

    pub fn operation_version_ids(&self) -> &[String] {
        &self.operation_version_ids
    }

    pub fn proof_reference(&self) -> Option<&str> {
        self.proof_reference.as_deref()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AdmissionDecision {
    Executable(ExecutableAdmission),
    Blocked(Vec<AdmissionBlockReason>),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdmissionInputError {
    InvalidIdentifier,
    InvalidFingerprint,
    InvalidOperationSet,
    InvalidExpiry,
}

/// Closed pure risk/approval policy.
#[derive(Clone, Copy, Debug, Default)]
pub struct AdmissionPolicy;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ComplementaryRecoveryRequirement {
    Visible,
    ReadyOrExplicitlyUnavailable,
    Ready,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct RiskRequirements {
    advanced_preference: bool,
    strong_auth: bool,
    experimental_cohort: bool,
    complementary_recovery: ComplementaryRecoveryRequirement,
}

const fn requirements_for(risk: ExecutableRisk) -> RiskRequirements {
    match risk {
        ExecutableRisk::Verified => RiskRequirements {
            advanced_preference: false,
            strong_auth: false,
            experimental_cohort: false,
            complementary_recovery: ComplementaryRecoveryRequirement::Visible,
        },
        ExecutableRisk::Advanced => RiskRequirements {
            advanced_preference: true,
            strong_auth: true,
            experimental_cohort: false,
            complementary_recovery: ComplementaryRecoveryRequirement::ReadyOrExplicitlyUnavailable,
        },
        ExecutableRisk::Experimental => RiskRequirements {
            advanced_preference: true,
            strong_auth: true,
            experimental_cohort: true,
            complementary_recovery: ComplementaryRecoveryRequirement::Ready,
        },
    }
}

impl AdmissionPolicy {
    pub fn effective_risk(
        operations: &[OperationRiskVersion],
    ) -> Result<ExecutableRisk, AdmissionBlockReason> {
        if operations.is_empty() {
            return Err(AdmissionBlockReason::NoOperationsSelected);
        }
        operations.iter().try_fold(
            ExecutableRisk::Verified,
            |highest, operation| match operation.risk {
                OperationRisk::Executable(risk) => Ok(highest.max(risk)),
                OperationRisk::ExtremeLocked => Err(AdmissionBlockReason::ExtremeLocked),
            },
        )
    }

    pub fn evaluate(request: AdmissionRequest<'_>) -> AdmissionDecision {
        let mut blockers = BTreeSet::new();
        if request.current_fingerprint.validate().is_err() {
            blockers.insert(AdmissionBlockReason::InvalidAuthority);
        }
        if request.operations.is_empty() {
            blockers.insert(AdmissionBlockReason::NoOperationsSelected);
        }
        if request
            .operations
            .iter()
            .any(|operation| operation.evidence != AdmissionEvidence::Admitted)
        {
            blockers.insert(AdmissionBlockReason::EvidenceNotAdmitted);
        }

        let effective_risk = match Self::effective_risk(request.operations) {
            Ok(risk) => Some(risk),
            Err(reason) => {
                blockers.insert(reason);
                None
            }
        };

        if let Some(risk) = effective_risk {
            let requirements = requirements_for(risk);
            if !request.ceiling.allows(risk) {
                blockers.insert(AdmissionBlockReason::RiskCeilingExceeded);
            }
            let selected_ids: Vec<_> = request
                .operations
                .iter()
                .map(OperationRiskVersion::operation_version_id)
                .collect();
            let selected_ids = canonical_operation_ids(selected_ids).ok();
            if request.current_fingerprint.effective_risk != risk {
                blockers.insert(AdmissionBlockReason::FreshReviewRequired(
                    ApprovalDiff::Risk,
                ));
            }
            if selected_ids.as_ref() != Some(&request.current_fingerprint.operation_version_ids) {
                blockers.insert(AdmissionBlockReason::FreshReviewRequired(
                    ApprovalDiff::OperationVersionSet,
                ));
            }

            validate_confirmation(
                request.confirmation,
                request.current_fingerprint,
                risk,
                &mut blockers,
            );
            validate_recovery(request.recovery, requirements, &mut blockers);

            if requirements.advanced_preference {
                validate_advanced_preference(
                    request.advanced_preference,
                    request.current_fingerprint,
                    &mut blockers,
                );
            }
            if requirements.strong_auth {
                validate_proof(
                    request.proof,
                    request.current_fingerprint,
                    request.now_epoch_seconds,
                    &mut blockers,
                );
            }
            if requirements.experimental_cohort && !request.experimental_cohort {
                blockers.insert(AdmissionBlockReason::ExperimentalCohortRequired);
            }
        }

        if blockers.is_empty() {
            let risk = effective_risk.expect("empty and Extreme risk paths are blocked");
            let proof_reference = request
                .proof
                .filter(|_| risk >= ExecutableRisk::Advanced)
                .map(|proof| proof.proof_reference.clone());
            AdmissionDecision::Executable(ExecutableAdmission {
                risk,
                operation_version_ids: request.current_fingerprint.operation_version_ids.clone(),
                proof_reference,
            })
        } else {
            AdmissionDecision::Blocked(blockers.into_iter().collect())
        }
    }
}

impl RiskCeiling {
    const fn allows(self, risk: ExecutableRisk) -> bool {
        match self {
            Self::Verified => matches!(risk, ExecutableRisk::Verified),
            Self::Advanced => !matches!(risk, ExecutableRisk::Experimental),
            Self::Experimental => true,
        }
    }
}

fn validate_confirmation(
    confirmation: Option<&ConfirmationEvidence>,
    current: &ApprovalFingerprint,
    risk: ExecutableRisk,
    blockers: &mut BTreeSet<AdmissionBlockReason>,
) {
    let Some(confirmation) = confirmation else {
        blockers.insert(AdmissionBlockReason::ReviewConfirmationRequired);
        return;
    };
    if confirmation.binding.validate().is_err() {
        blockers.insert(AdmissionBlockReason::InvalidAuthority);
    }
    for diff in confirmation.binding.diffs(current) {
        blockers.insert(AdmissionBlockReason::FreshReviewRequired(diff));
    }
    match (risk, &confirmation.kind) {
        (ExecutableRisk::Verified, _) => {}
        (
            ExecutableRisk::Advanced,
            ConfirmationKind::Advanced {
                detailed_review: true,
            },
        ) => {}
        (ExecutableRisk::Advanced, _) => {
            blockers.insert(AdmissionBlockReason::DetailedReviewRequired);
        }
        (
            ExecutableRisk::Experimental,
            ConfirmationKind::Experimental {
                detailed_review,
                operation_version_consents,
                per_apply_consent,
                typed_phrase,
            },
        ) => {
            if !detailed_review {
                blockers.insert(AdmissionBlockReason::DetailedReviewRequired);
            }
            if operation_version_consents != &current.operation_version_ids {
                blockers.insert(AdmissionBlockReason::ExperimentalVersionConsentRequired);
            }
            if !per_apply_consent {
                blockers.insert(AdmissionBlockReason::ExperimentalApplyConsentRequired);
            }
            if typed_phrase != "APPLY EXPERIMENTAL PLAN"
                && typed_phrase != "APLICAR PLANO EXPERIMENTAL"
            {
                blockers.insert(AdmissionBlockReason::ExperimentalPhraseMismatch);
            }
        }
        (ExecutableRisk::Experimental, _) => {
            blockers.insert(AdmissionBlockReason::DetailedReviewRequired);
            blockers.insert(AdmissionBlockReason::ExperimentalVersionConsentRequired);
            blockers.insert(AdmissionBlockReason::ExperimentalApplyConsentRequired);
            blockers.insert(AdmissionBlockReason::ExperimentalPhraseMismatch);
        }
    }
}

fn validate_recovery(
    recovery: &RecoveryReadiness,
    requirements: RiskRequirements,
    blockers: &mut BTreeSet<AdmissionBlockReason>,
) {
    if !recovery.manifest_rollback_proven {
        blockers.insert(AdmissionBlockReason::ManifestRollbackRequired);
    }
    match requirements.complementary_recovery {
        ComplementaryRecoveryRequirement::Visible => {}
        ComplementaryRecoveryRequirement::ReadyOrExplicitlyUnavailable => {
            match recovery.restore_point_status {
                RestorePointStatus::Ready => {}
                RestorePointStatus::Unavailable | RestorePointStatus::Failed => {
                    if !recovery.second_layer_unavailable_acknowledged {
                        blockers.insert(
                            AdmissionBlockReason::SecondRecoveryLayerAcknowledgementRequired,
                        );
                    }
                }
                RestorePointStatus::Unknown => {
                    blockers.insert(AdmissionBlockReason::ComplementaryRestoreRequired);
                }
            }
        }
        ComplementaryRecoveryRequirement::Ready => {
            if recovery.restore_point_status != RestorePointStatus::Ready {
                blockers.insert(AdmissionBlockReason::ComplementaryRestoreRequired);
            }
        }
    }
}

fn validate_advanced_preference(
    preference: Option<&AdvancedPreferenceProjection>,
    current: &ApprovalFingerprint,
    blockers: &mut BTreeSet<AdmissionBlockReason>,
) {
    let Some(preference) = preference else {
        blockers.insert(AdmissionBlockReason::AdvancedPreferenceMissing);
        return;
    };
    if preference.validate().is_err() {
        blockers.insert(AdmissionBlockReason::InvalidAuthority);
    }
    match preference.state {
        AdvancedPreferenceState::Disabled => {
            blockers.insert(AdmissionBlockReason::AdvancedPreferenceDisabled);
        }
        AdvancedPreferenceState::Revoked => {
            blockers.insert(AdmissionBlockReason::AdvancedPreferenceRevoked);
        }
        AdvancedPreferenceState::RevalidationRequired => {
            blockers.insert(AdmissionBlockReason::AdvancedPreferenceRevalidationRequired);
        }
        AdvancedPreferenceState::Enabled => {}
    }
    if preference.device_binding != current.device_binding
        || preference.hardware_fingerprint != current.hardware_fingerprint
        || preference.security_posture_fingerprint != current.security_posture_fingerprint
    {
        blockers.insert(AdmissionBlockReason::AdvancedPreferenceBindingMismatch);
    }
}

fn validate_proof(
    proof: Option<&OneUseApplyProof>,
    current: &ApprovalFingerprint,
    now_epoch_seconds: u64,
    blockers: &mut BTreeSet<AdmissionBlockReason>,
) {
    let Some(proof) = proof else {
        blockers.insert(AdmissionBlockReason::StrongAuthProofRequired);
        return;
    };
    if proof.action != ApprovalAction::ApplyPlan {
        blockers.insert(AdmissionBlockReason::ProofWrongAction);
    }
    if proof.disposition == ProofDisposition::Consumed {
        blockers.insert(AdmissionBlockReason::ProofConsumed);
    }
    if proof.expires_at_epoch_seconds <= now_epoch_seconds {
        blockers.insert(AdmissionBlockReason::ProofExpired);
    }
    if proof.binding.validate().is_err() {
        blockers.insert(AdmissionBlockReason::InvalidAuthority);
    }
    for diff in proof.binding.diffs(current) {
        blockers.insert(AdmissionBlockReason::ProofBindingMismatch(diff));
    }
}

fn canonical_operation_ids<I, S>(values: I) -> Result<Vec<String>, AdmissionInputError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut ids: Vec<_> = values
        .into_iter()
        .map(|value| value.as_ref().to_owned())
        .collect();
    if ids.is_empty() || ids.len() > 64 || ids.iter().any(|id| validate_identifier(id).is_err()) {
        return Err(AdmissionInputError::InvalidOperationSet);
    }
    ids.sort_unstable();
    if ids.windows(2).any(|window| window[0] == window[1]) {
        return Err(AdmissionInputError::InvalidOperationSet);
    }
    Ok(ids)
}

fn validate_identifier(value: &str) -> Result<(), AdmissionInputError> {
    if value.is_empty() || value.len() > 128 {
        Err(AdmissionInputError::InvalidIdentifier)
    } else {
        Ok(())
    }
}

fn validate_fingerprint_component(value: &str) -> Result<(), AdmissionInputError> {
    if value.is_empty() || value.len() > 128 {
        Err(AdmissionInputError::InvalidFingerprint)
    } else {
        Ok(())
    }
}

const fn fresh_review_code(diff: ApprovalDiff) -> &'static str {
    match diff {
        ApprovalDiff::PlanFingerprint => "fresh-review-plan-fingerprint-changed",
        ApprovalDiff::EvidenceFingerprint => "fresh-review-evidence-fingerprint-changed",
        ApprovalDiff::RecoveryFingerprint => "fresh-review-recovery-fingerprint-changed",
        ApprovalDiff::DeviceBinding => "fresh-review-device-binding-changed",
        ApprovalDiff::HardwareFingerprint => "fresh-review-hardware-fingerprint-changed",
        ApprovalDiff::SecurityPostureFingerprint => {
            "fresh-review-security-posture-fingerprint-changed"
        }
        ApprovalDiff::OperationVersionSet => "fresh-review-operation-version-set-changed",
        ApprovalDiff::Risk => "fresh-review-risk-changed",
    }
}

const fn proof_binding_code(diff: ApprovalDiff) -> &'static str {
    match diff {
        ApprovalDiff::PlanFingerprint => "proof-plan-fingerprint-mismatch",
        ApprovalDiff::EvidenceFingerprint => "proof-evidence-fingerprint-mismatch",
        ApprovalDiff::RecoveryFingerprint => "proof-recovery-fingerprint-mismatch",
        ApprovalDiff::DeviceBinding => "proof-device-binding-mismatch",
        ApprovalDiff::HardwareFingerprint => "proof-hardware-fingerprint-mismatch",
        ApprovalDiff::SecurityPostureFingerprint => "proof-security-posture-mismatch",
        ApprovalDiff::OperationVersionSet => "proof-operation-version-set-mismatch",
        ApprovalDiff::Risk => "proof-risk-mismatch",
    }
}

/// Recovery is a local safety action and has no entitlement or authentication
/// input. It remains callable while apply admission is blocked.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LocalRecoveryAdmission {
    Callable,
}

pub const fn local_recovery_admission() -> LocalRecoveryAdmission {
    LocalRecoveryAdmission::Callable
}
