[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('Audit', 'RunCleanVm')]
    [string]$Action,

    [switch]$DryRun,

    [string]$VmName = 'LiiiraaBoost-W11-25H2-Clean',

    [string]$CheckpointName = 'Clean-Windows-Ready',

    [string]$ArtifactManifestFromSummary = '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',

    [string]$SimulationAdmissionFromSummary = '.planning/phases/06-transactional-plans-and-recovery/06-38-SUMMARY.md',

    [PSCredential]$GuestCredential
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedVmName = 'LiiiraaBoost-W11-25H2-Clean'
$ExpectedCleanCheckpoint = 'Clean-Windows-Ready'
$ExpectedCleanCheckpointId = 'ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075'
$ExpectedBackupCheckpoint = 'Clean-Windows-Ready-PreLabAccount-v43'
$ExpectedBackupCheckpointId = 'ebccd5f3-5645-4089-b469-fa4d851fc6ef'
$ExpectedInstalledCheckpoint = 'LiiiraaBoost-Installed'
$ExpectedOperationVersion = 'managed-power-scheme-v46'
$ExpectedBuildId = 'physical-c714ca4c5ad147f4-managed-power-scheme-v46'
$ExpectedSourceCommit = '1a1dc18ce40beaef2f83cdb3e070386e4d639021'
$ExpectedArtifactManifestSha256 = 'a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da'
$ExpectedSimulationRunId = 'phase6-deterministic-simulation-managed-power-scheme-v46-a2be09354be8'
$ExpectedSimulationRunSha256 = 'ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229'
$ExpectedEvidenceManifestSha256 = 'd2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da'
$ExpectedPredecessorOperationVersion = 'managed-power-scheme-v45'
$ExpectedPredecessorBuildId = 'physical-68bb4f974e23ee26-managed-power-scheme-v45'
$ExpectedPredecessorArtifactManifestSha256 = '9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40'
$ExpectedPredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v45-9c80d1f216ea'
$ExpectedPredecessorRunSha256 = '0eb8f328e9a007d3247c3095c5805011268430be1f936d0520e2e60db36c8f1e'
$ExpectedPredecessorManifestSha256 = '4293127293aadc9e7a006c61673953b6cacd37fe4e74809de9d6c7f06e8fbca6'
$ExpectedPredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v45-evidence-manifest.json'
$ExpectedOlderPredecessorOperationVersion = 'managed-power-scheme-v44'
$ExpectedOlderPredecessorBuildId = 'physical-68bb4f974e23ee26-managed-power-scheme-v44'
$ExpectedOlderPredecessorArtifactManifestSha256 = '71274d04fbdffc1e2444a7c8771c5f767b8ce1f04c6fa1f6988f23a192b63e6f'
$ExpectedOlderPredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v44-71274d04fbdf'
$ExpectedOlderPredecessorRunSha256 = 'a4a906c3e350a5d1c1d98a936ca350b67c76deb3b96b69646ae285d195852a9e'
$ExpectedOlderPredecessorManifestSha256 = 'da004988b19b58dc423894138919de9577d340322ebbaeb02ae3f7db2393e026'
$ExpectedOlderPredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v44-evidence-manifest.json'
$ExpectedIntermediateOperationVersion = 'managed-power-scheme-v43'
$ExpectedIntermediateBuildId = 'physical-3eec8d7e3665a7f3-managed-power-scheme-v43'
$ExpectedIntermediateArtifactManifestSha256 = 'a94f83e0605b9ab7c501ec2c3d79c15a1a5b79a24f828c980bf2d4987fc163fa'
$ExpectedIntermediateRunId = 'phase6-deterministic-simulation-managed-power-scheme-v43-a94f83e0605b'
$ExpectedIntermediateRunSha256 = 'dee8f3c8f6dc117a1d14ee60aa3dfd50e943e9cb2e960c9aaa4e8e62422e44bd'
$ExpectedIntermediateManifestSha256 = '89c029cbe96f3a7822b0c842668e1bb27bbb22576ca5f017cef0598ddc55ca48'
$ExpectedIntermediateManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v43-evidence-manifest.json'
$ExpectedHistoricalOperationVersion = 'managed-power-scheme-v41'
$ExpectedHistoricalBuildId = 'physical-8d162575a964ec77-managed-power-scheme-v41'
$ExpectedHistoricalArtifactManifestSha256 = '8789c54ca0a73e2f496fedb7710dae6eac4b1b4bad10864e0284b7591d607784'
$ExpectedHistoricalRunId = 'phase6-deterministic-simulation-managed-power-scheme-v41-8789c54ca0a7'
$ExpectedHistoricalRunSha256 = '626b9793c70f1271d28eff8f3a3e4bba37956c9138b08c345b72e2b22f7f02b7'
$ExpectedHistoricalManifestSha256 = 'ead808d8fb26a01183d6522b0698f785daa0d25cbe9d7337bb662c13b53c5f7a'
$ExpectedHistoricalManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v41-evidence-manifest.json'
$ExpectedRunnerRelativePath = 'phase6-physical-runner.exe'
$ExpectedConfigRelativePath = 'configs\clean-windows-vm.run-config.json'
$ExpectedGuestRoot = "C:\LiiiraaBoost\Phase6\$ExpectedBuildId"
$ExpectedGuestRunner = "$ExpectedGuestRoot\phase6-physical-runner.exe"
$ExpectedGuestConfig = "$ExpectedGuestRoot\configs\clean-windows-vm.run-config.json"
$RunnerKeyLink = 'phase6-physical-runner.exe --run-config'
[void]$RunnerKeyLink
$ExpectedManifestRoles = @(
    'msi',
    'installationManifest',
    'installationManifestSignature',
    'cleanWindowsVmConfig',
    'ownerPcConfig',
    'friendsPcConfig',
    'runner',
    'tauriDriver',
    'msedgeDriver'
)
$MaximumEvidenceBytes = 64KB
$RepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..')).TrimEnd('\')
$ExpectedArtifactSummary = Join-Path $RepositoryRoot '.planning\phases\06-transactional-plans-and-recovery\06-31-SUMMARY.md'
$ExpectedSimulationSummary = Join-Path $RepositoryRoot '.planning\phases\06-transactional-plans-and-recovery\06-38-SUMMARY.md'
$ExpectedArtifactRoot = Join-Path $RepositoryRoot "target\phase6-physical\$ExpectedSourceCommit\$ExpectedBuildId"
$ExpectedArtifactManifest = Join-Path $ExpectedArtifactRoot 'artifact-manifest.json'
$ExpectedArtifactSignature = Join-Path $ExpectedArtifactRoot 'artifact-manifest.json.p7s'
$ExpectedEvidenceManifest = Join-Path $RepositoryRoot 'tooling\phase6-evidence\evidence-manifest.json'
$LabRoot = 'C:\Users\Liiiraa\VM-Lab'
$CompletedBoundaries = [Collections.Generic.List[string]]::new()
$MaximumRunnerOutputLines = 32
$MaximumRunnerOutputChars = 4096
$RunnerFailureStage = 'preflight'
$RunnerExitCode = $null
$RunnerFailureCode = $null

function Get-Sha256Hex {
    param([Parameter(Mandatory)][byte[]]$Bytes)

    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Get-FileSha256Hex {
    param([Parameter(Mandatory)][string]$Path)

    return Get-Sha256Hex -Bytes ([IO.File]::ReadAllBytes($Path))
}

function Resolve-ExactExistingPath {
    param(
        [Parameter(Mandatory)][string]$Supplied,
        [Parameter(Mandatory)][string]$Expected,
        [Parameter(Mandatory)][string]$Label
    )

    $candidate = if ([IO.Path]::IsPathRooted($Supplied)) { $Supplied } else { Join-Path (Get-Location) $Supplied }
    $actual = [IO.Path]::GetFullPath($candidate)
    $expectedFull = [IO.Path]::GetFullPath($Expected)
    if (-not $actual.Equals($expectedFull, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label must be the exact repository authority."
    }
    if (-not (Test-Path -LiteralPath $actual -PathType Leaf)) {
        throw "$Label is missing."
    }
    return (Resolve-Path -LiteralPath $actual).Path
}

function Assert-ExactInvocation {
    if (-not $VmName.Equals($ExpectedVmName, [StringComparison]::Ordinal)) {
        throw 'BLOCKED: VM target mismatch.'
    }
    if (-not $CheckpointName.Equals($ExpectedCleanCheckpoint, [StringComparison]::Ordinal)) {
        throw 'BLOCKED: clean checkpoint mismatch.'
    }
    if (-not (Test-Path -LiteralPath $LabRoot -PathType Container)) {
        throw 'BLOCKED: the exact VM-Lab root is missing.'
    }
    $resolvedLabRoot = (Resolve-Path -LiteralPath $LabRoot).Path.TrimEnd('\')
    if (-not $resolvedLabRoot.Equals($LabRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'BLOCKED: VM-Lab root resolved outside the exact path.'
    }
}

function Get-Authority {
    $artifactSummaryPath = Resolve-ExactExistingPath -Supplied $ArtifactManifestFromSummary -Expected $ExpectedArtifactSummary -Label 'artifact summary'
    $simulationSummaryPath = Resolve-ExactExistingPath -Supplied $SimulationAdmissionFromSummary -Expected $ExpectedSimulationSummary -Label 'simulation summary'
    $artifactSummaryText = [IO.File]::ReadAllText($artifactSummaryPath)
    $simulationSummaryText = [IO.File]::ReadAllText($simulationSummaryPath)

    foreach ($required in @(
        "target/phase6-physical/$ExpectedSourceCommit/$ExpectedBuildId",
        $ExpectedBuildId,
        $ExpectedOperationVersion,
        $ExpectedSourceCommit,
        $ExpectedArtifactManifestSha256
    )) {
        if ($artifactSummaryText.Replace('\', '/').IndexOf($required, [StringComparison]::Ordinal) -lt 0) {
            throw 'BLOCKED: 06-31 summary authority mismatch.'
        }
    }
    foreach ($required in @(
        'sole active deterministic admission',
        $ExpectedBuildId,
        $ExpectedOperationVersion,
        $ExpectedArtifactManifestSha256,
        $ExpectedSimulationRunSha256,
        $ExpectedEvidenceManifestSha256,
        $ExpectedPredecessorOperationVersion,
        $ExpectedPredecessorRunSha256,
        $ExpectedPredecessorManifestSha256,
        $ExpectedOlderPredecessorOperationVersion,
        $ExpectedOlderPredecessorRunSha256,
        $ExpectedOlderPredecessorManifestSha256,
        $ExpectedIntermediateOperationVersion,
        $ExpectedIntermediateRunSha256,
        $ExpectedIntermediateManifestSha256,
        $ExpectedHistoricalOperationVersion,
        $ExpectedHistoricalRunSha256,
        $ExpectedHistoricalManifestSha256
    )) {
        if ($simulationSummaryText.IndexOf($required, [StringComparison]::Ordinal) -lt 0) {
            throw 'BLOCKED: 06-38 simulation authority mismatch.'
        }
    }

    if (-not (Test-Path -LiteralPath $ExpectedArtifactManifest -PathType Leaf) -or
        -not (Test-Path -LiteralPath $ExpectedArtifactSignature -PathType Leaf)) {
        throw 'BLOCKED: exact create-once artifact authority is missing.'
    }
    $artifactRoot = (Resolve-Path -LiteralPath $ExpectedArtifactRoot).Path
    if (-not $artifactRoot.Equals($ExpectedArtifactRoot, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'BLOCKED: artifact root resolved away from the exact create-once root.'
    }
    $actualManifestSha256 = Get-FileSha256Hex -Path $ExpectedArtifactManifest
    if ($actualManifestSha256 -ne $ExpectedArtifactManifestSha256) {
        throw 'BLOCKED: artifact manifest live bytes changed.'
    }

    $manifest = [IO.File]::ReadAllText($ExpectedArtifactManifest) | ConvertFrom-Json
    if ($manifest.operationVersionId -ne $ExpectedOperationVersion -or
        $manifest.buildId -ne $ExpectedBuildId -or
        $manifest.sourceCommit -ne $ExpectedSourceCommit) {
        throw 'BLOCKED: artifact operation/build/source tuple mismatch.'
    }

    $manifestRoles = @($manifest.files.PSObject.Properties.Name)
    if (@(Compare-Object -ReferenceObject ($ExpectedManifestRoles | Sort-Object) -DifferenceObject ($manifestRoles | Sort-Object)).Count -ne 0) {
        throw 'BLOCKED: artifact manifest role set widened or narrowed.'
    }
    foreach ($role in $ExpectedManifestRoles) {
        $entry = $manifest.files.$role
        $relative = [string]$entry.relativePath
        if ([IO.Path]::IsPathRooted($relative) -or $relative.Contains('..')) {
            throw 'BLOCKED: artifact role path escaped the immutable root.'
        }
        $livePath = Join-Path $ExpectedArtifactRoot $relative
        if (-not (Test-Path -LiteralPath $livePath -PathType Leaf)) {
            throw 'BLOCKED: manifest-bound live byte is missing.'
        }
        $expectedHash = ([string]$entry.sha256).Replace('sha256:', '')
        if ((Get-FileSha256Hex -Path $livePath) -ne $expectedHash -or
            (Get-Item -LiteralPath $livePath).Length -ne [Int64]$entry.sizeBytes) {
            throw 'BLOCKED: manifest-bound live byte identity mismatch.'
        }
    }
    if ($manifest.files.runner.relativePath -ne 'phase6-physical-runner.exe' -or
        $manifest.files.cleanWindowsVmConfig.relativePath.Replace('/', '\') -ne $ExpectedConfigRelativePath) {
        throw 'BLOCKED: runner/config role path mismatch.'
    }

    if ((Get-FileSha256Hex -Path $ExpectedEvidenceManifest) -ne $ExpectedEvidenceManifestSha256) {
        throw 'BLOCKED: current evidence manifest bytes changed.'
    }
    $evidenceManifest = [IO.File]::ReadAllText($ExpectedEvidenceManifest) | ConvertFrom-Json
    $rootKeys = @($evidenceManifest.PSObject.Properties.Name | Sort-Object)
    $expectedRootKeys = @(
        'schemaVersion', 'generatedAt', 'operationVersion', 'immutableBuild', 'promotionStage',
        'requirementsCoverage', 'decisionCoverage', 'legacyBlockedAttempts', 'deterministicAdmissions', 'stages'
    ) | Sort-Object
    if (@(Compare-Object -ReferenceObject $expectedRootKeys -DifferenceObject $rootKeys).Count -ne 0 -or
        $evidenceManifest.schemaVersion -ne 3) {
        throw 'BLOCKED: deterministic admission schema is not the exact closed v3 authority.'
    }
    $admissions = @($evidenceManifest.deterministicAdmissions)
    if ($admissions.Count -ne 5 -or @($admissions | Where-Object { $_.status -eq 'active' }).Count -ne 1) {
        throw 'BLOCKED: deterministic admission chain must contain four predecessors and one active successor.'
    }
    $expectedAdmissionKeys = @(
        'status', 'operationVersion', 'buildId', 'artifactManifestSha256', 'runEvidenceId',
        'runEvidenceSha256', 'predecessorEvidenceSha256', 'successorEvidenceSha256', 'manifestRecord'
    ) | Sort-Object
    foreach ($admission in $admissions) {
        $actualKeys = @($admission.PSObject.Properties.Name | Sort-Object)
        if (@(Compare-Object -ReferenceObject $expectedAdmissionKeys -DifferenceObject $actualKeys).Count -ne 0) {
            throw 'BLOCKED: deterministic admission entry shape widened or narrowed.'
        }
    }
    $historical = $admissions[0]
    $intermediate = $admissions[1]
    $olderPredecessor = $admissions[2]
    $predecessor = $admissions[3]
    $active = $admissions[4]
    if ($historical.status -ne 'superseded' -or
        $historical.operationVersion -ne $ExpectedHistoricalOperationVersion -or
        $historical.buildId -ne $ExpectedHistoricalBuildId -or
        $historical.artifactManifestSha256 -ne $ExpectedHistoricalArtifactManifestSha256 -or
        $historical.runEvidenceId -ne $ExpectedHistoricalRunId -or
        $historical.runEvidenceSha256 -ne $ExpectedHistoricalRunSha256 -or
        $null -ne $historical.predecessorEvidenceSha256 -or
        $historical.successorEvidenceSha256 -ne $ExpectedIntermediateRunSha256 -or
        $historical.manifestRecord.path -ne $ExpectedHistoricalManifestRelativePath -or
        $historical.manifestRecord.sha256 -ne $ExpectedHistoricalManifestSha256) {
        throw 'BLOCKED: immutable v41 historical identity is invalid or reactivated.'
    }
    if ($intermediate.status -ne 'superseded' -or
        $intermediate.operationVersion -ne $ExpectedIntermediateOperationVersion -or
        $intermediate.buildId -ne $ExpectedIntermediateBuildId -or
        $intermediate.artifactManifestSha256 -ne $ExpectedIntermediateArtifactManifestSha256 -or
        $intermediate.runEvidenceId -ne $ExpectedIntermediateRunId -or
        $intermediate.runEvidenceSha256 -ne $ExpectedIntermediateRunSha256 -or
        $intermediate.predecessorEvidenceSha256 -ne $ExpectedHistoricalRunSha256 -or
        $intermediate.successorEvidenceSha256 -ne $ExpectedOlderPredecessorRunSha256 -or
        $intermediate.manifestRecord.path -ne $ExpectedIntermediateManifestRelativePath -or
        $intermediate.manifestRecord.sha256 -ne $ExpectedIntermediateManifestSha256) {
        throw 'BLOCKED: immutable v43 historical identity is invalid or reactivated.'
    }
    if ($olderPredecessor.status -ne 'superseded' -or
        $olderPredecessor.operationVersion -ne $ExpectedOlderPredecessorOperationVersion -or
        $olderPredecessor.buildId -ne $ExpectedOlderPredecessorBuildId -or
        $olderPredecessor.artifactManifestSha256 -ne $ExpectedOlderPredecessorArtifactManifestSha256 -or
        $olderPredecessor.runEvidenceId -ne $ExpectedOlderPredecessorRunId -or
        $olderPredecessor.runEvidenceSha256 -ne $ExpectedOlderPredecessorRunSha256 -or
        $olderPredecessor.predecessorEvidenceSha256 -ne $ExpectedIntermediateRunSha256 -or
        $olderPredecessor.successorEvidenceSha256 -ne $ExpectedPredecessorRunSha256 -or
        $olderPredecessor.manifestRecord.path -ne $ExpectedOlderPredecessorManifestRelativePath -or
        $olderPredecessor.manifestRecord.sha256 -ne $ExpectedOlderPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v44 predecessor identity is invalid or reactivated.'
    }
    if ($predecessor.status -ne 'superseded' -or
        $predecessor.operationVersion -ne $ExpectedPredecessorOperationVersion -or
        $predecessor.buildId -ne $ExpectedPredecessorBuildId -or
        $predecessor.artifactManifestSha256 -ne $ExpectedPredecessorArtifactManifestSha256 -or
        $predecessor.runEvidenceId -ne $ExpectedPredecessorRunId -or
        $predecessor.runEvidenceSha256 -ne $ExpectedPredecessorRunSha256 -or
        $predecessor.predecessorEvidenceSha256 -ne $ExpectedOlderPredecessorRunSha256 -or
        $predecessor.successorEvidenceSha256 -ne $ExpectedSimulationRunSha256 -or
        $predecessor.manifestRecord.path -ne $ExpectedPredecessorManifestRelativePath -or
        $predecessor.manifestRecord.sha256 -ne $ExpectedPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v45 predecessor identity is invalid or reactivated.'
    }
    if ($active.status -ne 'active' -or
        $active.operationVersion -ne $ExpectedOperationVersion -or
        $active.buildId -ne $ExpectedBuildId -or
        $active.artifactManifestSha256 -ne $ExpectedArtifactManifestSha256 -or
        $active.runEvidenceId -ne $ExpectedSimulationRunId -or
        $active.runEvidenceSha256 -ne $ExpectedSimulationRunSha256 -or
        $active.predecessorEvidenceSha256 -ne $ExpectedPredecessorRunSha256 -or
        $null -ne $active.successorEvidenceSha256 -or
        $null -ne $active.manifestRecord) {
        throw 'BLOCKED: active v46 deterministic admission tuple/hash/link mismatch.'
    }
    if (($admissions | ConvertTo-Json -Depth 8).IndexOf('managed-power-scheme-v42', [StringComparison]::Ordinal) -ge 0) {
        throw 'BLOCKED: rejected v42 cannot belong to the deterministic admission chain.'
    }
    $historicalManifest = Join-Path $RepositoryRoot $ExpectedHistoricalManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $historicalManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $historicalManifest) -ne $ExpectedHistoricalManifestSha256) {
        throw 'BLOCKED: immutable v41 historical record is missing or changed.'
    }
    $historicalDocument = [IO.File]::ReadAllText($historicalManifest) | ConvertFrom-Json
    $historicalStage = @($historicalDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    if ($historicalDocument.schemaVersion -ne 2 -or
        $historicalDocument.operationVersion -ne $ExpectedHistoricalOperationVersion -or
        $historicalDocument.immutableBuild.id -ne $ExpectedHistoricalBuildId -or
        $historicalDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedHistoricalArtifactManifestSha256 -or
        $historicalStage.Count -ne 1 -or
        @($historicalStage[0].runs).Count -ne 1 -or
        $historicalStage[0].runs[0].id -ne $ExpectedHistoricalRunId -or
        $null -ne $historicalStage[0].runs[0].predecessorRunEvidenceSha256) {
        throw 'BLOCKED: immutable v41 historical record identity is invalid.'
    }
    $intermediateManifest = Join-Path $RepositoryRoot $ExpectedIntermediateManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $intermediateManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $intermediateManifest) -ne $ExpectedIntermediateManifestSha256) {
        throw 'BLOCKED: immutable v43 historical record is missing or changed.'
    }
    $intermediateDocument = [IO.File]::ReadAllText($intermediateManifest) | ConvertFrom-Json
    $intermediateStage = @($intermediateDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $intermediateAdmissions = @($intermediateDocument.deterministicAdmissions)
    if ($intermediateDocument.schemaVersion -ne 3 -or
        $intermediateDocument.operationVersion -ne $ExpectedIntermediateOperationVersion -or
        $intermediateDocument.immutableBuild.id -ne $ExpectedIntermediateBuildId -or
        $intermediateDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedIntermediateArtifactManifestSha256 -or
        $intermediateAdmissions.Count -ne 2 -or
        $intermediateAdmissions[0].operationVersion -ne $ExpectedHistoricalOperationVersion -or
        $intermediateAdmissions[0].status -ne 'superseded' -or
        $intermediateAdmissions[1].operationVersion -ne $ExpectedIntermediateOperationVersion -or
        $intermediateAdmissions[1].status -ne 'active' -or
        $intermediateAdmissions[1].predecessorEvidenceSha256 -ne $ExpectedHistoricalRunSha256 -or
        $intermediateStage.Count -ne 1 -or
        @($intermediateStage[0].runs).Count -ne 1 -or
        $intermediateStage[0].runs[0].id -ne $ExpectedIntermediateRunId -or
        $intermediateStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedHistoricalRunSha256) {
        throw 'BLOCKED: immutable v43 historical record identity is invalid.'
    }
    $olderPredecessorManifest = Join-Path $RepositoryRoot $ExpectedOlderPredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $olderPredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $olderPredecessorManifest) -ne $ExpectedOlderPredecessorManifestSha256) {
        throw 'BLOCKED: immutable v44 predecessor record is missing or changed.'
    }
    $olderPredecessorDocument = [IO.File]::ReadAllText($olderPredecessorManifest) | ConvertFrom-Json
    $olderPredecessorStage = @($olderPredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $olderPredecessorAdmissions = @($olderPredecessorDocument.deterministicAdmissions)
    if ($olderPredecessorDocument.schemaVersion -ne 3 -or
        $olderPredecessorDocument.operationVersion -ne $ExpectedOlderPredecessorOperationVersion -or
        $olderPredecessorDocument.immutableBuild.id -ne $ExpectedOlderPredecessorBuildId -or
        $olderPredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedOlderPredecessorArtifactManifestSha256 -or
        $olderPredecessorAdmissions.Count -ne 3 -or
        $olderPredecessorAdmissions[0].operationVersion -ne $ExpectedHistoricalOperationVersion -or
        $olderPredecessorAdmissions[0].status -ne 'superseded' -or
        $olderPredecessorAdmissions[1].operationVersion -ne $ExpectedIntermediateOperationVersion -or
        $olderPredecessorAdmissions[1].status -ne 'superseded' -or
        $olderPredecessorAdmissions[2].operationVersion -ne $ExpectedOlderPredecessorOperationVersion -or
        $olderPredecessorAdmissions[2].status -ne 'active' -or
        $olderPredecessorAdmissions[2].predecessorEvidenceSha256 -ne $ExpectedIntermediateRunSha256 -or
        $olderPredecessorStage.Count -ne 1 -or
        @($olderPredecessorStage[0].runs).Count -ne 1 -or
        $olderPredecessorStage[0].runs[0].id -ne $ExpectedOlderPredecessorRunId -or
        $olderPredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedIntermediateRunSha256) {
        throw 'BLOCKED: immutable v44 predecessor record identity is invalid.'
    }
    $predecessorManifest = Join-Path $RepositoryRoot $ExpectedPredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $predecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $predecessorManifest) -ne $ExpectedPredecessorManifestSha256) {
        throw 'BLOCKED: immutable v45 predecessor record is missing or changed.'
    }
    $predecessorDocument = [IO.File]::ReadAllText($predecessorManifest) | ConvertFrom-Json
    $predecessorStage = @($predecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $predecessorAdmissions = @($predecessorDocument.deterministicAdmissions)
    if ($predecessorDocument.schemaVersion -ne 3 -or
        $predecessorDocument.operationVersion -ne $ExpectedPredecessorOperationVersion -or
        $predecessorDocument.immutableBuild.id -ne $ExpectedPredecessorBuildId -or
        $predecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedPredecessorArtifactManifestSha256 -or
        $predecessorAdmissions.Count -ne 4 -or
        $predecessorAdmissions[0].operationVersion -ne $ExpectedHistoricalOperationVersion -or
        $predecessorAdmissions[0].status -ne 'superseded' -or
        $predecessorAdmissions[1].operationVersion -ne $ExpectedIntermediateOperationVersion -or
        $predecessorAdmissions[1].status -ne 'superseded' -or
        $predecessorAdmissions[2].operationVersion -ne $ExpectedOlderPredecessorOperationVersion -or
        $predecessorAdmissions[2].status -ne 'superseded' -or
        $predecessorAdmissions[3].operationVersion -ne $ExpectedPredecessorOperationVersion -or
        $predecessorAdmissions[3].status -ne 'active' -or
        $predecessorAdmissions[3].predecessorEvidenceSha256 -ne $ExpectedOlderPredecessorRunSha256 -or
        $predecessorStage.Count -ne 1 -or
        @($predecessorStage[0].runs).Count -ne 1 -or
        $predecessorStage[0].runs[0].id -ne $ExpectedPredecessorRunId -or
        $predecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedOlderPredecessorRunSha256) {
        throw 'BLOCKED: immutable v45 predecessor record identity is invalid.'
    }
    $deterministic = @($evidenceManifest.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    if ($evidenceManifest.operationVersion -ne $ExpectedOperationVersion -or
        $evidenceManifest.immutableBuild.id -ne $ExpectedBuildId -or
        $evidenceManifest.immutableBuild.artifactManifestSha256 -ne $ExpectedArtifactManifestSha256 -or
        $deterministic.Count -ne 1 -or
        @($deterministic[0].runs).Count -ne 1 -or
        $deterministic[0].runs[0].id -ne $ExpectedSimulationRunId -or
        $deterministic[0].runs[0].operationVersion -ne $ExpectedOperationVersion -or
        $deterministic[0].runs[0].buildId -ne $ExpectedBuildId -or
        $deterministic[0].runs[0].artifactManifestSha256 -ne $ExpectedArtifactManifestSha256 -or
        $deterministic[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedPredecessorRunSha256 -or
        @($evidenceManifest.stages | Select-Object -Skip 1 | Where-Object {
            @($_.runs).Count -ne 0 -or @($_.consents).Count -ne 0 -or @($_.reviews).Count -ne 0
        }).Count -ne 0) {
        throw 'BLOCKED: deterministic simulation admission is not the exact active v46 authority.'
    }

    return [pscustomobject]@{
        Manifest = $manifest
        ArtifactRoot = $ExpectedArtifactRoot
        ArtifactManifest = $ExpectedArtifactManifest
        ArtifactManifestSha256 = $actualManifestSha256
        ConfigSha256 = ([string]$manifest.files.cleanWindowsVmConfig.sha256).Replace('sha256:', '')
        RunnerSha256 = ([string]$manifest.files.runner.sha256).Replace('sha256:', '')
    }
}

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-FixedProcess {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(Mandatory)][string[]]$Arguments,
        [Parameter(Mandatory)][string]$WorkingDirectory
    )

    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $FilePath
    $start.WorkingDirectory = $WorkingDirectory
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.Arguments = (($Arguments | ForEach-Object {
        '"' + $_.Replace('"', '\\"') + '"'
    }) -join ' ')
    $process = [Diagnostics.Process]::Start($start)
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    return [pscustomobject]@{
        ExitCode = $process.ExitCode
        Stdout = $stdoutTask.GetAwaiter().GetResult()
        Stderr = $stderrTask.GetAwaiter().GetResult()
    }
}

function Assert-ArtifactVerifierPass {
    param([Parameter(Mandatory)]$Authority)

    $result = Invoke-FixedProcess -FilePath 'cargo.exe' -WorkingDirectory $RepositoryRoot -Arguments @(
        'run', '--quiet', '-p', 'liiiraa-optimizer-service', '--bin', 'phase6-artifact-verifier', '--',
        '--artifact-manifest', $Authority.ArtifactManifest
    )
    if ($result.ExitCode -ne 0) {
        throw 'BLOCKED: the fixed 06-35 compiled-SPKI/CMS/live-byte verifier refused the artifact.'
    }
    $verdict = $result.Stdout | ConvertFrom-Json
    if ($verdict.verdict -ne 'verified' -or
        $verdict.manifestSha256.Replace('sha256:', '') -ne $ExpectedArtifactManifestSha256 -or
        $verdict.operationVersionId -ne $ExpectedOperationVersion) {
        throw 'BLOCKED: the fixed 06-35 verifier returned a mismatched verdict.'
    }
    [void]$CompletedBoundaries.Add('artifact-verifier-pass')
}

function Assert-FreshSimulationAdmission {
    $result = Invoke-FixedProcess -FilePath 'pnpm.cmd' -WorkingDirectory $RepositoryRoot -Arguments @(
        'phase6:verify', '--', '--mode', 'planned'
    )
    if ($result.ExitCode -ne 0 -or $result.Stdout.IndexOf('"ok": true', [StringComparison]::Ordinal) -lt 0 -or
        $result.Stdout.IndexOf('"highestAdmittedStage": "deterministic-simulation"', [StringComparison]::Ordinal) -lt 0) {
        throw 'BLOCKED: fresh deterministic simulation admission failed.'
    }
    [void]$CompletedBoundaries.Add('simulation-admission-pass')
}

function Assert-ExactHyperVAudit {
    $vm = Get-VM -Name $ExpectedVmName -ErrorAction Stop
    if ($vm.Name -ne $ExpectedVmName -or $vm.Generation -ne 2) {
        throw 'BLOCKED: exact Generation 2 VM audit failed.'
    }
    $clean = @(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedCleanCheckpoint -ErrorAction SilentlyContinue)
    if ($clean.Count -ne 1 -or $clean[0].Id.ToString() -ne $ExpectedCleanCheckpointId) {
        throw 'BLOCKED: exact prepared clean checkpoint identity is required.'
    }
    $backup = @(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedBackupCheckpoint -ErrorAction SilentlyContinue)
    if ($backup.Count -ne 1 -or $backup[0].Id.ToString() -ne $ExpectedBackupCheckpointId) {
        throw 'BLOCKED: immutable pre-account backup checkpoint identity is required.'
    }
    if (@(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedInstalledCheckpoint -ErrorAction SilentlyContinue).Count -ne 0) {
        throw 'BLOCKED: installed checkpoint must remain absent before clean-VM execution.'
    }
    $firmware = Get-VMFirmware -VMName $ExpectedVmName
    $security = Get-VMSecurity -VMName $ExpectedVmName
    if ($firmware.SecureBoot.ToString() -ne 'On' -or -not $security.TpmEnabled) {
        throw 'BLOCKED: SecureBoot or TpmEnabled audit failed.'
    }
    foreach ($serviceName in @('vmms', 'vmcompute')) {
        if ((Get-Service -Name $serviceName).Status -ne 'Running') {
            throw 'BLOCKED: required Hyper-V service is unhealthy.'
        }
    }
    $integration = @(Get-VMIntegrationService -VMName $ExpectedVmName)
    $disabled = @($integration | Where-Object { -not $_.Enabled })
    if ($integration.Count -ne 6 -or $disabled.Count -ne 0) {
        throw 'BLOCKED: exactly six enabled Hyper-V integration services are required before start.'
    }
    [void]$CompletedBoundaries.Add('hyper-v-prestart-audit-pass')
    return [pscustomobject]@{ Vm = $vm; CleanCheckpoint = $clean[0]; BackupCheckpoint = $backup[0]; Integration = $integration }
}

function Wait-ExactIntegrationServicesHealthy {
    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    do {
        $integration = @(Get-VMIntegrationService -VMName $ExpectedVmName -ErrorAction Stop)
        $healthy = @($integration | Where-Object { $_.Enabled -and $_.PrimaryStatusDescription -eq 'OK' })
        if ($integration.Count -eq 6 -and $healthy.Count -eq 6) {
            return $healthy
        }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'BLOCKED: exact Hyper-V integration services did not become healthy within 180 seconds.'
}

function Assert-ExactReadOnlyIntegrationHealth {
    $initialVm = Get-VM -Name $ExpectedVmName -ErrorAction Stop
    $initialState = $initialVm.State.ToString()
    $startedForAudit = $false
    try {
        if ($initialState -eq 'Off') {
            Start-VM -Name $ExpectedVmName -ErrorAction Stop | Out-Null
            $startedForAudit = $true
        }
        elseif ($initialState -ne 'Running') {
            throw "BLOCKED: read-only Audit cannot safely observe integration health from VM state $initialState."
        }
        $healthy = Wait-ExactIntegrationServicesHealthy
        [void]$CompletedBoundaries.Add('integration-services-healthy')
        return $healthy
    }
    finally {
        if ($startedForAudit) {
            $currentVm = Get-VM -Name $ExpectedVmName -ErrorAction Stop
            if ($currentVm.State.ToString() -ne 'Off') {
                Stop-VM -Name $ExpectedVmName -Force -Confirm:$false -ErrorAction Stop
            }
            $stopDeadline = [DateTime]::UtcNow.AddSeconds(120)
            do {
                $currentVm = Get-VM -Name $ExpectedVmName -ErrorAction Stop
                if ($currentVm.State.ToString() -eq 'Off') { break }
                Start-Sleep -Seconds 2
            } while ([DateTime]::UtcNow -lt $stopDeadline)
            if ($currentVm.State.ToString() -ne 'Off') {
                throw 'BLOCKED: read-only Audit did not restore the exact VM to its initial Off state within 120 seconds.'
            }
            [void]$CompletedBoundaries.Add('audit-vm-state-restored')
        }
    }
}

function Copy-ExactArtifactToGuest {
    param([Parameter(Mandatory)]$Authority)

    $copies = [Collections.Generic.List[object]]::new()
    [void]$copies.Add([pscustomobject]@{ Source = $ExpectedArtifactManifest; Relative = 'artifact-manifest.json' })
    [void]$copies.Add([pscustomobject]@{ Source = $ExpectedArtifactSignature; Relative = 'artifact-manifest.json.p7s' })
    foreach ($role in $ExpectedManifestRoles) {
        $relative = ([string]$Authority.Manifest.files.$role.relativePath).Replace('/', '\')
        [void]$copies.Add([pscustomobject]@{ Source = (Join-Path $Authority.ArtifactRoot $relative); Relative = $relative })
    }
    if ($copies.Count -ne 11) {
        throw 'BLOCKED: exact staged file cardinality changed.'
    }
    foreach ($copy in $copies) {
        Copy-VMFile -VMName $ExpectedVmName -SourcePath $copy.Source -DestinationPath (Join-Path $ExpectedGuestRoot $copy.Relative) -FileSource Host -CreateFullPath -ErrorAction Stop
    }
    [void]$CompletedBoundaries.Add('exact-artifact-staged')
}

function Assert-ExactGuestArtifactAclSnapshot {
    param(
        [Parameter(Mandatory)]$Snapshot,
        [Parameter(Mandatory)][string]$ExpectedUserSid
    )

    if ($ExpectedUserSid -notmatch '^S-1-5-21-(?:[0-9]+-){3}[0-9]+$') {
        throw 'BLOCKED:guest-acl-principal-mismatch'
    }
    if (@('S-1-5-18', 'S-1-5-32-544') -notcontains [string]$Snapshot.ownerSid) {
        throw 'BLOCKED:guest-acl-owner'
    }
    if (-not [bool]$Snapshot.protected) {
        throw 'BLOCKED:guest-acl-unprotected'
    }
    if (@('directory', 'file') -notcontains [string]$Snapshot.kind -or @($Snapshot.rules).Count -ne 3) {
        throw 'BLOCKED:guest-acl-shape'
    }
    $expectedInheritanceFlags = if ($Snapshot.kind -eq 'directory') { 3 } else { 0 }
    foreach ($rule in @($Snapshot.rules)) {
        if ([bool]$rule.inherited) {
            throw 'BLOCKED:guest-acl-inherited-drift'
        }
        if ([int]$rule.inheritanceFlags -ne $expectedInheritanceFlags -or [int]$rule.propagationFlags -ne 0) {
            throw 'BLOCKED:guest-acl-inheritance-drift'
        }
        if ([string]$rule.accessType -cne 'Allow') {
            throw 'BLOCKED:guest-acl-shape'
        }
    }
    $system = @($Snapshot.rules | Where-Object { $_.sid -eq 'S-1-5-18' })
    $administrators = @($Snapshot.rules | Where-Object { $_.sid -eq 'S-1-5-32-544' })
    $guest = @($Snapshot.rules | Where-Object { $_.sid -eq $ExpectedUserSid })
    if ($system.Count -ne 1 -or $administrators.Count -ne 1 -or $guest.Count -ne 1) {
        throw 'BLOCKED:guest-acl-principal-mismatch'
    }
    if ([int]$system[0].rights -ne 2032127) {
        throw 'BLOCKED:guest-acl-system-full'
    }
    if ([int]$administrators[0].rights -ne 2032127) {
        throw 'BLOCKED:guest-acl-admin-full'
    }
    if ([int]$guest[0].rights -ne 1179817) {
        if ([int]$guest[0].rights -gt 1179817) {
            throw 'BLOCKED:guest-acl-broad-write'
        }
        throw 'BLOCKED:guest-acl-rights-mismatch'
    }
}

function Set-ExactGuestArtifactCustody {
    param([Parameter(Mandatory)][PSCredential]$Credential)

    Invoke-Command -VMName 'LiiiraaBoost-W11-25H2-Clean' -Credential $Credential -ScriptBlock {
        $fixedRoot = 'C:\LiiiraaBoost\Phase6\physical-c714ca4c5ad147f4-managed-power-scheme-v46'
        $fixedFiles = @(
            'artifact-manifest.json',
            'artifact-manifest.json.p7s',
            'configs\clean-windows-vm.run-config.json',
            'configs\friends-pc.run-config.json',
            'installation-manifest.json',
            'installation-manifest.json.p7s',
            'msedgedriver.exe',
            'liiiraa-boost.msi',
            'configs\owner-pc.run-config.json',
            'phase6-physical-runner.exe',
            'tauri-driver.exe'
        )
        if (-not (Test-Path -LiteralPath $fixedRoot -PathType Container)) {
            throw 'BLOCKED:guest-acl-cardinality'
        }
        $actualFiles = @(Get-ChildItem -LiteralPath $fixedRoot -Force -Recurse -File)
        if ($actualFiles.Count -ne 11) {
            throw 'BLOCKED:guest-acl-cardinality'
        }
        foreach ($relative in $fixedFiles) {
            if (-not (Test-Path -LiteralPath (Join-Path $fixedRoot $relative) -PathType Leaf)) {
                throw 'BLOCKED:guest-acl-cardinality'
            }
        }
        $guestSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        if ($guestSid -notmatch '^S-1-5-21-(?:[0-9]+-){3}[0-9]+$') {
            throw 'BLOCKED:guest-acl-principal-mismatch'
        }
        function New-FixedDirectorySecurity {
            $security = [Security.AccessControl.DirectorySecurity]::new()
            $security.SetSecurityDescriptorSddlForm("O:S-1-5-32-544D:P(A;OICI;FA;;;S-1-5-18)(A;OICI;FA;;;S-1-5-32-544)(A;OICI;0x1200a9;;;$guestSid)")
            return $security
        }
        function New-FixedFileSecurity {
            $security = [Security.AccessControl.FileSecurity]::new()
            $security.SetSecurityDescriptorSddlForm("O:S-1-5-32-544D:P(A;;FA;;;S-1-5-18)(A;;FA;;;S-1-5-32-544)(A;;0x1200a9;;;$guestSid)")
            return $security
        }
        foreach ($item in @(Get-ChildItem -LiteralPath $fixedRoot -Force -Recurse | Sort-Object { $_.FullName.Length } -Descending)) {
            if ($item.PSIsContainer) {
                Set-Acl -LiteralPath $item.FullName -AclObject (New-FixedDirectorySecurity)
            } else {
                Set-Acl -LiteralPath $item.FullName -AclObject (New-FixedFileSecurity)
            }
        }
        Set-Acl -LiteralPath $fixedRoot -AclObject (New-FixedDirectorySecurity)
    }
    [void]$CompletedBoundaries.Add('guest-artifact-acl-provisioned')
}

function Assert-ExactGuestArtifactCustody {
    param([Parameter(Mandatory)][PSCredential]$Credential)

    $result = Invoke-Command -VMName 'LiiiraaBoost-W11-25H2-Clean' -Credential $Credential -ScriptBlock {
        $fixedRoot = 'C:\LiiiraaBoost\Phase6\physical-c714ca4c5ad147f4-managed-power-scheme-v46'
        $fixedFiles = @(
            'artifact-manifest.json',
            'artifact-manifest.json.p7s',
            'configs\clean-windows-vm.run-config.json',
            'configs\friends-pc.run-config.json',
            'installation-manifest.json',
            'installation-manifest.json.p7s',
            'msedgedriver.exe',
            'liiiraa-boost.msi',
            'configs\owner-pc.run-config.json',
            'phase6-physical-runner.exe',
            'tauri-driver.exe'
        )
        $guestSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        if ($guestSid -notmatch '^S-1-5-21-(?:[0-9]+-){3}[0-9]+$') {
            throw 'BLOCKED:guest-acl-principal-mismatch'
        }
        $actualFiles = @(Get-ChildItem -LiteralPath $fixedRoot -Force -Recurse -File)
        $actualDirectories = @(Get-ChildItem -LiteralPath $fixedRoot -Force -Recurse -Directory)
        if ($actualFiles.Count -ne 11 -or $actualDirectories.Count -ne 1) {
            throw 'BLOCKED:guest-acl-cardinality'
        }
        foreach ($relative in $fixedFiles) {
            if (-not (Test-Path -LiteralPath (Join-Path $fixedRoot $relative) -PathType Leaf)) {
                throw 'BLOCKED:guest-acl-cardinality'
            }
        }
        $items = @([pscustomobject]@{ Item = Get-Item -LiteralPath $fixedRoot; Kind = 'directory' })
        $items += @($actualDirectories | ForEach-Object { [pscustomobject]@{ Item = $_; Kind = 'directory' } })
        $items += @($actualFiles | ForEach-Object { [pscustomobject]@{ Item = $_; Kind = 'file' } })
        $snapshots = foreach ($entry in $items) {
            $acl = Get-Acl -LiteralPath $entry.Item.FullName
            $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | ForEach-Object {
                [pscustomobject]@{
                    sid = $_.IdentityReference.Value
                    rights = [int]$_.FileSystemRights
                    accessType = $_.AccessControlType.ToString()
                    inherited = [bool]$_.IsInherited
                    inheritanceFlags = [int]$_.InheritanceFlags
                    propagationFlags = [int]$_.PropagationFlags
                }
            })
            [pscustomobject]@{
                kind = $entry.Kind
                ownerSid = $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value
                protected = [bool]$acl.AreAccessRulesProtected
                rules = $rules
            }
        }
        [pscustomobject]@{ guestSid = $guestSid; snapshots = @($snapshots) }
    }
    if (@($result.snapshots).Count -ne 13) {
        throw 'BLOCKED:guest-acl-cardinality'
    }
    foreach ($snapshot in @($result.snapshots)) {
        Assert-ExactGuestArtifactAclSnapshot -Snapshot $snapshot -ExpectedUserSid ([string]$result.guestSid)
    }
    [void]$CompletedBoundaries.Add('guest-artifact-acl-verified')
}

function Resolve-RunnerFailureDiagnostic {
    param(
        [Parameter(Mandatory)][Int64]$ExitCode,
        [AllowEmptyCollection()][string[]]$Stdout = @(),
        [AllowEmptyCollection()][string[]]$Stderr = @(),
        [Parameter(Mandatory)][bool]$BoundsExceeded,
        [ValidateRange(1, 32)][int]$MaximumLines = 32,
        [ValidateRange(1, 4096)][int]$MaximumChars = 4096
    )

    $boundedExitCode = if ($ExitCode -ge 1 -and $ExitCode -le 65535) { [int]$ExitCode } else { $null }
    $lines = @(@($Stdout) + @($Stderr) | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $characterCount = 0
    foreach ($line in $lines) { $characterCount += $line.Length }
    $invalid = $BoundsExceeded -or
        $null -eq $boundedExitCode -or
        $lines.Count -ne 1 -or
        $lines.Count -gt $MaximumLines -or
        $characterCount -gt $MaximumChars
    $failureCode = if ($lines.Count -eq 1) { $lines[0].Trim() } else { $null }
    if (-not $invalid -and
        $failureCode -cmatch '^BLOCKED:[a-z0-9-]{1,64}$' -and
        $failureCode -notmatch '(?i)(password|token|bearer|S-1-5-\d|serial(?:number)?\s*[=:])') {
        return [pscustomobject][ordered]@{
            Reason = 'runner-failure'
            RunnerExitCode = $boundedExitCode
            RunnerFailureCode = $failureCode
        }
    }
    return [pscustomobject][ordered]@{
        Reason = 'runner-output-redacted'
        RunnerExitCode = $boundedExitCode
        RunnerFailureCode = $null
    }
}

function Invoke-ExactGuestRunner {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)][ValidateSet('installed-ready', 'reboot-pending', 'completed')][string]$Stage,
        [string]$ApprovalPhrase
    )

    $script:RunnerFailureStage = $Stage
    $script:RunnerExitCode = $null
    $script:RunnerFailureCode = $null
    $response = Invoke-Command -VMName $ExpectedVmName -Credential $Credential -ScriptBlock {
        param($RunnerPath, $ConfigPath, $Approval, $MaximumLines, $MaximumChars)
        if ($RunnerPath -ne 'C:\LiiiraaBoost\Phase6\physical-c714ca4c5ad147f4-managed-power-scheme-v46\phase6-physical-runner.exe' -or
            $ConfigPath -ne 'C:\LiiiraaBoost\Phase6\physical-c714ca4c5ad147f4-managed-power-scheme-v46\configs\clean-windows-vm.run-config.json') {
            throw 'fixed runner/config path mismatch'
        }
        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = $RunnerPath
        $start.Arguments = '"--run-config" "' + $ConfigPath.Replace('"', '\"') + '"'
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardInput = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        $process = [Diagnostics.Process]::Start($start)
        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if (-not [string]::IsNullOrEmpty($Approval)) {
            $process.StandardInput.WriteLine($Approval)
        }
        $process.StandardInput.Close()
        $process.WaitForExit()
        $stdoutText = $stdoutTask.GetAwaiter().GetResult()
        $stderrText = $stderrTask.GetAwaiter().GetResult()
        $stdout = @($stdoutText -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $stderr = @($stderrText -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
        $boundsExceeded = $stdout.Count + $stderr.Count -gt $MaximumLines -or
            $stdoutText.Length + $stderrText.Length -gt $MaximumChars
        if ($boundsExceeded) {
            $stdout = @()
            $stderr = @()
        }
        [pscustomobject]@{
            ExitCode = [int64]$process.ExitCode
            Stdout = $stdout
            Stderr = $stderr
            BoundsExceeded = $boundsExceeded
        }
    } -ArgumentList $ExpectedGuestRunner, $ExpectedGuestConfig, $ApprovalPhrase, $MaximumRunnerOutputLines, $MaximumRunnerOutputChars
    if ($response.ExitCode -ne 0) {
        $diagnostic = Resolve-RunnerFailureDiagnostic -ExitCode ([int64]$response.ExitCode) -Stdout @($response.Stdout) -Stderr @($response.Stderr) -BoundsExceeded ([bool]$response.BoundsExceeded)
        $script:RunnerExitCode = $diagnostic.RunnerExitCode
        $script:RunnerFailureCode = $diagnostic.RunnerFailureCode
        throw $diagnostic.Reason
    }
    $text = (@($response.Stdout) -join "`n")
    if ($response.BoundsExceeded -or @($response.Stderr).Count -ne 0 -or
        $text -match '(?i)(password|bearer|token\s*[=:]|S-1-5-\d|serial(?:number)?\s*[=:])') {
        $script:RunnerExitCode = 0
        throw 'runner-output-redacted'
    }
    return [pscustomobject]@{ State = (@($response.Stdout)[-1]).Trim(); Output = $text }
}

function Read-ExactGuestBytes {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)][ValidateSet('installed-ready', 'checkpoint-ready', 'continuation', 'raw-envelope')][string]$Kind
    )

    $relative = switch ($Kind) {
        'installed-ready' { 'state\clean-windows-vm\installed-ready.json' }
        'checkpoint-ready' { 'state\clean-windows-vm\checkpoint-ready.json' }
        'continuation' { 'state\clean-windows-vm\physical-continuation.json' }
        'raw-envelope' { 'evidence\clean-windows-vm\raw-run-envelope.json' }
    }
    $path = Join-Path $ExpectedGuestRoot $relative
    return [byte[]](Invoke-Command -VMName $ExpectedVmName -Credential $Credential -ScriptBlock {
        param($FixedPath)
        $bytes = [IO.File]::ReadAllBytes($FixedPath)
        if ($bytes.Length -eq 0 -or $bytes.Length -gt 64KB) { throw 'bounded fixed guest record required' }
        return $bytes
    } -ArgumentList $path)
}

function Assert-RecordBinding {
    param(
        [Parameter(Mandatory)][byte[]]$Bytes,
        [Parameter(Mandatory)][string]$State,
        [Parameter(Mandatory)][int]$Sequence,
        [Parameter(Mandatory)]$Authority
    )

    if ($Bytes.Length -eq 0 -or $Bytes.Length -gt 64KB) { throw 'BLOCKED: lifecycle record bounds failed.' }
    $record = [Text.Encoding]::UTF8.GetString($Bytes) | ConvertFrom-Json
    if ($record.kind -ne 'physical-continuation' -or $record.schemaVersion -ne '1.0' -or
        $record.state -ne $State -or [int]$record.sequence -ne $Sequence -or
        $record.artifactManifestSha256.Replace('sha256:', '') -ne $ExpectedArtifactManifestSha256 -or
        $record.configSha256.Replace('sha256:', '') -ne $Authority.ConfigSha256 -or
        $record.runnerSha256.Replace('sha256:', '') -ne $Authority.RunnerSha256 -or
        $record.stage -ne 'clean-windows-vm' -or
        $record.operationVersionId -ne $ExpectedOperationVersion -or
        $record.buildId -ne $ExpectedBuildId -or
        [string]::IsNullOrWhiteSpace([string]$record.recordHash) -or
        [DateTime]::Parse([string]$record.recordedAt).ToUniversalTime() -gt [DateTime]::UtcNow.AddMinutes(1)) {
        throw 'BLOCKED: lifecycle record identity/time/order mismatch.'
    }
    return $record
}

function Assert-InstalledReadyRecord {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)]$Authority,
        [Parameter(Mandatory)]$RunnerResult
    )

    if ($RunnerResult.State -ne 'InstalledReady') { throw 'BLOCKED: first runner boundary was not InstalledReady.' }
    $bytes = Read-ExactGuestBytes -Credential $Credential -Kind installed-ready
    $record = Assert-RecordBinding -Bytes $bytes -State 'installed-ready' -Sequence 0 -Authority $Authority
    if ($record.previousRecordHash -ne ('sha256:' + ('0' * 64))) { throw 'BLOCKED: installed-ready predecessor mismatch.' }
    [void]$CompletedBoundaries.Add('installed-ready-verified')
    return [pscustomobject]@{ Bytes = $bytes; Record = $record }
}

function New-InstalledCheckpointOnce {
    if (@(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedInstalledCheckpoint -ErrorAction SilentlyContinue).Count -ne 0) {
        throw 'BLOCKED: installed checkpoint already exists; overwrite is forbidden.'
    }
    Checkpoint-VM -Name $ExpectedVmName -SnapshotName $ExpectedInstalledCheckpoint -ErrorAction Stop | Out-Null
    $created = @(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedInstalledCheckpoint -ErrorAction Stop)
    if ($created.Count -ne 1) { throw 'BLOCKED: installed checkpoint create-once verification failed.' }
    [void]$CompletedBoundaries.Add('installed-checkpoint-created')
    return $created[0]
}

function Write-CheckpointReadyRecordOnce {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)]$Authority,
        [Parameter(Mandatory)][byte[]]$InstalledReadyBytes,
        [Parameter(Mandatory)]$InstalledCheckpoint
    )

    $previousHash = 'sha256:' + (Get-Sha256Hex -Bytes $InstalledReadyBytes)
    $observation = 'hyper-v-checkpoint:' + [string]$InstalledCheckpoint.Id
    $recordHash = 'sha256:' + (Get-Sha256Hex -Bytes ([Text.Encoding]::UTF8.GetBytes("checkpoint-ready:1:${previousHash}:$observation")))
    $journalHash = 'sha256:' + (Get-Sha256Hex -Bytes ([Text.Encoding]::UTF8.GetBytes($observation)))
    $record = [ordered]@{
        kind = 'physical-continuation'; schemaVersion = '1.0'; continuationId = "continuation-1-$ExpectedBuildId"
        state = 'checkpoint-ready'; sequence = 1; previousState = 'installed-ready'
        artifactManifestSha256 = 'sha256:' + $ExpectedArtifactManifestSha256
        configSha256 = 'sha256:' + $Authority.ConfigSha256; runnerSha256 = 'sha256:' + $Authority.RunnerSha256
        stage = 'clean-windows-vm'; operationVersionId = $ExpectedOperationVersion; buildId = $ExpectedBuildId
        runId = "run-$ExpectedBuildId"; transactionId = "transaction-$ExpectedBuildId"
        previousRecordHash = $previousHash; recordHash = $recordHash; observedJournalHeadHash = $journalHash
        recordedAt = [DateTime]::UtcNow.ToString('o')
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))
    $path = Join-Path $ExpectedGuestRoot 'state\clean-windows-vm\checkpoint-ready.json'
    Invoke-Command -VMName $ExpectedVmName -Credential $Credential -ScriptBlock {
        param($FixedPath, [byte[]]$FixedBytes)
        $parent = [IO.Path]::GetDirectoryName($FixedPath)
        [IO.Directory]::CreateDirectory($parent) | Out-Null
        $stream = [IO.File]::Open($FixedPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $stream.Write($FixedBytes, 0, $FixedBytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    } -ArgumentList $path, $bytes
    $readBack = Read-ExactGuestBytes -Credential $Credential -Kind checkpoint-ready
    [void](Assert-RecordBinding -Bytes $readBack -State 'checkpoint-ready' -Sequence 1 -Authority $Authority)
    [void]$CompletedBoundaries.Add('checkpoint-ready-created')
}

function Assert-RebootPendingRecord {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)]$Authority,
        [Parameter(Mandatory)]$RunnerResult
    )

    if ($RunnerResult.State -ne 'RebootPending') { throw 'BLOCKED: runner did not reach the reboot-pending boundary.' }
    $bytes = Read-ExactGuestBytes -Credential $Credential -Kind continuation
    $record = Assert-RecordBinding -Bytes $bytes -State 'reboot-pending' -Sequence 3 -Authority $Authority
    if ($record.previousState -ne 'running') { throw 'BLOCKED: reboot continuation predecessor mismatch.' }
    [void]$CompletedBoundaries.Add('reboot-pending-verified')
    return $record
}

function Wait-ExactVmReady {
    param([Parameter(Mandatory)][PSCredential]$Credential)

    $deadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
        try {
            $ready = Invoke-Command -VMName $ExpectedVmName -Credential $Credential -ScriptBlock { 'ready' } -ErrorAction Stop
            if ($ready -eq 'ready') { return }
        }
        catch { Start-Sleep -Seconds 2 }
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'BLOCKED: exact VM did not become available for observation-first continuation.'
}

function Copy-BoundedEvidenceAndIngest {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)]$Authority
    )

    $bytes = Read-ExactGuestBytes -Credential $Credential -Kind raw-envelope
    if ($bytes.Length -gt $MaximumEvidenceBytes) { throw 'BLOCKED: physical evidence exceeds 64KB.' }
    $text = [Text.Encoding]::UTF8.GetString($bytes)
    if ($text -match '(?i)(authorization\s*:|bearer\s+|password\s*[=:]|secret\s*[=:]|token\s*[=:]|S-1-5-\d|serial(?:number)?\s*[=:])') {
        throw 'BLOCKED: physical evidence contains forbidden secret/SID/serial/token fields.'
    }
    $envelope = $text | ConvertFrom-Json
    if ($envelope.observation.source -ne 'phase6-physical-runner-rust-1' -or
        $envelope.observation.stage -ne 'clean-windows-vm' -or
        $envelope.observation.artifactManifestSha256.Replace('sha256:', '') -ne $ExpectedArtifactManifestSha256 -or
        $envelope.observation.configSha256.Replace('sha256:', '') -ne $Authority.ConfigSha256) {
        throw 'BLOCKED: bounded evidence source/custody binding mismatch.'
    }
    $hostEnvelopePath = Join-Path $Authority.ArtifactRoot 'evidence\clean-windows-vm\raw-run-envelope.json'
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($hostEnvelopePath)) | Out-Null
    $stream = [IO.File]::Open($hostEnvelopePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    [void]$CompletedBoundaries.Add('bounded-evidence-copied')

    $EvidenceAuthorityChain = 'phase6-artifact-verifier phase6-physical-runner-rust-1 physical-writer'
    [void]$EvidenceAuthorityChain
    Assert-ArtifactVerifierPass -Authority $Authority
    $writer = Join-Path $RepositoryRoot 'tooling\phase6-evidence\src\physical-writer.ts'
    $result = Invoke-FixedProcess -FilePath 'node.exe' -WorkingDirectory $RepositoryRoot -Arguments @(
        '--experimental-strip-types', $writer, 'ingest', '--artifact-manifest', $Authority.ArtifactManifest,
        '--run-envelope', $hostEnvelopePath, '--stage', 'clean-windows-vm'
    )
    if ($result.ExitCode -ne 0) { throw 'BLOCKED: physical-writer refused the unchanged bounded evidence bytes.' }
    [void]$CompletedBoundaries.Add('physical-writer-ingested')
}

function Write-BlockedRecord {
    param([Parameter(Mandatory)][string]$Reason)

    $directory = Join-Path $LabRoot 'Evidence\phase6'
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $path = Join-Path $directory ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-clean-vm-BLOCKED.json')
    $safeReason = if ($Reason.Length -gt 128 -or $Reason -match '(?i)(password|bearer|token\s*[=:]|S-1-5-\d|serial(?:number)?\s*[=:]|[\r\n])') { 'redacted-blocker' } else { $Reason }
    $record = [ordered]@{
        status = 'BLOCKED'; operationVersion = $ExpectedOperationVersion; buildId = $ExpectedBuildId
        vmName = $ExpectedVmName; cleanCheckpoint = $ExpectedCleanCheckpoint; installedCheckpoint = $ExpectedInstalledCheckpoint
        completedBoundaries = @($CompletedBoundaries); stage = $RunnerFailureStage
        runnerExitCode = $RunnerExitCode; runnerFailureCode = $RunnerFailureCode
        reason = $safeReason; recordedAt = [DateTime]::UtcNow.ToString('o')
    }
    [IO.File]::WriteAllText($path, ($record | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
}

function Invoke-CleanVmRun {
    param(
        [Parameter(Mandatory)]$Authority,
        [Parameter(Mandatory)][PSCredential]$Credential
    )

    if (@(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedInstalledCheckpoint -ErrorAction SilentlyContinue).Count -ne 0) {
        throw 'BLOCKED: installed checkpoint already exists; create-once policy forbids overwrite or reuse.'
    }
    Restore-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedCleanCheckpoint -Confirm:$false -ErrorAction Stop
    [void]$CompletedBoundaries.Add('clean-checkpoint-restored')
    $vm = Get-VM -Name $ExpectedVmName
    if ($vm.State -eq 'Off') { Start-VM -Name $ExpectedVmName | Out-Null }
    Wait-ExactVmReady -Credential $Credential
    [void](Wait-ExactIntegrationServicesHealthy)
    [void]$CompletedBoundaries.Add('integration-services-healthy')
    Copy-ExactArtifactToGuest -Authority $Authority
    Set-ExactGuestArtifactCustody -Credential $Credential
    Assert-ExactGuestArtifactCustody -Credential $Credential

    $first = Invoke-ExactGuestRunner -Credential $Credential -Stage 'installed-ready'
    $installed = Assert-InstalledReadyRecord -Credential $Credential -Authority $Authority -RunnerResult $first
    $installedCheckpoint = New-InstalledCheckpointOnce
    Write-CheckpointReadyRecordOnce -Credential $Credential -Authority $Authority -InstalledReadyBytes $installed.Bytes -InstalledCheckpoint $installedCheckpoint

    $expectedApproval = "APPLY phase6-physical-plan $ExpectedOperationVersion"
    $approval = Read-Host "Type this exact phrase to authorize the guest apply: $expectedApproval"
    if ($approval -cne $expectedApproval) { throw 'BLOCKED: exact physical apply approval was refused.' }
    $second = Invoke-ExactGuestRunner -Credential $Credential -Stage 'reboot-pending' -ApprovalPhrase $approval
    [void](Assert-RebootPendingRecord -Credential $Credential -Authority $Authority -RunnerResult $second)

    Restart-VM -Name $ExpectedVmName -Force -Confirm:$false -ErrorAction Stop
    [void]$CompletedBoundaries.Add('operator-authorized-vm-restart')
    Wait-ExactVmReady -Credential $Credential
    $third = Invoke-ExactGuestRunner -Credential $Credential -Stage 'completed'
    if ($third.State -ne 'Completed') { throw 'BLOCKED: post-boot observation-first runner did not complete.' }
    [void]$CompletedBoundaries.Add('post-boot-observation-complete')
    Copy-BoundedEvidenceAndIngest -Credential $Credential -Authority $Authority
}

Assert-ExactInvocation
$authority = Get-Authority

if ($DryRun) {
    [ordered]@{
        mode = 'dry-run'
        actions = @('Audit', 'RunCleanVm')
        vmName = $ExpectedVmName
        cleanCheckpoint = $ExpectedCleanCheckpoint
        cleanCheckpointId = $ExpectedCleanCheckpointId
        backupCheckpoint = $ExpectedBackupCheckpoint
        backupCheckpointId = $ExpectedBackupCheckpointId
        installedCheckpoint = $ExpectedInstalledCheckpoint
        operationVersion = $ExpectedOperationVersion
        buildId = $ExpectedBuildId
        sourceCommit = $ExpectedSourceCommit
        artifactManifestSha256 = $ExpectedArtifactManifestSha256
        simulationRunSha256 = $ExpectedSimulationRunSha256
        runnerCommand = 'phase6-physical-runner.exe --run-config configs\clean-windows-vm.run-config.json'
        hostPowerMutation = $false
        guestDevelopmentRuntime = $false
        elevationRequiredForLiveAudit = $true
    } | ConvertTo-Json -Depth 4
    exit 0
}

if (-not (Test-IsAdministrator)) {
    throw 'BLOCKED: open one elevated PowerShell; no mutation was applied.'
}

try {
    Assert-ArtifactVerifierPass -Authority $authority
    Assert-FreshSimulationAdmission
    $hyperV = Assert-ExactHyperVAudit
    if ($Action -eq 'Audit') {
        $hyperV.Integration = @(Assert-ExactReadOnlyIntegrationHealth)
        [void]$CompletedBoundaries.Add('hyper-v-audit-pass')
        [ordered]@{
            status = 'PASSED'; action = 'Audit'; readOnly = $true; vmName = $ExpectedVmName
            cleanCheckpoint = $ExpectedCleanCheckpoint; cleanCheckpointId = $ExpectedCleanCheckpointId
            backupCheckpoint = $ExpectedBackupCheckpoint; backupCheckpointId = $ExpectedBackupCheckpointId
            installedCheckpoint = $ExpectedInstalledCheckpoint; installedCheckpointPresent = $false
            operationVersion = $ExpectedOperationVersion
            buildId = $ExpectedBuildId; artifactManifestSha256 = $ExpectedArtifactManifestSha256
            completedBoundaries = @($CompletedBoundaries)
        } | ConvertTo-Json -Depth 4
        exit 0
    }
    if ($null -eq $GuestCredential) {
        $GuestCredential = Get-Credential -Message 'Credencial local da VM (mantida somente na memoria deste processo)'
    }
    if ($null -eq $GuestCredential) { throw 'BLOCKED: in-memory guest credential is required.' }
    Invoke-CleanVmRun -Authority $authority -Credential $GuestCredential
    [ordered]@{ status = 'COMPLETED'; action = 'RunCleanVm'; completedBoundaries = @($CompletedBoundaries) } | ConvertTo-Json -Depth 4
}
catch {
    if ($Action -eq 'RunCleanVm') { Write-BlockedRecord -Reason $_.Exception.Message }
    throw
}
