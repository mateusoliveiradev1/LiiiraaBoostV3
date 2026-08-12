use std::collections::BTreeMap;
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
    #[cfg(windows)]
    gpu: Option<GpuSampler>,
}

impl Default for LiveTelemetrySampler {
    fn default() -> Self {
        Self {
            started_at: Instant::now(),
            previous_cpu: None,
            #[cfg(windows)]
            gpu: GpuSampler::new(),
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
        #[cfg(windows)]
        let gpu = self
            .gpu
            .as_mut()
            .map_or_else(unavailable_gpu, GpuSampler::sample);
        #[cfg(not(windows))]
        let gpu = unavailable_gpu();

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
        if let Some(value) = gpu.value {
            observations.push(CounterObservation {
                monotonic_ns,
                metric: MetricKind::GpuUtilizationPercent,
                value: Some(value),
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

fn unavailable_gpu() -> ScalarMetric {
    unavailable_scalar(
        "percent",
        "windows-pdh-gpu-engine",
        "Windows did not expose usable GPU engine counters.",
        "source-unavailable",
        "unavailable",
    )
}

fn busiest_gpu_engine_percent<I, K>(samples: I) -> Option<f64>
where
    I: IntoIterator<Item = (K, f64)>,
    K: Into<String>,
{
    let mut grouped = BTreeMap::<String, f64>::new();
    for (key, value) in samples {
        if value.is_finite() && value >= 0.0 {
            *grouped.entry(key.into()).or_default() += value;
        }
    }
    grouped
        .into_values()
        .reduce(f64::max)
        .map(|value| value.clamp(0.0, 100.0))
}

#[cfg(windows)]
struct GpuCounter {
    handle: usize,
    group: String,
}

#[cfg(windows)]
struct GpuSampler {
    query: usize,
    counters: Vec<GpuCounter>,
}

#[cfg(windows)]
impl GpuSampler {
    fn new() -> Option<Self> {
        use windows::Win32::System::Performance::{
            PDH_HCOUNTER, PDH_HQUERY, PDH_MORE_DATA, PdhAddEnglishCounterW, PdhCollectQueryData,
            PdhExpandWildCardPathW, PdhOpenQueryW,
        };
        use windows::core::{PCWSTR, PWSTR};

        let wildcard: Vec<u16> = "\\GPU Engine(*)\\Utilization Percentage\0"
            .encode_utf16()
            .collect();
        let mut required = 0_u32;
        // SAFETY: this is the documented two-call buffer sizing pattern for a local PDH path.
        let first = unsafe {
            PdhExpandWildCardPathW(
                PCWSTR::null(),
                PCWSTR(wildcard.as_ptr()),
                None,
                &mut required,
                0,
            )
        };
        if first != PDH_MORE_DATA || required == 0 {
            return None;
        }
        let mut expanded = vec![0_u16; required as usize];
        // SAFETY: expanded is writable and sized from the immediately preceding PDH query.
        if unsafe {
            PdhExpandWildCardPathW(
                PCWSTR::null(),
                PCWSTR(wildcard.as_ptr()),
                Some(PWSTR(expanded.as_mut_ptr())),
                &mut required,
                0,
            )
        } != 0
        {
            return None;
        }

        let paths = split_multi_sz(&expanded);
        let mut query = PDH_HQUERY::default();
        // SAFETY: query points to initialized storage and a null datasource selects the local machine.
        if unsafe { PdhOpenQueryW(PCWSTR::null(), 0, &mut query) } != 0 || query.is_invalid() {
            return None;
        }
        let mut counters = Vec::new();
        for path in paths {
            let wide: Vec<u16> = path.encode_utf16().chain(Some(0)).collect();
            let mut counter = PDH_HCOUNTER::default();
            // SAFETY: the path is a nul-terminated value returned by PDH for this query.
            if unsafe { PdhAddEnglishCounterW(query, PCWSTR(wide.as_ptr()), 0, &mut counter) } == 0
                && !counter.is_invalid()
            {
                counters.push(GpuCounter {
                    handle: counter.0 as usize,
                    group: gpu_engine_group(&path),
                });
            }
        }
        if counters.is_empty() {
            // SAFETY: query is an owned valid handle and has not been closed.
            unsafe { windows::Win32::System::Performance::PdhCloseQuery(query) };
            return None;
        }
        // Prime the rate counters. A later call supplies the measured interval.
        // SAFETY: query owns the admitted counters above.
        unsafe { PdhCollectQueryData(query) };
        Some(Self {
            query: query.0 as usize,
            counters,
        })
    }

    fn sample(&mut self) -> ScalarMetric {
        use windows::Win32::System::Performance::{
            PDH_CSTATUS_NEW_DATA, PDH_CSTATUS_VALID_DATA, PDH_FMT_COUNTERVALUE, PDH_FMT_DOUBLE,
            PDH_HCOUNTER, PDH_HQUERY, PdhCollectQueryData, PdhGetFormattedCounterValue,
        };
        let query = PDH_HQUERY(self.query as *mut _);
        // SAFETY: this sampler exclusively owns the query for its lifetime.
        if unsafe { PdhCollectQueryData(query) } != 0 {
            return unavailable_gpu();
        }
        let mut samples = Vec::with_capacity(self.counters.len());
        for counter in &self.counters {
            let mut formatted = PDH_FMT_COUNTERVALUE::default();
            // SAFETY: the counter belongs to query and formatted points to initialized writable storage.
            let status = unsafe {
                PdhGetFormattedCounterValue(
                    PDH_HCOUNTER(counter.handle as *mut _),
                    PDH_FMT_DOUBLE,
                    None,
                    &mut formatted,
                )
            };
            if status == 0
                && matches!(
                    formatted.CStatus,
                    PDH_CSTATUS_VALID_DATA | PDH_CSTATUS_NEW_DATA
                )
            {
                // SAFETY: PDH_FMT_DOUBLE makes doubleValue the active union member.
                let value = unsafe { formatted.Anonymous.doubleValue };
                samples.push((counter.group.clone(), value));
            }
        }
        busiest_gpu_engine_percent(samples).map_or_else(unavailable_gpu, |value| {
            observed_scalar(
                round(value, 1),
                "percent",
                "windows-pdh-gpu-engine",
                "Busiest physical GPU engine activity measured by Windows.",
            )
        })
    }
}

#[cfg(windows)]
impl Drop for GpuSampler {
    fn drop(&mut self) {
        let query = windows::Win32::System::Performance::PDH_HQUERY(self.query as *mut _);
        // SAFETY: this sampler owns the query and closes it exactly once here.
        unsafe { windows::Win32::System::Performance::PdhCloseQuery(query) };
    }
}

#[cfg(windows)]
fn split_multi_sz(buffer: &[u16]) -> Vec<String> {
    buffer
        .split(|value| *value == 0)
        .take_while(|part| !part.is_empty())
        .map(String::from_utf16_lossy)
        .collect()
}

#[cfg(windows)]
fn gpu_engine_group(path: &str) -> String {
    let lower = path.to_ascii_lowercase();
    let adapter = lower
        .find("luid_")
        .and_then(|start| {
            lower[start..]
                .find("_phys_")
                .map(|end| &lower[start..start + end])
        })
        .unwrap_or("adapter");
    let engine = lower
        .find("engtype_")
        .map(|start| {
            let value = &lower[start + "engtype_".len()..];
            value.split([')', '\\']).next().unwrap_or("engine")
        })
        .unwrap_or("engine");
    format!("{adapter}/{engine}")
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
    fn gpu_activity_uses_the_busiest_physical_engine_without_double_counting() {
        let value = busiest_gpu_engine_percent([
            ("luid-a/3d", 12.0),
            ("luid-a/3d", 8.0),
            ("luid-a/copy", 4.0),
            ("luid-b/3d", 7.0),
        ]);
        assert_eq!(value, Some(20.0));
    }

    #[test]
    fn snapshot_is_read_only_and_never_fabricates_gpu_values() {
        let reading = LiveTelemetrySampler::default().sample();
        assert!(reading.snapshot.read_only);
        assert_eq!(reading.snapshot.schema_version, "1.0");
        assert!(matches!(
            reading.snapshot.gpu.state,
            "warming-up" | "observed" | "unavailable"
        ));
        if let Some(value) = reading.snapshot.gpu.value {
            assert!((0.0..=100.0).contains(&value));
        }
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
        assert_eq!(second.snapshot.gpu.state, "observed");
        assert!(
            second
                .snapshot
                .gpu
                .value
                .is_some_and(|value| (0.0..=100.0).contains(&value))
        );
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
