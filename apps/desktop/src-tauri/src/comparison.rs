use std::collections::BTreeSet;

use liiiraa_contracts_rust::validate_hardware_evidence_document;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum EvidenceQuality {
    Valid,
    Degraded,
    Insufficient,
    Invalid,
}

impl EvidenceQuality {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Valid => "valid",
            Self::Degraded => "degraded",
            Self::Insufficient => "insufficient",
            Self::Invalid => "invalid",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetricSample {
    pub kind: String,
    pub unit: String,
    pub value: f64,
    pub quality: EvidenceQuality,
}

impl MetricSample {
    fn is_contract_metric(&self) -> bool {
        matches!(
            self.kind.as_str(),
            "frame-time-ms"
                | "cpu-utilization-percent"
                | "gpu-utilization-percent"
                | "memory-working-set-bytes"
                | "disk-latency-ms"
                | "network-latency-ms"
        ) && matches!(self.unit.as_str(), "milliseconds" | "percent" | "bytes")
            && self.value.is_finite()
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEvidence {
    pub session_id: String,
    pub evidence_hash: String,
    pub inventory_evidence_id: String,
    pub inventory_evidence_hash: String,
    pub workload_id: String,
    pub environment_id: String,
    pub methodology_id: String,
    pub duration_ms: u64,
    pub coverage_ppm: u32,
    pub source_healthy: bool,
    pub quality: EvidenceQuality,
    pub metric: Option<MetricSample>,
}

impl SessionEvidence {
    fn has_valid_identity(&self) -> bool {
        valid_identifier(&self.session_id)
            && valid_hash(&self.evidence_hash)
            && valid_identifier(&self.inventory_evidence_id)
            && valid_hash(&self.inventory_evidence_hash)
    }

    fn metric_is_valid(&self) -> bool {
        self.metric.as_ref().is_some_and(|metric| {
            metric.quality == EvidenceQuality::Valid && metric.is_contract_metric()
        })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct ComparisonRequest {
    pub comparison_id: String,
    pub before: SessionEvidence,
    pub after: SessionEvidence,
    pub compared_at: String,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum ComparisonBlocker {
    HardwareDrift,
    WorkloadDrift,
    InsufficientSamples,
    InvalidBefore,
    InvalidAfter,
    IncompatibleMetric,
    UnsupportedQuality,
}

impl ComparisonBlocker {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::HardwareDrift => "hardware-drift",
            Self::WorkloadDrift => "workload-drift",
            Self::InsufficientSamples => "insufficient-samples",
            Self::InvalidBefore => "invalid-before",
            Self::InvalidAfter => "invalid-after",
            Self::IncompatibleMetric => "incompatible-metric",
            Self::UnsupportedQuality => "unsupported-quality",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComparisonProjection {
    pub metric: String,
    pub unit: String,
    pub before: f64,
    pub after: f64,
    pub delta: f64,
    pub quality: EvidenceQuality,
    pub evidence_hash: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ComparisonDecision {
    pub document: Value,
    pub projection: Option<ComparisonProjection>,
    pub blockers: Vec<ComparisonBlocker>,
    pub before_session_id: String,
    pub before_hash: String,
    pub after_session_id: String,
    pub after_hash: String,
    pub comparison_id: String,
    pub compared_at: String,
}

impl ComparisonDecision {
    pub fn accepted(&self) -> bool {
        self.projection.is_some() && self.blockers.is_empty()
    }

    pub fn comparison_hash(&self) -> Option<&str> {
        self.projection
            .as_ref()
            .map(|projection| projection.evidence_hash.as_str())
    }
}

/// Pure all-dimensions admission. No delta exists until every blocker has
/// been collected, deduplicated, and found absent.
pub fn compare(request: &ComparisonRequest) -> ComparisonDecision {
    let mut blockers = BTreeSet::new();
    let before = &request.before;
    let after = &request.after;

    if before.inventory_evidence_id != after.inventory_evidence_id
        || before.inventory_evidence_hash != after.inventory_evidence_hash
        || before.environment_id != after.environment_id
    {
        blockers.insert(ComparisonBlocker::HardwareDrift);
    }
    if before.workload_id != after.workload_id {
        blockers.insert(ComparisonBlocker::WorkloadDrift);
    }
    if before.coverage_ppm < 950_000
        || after.coverage_ppm < 950_000
        || before.duration_ms == 0
        || after.duration_ms == 0
    {
        blockers.insert(ComparisonBlocker::InsufficientSamples);
    }
    if before.quality != EvidenceQuality::Valid || !before.has_valid_identity() {
        blockers.insert(ComparisonBlocker::InvalidBefore);
    }
    if after.quality != EvidenceQuality::Valid || !after.has_valid_identity() {
        blockers.insert(ComparisonBlocker::InvalidAfter);
    }
    if !before.source_healthy
        || !after.source_healthy
        || before.methodology_id != after.methodology_id
        || duration_drift_exceeds_budget(before.duration_ms, after.duration_ms)
    {
        blockers.insert(ComparisonBlocker::UnsupportedQuality);
    }

    let compatible_metric = match (&before.metric, &after.metric) {
        (Some(left), Some(right)) => {
            left.kind == right.kind
                && left.unit == right.unit
                && before.metric_is_valid()
                && after.metric_is_valid()
        }
        _ => false,
    };
    if !compatible_metric {
        blockers.insert(ComparisonBlocker::IncompatibleMetric);
    }

    let blockers = blockers.into_iter().collect::<Vec<_>>();
    let (document, projection) = if blockers.is_empty() && valid_identifier(&request.comparison_id)
    {
        let before_metric = before.metric.as_ref().expect("metric admitted above");
        let after_metric = after.metric.as_ref().expect("metric admitted above");
        let delta = after_metric.value - before_metric.value;
        let projection_hash = projection_hash(
            &request.comparison_id,
            &before.session_id,
            &after.session_id,
            &before_metric.kind,
            &before_metric.unit,
            before_metric.value,
            after_metric.value,
            delta,
        );
        let projection = ComparisonProjection {
            metric: before_metric.kind.clone(),
            unit: before_metric.unit.clone(),
            before: before_metric.value,
            after: after_metric.value,
            delta,
            quality: EvidenceQuality::Valid,
            evidence_hash: projection_hash,
        };
        let document = json!({
            "kind": "comparison",
            "schemaVersion": "1.0",
            "comparisonId": request.comparison_id,
            "state": "accepted",
            "beforeSessionId": before.session_id,
            "afterSessionId": after.session_id,
            "comparedAt": request.compared_at,
            "acceptedResult": projection,
        });
        (document, Some(projection))
    } else {
        let mut rejected = blockers.clone();
        if rejected.is_empty() {
            rejected.push(ComparisonBlocker::UnsupportedQuality);
        }
        let document = json!({
            "kind": "comparison",
            "schemaVersion": "1.0",
            "comparisonId": bounded_identifier(&request.comparison_id, "comparison-invalid"),
            "state": "rejected",
            "beforeSessionId": bounded_identifier(&before.session_id, "before-invalid"),
            "afterSessionId": bounded_identifier(&after.session_id, "after-invalid"),
            "comparedAt": request.compared_at,
            "blockers": rejected.iter().map(|blocker| blocker.as_str()).collect::<Vec<_>>(),
        });
        (document, None)
    };

    debug_assert!(validate_hardware_evidence_document(&document).is_ok());
    ComparisonDecision {
        document,
        projection,
        blockers,
        before_session_id: before.session_id.clone(),
        before_hash: before.evidence_hash.clone(),
        after_session_id: after.session_id.clone(),
        after_hash: after.evidence_hash.clone(),
        comparison_id: request.comparison_id.clone(),
        compared_at: request.compared_at.clone(),
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ClaimAuthorityState {
    Approved,
    Pending,
    Revoked,
    Missing,
}

#[derive(Clone, Debug, PartialEq)]
pub struct ClaimAdmissionResult {
    pub admitted: bool,
    pub history_reference: String,
    pub document: Value,
}

pub fn admit_claim(
    claim_id: &str,
    claim: &str,
    comparison: &ComparisonDecision,
    authority: ClaimAuthorityState,
    observed_at: &str,
) -> ClaimAdmissionResult {
    let admitted = comparison.accepted()
        && authority == ClaimAuthorityState::Approved
        && comparison
            .projection
            .as_ref()
            .is_some_and(|projection| projection.quality == EvidenceQuality::Valid);
    let state = if admitted { "admitted" } else { "rejected" };
    let limitation = match authority {
        ClaimAuthorityState::Approved if admitted => {
            "Válida somente para a carga e ambiente comparados."
        }
        ClaimAuthorityState::Approved => "A comparação não foi admitida.",
        ClaimAuthorityState::Pending => "A aprovação da comparação está pendente.",
        ClaimAuthorityState::Revoked => "A aprovação foi revogada; o histórico foi preservado.",
        ClaimAuthorityState::Missing => "Não existe aprovação imutável para esta comparação.",
    };
    let mut evidence_ids = vec![
        bounded_identifier(&comparison.before_session_id, "before-invalid"),
        bounded_identifier(&comparison.after_session_id, "after-invalid"),
    ];
    if valid_identifier(&comparison.comparison_id) {
        evidence_ids.push(comparison.comparison_id.clone());
    }
    evidence_ids.sort();
    evidence_ids.dedup();
    let mut evidence_hashes = vec![
        comparison.before_hash.clone(),
        comparison.after_hash.clone(),
    ];
    if let Some(hash) = comparison.comparison_hash() {
        evidence_hashes.push(hash.to_owned());
    }
    evidence_hashes.retain(|hash| valid_hash(hash));
    evidence_hashes.sort();
    evidence_hashes.dedup();
    if evidence_hashes.is_empty() {
        evidence_hashes.push(hash_bytes(b"missing-evidence"));
    }
    let document = json!({
        "kind": "claim-admission",
        "schemaVersion": "1.0",
        "claimId": bounded_identifier(claim_id, "claim-invalid"),
        "claim": bounded_text(claim, "Claim indisponível"),
        "state": state,
        "evidenceIds": evidence_ids,
        "evidenceHashes": evidence_hashes,
        "provenance": {
            "source": "Liiiraa Boost comparison authority",
            "collectedAt": observed_at,
        },
        "limitations": [limitation],
    });
    debug_assert!(validate_hardware_evidence_document(&document).is_ok());
    ClaimAdmissionResult {
        admitted,
        history_reference: comparison.comparison_id.clone(),
        document,
    }
}

fn duration_drift_exceeds_budget(before: u64, after: u64) -> bool {
    let larger = before.max(after);
    let smaller = before.min(after);
    larger == 0 || larger.saturating_sub(smaller).saturating_mul(100) > larger.saturating_mul(5)
}

fn projection_hash(
    comparison_id: &str,
    before_id: &str,
    after_id: &str,
    metric: &str,
    unit: &str,
    before: f64,
    after: f64,
    delta: f64,
) -> String {
    let canonical = format!(
        "{comparison_id}\n{before_id}\n{after_id}\n{metric}\n{unit}\n{before:.12}\n{after:.12}\n{delta:.12}"
    );
    hash_bytes(canonical.as_bytes())
}

pub(crate) fn hash_bytes(bytes: &[u8]) -> String {
    format!("sha256:{:x}", Sha256::digest(bytes))
}

pub(crate) fn canonical_json(value: &Value) -> Vec<u8> {
    fn normalize(value: &Value) -> Value {
        match value {
            Value::Object(map) => {
                let mut entries = map.iter().collect::<Vec<_>>();
                entries.sort_by(|left, right| left.0.cmp(right.0));
                Value::Object(
                    entries
                        .into_iter()
                        .map(|(key, value)| (key.clone(), normalize(value)))
                        .collect(),
                )
            }
            Value::Array(values) => Value::Array(values.iter().map(normalize).collect()),
            _ => value.clone(),
        }
    }
    serde_json::to_vec(&normalize(value)).expect("JSON values are serializable")
}

fn valid_hash(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..]
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn valid_identifier(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 128
}

fn bounded_identifier(value: &str, fallback: &str) -> String {
    let bounded = value.trim().chars().take(128).collect::<String>();
    if bounded.is_empty() {
        fallback.to_owned()
    } else {
        bounded
    }
}

fn bounded_text(value: &str, fallback: &str) -> String {
    let bounded = value.trim().chars().take(512).collect::<String>();
    if bounded.is_empty() {
        fallback.to_owned()
    } else {
        bounded
    }
}
