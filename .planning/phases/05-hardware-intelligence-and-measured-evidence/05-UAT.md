---
status: implementation-passed
phase: 05-hardware-intelligence-and-measured-evidence
started: 2026-08-12T19:30:00.000Z
updated: 2026-08-12T21:30:00.000Z
release_ready: false
---

# Phase 5 UAT — Hardware Intelligence and Measured Evidence

## Automated admission

Command: `pnpm phase5:verify -- --mode final`

Result: pass. Deterministic gates and one packaged physical Windows run were admitted with no evaluator diagnostics.

| Gate | Result | Evidence |
| --- | --- | --- |
| Contract and generated-client drift | pass | 12 generated artifacts verified |
| Evidence evaluator | pass | 11/11 tests |
| Desktop client | pass | 20/20 tests |
| Desktop evidence experience | pass | 91/91 tests |
| Native Rust evidence suites | pass | inventory, identity, policy, store and report tests |
| Native live telemetry | pass | real CPU and memory authority; bounded capture polling; unavailable GPU reported honestly |
| Browser authority flows | pass | 5/5 Playwright flows, including axe and keyboard coverage |
| Production build | pass | Vite production artifact and packaged Tauri executable |

## Current packaged Windows PC

Artifact commit: `bd1fb91f6e9977acfe280f48ff88023d69a983de`

Artifact SHA-256: `511c76603c927d4cd26e3f9ea43f500802d7d899c21d3249713c3886359c9546`

Environment: Microsoft Windows 11 Pro, build 26200, 64-bit.

| Physical budget | Observed | Limit | Result |
| --- | ---: | ---: | --- |
| Sample duration | 300 s | >= 300 s | pass |
| Native authority peak working set | 12.277 MB | <= 25 MB | pass |
| Idle CPU | 0% | <= 0.5% | pass |
| Background polling | 0 Hz | <= 1 Hz | pass |
| Capture cancellation acknowledgement | 100 ms | <= 250 ms | pass |
| Raw hardware identifiers crossing the probe boundary | 0 | 0 | pass |

Observed through the shipping native boundary: CPU via CPUID, GPU via EnumDisplayDevicesW, memory via GlobalMemoryStatusEx, storage via GetDiskFreeSpaceExW, display via EnumDisplaySettingsW and Windows lifecycle via RtlGetVersion/GetProductInfo. Missing native sources remained explicitly unavailable; no placeholder value was admitted.

The production desktop now also refreshes CPU and memory telemetry through the shipping Tauri authority. Measurement capture samples the same authority below 1 Hz and cancels with the capture lifecycle. GPU utilization remains explicitly unavailable until an admitted native utilization collector is implemented.

## Honest pending release matrix

These cells were not run and are not PASS:

- Windows 10 supported lifecycle.
- Intel CPU; Intel GPU; additional AMD/NVIDIA combinations.
- Notebook form factor.
- NVMe and SATA SSD matrix identity on additional machines.
- Ethernet and Wi-Fi matrix identity on additional machines.
- Active supported-game impact walkthrough on representative hardware.
- Narrator walkthrough in PT-BR and English at 150%/200% scaling.
- Phase 4 clean-install/recovery matrix and public Authenticode trust.

The pending cells do not invalidate the Phase 5 implementation or the admitted current-PC authority. They keep `releaseReady=false` and block public compatibility/performance claims until collected.

## Summary

implementation: pass
current_pc_packaged_probe: pass
evaluator_diagnostics: 0
external_matrix: pending
public_release: blocked
