//! Pure fail-closed policy for Phase 5 evidence.
//!
//! This module deliberately owns no clock, filesystem, network, Tauri, or Windows API. Callers
//! provide validated observations and receive a deterministic verdict with stable reason codes,
//! localization keys, and exact evidence references. Presentation remains outside Rust.

use liiiraa_contracts_rust::EvidenceQuality;

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct EvidenceReference {
    pub evidence_id: String,
    pub evidence_version: u32,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum EvidenceFreshness {
    Current,
    Stale,
    Contradictory,
    Corrupt,
    Unavailable,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum CapabilityState {
    Available,
    Experimental,
    Unavailable,
    Forbidden,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CapabilityObservation {
    pub capability_id: String,
    pub state: CapabilityState,
    pub freshness: EvidenceFreshness,
    pub evidence: EvidenceReference,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LifecycleState {
    Supported,
    Warning { warning_id: String },
    Unsupported,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LifecycleAdmission {
    pub state: LifecycleState,
    pub evidence: EvidenceReference,
    pub acknowledgement: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum RecommendationTier {
    Compatible,
    Experimental,
    Unsupported,
    Hidden,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum PolicyReason {
    CapabilityExperimental,
    CapabilityForbidden,
    CapabilityUnavailable,
    CapabilityUnknown,
    EvidenceContradictory,
    EvidenceCorrupt,
    EvidenceStale,
    EvidenceUnavailable,
    LifecycleAcknowledgementRequired,
    LifecycleUnknown,
    LifecycleUnsupported,
    MetricQualityRejected,
    ComparisonApprovalMissing,
    ComparisonApprovalPending,
    ComparisonApprovalRevoked,
}

impl PolicyReason {
    pub const fn localization_key(self) -> &'static str {
        match self {
            Self::CapabilityExperimental => "evidence.policy.capability.experimental",
            Self::CapabilityForbidden => "evidence.policy.capability.forbidden",
            Self::CapabilityUnavailable => "evidence.policy.capability.unavailable",
            Self::CapabilityUnknown => "evidence.policy.capability.unknown",
            Self::EvidenceContradictory => "evidence.policy.freshness.contradictory",
            Self::EvidenceCorrupt => "evidence.policy.freshness.corrupt",
            Self::EvidenceStale => "evidence.policy.freshness.stale",
            Self::EvidenceUnavailable => "evidence.policy.freshness.unavailable",
            Self::LifecycleAcknowledgementRequired => {
                "evidence.policy.lifecycle.acknowledgement-required"
            }
            Self::LifecycleUnknown => "evidence.policy.lifecycle.unknown",
            Self::LifecycleUnsupported => "evidence.policy.lifecycle.unsupported",
            Self::MetricQualityRejected => "evidence.policy.metric-quality.rejected",
            Self::ComparisonApprovalMissing => "evidence.policy.comparison.missing",
            Self::ComparisonApprovalPending => "evidence.policy.comparison.pending",
            Self::ComparisonApprovalRevoked => "evidence.policy.comparison.revoked",
        }
    }

    const fn order(self) -> u8 {
        match self {
            Self::EvidenceCorrupt => 10,
            Self::EvidenceContradictory => 20,
            Self::EvidenceStale => 30,
            Self::EvidenceUnavailable => 40,
            Self::CapabilityForbidden => 50,
            Self::CapabilityUnknown => 60,
            Self::CapabilityUnavailable => 70,
            Self::CapabilityExperimental => 80,
            Self::LifecycleUnsupported => 90,
            Self::LifecycleUnknown => 100,
            Self::LifecycleAcknowledgementRequired => 110,
            Self::MetricQualityRejected => 120,
            Self::ComparisonApprovalRevoked => 130,
            Self::ComparisonApprovalPending => 140,
            Self::ComparisonApprovalMissing => 150,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyBlocker {
    pub code: PolicyReason,
    pub localization_key: &'static str,
    pub subject: String,
    pub evidence: Option<EvidenceReference>,
}

impl PolicyBlocker {
    fn new(
        code: PolicyReason,
        subject: impl Into<String>,
        evidence: Option<EvidenceReference>,
    ) -> Self {
        Self {
            code,
            localization_key: code.localization_key(),
            subject: subject.into(),
            evidence,
        }
    }

    pub fn sort_key(&self) -> (u8, &str, &str, u32) {
        let evidence = self.evidence.as_ref();
        (
            self.code.order(),
            self.subject.as_str(),
            evidence.map_or("", |reference| reference.evidence_id.as_str()),
            evidence.map_or(0, |reference| reference.evidence_version),
        )
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyInput {
    /// Human-facing label only. It is intentionally ignored by the evaluator.
    pub marketing_name: String,
    pub requested_tier: RecommendationTier,
    pub capabilities: Vec<CapabilityObservation>,
    pub lifecycle: LifecycleAdmission,
    pub quality: EvidenceQuality,
    pub quality_evidence: EvidenceReference,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PolicyVerdict {
    pub actionable: bool,
    pub tier: RecommendationTier,
    pub acknowledgement_required: bool,
    pub reasons: Vec<PolicyBlocker>,
    pub evidence: Vec<EvidenceReference>,
}

fn freshness_reason(freshness: EvidenceFreshness) -> Option<PolicyReason> {
    match freshness {
        EvidenceFreshness::Current => None,
        EvidenceFreshness::Stale => Some(PolicyReason::EvidenceStale),
        EvidenceFreshness::Contradictory => Some(PolicyReason::EvidenceContradictory),
        EvidenceFreshness::Corrupt => Some(PolicyReason::EvidenceCorrupt),
        EvidenceFreshness::Unavailable => Some(PolicyReason::EvidenceUnavailable),
    }
}

fn capability_reason(state: CapabilityState) -> Option<PolicyReason> {
    match state {
        CapabilityState::Available => None,
        CapabilityState::Experimental => Some(PolicyReason::CapabilityExperimental),
        CapabilityState::Unavailable => Some(PolicyReason::CapabilityUnavailable),
        CapabilityState::Forbidden => Some(PolicyReason::CapabilityForbidden),
        CapabilityState::Unknown => Some(PolicyReason::CapabilityUnknown),
    }
}

fn tier_for_capability(state: CapabilityState) -> RecommendationTier {
    match state {
        CapabilityState::Available => RecommendationTier::Compatible,
        CapabilityState::Experimental => RecommendationTier::Experimental,
        CapabilityState::Unavailable => RecommendationTier::Unsupported,
        CapabilityState::Forbidden | CapabilityState::Unknown => RecommendationTier::Hidden,
    }
}

fn tier_rank(tier: RecommendationTier) -> u8 {
    match tier {
        RecommendationTier::Compatible => 0,
        RecommendationTier::Experimental => 1,
        RecommendationTier::Unsupported => 2,
        RecommendationTier::Hidden => 3,
    }
}

fn stricter_tier(left: RecommendationTier, right: RecommendationTier) -> RecommendationTier {
    if tier_rank(left) >= tier_rank(right) {
        left
    } else {
        right
    }
}

fn insert_evidence(evidence: &mut Vec<EvidenceReference>, reference: &EvidenceReference) {
    if !evidence.contains(reference) {
        evidence.push(reference.clone());
    }
}

fn stable_reasons(mut reasons: Vec<PolicyBlocker>) -> Vec<PolicyBlocker> {
    reasons.sort_by(|left, right| left.sort_key().cmp(&right.sort_key()));
    reasons.dedup();
    reasons
}

fn stable_evidence(mut evidence: Vec<EvidenceReference>) -> Vec<EvidenceReference> {
    evidence.sort();
    evidence.dedup();
    evidence
}

pub fn evaluate_policy(input: &PolicyInput) -> PolicyVerdict {
    let mut reasons = Vec::new();
    let mut evidence = Vec::new();
    let mut tier = input.requested_tier;
    let mut acknowledgement_required = false;

    // The marketing name is deliberately never read. Capabilities and evidence own truth.
    for capability in &input.capabilities {
        insert_evidence(&mut evidence, &capability.evidence);

        if let Some(code) = freshness_reason(capability.freshness) {
            reasons.push(PolicyBlocker::new(
                code,
                capability.capability_id.clone(),
                Some(capability.evidence.clone()),
            ));
            tier = RecommendationTier::Hidden;
        }

        if let Some(code) = capability_reason(capability.state) {
            reasons.push(PolicyBlocker::new(
                code,
                capability.capability_id.clone(),
                Some(capability.evidence.clone()),
            ));
            tier = stricter_tier(tier, tier_for_capability(capability.state));
        }
    }

    insert_evidence(&mut evidence, &input.lifecycle.evidence);
    match &input.lifecycle.state {
        LifecycleState::Supported => {}
        LifecycleState::Warning { warning_id } => {
            if input.lifecycle.acknowledgement.as_deref() != Some(warning_id.as_str()) {
                acknowledgement_required = true;
                tier = stricter_tier(tier, RecommendationTier::Experimental);
                reasons.push(PolicyBlocker::new(
                    PolicyReason::LifecycleAcknowledgementRequired,
                    warning_id.clone(),
                    Some(input.lifecycle.evidence.clone()),
                ));
            }
        }
        LifecycleState::Unsupported => {
            tier = stricter_tier(tier, RecommendationTier::Unsupported);
            reasons.push(PolicyBlocker::new(
                PolicyReason::LifecycleUnsupported,
                "windows-lifecycle",
                Some(input.lifecycle.evidence.clone()),
            ));
        }
        LifecycleState::Unknown => {
            tier = RecommendationTier::Hidden;
            reasons.push(PolicyBlocker::new(
                PolicyReason::LifecycleUnknown,
                "windows-lifecycle",
                Some(input.lifecycle.evidence.clone()),
            ));
        }
    }

    insert_evidence(&mut evidence, &input.quality_evidence);
    if input.quality != EvidenceQuality::Valid {
        tier = RecommendationTier::Hidden;
        reasons.push(PolicyBlocker::new(
            PolicyReason::MetricQualityRejected,
            input.quality.to_string(),
            Some(input.quality_evidence.clone()),
        ));
    }

    let reasons = stable_reasons(reasons);
    let actionable = reasons.is_empty()
        && !acknowledgement_required
        && input.quality == EvidenceQuality::Valid
        && input.capabilities.iter().all(|capability| {
            capability.state == CapabilityState::Available
                && capability.freshness == EvidenceFreshness::Current
        });

    PolicyVerdict {
        actionable,
        tier,
        acknowledgement_required,
        reasons,
        evidence: stable_evidence(evidence),
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ClaimAuthority {
    Approved,
    Pending,
    Revoked,
    Missing,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComparisonAuthority {
    pub comparison_id: String,
    pub evidence: EvidenceReference,
    pub state: ClaimAuthority,
    pub quality: EvidenceQuality,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimVerdict {
    pub admitted: bool,
    pub history_reference: EvidenceReference,
    pub reasons: Vec<PolicyBlocker>,
}

pub fn evaluate_claim(authority: &ComparisonAuthority) -> ClaimVerdict {
    let mut reasons = Vec::new();

    match authority.state {
        ClaimAuthority::Approved => {}
        ClaimAuthority::Pending => reasons.push(PolicyBlocker::new(
            PolicyReason::ComparisonApprovalPending,
            authority.comparison_id.clone(),
            Some(authority.evidence.clone()),
        )),
        ClaimAuthority::Revoked => reasons.push(PolicyBlocker::new(
            PolicyReason::ComparisonApprovalRevoked,
            authority.comparison_id.clone(),
            Some(authority.evidence.clone()),
        )),
        ClaimAuthority::Missing => reasons.push(PolicyBlocker::new(
            PolicyReason::ComparisonApprovalMissing,
            authority.comparison_id.clone(),
            Some(authority.evidence.clone()),
        )),
    }

    if authority.quality != EvidenceQuality::Valid {
        reasons.push(PolicyBlocker::new(
            PolicyReason::MetricQualityRejected,
            authority.quality.to_string(),
            Some(authority.evidence.clone()),
        ));
    }

    let reasons = stable_reasons(reasons);
    ClaimVerdict {
        admitted: reasons.is_empty(),
        history_reference: authority.evidence.clone(),
        reasons,
    }
}
