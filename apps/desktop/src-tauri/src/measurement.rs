use std::collections::{BTreeMap, BTreeSet};
use std::time::Instant;

use liiiraa_contracts_rust::validate_hardware_evidence_document;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::evidence_store::{EvidenceLifecycle, EvidenceStore, EvidenceStoreError, StoredEvidence};

const MIN_COUNTER_INTERVAL_NS: u64 = 1_000_000_000;
const MAX_CHUNK_VALUES: usize = 4096;
const MAX_SESSION_CHUNKS: usize = 256;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum MetricKind {
    FrameTimeMs,
    CpuUtilizationPercent,
    GpuUtilizationPercent,
    MemoryWorkingSetBytes,
    DiskLatencyMs,
    NetworkLatencyMs,
}

impl MetricKind {
    pub const ALL_COUNTERS: [Self; 5] = [
        Self::CpuUtilizationPercent,
        Self::GpuUtilizationPercent,
        Self::MemoryWorkingSetBytes,
        Self::DiskLatencyMs,
        Self::NetworkLatencyMs,
    ];

    pub const fn contract_value(self) -> &'static str {
        match self {
            Self::FrameTimeMs => "frame-time-ms",
            Self::CpuUtilizationPercent => "cpu-utilization-percent",
            Self::GpuUtilizationPercent => "gpu-utilization-percent",
            Self::MemoryWorkingSetBytes => "memory-working-set-bytes",
            Self::DiskLatencyMs => "disk-latency-ms",
            Self::NetworkLatencyMs => "network-latency-ms",
        }
    }

    pub const fn unit(self) -> &'static str {
        match self {
            Self::FrameTimeMs | Self::DiskLatencyMs | Self::NetworkLatencyMs => "milliseconds",
            Self::CpuUtilizationPercent | Self::GpuUtilizationPercent => "percent",
            Self::MemoryWorkingSetBytes => "bytes",
        }
    }

    fn value_is_admissible(self, value: f64) -> bool {
        if !value.is_finite() || value < 0.0 {
            return false;
        }
        !matches!(
            self,
            Self::CpuUtilizationPercent | Self::GpuUtilizationPercent
        ) || value <= 100.0
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SourceHealth {
    Valid,
    PermissionDenied,
    InvalidCounterStatus,
    SourceLost,
    TimedOut,
    Cancelled,
    InsufficientHistory,
}

impl SourceHealth {
    pub const fn reason(self) -> &'static str {
        match self {
            Self::Valid => "valid",
            Self::PermissionDenied => "permission-denied",
            Self::InvalidCounterStatus => "invalid-counter-status",
            Self::SourceLost => "source-lost",
            Self::TimedOut => "timed-out",
            Self::Cancelled => "cancelled",
            Self::InsufficientHistory => "insufficient-history",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameEvent {
    pub monotonic_ns: u64,
    pub frame_time_ms: f64,
    pub health: SourceHealth,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CounterObservation {
    pub monotonic_ns: u64,
    pub metric: MetricKind,
    pub value: Option<f64>,
    pub health: SourceHealth,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceTrace {
    pub schema_version: String,
    pub source: String,
    pub methodology: ReferenceMethodology,
    pub expected: ExpectedFrameAggregate,
    pub frames: Vec<FrameEvent>,
    pub counter_samples: Vec<CounterObservation>,
    pub fault_scenarios: Vec<ReferenceFault>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceMethodology {
    pub ordering: String,
    pub frame_capture: String,
    pub counter_polling: String,
    pub missing_values: String,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExpectedFrameAggregate {
    pub sample_count: usize,
    pub average_frame_time_ms: f64,
    pub average_fps: f64,
    pub one_percent_low_fps: f64,
    pub p95_frame_time_ms: f64,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReferenceFault {
    pub name: String,
    pub expected: String,
    pub numeric_admission: bool,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FrameAggregate {
    pub sample_count: usize,
    pub average_frame_time_ms: f64,
    pub average_fps: f64,
    pub one_percent_low_fps: f64,
    pub p95_frame_time_ms: f64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FrameAggregationError {
    NoReliableFrames,
    InvalidFrame,
    ClockDiscontinuity,
}

pub struct FrameAggregator;

impl FrameAggregator {
    pub fn summarize(frames: &[FrameEvent]) -> Result<FrameAggregate, FrameAggregationError> {
        if frames.is_empty() {
            return Err(FrameAggregationError::NoReliableFrames);
        }
        let mut previous = None;
        let mut values = Vec::with_capacity(frames.len());
        for frame in frames {
            if frame.health != SourceHealth::Valid
                || !frame.frame_time_ms.is_finite()
                || frame.frame_time_ms <= 0.0
            {
                return Err(FrameAggregationError::InvalidFrame);
            }
            if previous.is_some_and(|value| frame.monotonic_ns < value) {
                return Err(FrameAggregationError::ClockDiscontinuity);
            }
            previous = Some(frame.monotonic_ns);
            values.push(frame.frame_time_ms);
        }

        let sample_count = values.len();
        let average_frame_time_ms = values.iter().sum::<f64>() / sample_count as f64;
        let average_fps = 1000.0 / average_frame_time_ms;
        values.sort_by(f64::total_cmp);
        let slow_count = ((sample_count as f64 * 0.01).ceil() as usize).max(1);
        let slow_average =
            values[sample_count - slow_count..].iter().sum::<f64>() / slow_count as f64;
        let one_percent_low_fps = 1000.0 / slow_average;
        let p95_index = ((sample_count as f64 * 0.95).ceil() as usize)
            .saturating_sub(1)
            .min(sample_count - 1);

        Ok(FrameAggregate {
            sample_count,
            average_frame_time_ms,
            average_fps,
            one_percent_low_fps,
            p95_frame_time_ms: values[p95_index],
        })
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SchedulerLimits {
    pub counter_poll_interval_ns: u64,
    pub source_deadline_ms: u64,
    pub max_concurrent_sources: usize,
    pub max_buffered_samples: usize,
    pub max_gap_ns: u64,
    pub cancellation_deadline_ms: u64,
}

impl Default for SchedulerLimits {
    fn default() -> Self {
        Self {
            counter_poll_interval_ns: MIN_COUNTER_INTERVAL_NS,
            source_deadline_ms: 250,
            max_concurrent_sources: 2,
            max_buffered_samples: MAX_CHUNK_VALUES,
            max_gap_ns: 2_000_000_000,
            cancellation_deadline_ms: 250,
        }
    }
}

pub struct BoundedScheduler {
    limits: SchedulerLimits,
    last_counter_poll: BTreeMap<MetricKind, u64>,
    in_flight: BTreeSet<MetricKind>,
    accepted_frame_events: usize,
    accepted_counter_polls: usize,
    cancel_requested_at: Option<u64>,
    cancel_acknowledged_at: Option<u64>,
}

impl BoundedScheduler {
    pub fn new(mut limits: SchedulerLimits) -> Self {
        limits.counter_poll_interval_ns =
            limits.counter_poll_interval_ns.max(MIN_COUNTER_INTERVAL_NS);
        limits.source_deadline_ms = limits.source_deadline_ms.clamp(1, 60_000);
        limits.max_concurrent_sources = limits.max_concurrent_sources.clamp(1, 8);
        limits.max_buffered_samples = limits.max_buffered_samples.clamp(1, MAX_CHUNK_VALUES);
        limits.max_gap_ns = limits.max_gap_ns.max(MIN_COUNTER_INTERVAL_NS);
        limits.cancellation_deadline_ms = limits.cancellation_deadline_ms.clamp(1, 1_000);
        Self {
            limits,
            last_counter_poll: BTreeMap::new(),
            in_flight: BTreeSet::new(),
            accepted_frame_events: 0,
            accepted_counter_polls: 0,
            cancel_requested_at: None,
            cancel_acknowledged_at: None,
        }
    }

    pub fn admit_frame_event(&mut self, _monotonic_ns: u64) -> bool {
        if self.cancel_requested_at.is_some() {
            return false;
        }
        self.accepted_frame_events += 1;
        true
    }

    pub fn try_reserve_counter(&mut self, metric: MetricKind, monotonic_ns: u64) -> bool {
        if metric == MetricKind::FrameTimeMs
            || self.cancel_requested_at.is_some()
            || self.in_flight.len() >= self.limits.max_concurrent_sources
            || self.in_flight.contains(&metric)
        {
            return false;
        }
        if self.last_counter_poll.get(&metric).is_some_and(|last| {
            monotonic_ns.saturating_sub(*last) < self.limits.counter_poll_interval_ns
        }) {
            return false;
        }
        self.last_counter_poll.insert(metric, monotonic_ns);
        self.in_flight.insert(metric);
        self.accepted_counter_polls += 1;
        true
    }

    pub fn complete_counter(&mut self, metric: MetricKind) {
        self.in_flight.remove(&metric);
    }

    pub fn request_cancel(&mut self, monotonic_ns: u64) -> bool {
        if self.cancel_requested_at.is_some() {
            return false;
        }
        self.cancel_requested_at = Some(monotonic_ns);
        self.in_flight.clear();
        true
    }

    pub fn acknowledge_cancel(&mut self, monotonic_ns: u64) -> bool {
        let Some(requested_at) = self.cancel_requested_at else {
            return false;
        };
        if self.cancel_acknowledged_at.is_some() {
            return false;
        }
        self.cancel_acknowledged_at = Some(monotonic_ns.max(requested_at));
        true
    }

    pub fn cancellation_latency_ms(&self) -> Option<u64> {
        Some(
            self.cancel_acknowledged_at?
                .saturating_sub(self.cancel_requested_at?)
                / 1_000_000,
        )
    }

    pub const fn accepted_frame_events(&self) -> usize {
        self.accepted_frame_events
    }

    pub const fn accepted_counter_polls(&self) -> usize {
        self.accepted_counter_polls
    }

    pub const fn effective_counter_interval_ns(&self) -> u64 {
        self.limits.counter_poll_interval_ns
    }

    pub const fn source_deadline_ms(&self) -> u64 {
        self.limits.source_deadline_ms
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CaptureMetadata {
    pub session_id: String,
    pub evidence_version: u32,
    pub started_at: String,
    pub deadline_at: String,
    pub baseline_id: String,
    pub inventory_evidence_id: String,
    pub inventory_evidence_hash: String,
    pub collector_version: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CaptureFault {
    ClockDiscontinuity,
    SampleGap(MetricKind),
    PermissionLoss(MetricKind),
    InvalidCounterStatus(MetricKind),
    SourceLost(MetricKind),
    WorkloadTerminated,
    Backpressure,
}

#[derive(Clone, Debug, PartialEq)]
pub struct CaptureResult {
    pub document: Value,
    pub frame_aggregate: Option<FrameAggregate>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MeasurementError {
    InvalidConfiguration,
    ContractRejected,
    InvalidTransition,
    Persistence(EvidenceStoreError),
}

pub struct CaptureSession {
    metadata: CaptureMetadata,
    limits: SchedulerLimits,
    scheduler: BoundedScheduler,
    frames: Vec<FrameEvent>,
    counters: BTreeMap<MetricKind, Vec<(u64, f64)>>,
    blocked_metrics: BTreeSet<MetricKind>,
    quality_issues: BTreeSet<String>,
    invalid_reason: Option<String>,
    first_monotonic_ns: Option<u64>,
    last_monotonic_ns: Option<u64>,
    dropped_samples: usize,
}

impl CaptureSession {
    pub fn new(
        metadata: CaptureMetadata,
        limits: SchedulerLimits,
    ) -> Result<Self, MeasurementError> {
        if metadata.session_id.is_empty()
            || metadata.session_id.len() > 128
            || metadata.evidence_version == 0
            || metadata.started_at.is_empty()
            || metadata.deadline_at.is_empty()
            || metadata.baseline_id.is_empty()
            || metadata.inventory_evidence_id.is_empty()
            || !valid_hash(&metadata.inventory_evidence_hash)
            || metadata.collector_version.is_empty()
        {
            return Err(MeasurementError::InvalidConfiguration);
        }
        let scheduler = BoundedScheduler::new(limits);
        let limits = scheduler.limits;
        Ok(Self {
            metadata,
            limits,
            scheduler,
            frames: Vec::new(),
            counters: BTreeMap::new(),
            blocked_metrics: BTreeSet::new(),
            quality_issues: BTreeSet::new(),
            invalid_reason: None,
            first_monotonic_ns: None,
            last_monotonic_ns: None,
            dropped_samples: 0,
        })
    }

    pub fn ingest_frame(&mut self, frame: FrameEvent) {
        if !self.scheduler.admit_frame_event(frame.monotonic_ns) {
            return;
        }
        if !self.admit_monotonic(frame.monotonic_ns) {
            self.record_fault(CaptureFault::ClockDiscontinuity);
            return;
        }
        if frame.health != SourceHealth::Valid
            || !frame.frame_time_ms.is_finite()
            || frame.frame_time_ms <= 0.0
        {
            self.block_metric(MetricKind::FrameTimeMs, frame.health.reason());
            return;
        }
        if self.frames.len() >= self.limits.max_buffered_samples {
            self.record_fault(CaptureFault::Backpressure);
            self.dropped_samples += 1;
            return;
        }
        self.frames.push(frame);
    }

    pub fn ingest_counter(&mut self, observation: CounterObservation) {
        if self.scheduler.cancel_requested_at.is_some() {
            return;
        }
        if !self.admit_monotonic(observation.monotonic_ns) {
            self.record_fault(CaptureFault::ClockDiscontinuity);
            return;
        }
        if observation.metric == MetricKind::FrameTimeMs {
            self.block_metric(observation.metric, "counter-used-for-frame-events");
            return;
        }
        if observation.health != SourceHealth::Valid {
            self.block_metric(observation.metric, observation.health.reason());
            return;
        }
        let Some(value) = observation.value else {
            self.block_metric(observation.metric, "missing-value");
            return;
        };
        if !observation.metric.value_is_admissible(value) {
            self.block_metric(observation.metric, "invalid-value");
            return;
        }
        if self.blocked_metrics.contains(&observation.metric) {
            return;
        }
        let series = self.counters.entry(observation.metric).or_default();
        if series.len() >= self.limits.max_buffered_samples {
            self.record_fault(CaptureFault::Backpressure);
            self.dropped_samples += 1;
            return;
        }
        if series.last().is_some_and(|(last, _)| {
            observation.monotonic_ns.saturating_sub(*last) < MIN_COUNTER_INTERVAL_NS
        }) {
            self.block_metric(observation.metric, "polling-faster-than-one-hertz");
            return;
        }
        series.push((observation.monotonic_ns, value));
    }

    pub fn record_fault(&mut self, fault: CaptureFault) {
        match fault {
            CaptureFault::ClockDiscontinuity => {
                self.invalid_reason = Some("clock-discontinuity".to_owned());
            }
            CaptureFault::SampleGap(metric) => self.block_metric(metric, "sample-gap"),
            CaptureFault::PermissionLoss(metric) => self.block_metric(metric, "permission-denied"),
            CaptureFault::InvalidCounterStatus(metric) => {
                self.block_metric(metric, "invalid-counter-status")
            }
            CaptureFault::SourceLost(metric) => self.block_metric(metric, "source-lost"),
            CaptureFault::WorkloadTerminated => {
                self.quality_issues.insert("workload-terminated".to_owned());
            }
            CaptureFault::Backpressure => {
                self.quality_issues
                    .insert("backpressure-sample-loss".to_owned());
            }
        }
    }

    pub fn request_cancel(&mut self, monotonic_ns: u64) -> bool {
        self.scheduler.request_cancel(monotonic_ns)
    }

    pub fn acknowledge_cancel(&mut self, monotonic_ns: u64) -> bool {
        self.scheduler.acknowledge_cancel(monotonic_ns)
    }

    pub fn cancellation_latency_ms(&self) -> Option<u64> {
        self.scheduler.cancellation_latency_ms()
    }

    pub fn incomplete_document(&self) -> Result<Value, MeasurementError> {
        let document = json!({
            "kind": "measurement-session",
            "schemaVersion": "1.0",
            "sessionId": self.metadata.session_id,
            "evidenceVersion": self.metadata.evidence_version,
            "status": "incomplete",
            "startedAt": self.metadata.started_at,
            "execution": self.execution("healthy", "valid", "not-requested", "capture initialized"),
            "baseline": self.baseline(),
            "chunks": [],
            "reason": "capture initialized; no completed evidence admitted",
        });
        validate_document(document)
    }

    pub fn persist_incomplete(
        &self,
        store: &mut EvidenceStore,
        created_order: i64,
    ) -> Result<StoredEvidence, MeasurementError> {
        let document = self.incomplete_document()?;
        store
            .append_document(&document, EvidenceLifecycle::Incomplete, created_order)
            .map_err(MeasurementError::Persistence)
    }

    pub fn finalize(&self, completed_at: &str) -> Result<CaptureResult, MeasurementError> {
        if completed_at.is_empty() {
            return Err(MeasurementError::InvalidConfiguration);
        }
        if let Some(reason) = &self.invalid_reason {
            let document = json!({
                "kind": "measurement-session",
                "schemaVersion": "1.0",
                "sessionId": self.metadata.session_id,
                "evidenceVersion": self.metadata.evidence_version,
                "status": "invalid",
                "startedAt": self.metadata.started_at,
                "invalidatedAt": completed_at,
                "execution": self.execution("degraded", "invalid", "not-requested", reason),
                "baseline": self.baseline(),
                "reason": reason,
            });
            return Ok(CaptureResult {
                document: validate_document(document)?,
                frame_aggregate: None,
            });
        }

        if self.scheduler.cancel_requested_at.is_some() {
            let cancellation_state = if self.scheduler.cancel_acknowledged_at.is_some() {
                "acknowledged"
            } else {
                "requested"
            };
            let document = json!({
                "kind": "measurement-session",
                "schemaVersion": "1.0",
                "sessionId": self.metadata.session_id,
                "evidenceVersion": self.metadata.evidence_version,
                "status": "incomplete",
                "startedAt": self.metadata.started_at,
                "execution": self.execution("degraded", "insufficient", cancellation_state, "capture cancelled before completion"),
                "baseline": self.baseline(),
                "chunks": self.metric_chunks(completed_at)?,
                "reason": "capture cancelled before completion",
            });
            return Ok(CaptureResult {
                document: validate_document(document)?,
                frame_aggregate: None,
            });
        }

        let chunks = self.metric_chunks(completed_at)?;
        if chunks.is_empty() {
            let document = json!({
                "kind": "measurement-session",
                "schemaVersion": "1.0",
                "sessionId": self.metadata.session_id,
                "evidenceVersion": self.metadata.evidence_version,
                "status": "invalid",
                "startedAt": self.metadata.started_at,
                "invalidatedAt": completed_at,
                "execution": self.execution("unavailable", "invalid", "not-requested", "no reliable metrics admitted"),
                "baseline": self.baseline(),
                "reason": "no reliable metrics admitted",
            });
            return Ok(CaptureResult {
                document: validate_document(document)?,
                frame_aggregate: None,
            });
        }

        let frame_aggregate = if self.blocked_metrics.contains(&MetricKind::FrameTimeMs) {
            None
        } else {
            FrameAggregator::summarize(&self.frames).ok()
        };
        let limitation = format!(
            "collector={}; ordering=monotonic; frames=event-driven; counters<=1Hz",
            bounded_text(&self.metadata.collector_version)
        );
        let mut document = if self.quality_issues.is_empty() {
            json!({
                "kind": "measurement-session",
                "schemaVersion": "1.0",
                "sessionId": self.metadata.session_id,
                "evidenceVersion": self.metadata.evidence_version,
                "status": "completed",
                "startedAt": self.metadata.started_at,
                "completedAt": completed_at,
                "execution": self.execution("healthy", "valid", "not-requested", "bounded sources completed"),
                "baseline": self.baseline(),
                "chunks": chunks,
                "evidenceHash": zero_hash(),
                "limitations": [limitation],
            })
        } else {
            json!({
                "kind": "measurement-session",
                "schemaVersion": "1.0",
                "sessionId": self.metadata.session_id,
                "evidenceVersion": self.metadata.evidence_version,
                "status": "degraded",
                "startedAt": self.metadata.started_at,
                "completedAt": completed_at,
                "execution": self.execution("degraded", "degraded", "not-requested", "one or more metrics were not admitted"),
                "baseline": self.baseline(),
                "chunks": chunks,
                "evidenceHash": zero_hash(),
                "limitations": [limitation],
                "qualityIssues": self.quality_issues.iter().cloned().collect::<Vec<_>>(),
            })
        };
        document["evidenceHash"] = Value::String(hash_without_field(&document, "evidenceHash")?);
        Ok(CaptureResult {
            document: validate_document(document)?,
            frame_aggregate,
        })
    }

    pub fn persist_completed(
        &self,
        store: &mut EvidenceStore,
        result: &CaptureResult,
        completed_order: i64,
    ) -> Result<StoredEvidence, MeasurementError> {
        if result.document["status"] != "completed" {
            return Err(MeasurementError::InvalidTransition);
        }
        store
            .complete_session(&result.document, completed_order)
            .map_err(MeasurementError::Persistence)
    }

    fn admit_monotonic(&mut self, monotonic_ns: u64) -> bool {
        if self
            .last_monotonic_ns
            .is_some_and(|last| monotonic_ns < last)
        {
            return false;
        }
        if let Some(last) = self.last_monotonic_ns
            && monotonic_ns.saturating_sub(last) > self.limits.max_gap_ns
        {
            self.quality_issues.insert("sample-gap".to_owned());
        }
        self.first_monotonic_ns.get_or_insert(monotonic_ns);
        self.last_monotonic_ns = Some(monotonic_ns);
        true
    }

    fn block_metric(&mut self, metric: MetricKind, reason: &str) {
        self.blocked_metrics.insert(metric);
        // A failed source must remain non-numeric and must not be mistaken for
        // an observed metric merely because its identifier appears in the
        // durable document. The source reason is sufficient for operators;
        // the blocked metric remains an in-memory capture concern.
        self.quality_issues.insert(reason.to_owned());
        if metric == MetricKind::FrameTimeMs {
            self.frames.clear();
        } else {
            self.counters.remove(&metric);
        }
    }

    fn baseline(&self) -> Value {
        json!({
            "baselineId": self.metadata.baseline_id,
            "inventoryEvidenceId": self.metadata.inventory_evidence_id,
            "inventoryEvidenceHash": self.metadata.inventory_evidence_hash,
            "capturedAt": self.metadata.started_at,
        })
    }

    fn execution(
        &self,
        health: &str,
        quality: &str,
        cancellation_state: &str,
        detail: &str,
    ) -> Value {
        let sample_window_ms = self
            .last_monotonic_ns
            .unwrap_or_default()
            .saturating_sub(self.first_monotonic_ns.unwrap_or_default())
            .div_ceil(1_000_000)
            .clamp(1, 60_000);
        json!({
            "sourceCapability": "native-performance-counter",
            "deadlineAt": self.metadata.deadline_at,
            "cancellationState": cancellation_state,
            "health": {
                "state": health,
                "checkedAt": self.metadata.started_at,
                "detail": bounded_text(detail),
            },
            "overhead": {
                "sampleWindowMs": sample_window_ms,
                "cpuTimeMs": 0,
                "peakWorkingSetBytes": "0",
                "quality": quality,
            }
        })
    }

    fn metric_chunks(&self, completed_at: &str) -> Result<Vec<Value>, MeasurementError> {
        let mut series = BTreeMap::<MetricKind, Vec<f64>>::new();
        if !self.frames.is_empty() && !self.blocked_metrics.contains(&MetricKind::FrameTimeMs) {
            series.insert(
                MetricKind::FrameTimeMs,
                self.frames
                    .iter()
                    .map(|frame| frame.frame_time_ms)
                    .collect(),
            );
        }
        for (metric, samples) in &self.counters {
            if !self.blocked_metrics.contains(metric) && !samples.is_empty() {
                series.insert(*metric, samples.iter().map(|(_, value)| *value).collect());
            }
        }
        if series.len() > MAX_SESSION_CHUNKS {
            return Err(MeasurementError::ContractRejected);
        }

        series
            .into_iter()
            .enumerate()
            .map(|(sequence, (metric, values))| {
                let mut chunk = json!({
                    "chunkId": format!("{}-chunk-{sequence}", self.metadata.session_id),
                    "sequence": sequence,
                    "startedAt": self.metadata.started_at,
                    "endedAt": completed_at,
                    "metric": metric.contract_value(),
                    "unit": metric.unit(),
                    "values": values,
                    "evidenceHash": zero_hash(),
                    "quality": "valid",
                });
                chunk["evidenceHash"] = Value::String(hash_without_field(&chunk, "evidenceHash")?);
                Ok(chunk)
            })
            .collect()
    }
}

fn validate_document(document: Value) -> Result<Value, MeasurementError> {
    validate_hardware_evidence_document(&document)
        .map_err(|_| MeasurementError::ContractRejected)?;
    Ok(document)
}

fn valid_hash(value: &str) -> bool {
    value.len() == 71
        && value.starts_with("sha256:")
        && value[7..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn zero_hash() -> String {
    format!("sha256:{}", "0".repeat(64))
}

fn hash_without_field(document: &Value, field: &str) -> Result<String, MeasurementError> {
    let mut hashable = document.clone();
    hashable
        .as_object_mut()
        .ok_or(MeasurementError::ContractRejected)?
        .remove(field);
    let bytes = serde_json::to_vec(&hashable).map_err(|_| MeasurementError::ContractRejected)?;
    Ok(format!("sha256:{}", hex_lower(&Sha256::digest(bytes))))
}

fn hex_lower(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut output = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        output.push(HEX[(byte >> 4) as usize] as char);
        output.push(HEX[(byte & 0x0f) as usize] as char);
    }
    output
}

fn bounded_text(value: &str) -> String {
    let value: String = value.trim().chars().take(512).collect();
    if value.is_empty() {
        "measurement detail unavailable".to_owned()
    } else {
        value
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SourceDeadline {
    pub expires_at_ns: u64,
}

#[derive(Clone, Debug, PartialEq)]
pub struct SourceBatch<T> {
    pub items: Vec<T>,
    pub health: SourceHealth,
    pub completed_at_ns: u64,
}

pub trait FrameEventSource {
    fn drain_until(&mut self, deadline: SourceDeadline) -> SourceBatch<FrameEvent>;
}

pub trait CounterSource {
    fn poll(
        &mut self,
        metric: MetricKind,
        now_ns: u64,
        deadline: SourceDeadline,
    ) -> CounterObservation;
}

pub trait MonotonicClock {
    fn now_ns(&self) -> u64;
}

/// Portable fallback used by tests and non-Windows builds. On Windows the
/// standard library's `Instant` is backed by the platform performance counter.
pub struct SystemMonotonicClock {
    origin: Instant,
}

impl Default for SystemMonotonicClock {
    fn default() -> Self {
        Self {
            origin: Instant::now(),
        }
    }
}

impl MonotonicClock for SystemMonotonicClock {
    fn now_ns(&self) -> u64 {
        self.origin.elapsed().as_nanos().min(u64::MAX as u128) as u64
    }
}

/// Explicit unavailable frame source. It prevents unsupported workloads from
/// receiving synthetic FPS while preserving the event-source contract for an
/// ETW/PresentMon-compatible adapter.
pub struct UnsupportedFrameEventSource;

impl FrameEventSource for UnsupportedFrameEventSource {
    fn drain_until(&mut self, deadline: SourceDeadline) -> SourceBatch<FrameEvent> {
        SourceBatch {
            items: Vec::new(),
            health: SourceHealth::SourceLost,
            completed_at_ns: deadline.expires_at_ns,
        }
    }
}

#[cfg(target_os = "windows")]
mod windows_sources {
    use std::mem::size_of;

    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::System::Performance::{QueryPerformanceCounter, QueryPerformanceFrequency};
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};
    use windows::Win32::System::Threading::GetSystemTimes;

    use super::*;

    /// Native QPC clock. All capture timestamps share this origin so wall-clock
    /// adjustments cannot reorder samples or manufacture negative durations.
    pub struct WindowsQpcClock {
        origin_ticks: i64,
        frequency: i64,
    }

    impl WindowsQpcClock {
        pub fn new() -> Result<Self, MeasurementError> {
            let mut frequency = 0_i64;
            let mut origin_ticks = 0_i64;
            unsafe {
                QueryPerformanceFrequency(&mut frequency)
                    .map_err(|_| MeasurementError::InvalidConfiguration)?;
                QueryPerformanceCounter(&mut origin_ticks)
                    .map_err(|_| MeasurementError::InvalidConfiguration)?;
            }
            if frequency <= 0 {
                return Err(MeasurementError::InvalidConfiguration);
            }
            Ok(Self {
                origin_ticks,
                frequency,
            })
        }
    }

    impl MonotonicClock for WindowsQpcClock {
        fn now_ns(&self) -> u64 {
            let mut current = self.origin_ticks;
            if unsafe { QueryPerformanceCounter(&mut current) }.is_err() {
                return 0;
            }
            let elapsed = current.saturating_sub(self.origin_ticks).max(0) as u128;
            elapsed
                .saturating_mul(1_000_000_000)
                .checked_div(self.frequency as u128)
                .unwrap_or(0)
                .min(u64::MAX as u128) as u64
        }
    }

    #[derive(Clone, Copy, Debug)]
    struct CpuTimes {
        idle: u64,
        kernel: u64,
        user: u64,
    }

    #[derive(Default)]
    pub struct WindowsSystemCounterSource {
        previous_cpu: Option<CpuTimes>,
    }

    impl CounterSource for WindowsSystemCounterSource {
        fn poll(
            &mut self,
            metric: MetricKind,
            now_ns: u64,
            deadline: SourceDeadline,
        ) -> CounterObservation {
            if now_ns > deadline.expires_at_ns {
                return observation(metric, now_ns, None, SourceHealth::TimedOut);
            }
            match metric {
                MetricKind::CpuUtilizationPercent => {
                    let current = match read_cpu_times() {
                        Some(times) => times,
                        None => {
                            return observation(
                                metric,
                                now_ns,
                                None,
                                SourceHealth::InvalidCounterStatus,
                            );
                        }
                    };
                    let previous = self.previous_cpu.replace(current);
                    let Some(previous) = previous else {
                        return observation(
                            metric,
                            now_ns,
                            None,
                            SourceHealth::InsufficientHistory,
                        );
                    };
                    let idle = current.idle.saturating_sub(previous.idle);
                    let kernel = current.kernel.saturating_sub(previous.kernel);
                    let user = current.user.saturating_sub(previous.user);
                    let total = kernel.saturating_add(user);
                    if total == 0 || idle > total {
                        return observation(
                            metric,
                            now_ns,
                            None,
                            SourceHealth::InvalidCounterStatus,
                        );
                    }
                    let busy = total.saturating_sub(idle);
                    observation(
                        metric,
                        now_ns,
                        Some((busy as f64 / total as f64) * 100.0),
                        SourceHealth::Valid,
                    )
                }
                MetricKind::MemoryWorkingSetBytes => {
                    let mut memory = MEMORYSTATUSEX {
                        dwLength: size_of::<MEMORYSTATUSEX>() as u32,
                        ..Default::default()
                    };
                    if unsafe { GlobalMemoryStatusEx(&mut memory) }.is_err() {
                        return observation(metric, now_ns, None, SourceHealth::SourceLost);
                    }
                    let used = memory.ullTotalPhys.saturating_sub(memory.ullAvailPhys) as f64;
                    observation(metric, now_ns, Some(used), SourceHealth::Valid)
                }
                _ => observation(metric, now_ns, None, SourceHealth::SourceLost),
            }
        }
    }

    fn read_cpu_times() -> Option<CpuTimes> {
        let mut idle = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();
        unsafe {
            GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)).ok()?;
        }
        Some(CpuTimes {
            idle: filetime_ticks(idle),
            kernel: filetime_ticks(kernel),
            user: filetime_ticks(user),
        })
    }

    fn filetime_ticks(value: FILETIME) -> u64 {
        ((value.dwHighDateTime as u64) << 32) | value.dwLowDateTime as u64
    }

    fn observation(
        metric: MetricKind,
        monotonic_ns: u64,
        value: Option<f64>,
        health: SourceHealth,
    ) -> CounterObservation {
        CounterObservation {
            monotonic_ns,
            metric,
            value,
            health,
        }
    }
}

#[cfg(target_os = "windows")]
#[allow(unused_imports)]
pub use windows_sources::{WindowsQpcClock, WindowsSystemCounterSource};
