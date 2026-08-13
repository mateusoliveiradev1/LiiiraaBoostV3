# Phase 6 windows-service Supply-Chain Approval

> Generated before dependency installation by `tooling/supply-chain/phase6-windows-service-approval.mjs`. The machine-readable record is authoritative; do not approve a different identity.

## Gate status

Awaiting the non-auto-approvable human legitimacy decision.

- Status: `PENDING`
- Exact crate: `windows-service 0.8.1`
- Registry record: [crates.io windows-service 0.8.1](https://crates.io/api/v1/crates/windows-service/0.8.1)
- Registry checksum (SHA-256): `857224b3b211c6f3616921f081ee54721ee3ad2ace2fac6a6337e032f7b4dcf2`
- SPDX license: `MIT OR Apache-2.0`
- Source repository: [Mullvad windows-service-rs](https://github.com/mullvad/windows-service-rs)
- Source tag: [v0.8.1](https://github.com/mullvad/windows-service-rs/releases/tag/v0.8.1)
- Immutable source commit: [`aab40570b50c05b8e6f3c375171727e666ee42a0`](https://github.com/mullvad/windows-service-rs/commit/aab40570b50c05b8e6f3c375171727e666ee42a0)
- Signed tag verified by GitHub: `true`
- Publisher: `hulthe` (Joakim Hulthe) at `2026-05-08T13:35:47.104020Z`

## Dependency summary

| Dependency | Requirement | Kind | Target | Optional |
| --- | --- | --- | --- | --- |
| `bitflags` | `^2.3` | normal | `cfg(windows)` | no |
| `widestring` | `^1` | normal | `cfg(windows)` | no |
| `windows-sys` | `^0.61` | normal | `cfg(windows)` | no |

## Build and install behavior

Library-only crate; no root build.rs, explicit Cargo build script, native links declaration, or installable binary was found at the immutable source commit.

- Cargo library: `true`
- Binary targets: `none`
- Root `build.rs`: `false`
- Explicit package `build`: `false`
- Native `links`: `false`

## Reviewer instructions

Open the registry, repository, tag, and immutable commit links above. Compare the exact name, version, checksum, license, source ownership/history, dependency tree, and build/install behavior. Approve only `windows-service 0.8.1`; any mismatch is a rejection.

## Machine-readable approval record

<!-- phase6-windows-service-approval-record:start
{
  "schemaVersion": 1,
  "status": "PENDING",
  "candidate": {
    "name": "windows-service",
    "version": "0.8.1",
    "registry": "https://crates.io",
    "registryRecordUrl": "https://crates.io/api/v1/crates/windows-service/0.8.1",
    "registryDependenciesUrl": "https://crates.io/api/v1/crates/windows-service/0.8.1/dependencies",
    "registryDownloadUrl": "https://crates.io/api/v1/crates/windows-service/0.8.1/download",
    "sourceRepositoryUrl": "https://github.com/mullvad/windows-service-rs",
    "sourceTag": "v0.8.1",
    "sourceTagUrl": "https://github.com/mullvad/windows-service-rs/releases/tag/v0.8.1",
    "sourceTagObjectSha": "139b454e0e22cd4ae7d3ff05c02926ca08994589",
    "sourceTagSignatureVerified": true,
    "sourceCommit": "aab40570b50c05b8e6f3c375171727e666ee42a0",
    "sourceCommitUrl": "https://github.com/mullvad/windows-service-rs/commit/aab40570b50c05b8e6f3c375171727e666ee42a0",
    "sourceArchiveUrl": "https://github.com/mullvad/windows-service-rs/archive/aab40570b50c05b8e6f3c375171727e666ee42a0.tar.gz",
    "sourceManifestUrl": "https://raw.githubusercontent.com/mullvad/windows-service-rs/aab40570b50c05b8e6f3c375171727e666ee42a0/Cargo.toml",
    "checksumSha256": "857224b3b211c6f3616921f081ee54721ee3ad2ace2fac6a6337e032f7b4dcf2",
    "spdxLicense": "MIT OR Apache-2.0",
    "dependencies": [
      {
        "name": "bitflags",
        "requirement": "^2.3",
        "kind": "normal",
        "target": "cfg(windows)",
        "optional": false,
        "defaultFeatures": true,
        "features": []
      },
      {
        "name": "widestring",
        "requirement": "^1",
        "kind": "normal",
        "target": "cfg(windows)",
        "optional": false,
        "defaultFeatures": true,
        "features": []
      },
      {
        "name": "windows-sys",
        "requirement": "^0.61",
        "kind": "normal",
        "target": "cfg(windows)",
        "optional": false,
        "defaultFeatures": true,
        "features": [
          "Win32_Foundation",
          "Win32_Storage_FileSystem",
          "Win32_System_Power",
          "Win32_System_RemoteDesktop",
          "Win32_System_Services",
          "Win32_System_SystemServices",
          "Win32_System_Threading",
          "Win32_System_WindowsProgramming",
          "Win32_UI_WindowsAndMessaging"
        ]
      }
    ],
    "publishedBy": {
      "cratesIoUserId": 118863,
      "login": "hulthe",
      "name": "Joakim Hulthe",
      "profileUrl": "https://github.com/hulthe"
    },
    "publishedAtUtc": "2026-05-08T13:35:47.104020Z",
    "crateSizeBytes": 37785,
    "rustVersion": "1.71.0",
    "yanked": false,
    "buildInstallBehavior": {
      "hasLibrary": true,
      "binaryNames": [],
      "cargoNativeLinks": null,
      "rootBuildScriptPresent": false,
      "manifestDeclaresBuildScript": false,
      "manifestDeclaresNativeLinks": false,
      "summary": "Library-only crate; no root build.rs, explicit Cargo build script, native links declaration, or installable binary was found at the immutable source commit."
    }
  },
  "preInstallGuard": {
    "dependencyAbsent": true,
    "files": [
      {
        "path": "Cargo.lock",
        "sha256": "99f583bc9a7e180c034f0ba07a88a7ac8f047c951bdcb44071fa7a810b08cbb5"
      },
      {
        "path": "Cargo.toml",
        "sha256": "c70c30e95685d91c83ec26e49054ff35743942778bdc16d76b148a63b0ab3ca5"
      },
      {
        "path": "apps/desktop/src-tauri/Cargo.toml",
        "sha256": "fc8bc3d67f2b5ea240739402f55e0ce11fe73b164eafc4485cc825ba0704a8b7"
      },
      {
        "path": "crates/contracts-rust/Cargo.toml",
        "sha256": "8b1b370e64b76a0c94166211d9dea927f34379025585cfe737ed3ae3eaf76271"
      },
      {
        "path": "crates/plan-engine/Cargo.toml",
        "sha256": "1649e582c2f9e64f8ad4c1cc697abeabbd89b1e3484b17b843374802648a5ffb"
      },
      {
        "path": "tooling/contract-generation-rust/Cargo.toml",
        "sha256": "ac465995594a2ebf1a0e40eee29111efba581032b7da3c92e9f0ef06cadd032c"
      },
      {
        "path": "tooling/contract-generation-spike-rust/Cargo.toml",
        "sha256": "391bfd660605686695970e7270d12cda74a6e2295c0c39d4f5dcb66741b8415c"
      }
    ]
  },
  "review": {
    "reviewerIdentity": null,
    "reviewedAtUtc": null,
    "reviewerResponse": null,
    "verdict": null,
    "approvedIdentity": null
  }
}
phase6-windows-service-approval-record:end -->
