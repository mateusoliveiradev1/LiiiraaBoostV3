//! Immutable plan revisions and approval-fingerprint interfaces.

use std::collections::{BTreeMap, BTreeSet};

use liiiraa_contracts_rust::{
    CompatibilityVerdict, DependencyGroup, DeviceAuthorityBinding, EvidenceQuality,
    EvidenceReference, PlanApprovalDocument, PlanOperation, RiskClass, TransactionHash,
    TransactionIdentifier, TransactionalPlanDocument,
};
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::domain::{
    GeneratedTransport, PlanEngineError, PlanEngineErrorCode, PlanEngineResult, RendererPlanIntent,
};
use crate::risk::EvidenceAdmission;

/// Native evidence disposition for one registered operation version.
///
/// Only `Admitted` can participate in composition. Every uncertain or revoked
/// state remains structurally distinct so it cannot silently become compatible.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RevisionEvidenceDisposition {
    Admitted,
    Unknown,
    Degraded,
    Contradictory,
    Incompatible,
    Revoked,
}

/// Immutable Phase 5 evidence authority bound to one operation version.
#[derive(Clone, Debug)]
pub struct RevisionEvidence {
    operation_version_id: TransactionIdentifier,
    references: Vec<EvidenceReference>,
    disposition: RevisionEvidenceDisposition,
}

impl RevisionEvidence {
    pub fn new(
        operation_version_id: TransactionIdentifier,
        references: Vec<EvidenceReference>,
        disposition: RevisionEvidenceDisposition,
    ) -> Self {
        Self {
            operation_version_id,
            references,
            disposition,
        }
    }

    pub const fn operation_version_id(&self) -> &TransactionIdentifier {
        &self.operation_version_id
    }

    pub fn references(&self) -> &[EvidenceReference] {
        &self.references
    }

    pub const fn disposition(&self) -> RevisionEvidenceDisposition {
        self.disposition
    }
}

/// Immutable native registry snapshot used for one composition decision.
#[derive(Clone, Debug)]
pub struct CanonicalOperationRegistry {
    operations: Vec<PlanOperation>,
    dependency_groups: Vec<DependencyGroup>,
}

impl CanonicalOperationRegistry {
    pub fn new(operations: Vec<PlanOperation>, dependency_groups: Vec<DependencyGroup>) -> Self {
        Self {
            operations,
            dependency_groups,
        }
    }

    pub fn operations(&self) -> &[PlanOperation] {
        &self.operations
    }

    pub fn dependency_groups(&self) -> &[DependencyGroup] {
        &self.dependency_groups
    }
}

/// Complete immutable authority supplied to deterministic plan composition.
pub struct RevisionComposition<'a> {
    intent: &'a RendererPlanIntent,
    device: &'a DeviceAuthorityBinding,
    registry: &'a CanonicalOperationRegistry,
    evidence: &'a [RevisionEvidence],
}

impl<'a> RevisionComposition<'a> {
    pub const fn new(
        intent: &'a RendererPlanIntent,
        device: &'a DeviceAuthorityBinding,
        registry: &'a CanonicalOperationRegistry,
        evidence: &'a [RevisionEvidence],
    ) -> Self {
        Self {
            intent,
            device,
            registry,
            evidence,
        }
    }
}

/// Append-only in-memory lineage. No revision can be replaced in place.
#[derive(Clone, Debug)]
pub struct PlanRevisionHistory {
    revisions: Vec<PlanRevision>,
}

impl PlanRevisionHistory {
    pub fn revisions(&self) -> &[PlanRevision] {
        &self.revisions
    }

    pub fn current(&self) -> &PlanRevision {
        self.revisions
            .last()
            .expect("a revision history is never empty")
    }
}

/// Pure deterministic composer for immutable personalized plan revisions.
#[derive(Clone, Copy, Debug, Default)]
pub struct DeterministicRevisionComposer;

impl DeterministicRevisionComposer {
    pub fn compose(
        &self,
        composition: RevisionComposition<'_>,
    ) -> PlanEngineResult<PlanRevisionHistory> {
        let selected = canonical_selected_ids(composition.intent)?;
        let plan_id = deterministic_plan_id(composition.device, &selected)?;
        let revision = compose_document(composition, plan_id, 1)?;
        Ok(PlanRevisionHistory {
            revisions: vec![revision],
        })
    }

    pub fn revise(
        &self,
        history: &PlanRevisionHistory,
        composition: RevisionComposition<'_>,
    ) -> PlanEngineResult<PlanRevisionHistory> {
        let current = history.current().transport();
        let next_revision = current
            .revision
            .get()
            .checked_add(1)
            .ok_or_else(|| error(PlanEngineErrorCode::InvalidGeneratedTransport, None))?;
        let revision = compose_document(composition, current.plan_id.clone(), next_revision)?;
        let mut revisions = history.revisions.clone();
        revisions.push(revision);
        Ok(PlanRevisionHistory { revisions })
    }
}

fn compose_document(
    composition: RevisionComposition<'_>,
    plan_id: TransactionIdentifier,
    revision: u64,
) -> PlanEngineResult<PlanRevision> {
    validate_registry(composition.registry)?;
    let selected = canonical_selected_ids(composition.intent)?;
    let operations_by_id: BTreeMap<_, _> = composition
        .registry
        .operations
        .iter()
        .map(|operation| (operation.operation_version_id.as_str(), operation))
        .collect();
    let evidence_by_id = evidence_by_operation(composition.evidence)?;

    let mut selected_operations = BTreeMap::new();
    let mut selected_groups = BTreeSet::new();
    for operation_id in &selected {
        let operation = operations_by_id.get(operation_id.as_str()).ok_or_else(|| {
            error(
                PlanEngineErrorCode::UnknownOperationVersion,
                Some(operation_id.clone()),
            )
        })?;
        validate_operation_authority(
            operation,
            evidence_by_id.get(operation_id.as_str()).copied(),
        )?;
        validate_risk(operation, composition.intent.risk_ceiling())?;
        selected_groups.insert(operation.dependency_group_id.as_str());
        selected_operations.insert(operation_id.as_str(), (*operation).clone());
    }

    let ordered_groups = ordered_selected_groups(composition.registry, &selected_groups)?;
    let mut operations = Vec::with_capacity(selected_operations.len());
    let mut dependency_groups = Vec::with_capacity(ordered_groups.len());
    for group in ordered_groups {
        let mut operation_ids: Vec<_> = group
            .operation_version_ids
            .iter()
            .filter(|id| selected_operations.contains_key(id.as_str()))
            .cloned()
            .collect();
        operation_ids.sort_by(|left, right| left.as_str().cmp(right.as_str()));
        for operation_id in &operation_ids {
            operations.push(
                selected_operations
                    .get(operation_id.as_str())
                    .expect("validated selected operation")
                    .clone(),
            );
        }
        let mut dependencies = group.depends_on_group_ids.clone();
        dependencies.sort_by(|left, right| left.as_str().cmp(right.as_str()));
        dependency_groups.push(DependencyGroup {
            dependency_group_id: group.dependency_group_id.clone(),
            depends_on_group_ids: dependencies,
            operation_version_ids: operation_ids,
        });
    }

    let evidence_fingerprint =
        fingerprint(&canonical_evidence_value(composition.device, &operations)?)?;
    let created_at = operations
        .iter()
        .flat_map(|operation| operation.evidence.iter())
        .map(|reference| reference.captured_at.as_str())
        .max()
        .ok_or_else(|| error(PlanEngineErrorCode::EvidenceNotAdmitted, None))?;
    let effective_risk = operations
        .iter()
        .map(|operation| operation.risk)
        .max_by_key(|risk| risk_rank(*risk))
        .ok_or_else(|| error(PlanEngineErrorCode::InvalidGeneratedTransport, None))?;

    let mut document = json!({
        "kind": "transactional-plan",
        "schemaVersion": "1.0",
        "planId": plan_id,
        "revision": revision,
        "revisionFingerprint": zero_hash(),
        "evidenceFingerprint": evidence_fingerprint,
        "device": composition.device,
        "lifecycle": "composed",
        "riskCeiling": generated_ceiling(composition.intent.risk_ceiling()),
        "effectiveRisk": effective_risk,
        "createdAt": created_at,
        "operations": operations,
        "dependencyGroups": dependency_groups,
    });
    let revision_fingerprint = fingerprint(&document)?;
    document["revisionFingerprint"] = Value::String(revision_fingerprint.to_string());
    let transport = serde_json::from_value(document)
        .map_err(|_| error(PlanEngineErrorCode::InvalidGeneratedTransport, None))?;
    Ok(PlanRevision::from_transport(transport))
}

fn canonical_selected_ids(
    intent: &RendererPlanIntent,
) -> PlanEngineResult<Vec<TransactionIdentifier>> {
    if intent.operation_version_ids().is_empty() || intent.operation_version_ids().len() > 64 {
        return Err(error(PlanEngineErrorCode::InvalidGeneratedTransport, None));
    }
    let mut selected = intent.operation_version_ids().to_vec();
    selected.sort_by(|left, right| left.as_str().cmp(right.as_str()));
    if selected
        .windows(2)
        .any(|window| window[0].as_str() == window[1].as_str())
    {
        return Err(error(PlanEngineErrorCode::InvalidGeneratedTransport, None));
    }
    Ok(selected)
}

fn deterministic_plan_id(
    device: &DeviceAuthorityBinding,
    selected: &[TransactionIdentifier],
) -> PlanEngineResult<TransactionIdentifier> {
    let digest = fingerprint(&json!({
        "device": device,
        "selectedOperationVersionIds": selected,
    }))?;
    format!("plan-{}", digest.as_str().trim_start_matches("sha256:"))
        .parse()
        .map_err(|_| error(PlanEngineErrorCode::InvalidGeneratedTransport, None))
}

fn validate_registry(registry: &CanonicalOperationRegistry) -> PlanEngineResult<()> {
    if registry.operations.is_empty()
        || registry.operations.len() > 64
        || registry.dependency_groups.is_empty()
        || registry.dependency_groups.len() > 32
    {
        return Err(error(PlanEngineErrorCode::InvalidGeneratedTransport, None));
    }

    let mut operation_ids = BTreeSet::new();
    for operation in &registry.operations {
        if !operation_ids.insert(operation.operation_version_id.as_str()) {
            return Err(error(
                PlanEngineErrorCode::InvalidGeneratedTransport,
                Some(operation.operation_version_id.clone()),
            ));
        }
    }

    let mut groups = BTreeMap::new();
    for group in &registry.dependency_groups {
        if group.operation_version_ids.is_empty()
            || group.operation_version_ids.len() > 64
            || !groups
                .insert(group.dependency_group_id.as_str(), group)
                .is_none()
        {
            return Err(error(
                PlanEngineErrorCode::DependencyGraphInvalid,
                Some(group.dependency_group_id.clone()),
            ));
        }
        let mut members = BTreeSet::new();
        for operation_id in &group.operation_version_ids {
            if !members.insert(operation_id.as_str()) {
                return Err(error(
                    PlanEngineErrorCode::DependencyGraphInvalid,
                    Some(operation_id.clone()),
                ));
            }
            let operation = registry
                .operations
                .iter()
                .find(|operation| operation.operation_version_id == *operation_id)
                .ok_or_else(|| {
                    error(
                        PlanEngineErrorCode::DependencyGraphInvalid,
                        Some(operation_id.clone()),
                    )
                })?;
            if operation.dependency_group_id != group.dependency_group_id {
                return Err(error(
                    PlanEngineErrorCode::DependencyGraphInvalid,
                    Some(operation_id.clone()),
                ));
            }
        }
    }

    for operation in &registry.operations {
        let membership_count = registry
            .dependency_groups
            .iter()
            .filter(|group| {
                group
                    .operation_version_ids
                    .iter()
                    .any(|id| id == &operation.operation_version_id)
            })
            .count();
        if membership_count != 1 {
            return Err(error(
                PlanEngineErrorCode::DependencyGraphInvalid,
                Some(operation.operation_version_id.clone()),
            ));
        }
    }

    topological_groups(&registry.dependency_groups).map(|_| ())
}

fn evidence_by_operation<'a>(
    evidence: &'a [RevisionEvidence],
) -> PlanEngineResult<BTreeMap<&'a str, &'a RevisionEvidence>> {
    let mut by_operation = BTreeMap::new();
    for authority in evidence {
        if by_operation
            .insert(authority.operation_version_id.as_str(), authority)
            .is_some()
        {
            return Err(error(
                PlanEngineErrorCode::EvidenceNotAdmitted,
                Some(authority.operation_version_id.clone()),
            ));
        }
    }
    Ok(by_operation)
}

fn validate_operation_authority(
    operation: &PlanOperation,
    authority: Option<&RevisionEvidence>,
) -> PlanEngineResult<()> {
    let authority = authority.ok_or_else(|| {
        error(
            PlanEngineErrorCode::EvidenceNotAdmitted,
            Some(operation.operation_version_id.clone()),
        )
    })?;
    if authority.disposition != RevisionEvidenceDisposition::Admitted
        || operation.compatibility.verdict != CompatibilityVerdict::Compatible
        || operation.evidence.is_empty()
        || operation.evidence.len() > 16
        || operation
            .evidence
            .iter()
            .any(|reference| reference.quality != EvidenceQuality::Valid)
        || canonical_serialized(&operation.evidence)?
            != canonical_serialized(&authority.references)?
    {
        return Err(error(
            PlanEngineErrorCode::EvidenceNotAdmitted,
            Some(operation.operation_version_id.clone()),
        ));
    }
    Ok(())
}

fn validate_risk(
    operation: &PlanOperation,
    ceiling: crate::risk::RiskCeiling,
) -> PlanEngineResult<()> {
    if operation.risk == RiskClass::ExtremeLocked {
        return Err(error(
            PlanEngineErrorCode::ExtremeLocked,
            Some(operation.operation_version_id.clone()),
        ));
    }
    if risk_rank(operation.risk) > ceiling_rank(ceiling) {
        return Err(error(
            PlanEngineErrorCode::RiskCeilingExceeded,
            Some(operation.operation_version_id.clone()),
        ));
    }
    Ok(())
}

fn ordered_selected_groups<'a>(
    registry: &'a CanonicalOperationRegistry,
    selected: &BTreeSet<&str>,
) -> PlanEngineResult<Vec<&'a DependencyGroup>> {
    let ordered = topological_groups(&registry.dependency_groups)?;
    for group in ordered
        .iter()
        .filter(|group| selected.contains(group.dependency_group_id.as_str()))
    {
        if group
            .depends_on_group_ids
            .iter()
            .any(|dependency| !selected.contains(dependency.as_str()))
        {
            return Err(error(
                PlanEngineErrorCode::DependencyGraphInvalid,
                Some(group.dependency_group_id.clone()),
            ));
        }
    }
    Ok(ordered
        .into_iter()
        .filter(|group| selected.contains(group.dependency_group_id.as_str()))
        .collect())
}

fn topological_groups(groups: &[DependencyGroup]) -> PlanEngineResult<Vec<&DependencyGroup>> {
    let by_id: BTreeMap<_, _> = groups
        .iter()
        .map(|group| (group.dependency_group_id.as_str(), group))
        .collect();
    let mut remaining: BTreeMap<_, BTreeSet<_>> = groups
        .iter()
        .map(|group| {
            (
                group.dependency_group_id.as_str(),
                group
                    .depends_on_group_ids
                    .iter()
                    .map(|dependency| dependency.as_str())
                    .collect(),
            )
        })
        .collect();
    if remaining
        .values()
        .flatten()
        .any(|dependency| !by_id.contains_key(dependency))
    {
        return Err(error(PlanEngineErrorCode::DependencyGraphInvalid, None));
    }

    let mut ordered = Vec::with_capacity(groups.len());
    while !remaining.is_empty() {
        let ready: Vec<_> = remaining
            .iter()
            .filter_map(|(id, dependencies)| dependencies.is_empty().then_some(*id))
            .collect();
        if ready.is_empty() {
            return Err(error(PlanEngineErrorCode::DependencyGraphInvalid, None));
        }
        for id in ready {
            remaining.remove(id);
            for dependencies in remaining.values_mut() {
                dependencies.remove(id);
            }
            ordered.push(*by_id.get(id).expect("topological id came from registry"));
        }
    }
    Ok(ordered)
}

fn canonical_evidence_value(
    device: &DeviceAuthorityBinding,
    operations: &[PlanOperation],
) -> PlanEngineResult<Value> {
    let mut evidence: Vec<_> = operations
        .iter()
        .flat_map(|operation| {
            operation.evidence.iter().map(|reference| {
                json!({
                    "operationVersionId": operation.operation_version_id,
                    "reference": reference,
                })
            })
        })
        .collect();
    evidence.sort_by_key(canonical_value_bytes);
    Ok(json!({
        "deviceBindingId": device.device_binding_id,
        "hardwareFingerprint": device.hardware_fingerprint,
        "securityPostureFingerprint": device.security_posture_fingerprint,
        "evidence": evidence,
    }))
}

fn canonical_serialized<T: Serialize>(value: &T) -> PlanEngineResult<Vec<u8>> {
    let value = serde_json::to_value(value)
        .map_err(|_| error(PlanEngineErrorCode::InvalidGeneratedTransport, None))?;
    Ok(canonical_value_bytes(&value))
}

fn canonical_value_bytes(value: &Value) -> Vec<u8> {
    match value {
        Value::Array(items) => {
            let mut canonical_items: Vec<_> = items.iter().map(canonical_value).collect();
            canonical_items.sort_by_key(canonical_value_bytes);
            serde_json::to_vec(&canonical_items).expect("JSON value serialization is infallible")
        }
        _ => serde_json::to_vec(&canonical_value(value))
            .expect("JSON value serialization is infallible"),
    }
}

fn canonical_value(value: &Value) -> Value {
    match value {
        Value::Object(object) => Value::Object(
            object
                .iter()
                .map(|(key, value)| (key.clone(), canonical_value(value)))
                .collect(),
        ),
        Value::Array(items) => {
            let mut items: Vec<_> = items.iter().map(canonical_value).collect();
            items.sort_by_key(canonical_value_bytes);
            Value::Array(items)
        }
        scalar => scalar.clone(),
    }
}

fn fingerprint(value: &Value) -> PlanEngineResult<TransactionHash> {
    let digest = Sha256::digest(canonical_value_bytes(value));
    let hexadecimal: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("sha256:{hexadecimal}")
        .parse()
        .map_err(|_| error(PlanEngineErrorCode::InvalidGeneratedTransport, None))
}

fn zero_hash() -> String {
    format!("sha256:{}", "0".repeat(64))
}

const fn risk_rank(risk: RiskClass) -> u8 {
    match risk {
        RiskClass::Verified => 0,
        RiskClass::Advanced => 1,
        RiskClass::Experimental => 2,
        RiskClass::ExtremeLocked => 3,
    }
}

const fn ceiling_rank(ceiling: crate::risk::RiskCeiling) -> u8 {
    match ceiling {
        crate::risk::RiskCeiling::Verified => 0,
        crate::risk::RiskCeiling::Advanced => 1,
        crate::risk::RiskCeiling::Experimental => 2,
    }
}

const fn generated_ceiling(ceiling: crate::risk::RiskCeiling) -> RiskClass {
    match ceiling {
        crate::risk::RiskCeiling::Verified => RiskClass::Verified,
        crate::risk::RiskCeiling::Advanced => RiskClass::Advanced,
        crate::risk::RiskCeiling::Experimental => RiskClass::Experimental,
    }
}

fn error(code: PlanEngineErrorCode, subject_id: Option<TransactionIdentifier>) -> PlanEngineError {
    PlanEngineError::new(code, subject_id)
}

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
