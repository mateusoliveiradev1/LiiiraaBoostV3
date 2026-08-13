//! Exact-version promotion, signed revocation, and redacted diagnostics.

use liiiraa_contracts_rust::{
    OperationPromotionDocument, RedactedDiagnosticExportDocument,
    SignedOperationRevocationDocument, TransactionIdentifier,
};

use crate::domain::{GeneratedTransport, PlanEngineResult};

/// Validated promotion record for one exact operation version.
#[derive(Clone, Debug)]
pub struct AcceptedPromotion(OperationPromotionDocument);

impl AcceptedPromotion {
    pub(crate) const fn from_transport(transport: OperationPromotionDocument) -> Self {
        Self(transport)
    }
}

impl GeneratedTransport<OperationPromotionDocument> for AcceptedPromotion {
    fn transport(&self) -> &OperationPromotionDocument {
        &self.0
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

pub struct PromotionRequest<'a> {
    pub operation_version_id: &'a TransactionIdentifier,
    pub candidate: OperationPromotionDocument,
    pub previous: Option<&'a AcceptedPromotion>,
}

/// A verified revocation has exactly this bounded effect. It cannot carry a
/// remote mutation, rollback, script, or override.
#[derive(Clone, Debug)]
pub struct RevocationDisposition {
    revocation: SignedOperationRevocationDocument,
}

impl RevocationDisposition {
    pub(crate) const fn block_alert_and_keep_local_recovery(
        revocation: SignedOperationRevocationDocument,
    ) -> Self {
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
}

impl GeneratedTransport<SignedOperationRevocationDocument> for RevocationDisposition {
    fn transport(&self) -> &SignedOperationRevocationDocument {
        &self.revocation
    }
}

pub trait PromotionPolicy {
    fn evaluate(&self, request: PromotionRequest<'_>) -> PlanEngineResult<PromotionDecision>;

    fn verify_revocation(
        &self,
        document: SignedOperationRevocationDocument,
    ) -> PlanEngineResult<RevocationDisposition>;
}

/// Produces the generated redacted export only from local durable authority.
pub trait DiagnosticProjection {
    type JournalView;

    fn project_redacted(
        &self,
        journal: &Self::JournalView,
    ) -> PlanEngineResult<RedactedDiagnosticExportDocument>;
}
