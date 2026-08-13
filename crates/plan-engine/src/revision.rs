//! Immutable plan revisions and approval-fingerprint interfaces.

use liiiraa_contracts_rust::{
    DeviceAuthorityBinding, PlanApprovalDocument, PlanOperation, TransactionHash,
    TransactionIdentifier, TransactionalPlanDocument,
};

use crate::domain::{GeneratedTransport, PlanEngineResult, RendererPlanIntent};
use crate::risk::EvidenceAdmission;

/// Registry-owned operation version. Its generated transport is immutable once
/// admitted, so risk and operation semantics cannot be edited by a caller.
#[derive(Clone, Debug)]
pub struct RegisteredOperationVersion(PlanOperation);

impl RegisteredOperationVersion {
    pub(crate) const fn from_transport(transport: PlanOperation) -> Self {
        Self(transport)
    }
}

impl GeneratedTransport<PlanOperation> for RegisteredOperationVersion {
    fn transport(&self) -> &PlanOperation {
        &self.0
    }
}

/// Immutable generated plan document accepted by the domain.
#[derive(Clone, Debug)]
pub struct PlanRevision(TransactionalPlanDocument);

impl PlanRevision {
    pub(crate) const fn from_transport(transport: TransactionalPlanDocument) -> Self {
        Self(transport)
    }

    pub fn plan_id(&self) -> &TransactionIdentifier {
        &self.0.plan_id
    }

    pub fn revision_fingerprint(&self) -> &TransactionHash {
        &self.0.revision_fingerprint
    }

    pub fn evidence_fingerprint(&self) -> &TransactionHash {
        &self.0.evidence_fingerprint
    }
}

impl GeneratedTransport<TransactionalPlanDocument> for PlanRevision {
    fn transport(&self) -> &TransactionalPlanDocument {
        &self.0
    }
}

/// Immutable approval bound to one exact revision, evidence set, and device.
#[derive(Clone, Debug)]
pub struct PlanApproval(PlanApprovalDocument);

impl PlanApproval {
    pub(crate) const fn from_transport(transport: PlanApprovalDocument) -> Self {
        Self(transport)
    }
}

impl GeneratedTransport<PlanApprovalDocument> for PlanApproval {
    fn transport(&self) -> &PlanApprovalDocument {
        &self.0
    }
}

/// Authoritative inputs used to compose a revision from renderer intent.
pub struct ComposeRevisionRequest<'a> {
    intent: &'a RendererPlanIntent,
    device: &'a DeviceAuthorityBinding,
    operation_versions: &'a [RegisteredOperationVersion],
    evidence: &'a [EvidenceAdmission],
}

impl<'a> ComposeRevisionRequest<'a> {
    pub(crate) const fn from_parts(
        intent: &'a RendererPlanIntent,
        device: &'a DeviceAuthorityBinding,
        operation_versions: &'a [RegisteredOperationVersion],
        evidence: &'a [EvidenceAdmission],
    ) -> Self {
        Self {
            intent,
            device,
            operation_versions,
            evidence,
        }
    }

    pub const fn intent(&self) -> &RendererPlanIntent {
        self.intent
    }

    pub const fn device(&self) -> &DeviceAuthorityBinding {
        self.device
    }

    pub const fn operation_versions(&self) -> &[RegisteredOperationVersion] {
        self.operation_versions
    }

    pub const fn evidence(&self) -> &[EvidenceAdmission] {
        self.evidence
    }
}

/// A revision request never mutates the existing revision; it produces a new one.
pub struct RevisePlanRequest<'a> {
    current: &'a PlanRevision,
    composition: ComposeRevisionRequest<'a>,
}

impl<'a> RevisePlanRequest<'a> {
    pub(crate) const fn from_parts(
        current: &'a PlanRevision,
        composition: ComposeRevisionRequest<'a>,
    ) -> Self {
        Self {
            current,
            composition,
        }
    }

    pub const fn current(&self) -> &PlanRevision {
        self.current
    }

    pub const fn composition(&self) -> &ComposeRevisionRequest<'a> {
        &self.composition
    }
}

/// Exact reason an approval must not authorize the current revision.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApprovalInvalidationReason {
    RevisionFingerprintChanged,
    EvidenceFingerprintChanged,
    DeviceBindingChanged,
    CompatibilityChanged,
    RiskChanged,
    OperationVersionSetChanged,
    ProofExpired,
}

/// Approval freshness is structural rather than a renderer-supplied boolean.
#[derive(Clone, Debug)]
pub enum ApprovalFreshness {
    Current,
    Invalidated(Vec<ApprovalInvalidationReason>),
}

/// Pure revision policy implemented by the behavior plans.
pub trait RevisionPolicy {
    fn compose(&self, request: ComposeRevisionRequest<'_>) -> PlanEngineResult<PlanRevision>;

    fn revise(&self, request: RevisePlanRequest<'_>) -> PlanEngineResult<PlanRevision>;

    fn approval_freshness(
        &self,
        revision: &PlanRevision,
        approval: &PlanApproval,
    ) -> ApprovalFreshness;
}

/// Read-only operation registry. Renderer input supplies identifiers only.
pub trait OperationRegistry {
    fn resolve(
        &self,
        operation_version_id: &TransactionIdentifier,
    ) -> PlanEngineResult<RegisteredOperationVersion>;
}
