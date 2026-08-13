//! Exact-version promotion, signed revocation, and redacted diagnostics.

use std::collections::BTreeMap;

use liiiraa_contracts_rust::{
    OperationPromotionDocument, PromotionVerdict, RedactedDiagnosticExportDocument,
    SignedOperationRevocationDocument, TransactionIdentifier,
};
use sha2::{Digest, Sha256};

use crate::domain::{GeneratedTransport, PlanEngineError, PlanEngineErrorCode, PlanEngineResult};

/// The closed physical-validation sequence for one immutable operation version.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum PromotionStage {
    DeterministicSimulation,
    CleanWindowsVm,
    OwnerPc,
    FriendsPc,
}

impl PromotionStage {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::DeterministicSimulation => "deterministic-simulation",
            Self::CleanWindowsVm => "clean-windows-vm",
            Self::OwnerPc => "owner-pc",
            Self::FriendsPc => "friends-pc",
        }
    }

    pub const fn next(self) -> Option<Self> {
        match self {
            Self::DeterministicSimulation => Some(Self::CleanWindowsVm),
            Self::CleanWindowsVm => Some(Self::OwnerPc),
            Self::OwnerPc => Some(Self::FriendsPc),
            Self::FriendsPc => None,
        }
    }
}

/// Restart proof is explicit. `RequiredButMissing` can never complete a cycle.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RestartEvidence {
    NotRequired,
    RequiredButMissing,
    Completed,
}

/// Exact immutable identity of one stage-evidence artifact.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct ExactEvidenceIdentity {
    evidence_id: String,
    evidence_hash: String,
}

impl ExactEvidenceIdentity {
    pub fn new(evidence_id: impl Into<String>, evidence_hash: impl Into<String>) -> Self {
        Self {
            evidence_id: evidence_id.into(),
            evidence_hash: evidence_hash.into(),
        }
    }

    fn is_well_formed(&self) -> bool {
        !self.evidence_id.is_empty()
            && self.evidence_id.len() <= 128
            && self.evidence_hash.len() == 71
            && self
                .evidence_hash
                .strip_prefix("sha256:")
                .is_some_and(|digest| digest.bytes().all(|byte| byte.is_ascii_hexdigit()))
    }
}

/// Recovery-cycle evidence bound to one operation version, immutable build,
/// exact stage, and the exact generated evidence references carried by the
/// candidate promotion document.
#[derive(Clone, Debug)]
pub struct ExactStageEvidence {
    operation_version_id: TransactionIdentifier,
    immutable_build_id: TransactionIdentifier,
    stage: PromotionStage,
    evidence: Vec<ExactEvidenceIdentity>,
    recovery_prepared: bool,
    applied: bool,
    verified_after_apply: bool,
    restart: RestartEvidence,
    restored: bool,
    verified_after_restore: bool,
    tested_hardware_ids: Vec<TransactionIdentifier>,
    coverage_gaps: Vec<TransactionIdentifier>,
}

impl ExactStageEvidence {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        operation_version_id: TransactionIdentifier,
        immutable_build_id: TransactionIdentifier,
        stage: PromotionStage,
        evidence: Vec<ExactEvidenceIdentity>,
        recovery_prepared: bool,
        applied: bool,
        verified_after_apply: bool,
        restart: RestartEvidence,
        restored: bool,
        verified_after_restore: bool,
        tested_hardware_ids: Vec<TransactionIdentifier>,
        coverage_gaps: Vec<TransactionIdentifier>,
    ) -> Self {
        Self {
            operation_version_id,
            immutable_build_id,
            stage,
            evidence,
            recovery_prepared,
            applied,
            verified_after_apply,
            restart,
            restored,
            verified_after_restore,
            tested_hardware_ids,
            coverage_gaps,
        }
    }

    fn is_complete(&self) -> bool {
        self.recovery_prepared
            && self.applied
            && self.verified_after_apply
            && self.restart != RestartEvidence::RequiredButMissing
            && self.restored
            && self.verified_after_restore
            && !self.evidence.is_empty()
            && self
                .evidence
                .iter()
                .all(ExactEvidenceIdentity::is_well_formed)
            && all_unique(&self.evidence)
            && !self.tested_hardware_ids.is_empty()
            && all_unique(&self.tested_hardware_ids)
            && !self.coverage_gaps.is_empty()
            && all_unique(&self.coverage_gaps)
    }
}

/// Validated promotion record for one exact operation version and build.
#[derive(Clone, Debug)]
pub struct AcceptedPromotion {
    transport: OperationPromotionDocument,
    operation_version_id: TransactionIdentifier,
    immutable_build_id: TransactionIdentifier,
    stage: PromotionStage,
    coverage_gaps: Vec<TransactionIdentifier>,
}

impl AcceptedPromotion {
    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub const fn immutable_build_id(&self) -> &TransactionIdentifier {
        &self.immutable_build_id
    }

    pub const fn stage(&self) -> PromotionStage {
        self.stage
    }

    pub fn coverage_gaps(&self) -> &[TransactionIdentifier] {
        &self.coverage_gaps
    }

    /// Bounded owner/friends evidence never becomes a universal-support claim.
    pub const fn claims_universal_support(&self) -> bool {
        false
    }
}

impl GeneratedTransport<OperationPromotionDocument> for AcceptedPromotion {
    fn transport(&self) -> &OperationPromotionDocument {
        &self.transport
    }
}

/// The only possible next stage after an accepted promotion.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum NextPromotionStage {
    CleanWindowsVm,
    OwnerPc,
    FriendsPc,
    FullyPromoted,
}

impl From<PromotionStage> for NextPromotionStage {
    fn from(stage: PromotionStage) -> Self {
        match stage {
            PromotionStage::DeterministicSimulation => Self::CleanWindowsVm,
            PromotionStage::CleanWindowsVm => Self::OwnerPc,
            PromotionStage::OwnerPc => Self::FriendsPc,
            PromotionStage::FriendsPc => Self::FullyPromoted,
        }
    }
}

/// Promotion failure is permanent for the exact version. A fix must register a
/// new version and start again at deterministic simulation.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PromotionBlockReason {
    MissingPreviousStage,
    PreviousStageNotPassed,
    VersionMismatch,
    StageSkipped,
    EvidenceIncomplete,
    StageFailed,
    VersionRevoked,
}

#[derive(Clone, Debug)]
pub enum PromotionDecision {
    Accepted {
        promotion: AcceptedPromotion,
        next: NextPromotionStage,
    },
    Blocked(PromotionBlockReason),
}

pub struct PromotionRequest {
    candidate: OperationPromotionDocument,
    evidence: ExactStageEvidence,
}

impl PromotionRequest {
    pub const fn new(candidate: OperationPromotionDocument, evidence: ExactStageEvidence) -> Self {
        Self {
            candidate,
            evidence,
        }
    }
}

#[derive(Clone, Debug)]
struct AcceptedIdentity {
    stage: PromotionStage,
    promotion_id: TransactionIdentifier,
    immutable_build_id: TransactionIdentifier,
}

#[derive(Clone, Debug, Default)]
struct VersionLedger {
    latest: Option<AcceptedIdentity>,
    failed: bool,
    revoked: bool,
}

#[derive(Clone, Debug)]
struct CandidateIdentity {
    operation_version_id: TransactionIdentifier,
    promotion_id: TransactionIdentifier,
    stage: PromotionStage,
    previous_promotion_id: Option<TransactionIdentifier>,
    verdict: PromotionVerdict,
    evidence: Vec<ExactEvidenceIdentity>,
}

fn evidence_identity(
    evidence: &[liiiraa_contracts_rust::PromotionEvidenceReference],
) -> Vec<ExactEvidenceIdentity> {
    evidence
        .iter()
        .map(|reference| {
            ExactEvidenceIdentity::new(
                reference.evidence_id.as_str(),
                reference.evidence_hash.as_str(),
            )
        })
        .collect()
}

fn candidate_identity(candidate: &OperationPromotionDocument) -> CandidateIdentity {
    match candidate {
        OperationPromotionDocument::SimulationPromotionDocument(document) => CandidateIdentity {
            operation_version_id: document.operation_version_id.clone(),
            promotion_id: document.promotion_id.clone(),
            stage: PromotionStage::DeterministicSimulation,
            previous_promotion_id: None,
            verdict: document.verdict,
            evidence: evidence_identity(&document.evidence),
        },
        OperationPromotionDocument::VmPromotionDocument(document) => CandidateIdentity {
            operation_version_id: document.operation_version_id.clone(),
            promotion_id: document.promotion_id.clone(),
            stage: PromotionStage::CleanWindowsVm,
            previous_promotion_id: Some(document.previous_promotion_id.clone()),
            verdict: document.verdict,
            evidence: evidence_identity(&document.evidence),
        },
        OperationPromotionDocument::OwnerPromotionDocument(document) => CandidateIdentity {
            operation_version_id: document.operation_version_id.clone(),
            promotion_id: document.promotion_id.clone(),
            stage: PromotionStage::OwnerPc,
            previous_promotion_id: Some(document.previous_promotion_id.clone()),
            verdict: document.verdict,
            evidence: evidence_identity(&document.evidence),
        },
        OperationPromotionDocument::FriendsPromotionDocument(document) => CandidateIdentity {
            operation_version_id: document.operation_version_id.clone(),
            promotion_id: document.promotion_id.clone(),
            stage: PromotionStage::FriendsPc,
            previous_promotion_id: Some(document.previous_promotion_id.clone()),
            verdict: document.verdict,
            evidence: evidence_identity(&document.evidence),
        },
    }
}

fn all_unique<T>(values: &[T]) -> bool
where
    T: Ord,
{
    let mut sorted = values.iter().collect::<Vec<_>>();
    sorted.sort_unstable();
    sorted.windows(2).all(|window| window[0] != window[1])
}

fn same_evidence(left: &[ExactEvidenceIdentity], right: &[ExactEvidenceIdentity]) -> bool {
    if !all_unique(left) || !all_unique(right) {
        return false;
    }
    let mut left = left.iter().collect::<Vec<_>>();
    let mut right = right.iter().collect::<Vec<_>>();
    left.sort_unstable();
    right.sort_unstable();
    left == right
}

/// Port that verifies the detached revocation signature over the exact received
/// document bytes or an equivalent canonical representation.
pub trait RevocationSignatureVerifier {
    fn verify(&self, document: &SignedOperationRevocationDocument) -> bool;
}

/// Stateful exact-version ledger. It intentionally exposes no override or
/// reset operation: a failed version remains failed for this authority's life.
pub struct ExactVersionPromotionPolicy<V> {
    signature_verifier: V,
    versions: BTreeMap<String, VersionLedger>,
}

impl<V> ExactVersionPromotionPolicy<V>
where
    V: RevocationSignatureVerifier,
{
    pub fn new(signature_verifier: V) -> Self {
        Self {
            signature_verifier,
            versions: BTreeMap::new(),
        }
    }

    pub fn evaluate(&mut self, request: PromotionRequest) -> PromotionDecision {
        let PromotionRequest {
            candidate,
            evidence,
        } = request;
        let candidate_identity = candidate_identity(&candidate);
        let version_key = candidate_identity.operation_version_id.as_str().to_owned();
        let ledger = self.versions.entry(version_key).or_default();

        if ledger.revoked || candidate_identity.verdict == PromotionVerdict::Revoked {
            ledger.revoked = true;
            return PromotionDecision::Blocked(PromotionBlockReason::VersionRevoked);
        }
        if ledger.failed {
            return PromotionDecision::Blocked(PromotionBlockReason::StageFailed);
        }
        if candidate_identity.operation_version_id != evidence.operation_version_id {
            return PromotionDecision::Blocked(PromotionBlockReason::VersionMismatch);
        }
        if candidate_identity.stage != evidence.stage {
            return PromotionDecision::Blocked(PromotionBlockReason::StageSkipped);
        }
        if !evidence.is_complete()
            || !same_evidence(&candidate_identity.evidence, &evidence.evidence)
        {
            return PromotionDecision::Blocked(PromotionBlockReason::EvidenceIncomplete);
        }
        if candidate_identity.verdict == PromotionVerdict::Failed {
            ledger.failed = true;
            return PromotionDecision::Blocked(PromotionBlockReason::StageFailed);
        }
        if candidate_identity.verdict != PromotionVerdict::Passed {
            return PromotionDecision::Blocked(PromotionBlockReason::PreviousStageNotPassed);
        }
        match &ledger.latest {
            None if candidate_identity.stage != PromotionStage::DeterministicSimulation => {
                return PromotionDecision::Blocked(PromotionBlockReason::MissingPreviousStage);
            }
            None if candidate_identity.previous_promotion_id.is_some() => {
                return PromotionDecision::Blocked(PromotionBlockReason::StageSkipped);
            }
            Some(previous) => {
                if previous.immutable_build_id != evidence.immutable_build_id {
                    return PromotionDecision::Blocked(PromotionBlockReason::VersionMismatch);
                }
                if previous.stage.next() != Some(candidate_identity.stage) {
                    return PromotionDecision::Blocked(PromotionBlockReason::StageSkipped);
                }
                if candidate_identity.previous_promotion_id.as_ref() != Some(&previous.promotion_id)
                {
                    return PromotionDecision::Blocked(PromotionBlockReason::VersionMismatch);
                }
            }
            None => {}
        }

        let accepted = AcceptedPromotion {
            transport: candidate,
            operation_version_id: candidate_identity.operation_version_id.clone(),
            immutable_build_id: evidence.immutable_build_id.clone(),
            stage: candidate_identity.stage,
            coverage_gaps: evidence.coverage_gaps,
        };
        ledger.latest = Some(AcceptedIdentity {
            stage: candidate_identity.stage,
            promotion_id: candidate_identity.promotion_id,
            immutable_build_id: evidence.immutable_build_id,
        });
        PromotionDecision::Accepted {
            promotion: accepted,
            next: candidate_identity.stage.into(),
        }
    }

    pub fn verify_revocation(
        &mut self,
        document: SignedOperationRevocationDocument,
    ) -> PlanEngineResult<RevocationDisposition> {
        let operation_version_id = document.operation_version_id.clone();
        if !document.recovery_remains_available || !self.signature_verifier.verify(&document) {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::PromotionBlocked,
                Some(operation_version_id),
            ));
        }
        self.versions
            .entry(operation_version_id.as_str().to_owned())
            .or_default()
            .revoked = true;
        Ok(RevocationDisposition::block_alert_and_keep_local_recovery(
            document,
        ))
    }

    pub fn new_applications_blocked(&self, operation_version_id: &TransactionIdentifier) -> bool {
        self.versions
            .get(operation_version_id.as_str())
            .is_some_and(|version| version.revoked)
    }

    /// Recovery is local safety authority and is independent of revocation,
    /// online state, authentication, or subscription state.
    pub const fn local_recovery_available(
        &self,
        _operation_version_id: &TransactionIdentifier,
    ) -> bool {
        true
    }
}

pub trait PromotionPolicy {
    fn evaluate(&mut self, request: PromotionRequest) -> PromotionDecision;

    fn verify_revocation(
        &mut self,
        document: SignedOperationRevocationDocument,
    ) -> PlanEngineResult<RevocationDisposition>;
}

impl<V> PromotionPolicy for ExactVersionPromotionPolicy<V>
where
    V: RevocationSignatureVerifier,
{
    fn evaluate(&mut self, request: PromotionRequest) -> PromotionDecision {
        Self::evaluate(self, request)
    }

    fn verify_revocation(
        &mut self,
        document: SignedOperationRevocationDocument,
    ) -> PlanEngineResult<RevocationDisposition> {
        Self::verify_revocation(self, document)
    }
}

/// A verified revocation has exactly this bounded effect. It cannot carry a
/// remote mutation, rollback, script, or override.
#[derive(Clone, Debug)]
pub struct RevocationDisposition {
    revocation: SignedOperationRevocationDocument,
}

impl RevocationDisposition {
    fn block_alert_and_keep_local_recovery(revocation: SignedOperationRevocationDocument) -> Self {
        Self { revocation }
    }

    pub const fn blocks_new_applications(&self) -> bool {
        true
    }

    pub const fn alerts_affected_users(&self) -> bool {
        true
    }

    pub const fn local_recovery_available(&self) -> bool {
        true
    }

    pub const fn authorizes_remote_rollback(&self) -> bool {
        false
    }

    pub const fn authorizes_remote_execution(&self) -> bool {
        false
    }
}

impl GeneratedTransport<SignedOperationRevocationDocument> for RevocationDisposition {
    fn transport(&self) -> &SignedOperationRevocationDocument {
        &self.revocation
    }
}

/// Local journal projection input. Raw fields are retained only to prove that
/// the redacted generated document does not disclose them.
#[derive(Clone, Debug)]
pub struct LocalDiagnosticJournal {
    redacted_document: RedactedDiagnosticExportDocument,
    raw_identifiers: Vec<String>,
    raw_secrets: Vec<String>,
}

impl LocalDiagnosticJournal {
    pub fn new(
        redacted_document: RedactedDiagnosticExportDocument,
        raw_identifiers: Vec<String>,
        raw_secrets: Vec<String>,
    ) -> Self {
        Self {
            redacted_document,
            raw_identifiers,
            raw_secrets,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DiagnosticReleaseIntent {
    ExportLocalFile,
    SendToSupport,
}

#[derive(Clone, Debug)]
pub struct DiagnosticReleaseConsent {
    preview_fingerprint: String,
    intent: DiagnosticReleaseIntent,
    granted: bool,
}

impl DiagnosticReleaseConsent {
    pub const fn new(
        preview_fingerprint: String,
        intent: DiagnosticReleaseIntent,
        granted: bool,
    ) -> Self {
        Self {
            preview_fingerprint,
            intent,
            granted,
        }
    }
}

#[derive(Clone, Debug)]
pub struct RedactedDiagnosticPreview {
    document: RedactedDiagnosticExportDocument,
    fingerprint: String,
}

impl RedactedDiagnosticPreview {
    pub fn fingerprint(&self) -> &str {
        &self.fingerprint
    }

    pub const fn requires_explicit_consent(&self) -> bool {
        true
    }

    pub const fn has_automatic_transport(&self) -> bool {
        false
    }

    pub fn authorize_release(
        &self,
        consent: DiagnosticReleaseConsent,
    ) -> PlanEngineResult<AuthorizedDiagnosticRelease> {
        if !consent.granted || consent.preview_fingerprint != self.fingerprint {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::PromotionBlocked,
                Some(self.document.export_id.clone()),
            ));
        }
        Ok(AuthorizedDiagnosticRelease {
            document: self.document.clone(),
            intent: consent.intent,
        })
    }
}

impl GeneratedTransport<RedactedDiagnosticExportDocument> for RedactedDiagnosticPreview {
    fn transport(&self) -> &RedactedDiagnosticExportDocument {
        &self.document
    }
}

#[derive(Clone, Debug)]
pub struct AuthorizedDiagnosticRelease {
    document: RedactedDiagnosticExportDocument,
    intent: DiagnosticReleaseIntent,
}

impl AuthorizedDiagnosticRelease {
    pub const fn intent(&self) -> DiagnosticReleaseIntent {
        self.intent
    }

    pub const fn is_automatic(&self) -> bool {
        false
    }
}

impl GeneratedTransport<RedactedDiagnosticExportDocument> for AuthorizedDiagnosticRelease {
    fn transport(&self) -> &RedactedDiagnosticExportDocument {
        &self.document
    }
}

pub struct RedactedDiagnosticPolicy;

impl RedactedDiagnosticPolicy {
    pub fn project_redacted(
        &self,
        journal: &LocalDiagnosticJournal,
    ) -> PlanEngineResult<RedactedDiagnosticPreview> {
        let encoded = serde_json::to_vec(&journal.redacted_document).map_err(|_| {
            PlanEngineError::new(
                PlanEngineErrorCode::InvalidGeneratedTransport,
                Some(journal.redacted_document.export_id.clone()),
            )
        })?;
        let encoded_text = String::from_utf8_lossy(&encoded);
        let contains_raw_value = journal
            .raw_identifiers
            .iter()
            .chain(journal.raw_secrets.iter())
            .any(|value| !value.is_empty() && encoded_text.contains(value));
        if contains_raw_value
            || journal.redacted_document.entries.is_empty()
            || journal.redacted_document.redactions_applied.is_empty()
        {
            return Err(PlanEngineError::new(
                PlanEngineErrorCode::InvalidGeneratedTransport,
                Some(journal.redacted_document.export_id.clone()),
            ));
        }
        let fingerprint = format!("sha256:{:x}", Sha256::digest(&encoded));
        Ok(RedactedDiagnosticPreview {
            document: journal.redacted_document.clone(),
            fingerprint,
        })
    }
}

/// Produces a previewable generated redacted export from local durable truth.
pub trait DiagnosticProjection {
    type JournalView;

    fn project_redacted(
        &self,
        journal: &Self::JournalView,
    ) -> PlanEngineResult<RedactedDiagnosticPreview>;
}

impl DiagnosticProjection for RedactedDiagnosticPolicy {
    type JournalView = LocalDiagnosticJournal;

    fn project_redacted(
        &self,
        journal: &Self::JournalView,
    ) -> PlanEngineResult<RedactedDiagnosticPreview> {
        Self::project_redacted(self, journal)
    }
}
