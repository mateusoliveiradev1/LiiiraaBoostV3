use std::mem::size_of;
use std::time::Instant;

use serde::Serialize;

use crate::measurement::{CounterObservation, MetricKind, SourceHealth};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct CpuTimes {
    idle: u64,
    kernel: u64,
    user: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScalarMetric {
    state: &'static str,
    value: Option<f64>,
    unit: &'static str,
    source: &'static str,
    detail: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason_code: Option<&'static str>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemoryMetric {
    state: &'static str,
    used_bytes: Option<u64>,
    total_bytes: Option<u64>,
    load_percent: Option<f64>,
    source: &'static str,
    detail: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    reason_code: Option<&'static str>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveTelemetrySnapshot {
    schema_version: &'static str,
    read_only: bool,
    pub cpu: ScalarMetric,
    pub memory: MemoryMetric,
    pub gpu: ScalarMetric,
    collection_latency: ScalarMetric,
}

pub struct LiveTelemetryReading {
    pub snapshot: LiveTelemetrySnapshot,
    pub observations: Vec<CounterObservation>,
}

pub struct LiveTelemetrySampler {
    started_at: Instant,
    previous_cpu: Option<CpuTimes>,
}

impl Default for LiveTelemetrySampler {
    fn default() -> Self {
        Self {
            started_at: Instant::now(),
            previous_cpu: None,
        }
    }
}

impl LiveTelemetrySampler {
    pub fn sample(&mut self) -> LiveTelemetryReading {
        let collection_started = Instant::now();
        let monotonic_ns = self
            .started_at
            .elapsed()
            .as_nanos()
            .min(u128::from(u64::MAX)) as u64;
        let current_cpu = read_cpu_times();
        let cpu = match (self.previous_cpu, current_cpu) {
            (Some(previous), Some(current)) => match calculate_cpu_percent(previous, current) {
                Some(value) => observed_scalar(
                    round(value, 1),
                    "percent",
                    "windows-get-system-times",
                    "Total processor utilization measured by Windows.",
                ),
                None => unavailable_scalar(
                    "percent",
                    "windows-get-system-times",
                    "Windows did not provide a usable processor interval.",
                    "insufficient-history",
                    "warming-up",
                ),
            },
            (None, Some(_)) => unavailable_scalar(
                "percent",
                "windows-get-system-times",
                "A second Windows sample is required before utilization can be calculated.",
                "insufficient-history",
                "warming-up",
            ),
            (_, None) => unavailable_scalar(
                "percent",
                "windows-get-system-times",
                "Windows did not expose processor timing counters.",
                "source-unavailable",
                "unavailable",
            ),
        };
        if current_cpu.is_some() {
            self.previous_cpu = current_cpu;
        }

        let memory = read_memory_metric();
        let gpu = unavailable_scalar(
            "percent",
            "none",
            "No trustworthy native GPU utilization counter is admitted in this build.",
            "source-not-admitted",
            "unavailable",
        );

        let mut observations = Vec::with_capacity(2);
        if let Some(value) = cpu.value {
            observations.push(CounterObservation {
                monotonic_ns,
                metric: MetricKind::CpuUtilizationPercent,
                value: Some(value),
                health: SourceHealth::Valid,
            });
        }
        if let Some(value) = memory.used_bytes {
            observations.push(CounterObservation {
                monotonic_ns,
                metric: MetricKind::MemoryWorkingSetBytes,
                value: Some(value as f64),
                health: SourceHealth::Valid,
            });
        }

        let collection_latency = observed_scalar(
            round(collection_started.elapsed().as_secs_f64() * 1_000.0, 3),
            "milliseconds",
            "native-monotonic-clock",
            "Time spent collecting this read-only local snapshot.",
        );

        LiveTelemetryReading {
            snapshot: LiveTelemetrySnapshot {
                schema_version: "1.0",
                read_only: true,
                cpu,
                memory,
                gpu,
                collection_latency,
            },
            observations,
        }
    }
}

fn observed_scalar(
    value: f64,
    unit: &'static str,
    source: &'static str,
    detail: &'static str,
) -> ScalarMetric {
    ScalarMetric {
        state: "observed",
        value: Some(value),
        unit,
        source,
        detail,
        reason_code: None,
    }
}

fn unavailable_scalar(
    unit: &'static str,
    source: &'static str,
    detail: &'static str,
    reason_code: &'static str,
    state: &'static str,
) -> ScalarMetric {
    ScalarMetric {
        state,
        value: None,
        unit,
        source,
        detail,
        reason_code: Some(reason_code),
    }
}

fn round(value: f64, decimal_places: i32) -> f64 {
    let factor = 10_f64.powi(decimal_places);
    (value * factor).round() / factor
}

fn calculate_cpu_percent(previous: CpuTimes, current: CpuTimes) -> Option<f64> {
    let idle = current.idle.checked_sub(previous.idle)?;
    let kernel = current.kernel.checked_sub(previous.kernel)?;
    let user = current.user.checked_sub(previous.user)?;
    let total = kernel.checked_add(user)?;
    if total == 0 || idle > total {
        return None;
    }
    Some(((total - idle) as f64 / total as f64) * 100.0)
}

#[cfg(windows)]
fn filetime_value(value: windows::Win32::Foundation::FILETIME) -> u64 {
    (u64::from(value.dwHighDateTime) << 32) | u64::from(value.dwLowDateTime)
}

#[cfg(windows)]
fn read_cpu_times() -> Option<CpuTimes> {
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::System::Threading::GetSystemTimes;

    let mut idle = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    // SAFETY: Windows writes three initialized FILETIME values to valid local pointers.
    unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)) }.ok()?;
    Some(CpuTimes {
        idle: filetime_value(idle),
        kernel: filetime_value(kernel),
        user: filetime_value(user),
    })
}

#[cfg(not(windows))]
fn read_cpu_times() -> Option<CpuTimes> {
    None
}

#[cfg(windows)]
fn read_memory_metric() -> MemoryMetric {
    use windows::Win32::System::SystemInformation::{GlobalMemoryStatusEx, MEMORYSTATUSEX};

    let mut status = MEMORYSTATUSEX {
        dwLength: size_of::<MEMORYSTATUSEX>() as u32,
        ..Default::default()
    };
    // SAFETY: status has the required dwLength and remains valid for the call duration.
    if unsafe { GlobalMemoryStatusEx(&mut status) }.is_err() || status.ullTotalPhys == 0 {
        return unavailable_memory();
    }
    MemoryMetric {
        state: "observed",
        used_bytes: Some(status.ullTotalPhys.saturating_sub(status.ullAvailPhys)),
        total_bytes: Some(status.ullTotalPhys),
        load_percent: Some(f64::from(status.dwMemoryLoad)),
        source: "windows-global-memory-status-ex",
        detail: "Physical memory usage measured by Windows.",
        reason_code: None,
    }
}

#[cfg(not(windows))]
fn read_memory_metric() -> MemoryMetric {
    unavailable_memory()
}

fn unavailable_memory() -> MemoryMetric {
    MemoryMetric {
        state: "unavailable",
        used_bytes: None,
        total_bytes: None,
        load_percent: None,
        source: "windows-global-memory-status-ex",
        detail: "Windows did not expose physical memory counters.",
        reason_code: Some("source-unavailable"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_busy_cpu_from_documented_windows_intervals() {
        let value = calculate_cpu_percent(
            CpuTimes {
                idle: 100,
                kernel: 300,
                user: 100,
            },
            CpuTimes {
                idle: 140,
                kernel: 380,
                user: 120,
            },
        );
        assert_eq!(value, Some(60.0));
    }

    #[test]
    fn refuses_discontinuous_or_empty_cpu_intervals() {
        assert_eq!(
            calculate_cpu_percent(
                CpuTimes {
                    idle: 100,
                    kernel: 300,
                    user: 100
                },
                CpuTimes {
                    idle: 90,
                    kernel: 380,
                    user: 120
                },
            ),
            None,
        );
        assert_eq!(
            calculate_cpu_percent(
                CpuTimes {
                    idle: 100,
                    kernel: 300,
                    user: 100
                },
                CpuTimes {
                    idle: 100,
                    kernel: 300,
                    user: 100
                },
            ),
            None,
        );
    }

    #[test]
    fn snapshot_is_read_only_and_never_fabricates_gpu_values() {
        let reading = LiveTelemetrySampler::default().sample();
        assert!(reading.snapshot.read_only);
        assert_eq!(reading.snapshot.schema_version, "1.0");
        assert_eq!(reading.snapshot.gpu.state, "unavailable");
        assert_eq!(reading.snapshot.gpu.value, None);
        assert_eq!(
            reading.snapshot.gpu.reason_code,
            Some("source-not-admitted")
        );
    }

    #[cfg(windows)]
    #[test]
    fn current_windows_machine_exposes_real_cpu_and_memory_samples() {
        let mut sampler = LiveTelemetrySampler::default();
        let first = sampler.sample();
        assert_eq!(first.snapshot.memory.state, "observed");
        assert!(first.snapshot.memory.used_bytes.is_some());
        assert!(first.snapshot.memory.total_bytes.is_some());

        std::thread::sleep(std::time::Duration::from_millis(120));
        let second = sampler.sample();
        assert_eq!(second.snapshot.cpu.state, "observed");
        assert!(
            second
                .snapshot
                .cpu
                .value
                .is_some_and(|value| (0.0..=100.0).contains(&value))
        );
        assert_eq!(second.snapshot.memory.state, "observed");
        assert!(
            second
                .observations
                .iter()
                .any(|sample| sample.metric == MetricKind::CpuUtilizationPercent)
        );
        assert!(
            second
                .observations
                .iter()
                .any(|sample| sample.metric == MetricKind::MemoryWorkingSetBytes)
        );

        let serialized = serde_json::to_string(&second.snapshot).expect("serialize snapshot");
        for forbidden in ["serial", "machineGuid", "macAddress", "deviceInstanceId"] {
            assert!(!serialized.contains(forbidden));
        }
    }
}
