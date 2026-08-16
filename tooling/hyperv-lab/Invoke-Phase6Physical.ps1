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
$ExpectedCleanCheckpointId = 'a918f5c0-ade0-4bac-bca3-baa91686777e'
$ExpectedBackupCheckpoint = 'Clean-Windows-Ready-PreLabAccount-v43'
$ExpectedBackupCheckpointId = 'ebccd5f3-5645-4089-b469-fa4d851fc6ef'
$ExpectedInstalledCheckpoint = 'LiiiraaBoost-Installed'
$CurrentAuthority = [pscustomobject][ordered]@{
    OperationVersion = 'managed-power-scheme-v58'
    BuildId = 'physical-9f5464923978c943-managed-power-scheme-v58'
    SourceCommit = 'ed529a1c61d4d1b7d8dc59979db7058815a3814e'
    ArtifactManifestSha256 = '2f407cc28495c09fdc8513c4dfd670749ba7b429d6133713af384f603e8aa888'
    SimulationRunId = 'phase6-deterministic-simulation-managed-power-scheme-v58-2f407cc28495'
    SimulationRunSha256 = 'ee3f5275a39982715f5e38a731ed9a1617de9163f05963e68a0a5a23c1ff0e5f'
    EvidenceManifestSha256 = 'c74c3dd1bbe10949597fa938f4330856f6e6b3e18515468bf8ee4c84c772d90e'
    RunnerRelativePath = 'phase6-physical-runner.exe'
    ConfigRelativePath = 'configs\clean-windows-vm.run-config.json'
    GuestRoot = 'C:\LiiiraaBoost\Phase6\physical-9f5464923978c943-managed-power-scheme-v58'
    GuestRunner = 'C:\LiiiraaBoost\Phase6\physical-9f5464923978c943-managed-power-scheme-v58\phase6-physical-runner.exe'
    GuestConfig = 'C:\LiiiraaBoost\Phase6\physical-9f5464923978c943-managed-power-scheme-v58\configs\clean-windows-vm.run-config.json'
}
$ExpectedOperationVersion = $CurrentAuthority.OperationVersion
$ExpectedBuildId = $CurrentAuthority.BuildId
$ExpectedSourceCommit = $CurrentAuthority.SourceCommit
$ExpectedArtifactManifestSha256 = $CurrentAuthority.ArtifactManifestSha256
$ExpectedSimulationRunId = $CurrentAuthority.SimulationRunId
$ExpectedSimulationRunSha256 = $CurrentAuthority.SimulationRunSha256
$ExpectedEvidenceManifestSha256 = $CurrentAuthority.EvidenceManifestSha256
$ExpectedNewestActivePredecessorOperationVersion = 'managed-power-scheme-v57'
$ExpectedNewestActivePredecessorBuildId = 'physical-9f5464923978c943-managed-power-scheme-v57'
$ExpectedNewestActivePredecessorArtifactManifestSha256 = '4f291830874f31250147726467a1ce66e500d6657e0f4229124f280f1abd0cb3'
$ExpectedNewestActivePredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v57-4f291830874f'
$ExpectedNewestActivePredecessorRunSha256 = '62aa6c83e3bd32022d238e75121f93ef2664712c707ed9ba29929b92cc59f762'
$ExpectedNewestActivePredecessorManifestSha256 = '0f1deb2d1fa9e15044fa11f30cee8143a464dc896068de7117146d2480f5d0a1'
$ExpectedNewestActivePredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v57-evidence-manifest.json'
$ExpectedImmediateActivePredecessorOperationVersion = 'managed-power-scheme-v56'
$ExpectedImmediateActivePredecessorBuildId = 'physical-c013840c872b6f81-managed-power-scheme-v56'
$ExpectedImmediateActivePredecessorArtifactManifestSha256 = '4bffc051607994b34a29f96afd2ac12f173815f84519ab1855090ff89fcb060f'
$ExpectedImmediateActivePredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v56-4bffc0516079'
$ExpectedImmediateActivePredecessorRunSha256 = '858c24f08a246793aff101183a0e6876fdb4189d3bae4ad48d30cf74d2b65940'
$ExpectedImmediateActivePredecessorManifestSha256 = '29d024104cc942ef34e5d5dd8ae0bb906b9375341818587e9e102320fd359be4'
$ExpectedImmediateActivePredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v56-evidence-manifest.json'
$ExpectedLatestActivePredecessorOperationVersion = 'managed-power-scheme-v55'
$ExpectedLatestActivePredecessorBuildId = 'physical-4c88acfffc6c9dc2-managed-power-scheme-v55'
$ExpectedLatestActivePredecessorArtifactManifestSha256 = 'e38830867effd2f71562a7732a12ab1645a6b88cc8c3f4ad36a44abd0197fb7a'
$ExpectedLatestActivePredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v55-e38830867eff'
$ExpectedLatestActivePredecessorRunSha256 = 'a5d3de5a10249b0f7c7bf7cf922668eea3073e31fc2862ab31e9c667c0b5d3cb'
$ExpectedLatestActivePredecessorManifestSha256 = 'eed0d494cae1778f4099a3ee90e97e22b81235b5fdc8ddc18876ce17cc75f8d8'
$ExpectedLatestActivePredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v55-evidence-manifest.json'
$ExpectedActivePredecessorOperationVersion = 'managed-power-scheme-v54'
$ExpectedActivePredecessorBuildId = 'physical-0fb27dbbc1f09383-managed-power-scheme-v54'
$ExpectedActivePredecessorArtifactManifestSha256 = '07e2e082d865bc3ccd22f167108f14e9ce9eb1b517ce624a79e64481b0687c40'
$ExpectedActivePredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v54-07e2e082d865'
$ExpectedActivePredecessorRunSha256 = 'bc06bea9da9baa679e10c82703d4cf9588220fc8f0e976082fd438e8e5914965'
$ExpectedActivePredecessorManifestSha256 = '681e2c64cc0ee154149753e07fe4d78398d3eac79237b371b87a0d4d5da21e63'
$ExpectedActivePredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v54-evidence-manifest.json'
$ExpectedImmediateCurrentPredecessorOperationVersion = 'managed-power-scheme-v53'
$ExpectedImmediateCurrentPredecessorBuildId = 'physical-468a05974898514d-managed-power-scheme-v53'
$ExpectedImmediateCurrentPredecessorArtifactManifestSha256 = '6d2e76a71014ea056c4fd0027d46f5fe26c500616885e1153b326d9dbf024271'
$ExpectedImmediateCurrentPredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v53-6d2e76a71014'
$ExpectedImmediateCurrentPredecessorRunSha256 = '01666800658d5aac14e99b46a14e0a23497c937710f38168e9559e92d2bee7ba'
$ExpectedImmediateCurrentPredecessorManifestSha256 = '513ce2511f826316a2851c109bd7d433d5ade7b2c003d07d48b74cfd497a5833'
$ExpectedImmediateCurrentPredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v53-evidence-manifest.json'
$ExpectedCurrentPredecessorOperationVersion = 'managed-power-scheme-v52'
$ExpectedCurrentPredecessorBuildId = 'physical-487e3c326b5066a0-managed-power-scheme-v52'
$ExpectedCurrentPredecessorArtifactManifestSha256 = 'e11d36a6285af09417d397681692e9e65bce959ff87047686d435401c52b66b3'
$ExpectedCurrentPredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v52-e11d36a6285a'
$ExpectedCurrentPredecessorRunSha256 = '1dfaa8be4dac42e9f5c45cba7dea0ffc08606d9828948112cf07ac9df6301644'
$ExpectedCurrentPredecessorManifestSha256 = '9c98b29b9d42539963944bd26e34106e95314ca3ccc26ac856a3ae175720b598'
$ExpectedCurrentPredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v52-evidence-manifest.json'
$ExpectedNewestPredecessorOperationVersion = 'managed-power-scheme-v50'
$ExpectedNewestPredecessorBuildId = 'physical-487e3c326b5066a0-managed-power-scheme-v50'
$ExpectedNewestPredecessorArtifactManifestSha256 = 'c02d0310205662e0d9e3a8fc9b5240bd954d82b4e28924f4a9c30c10c8b5516b'
$ExpectedNewestPredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v50-c02d03102056'
$ExpectedNewestPredecessorRunSha256 = 'ceba27bb8e17dd0bf333300e29bbdab9bfbcf2b3bdf45854f2d7bd6cc95ac36b'
$ExpectedNewestPredecessorManifestSha256 = '41260143ac410eeef9133a7a7b79ec5354e1278d2491c6c2a036eacfe727735c'
$ExpectedNewestPredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v50-evidence-manifest.json'
$ExpectedLatestPredecessorOperationVersion = 'managed-power-scheme-v49'
$ExpectedLatestPredecessorBuildId = 'physical-487e3c326b5066a0-managed-power-scheme-v49'
$ExpectedLatestPredecessorArtifactManifestSha256 = 'e3c904651333c0ac22b0706ffed4fc932a0ac18db76a87f02e863693ae78be09'
$ExpectedLatestPredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v49-e3c904651333'
$ExpectedLatestPredecessorRunSha256 = '5fa130be15b8cc0e3da89b2825e791fd2d5e725f3bc2f296341f4a54d4daf92d'
$ExpectedLatestPredecessorManifestSha256 = '2f197d2be921e8c46ca7913c7c76f8b6b2a5acc31f36968cbf1a6188d07fbd24'
$ExpectedLatestPredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v49-evidence-manifest.json'
$ExpectedPriorPredecessorOperationVersion = 'managed-power-scheme-v47'
$ExpectedPriorPredecessorBuildId = 'physical-50796b7236b2889c-managed-power-scheme-v47'
$ExpectedPriorPredecessorArtifactManifestSha256 = '31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b'
$ExpectedPriorPredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v47-31a039f7a4e3'
$ExpectedPriorPredecessorRunSha256 = 'b9d29c44b13dd23b113413c5c64315783b2b176d3dfaa72ec76b096e163608f6'
$ExpectedPriorPredecessorManifestSha256 = 'b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8'
$ExpectedPriorPredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v47-evidence-manifest.json'
$ExpectedImmediatePredecessorOperationVersion = 'managed-power-scheme-v46'
$ExpectedImmediatePredecessorBuildId = 'physical-c714ca4c5ad147f4-managed-power-scheme-v46'
$ExpectedImmediatePredecessorArtifactManifestSha256 = 'a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da'
$ExpectedImmediatePredecessorRunId = 'phase6-deterministic-simulation-managed-power-scheme-v46-a2be09354be8'
$ExpectedImmediatePredecessorRunSha256 = 'ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229'
$ExpectedImmediatePredecessorManifestSha256 = 'd2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da'
$ExpectedImmediatePredecessorManifestRelativePath = 'tooling/phase6-evidence/records/superseded/managed-power-scheme-v46-evidence-manifest.json'
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
$ExpectedRunnerRelativePath = $CurrentAuthority.RunnerRelativePath
$ExpectedConfigRelativePath = $CurrentAuthority.ConfigRelativePath
$ExpectedGuestRoot = $CurrentAuthority.GuestRoot
$ExpectedGuestRunner = $CurrentAuthority.GuestRunner
$ExpectedGuestConfig = $CurrentAuthority.GuestConfig
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
$CurrentAuthority | Add-Member -NotePropertyName ArtifactRoot -NotePropertyValue $ExpectedArtifactRoot
$CurrentAuthority | Add-Member -NotePropertyName ArtifactManifest -NotePropertyValue $ExpectedArtifactManifest
$CurrentAuthority | Add-Member -NotePropertyName ArtifactSignature -NotePropertyValue $ExpectedArtifactSignature
$CurrentAuthority | Add-Member -NotePropertyName EvidenceManifest -NotePropertyValue $ExpectedEvidenceManifest
$LabRoot = 'C:\Users\Liiiraa\VM-Lab'
$CompletedBoundaries = [Collections.Generic.List[string]]::new()
$MaximumRunnerOutputLines = 32
$MaximumRunnerOutputChars = 4096
$RunnerFailureStage = 'preflight'
$RunnerExitCode = $null
$RunnerFailureCode = $null
$InstallerDiagnostic = $null
$InstalledCustodyDiagnostic = $null
$WebDriverDiagnostic = $null

function Assert-ClosedCurrentAuthority {
    $expectedKeys = @(
        'OperationVersion', 'BuildId', 'SourceCommit', 'ArtifactManifestSha256',
        'SimulationRunId', 'SimulationRunSha256', 'EvidenceManifestSha256',
        'RunnerRelativePath', 'ConfigRelativePath', 'GuestRoot', 'GuestRunner',
        'GuestConfig', 'ArtifactRoot', 'ArtifactManifest', 'ArtifactSignature',
        'EvidenceManifest'
    ) | Sort-Object
    $actualKeys = @($CurrentAuthority.PSObject.Properties.Name | Sort-Object)
    $escapedOperation = [regex]::Escape([string]$CurrentAuthority.OperationVersion)
    $expectedGuestRoot = "C:\LiiiraaBoost\Phase6\$($CurrentAuthority.BuildId)"
    $expectedArtifactRoot = Join-Path $RepositoryRoot "target\phase6-physical\$($CurrentAuthority.SourceCommit)\$($CurrentAuthority.BuildId)"
    if (@(Compare-Object -ReferenceObject $expectedKeys -DifferenceObject $actualKeys).Count -ne 0 -or
        $CurrentAuthority.OperationVersion -notmatch '^managed-power-scheme-v[0-9]+$' -or
        $CurrentAuthority.BuildId -notmatch "^physical-[0-9a-f]{16}-$escapedOperation$" -or
        $CurrentAuthority.SourceCommit -notmatch '^[0-9a-f]{40}$' -or
        $CurrentAuthority.ArtifactManifestSha256 -notmatch '^[0-9a-f]{64}$' -or
        $CurrentAuthority.SimulationRunSha256 -notmatch '^[0-9a-f]{64}$' -or
        $CurrentAuthority.EvidenceManifestSha256 -notmatch '^[0-9a-f]{64}$' -or
        $CurrentAuthority.RunnerRelativePath -cne 'phase6-physical-runner.exe' -or
        $CurrentAuthority.ConfigRelativePath -cne 'configs\clean-windows-vm.run-config.json' -or
        $CurrentAuthority.GuestRoot -cne $expectedGuestRoot -or
        $CurrentAuthority.GuestRunner -cne (Join-Path $expectedGuestRoot $CurrentAuthority.RunnerRelativePath) -or
        $CurrentAuthority.GuestConfig -cne (Join-Path $expectedGuestRoot $CurrentAuthority.ConfigRelativePath) -or
        $CurrentAuthority.ArtifactRoot -cne $expectedArtifactRoot -or
        $CurrentAuthority.ArtifactManifest -cne (Join-Path $expectedArtifactRoot 'artifact-manifest.json') -or
        $CurrentAuthority.ArtifactSignature -cne (Join-Path $expectedArtifactRoot 'artifact-manifest.json.p7s') -or
        $CurrentAuthority.EvidenceManifest -cne (Join-Path $RepositoryRoot 'tooling\phase6-evidence\evidence-manifest.json')) {
        throw 'BLOCKED: current physical authority is widened or internally inconsistent.'
    }
}

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
        $ExpectedNewestActivePredecessorOperationVersion,
        $ExpectedNewestActivePredecessorRunSha256,
        $ExpectedNewestActivePredecessorManifestSha256,
        $ExpectedImmediateActivePredecessorOperationVersion,
        $ExpectedImmediateActivePredecessorRunSha256,
        $ExpectedImmediateActivePredecessorManifestSha256,
        $ExpectedLatestActivePredecessorOperationVersion,
        $ExpectedLatestActivePredecessorRunSha256,
        $ExpectedLatestActivePredecessorManifestSha256,
        $ExpectedActivePredecessorOperationVersion,
        $ExpectedActivePredecessorRunSha256,
        $ExpectedActivePredecessorManifestSha256,
        $ExpectedImmediateCurrentPredecessorOperationVersion,
        $ExpectedImmediateCurrentPredecessorRunSha256,
        $ExpectedImmediateCurrentPredecessorManifestSha256,
        $ExpectedCurrentPredecessorOperationVersion,
        $ExpectedCurrentPredecessorRunSha256,
        $ExpectedCurrentPredecessorManifestSha256,
        $ExpectedNewestPredecessorOperationVersion,
        $ExpectedNewestPredecessorRunSha256,
        $ExpectedNewestPredecessorManifestSha256,
        $ExpectedLatestPredecessorOperationVersion,
        $ExpectedLatestPredecessorRunSha256,
        $ExpectedLatestPredecessorManifestSha256,
        $ExpectedPriorPredecessorOperationVersion,
        $ExpectedPriorPredecessorRunSha256,
        $ExpectedPriorPredecessorManifestSha256,
        $ExpectedImmediatePredecessorOperationVersion,
        $ExpectedImmediatePredecessorRunSha256,
        $ExpectedImmediatePredecessorManifestSha256,
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
    if ($admissions.Count -ne 15 -or @($admissions | Where-Object { $_.status -eq 'active' }).Count -ne 1) {
        throw 'BLOCKED: deterministic admission chain must contain fourteen predecessors and one active successor.'
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
    $immediatePredecessor = $admissions[4]
    $priorPredecessor = $admissions[5]
    $latestPredecessor = $admissions[6]
    $newestPredecessor = $admissions[7]
    $currentPredecessor = $admissions[8]
    $immediateCurrentPredecessor = $admissions[9]
    $activePredecessor = $admissions[10]
    $latestActivePredecessor = $admissions[11]
    $immediateActivePredecessor = $admissions[12]
    $newestActivePredecessor = $admissions[13]
    $active = $admissions[14]
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
        $predecessor.successorEvidenceSha256 -ne $ExpectedImmediatePredecessorRunSha256 -or
        $predecessor.manifestRecord.path -ne $ExpectedPredecessorManifestRelativePath -or
        $predecessor.manifestRecord.sha256 -ne $ExpectedPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v45 predecessor identity is invalid or reactivated.'
    }
    if ($immediatePredecessor.status -ne 'superseded' -or
        $immediatePredecessor.operationVersion -ne $ExpectedImmediatePredecessorOperationVersion -or
        $immediatePredecessor.buildId -ne $ExpectedImmediatePredecessorBuildId -or
        $immediatePredecessor.artifactManifestSha256 -ne $ExpectedImmediatePredecessorArtifactManifestSha256 -or
        $immediatePredecessor.runEvidenceId -ne $ExpectedImmediatePredecessorRunId -or
        $immediatePredecessor.runEvidenceSha256 -ne $ExpectedImmediatePredecessorRunSha256 -or
        $immediatePredecessor.predecessorEvidenceSha256 -ne $ExpectedPredecessorRunSha256 -or
        $immediatePredecessor.successorEvidenceSha256 -ne $ExpectedPriorPredecessorRunSha256 -or
        $immediatePredecessor.manifestRecord.path -ne $ExpectedImmediatePredecessorManifestRelativePath -or
        $immediatePredecessor.manifestRecord.sha256 -ne $ExpectedImmediatePredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v46 predecessor identity is invalid or reactivated.'
    }
    if ($priorPredecessor.status -ne 'superseded' -or
        $priorPredecessor.operationVersion -ne $ExpectedPriorPredecessorOperationVersion -or
        $priorPredecessor.buildId -ne $ExpectedPriorPredecessorBuildId -or
        $priorPredecessor.artifactManifestSha256 -ne $ExpectedPriorPredecessorArtifactManifestSha256 -or
        $priorPredecessor.runEvidenceId -ne $ExpectedPriorPredecessorRunId -or
        $priorPredecessor.runEvidenceSha256 -ne $ExpectedPriorPredecessorRunSha256 -or
        $priorPredecessor.predecessorEvidenceSha256 -ne $ExpectedImmediatePredecessorRunSha256 -or
        $priorPredecessor.successorEvidenceSha256 -ne $ExpectedLatestPredecessorRunSha256 -or
        $priorPredecessor.manifestRecord.path -ne $ExpectedPriorPredecessorManifestRelativePath -or
        $priorPredecessor.manifestRecord.sha256 -ne $ExpectedPriorPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v47 predecessor identity is invalid or reactivated.'
    }
    if ($latestPredecessor.status -ne 'superseded' -or
        $latestPredecessor.operationVersion -ne $ExpectedLatestPredecessorOperationVersion -or
        $latestPredecessor.buildId -ne $ExpectedLatestPredecessorBuildId -or
        $latestPredecessor.artifactManifestSha256 -ne $ExpectedLatestPredecessorArtifactManifestSha256 -or
        $latestPredecessor.runEvidenceId -ne $ExpectedLatestPredecessorRunId -or
        $latestPredecessor.runEvidenceSha256 -ne $ExpectedLatestPredecessorRunSha256 -or
        $latestPredecessor.predecessorEvidenceSha256 -ne $ExpectedPriorPredecessorRunSha256 -or
        $latestPredecessor.successorEvidenceSha256 -ne $ExpectedNewestPredecessorRunSha256 -or
        $latestPredecessor.manifestRecord.path -ne $ExpectedLatestPredecessorManifestRelativePath -or
        $latestPredecessor.manifestRecord.sha256 -ne $ExpectedLatestPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v49 predecessor identity is invalid or reactivated.'
    }
    if ($newestPredecessor.status -ne 'superseded' -or
        $newestPredecessor.operationVersion -ne $ExpectedNewestPredecessorOperationVersion -or
        $newestPredecessor.buildId -ne $ExpectedNewestPredecessorBuildId -or
        $newestPredecessor.artifactManifestSha256 -ne $ExpectedNewestPredecessorArtifactManifestSha256 -or
        $newestPredecessor.runEvidenceId -ne $ExpectedNewestPredecessorRunId -or
        $newestPredecessor.runEvidenceSha256 -ne $ExpectedNewestPredecessorRunSha256 -or
        $newestPredecessor.predecessorEvidenceSha256 -ne $ExpectedLatestPredecessorRunSha256 -or
        $newestPredecessor.successorEvidenceSha256 -ne $ExpectedCurrentPredecessorRunSha256 -or
        $newestPredecessor.manifestRecord.path -ne $ExpectedNewestPredecessorManifestRelativePath -or
        $newestPredecessor.manifestRecord.sha256 -ne $ExpectedNewestPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v50 predecessor identity is invalid or reactivated.'
    }
    if ($currentPredecessor.status -ne 'superseded' -or
        $currentPredecessor.operationVersion -ne $ExpectedCurrentPredecessorOperationVersion -or
        $currentPredecessor.buildId -ne $ExpectedCurrentPredecessorBuildId -or
        $currentPredecessor.artifactManifestSha256 -ne $ExpectedCurrentPredecessorArtifactManifestSha256 -or
        $currentPredecessor.runEvidenceId -ne $ExpectedCurrentPredecessorRunId -or
        $currentPredecessor.runEvidenceSha256 -ne $ExpectedCurrentPredecessorRunSha256 -or
        $currentPredecessor.predecessorEvidenceSha256 -ne $ExpectedNewestPredecessorRunSha256 -or
        $currentPredecessor.successorEvidenceSha256 -ne $ExpectedImmediateCurrentPredecessorRunSha256 -or
        $currentPredecessor.manifestRecord.path -ne $ExpectedCurrentPredecessorManifestRelativePath -or
        $currentPredecessor.manifestRecord.sha256 -ne $ExpectedCurrentPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v52 predecessor identity is invalid or reactivated.'
    }
    if ($immediateCurrentPredecessor.status -ne 'superseded' -or
        $immediateCurrentPredecessor.operationVersion -ne $ExpectedImmediateCurrentPredecessorOperationVersion -or
        $immediateCurrentPredecessor.buildId -ne $ExpectedImmediateCurrentPredecessorBuildId -or
        $immediateCurrentPredecessor.artifactManifestSha256 -ne $ExpectedImmediateCurrentPredecessorArtifactManifestSha256 -or
        $immediateCurrentPredecessor.runEvidenceId -ne $ExpectedImmediateCurrentPredecessorRunId -or
        $immediateCurrentPredecessor.runEvidenceSha256 -ne $ExpectedImmediateCurrentPredecessorRunSha256 -or
        $immediateCurrentPredecessor.predecessorEvidenceSha256 -ne $ExpectedCurrentPredecessorRunSha256 -or
        $immediateCurrentPredecessor.successorEvidenceSha256 -ne $ExpectedActivePredecessorRunSha256 -or
        $immediateCurrentPredecessor.manifestRecord.path -ne $ExpectedImmediateCurrentPredecessorManifestRelativePath -or
        $immediateCurrentPredecessor.manifestRecord.sha256 -ne $ExpectedImmediateCurrentPredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v53 predecessor identity is invalid or reactivated.'
    }
    if ($activePredecessor.status -ne 'superseded' -or
        $activePredecessor.operationVersion -ne $ExpectedActivePredecessorOperationVersion -or
        $activePredecessor.buildId -ne $ExpectedActivePredecessorBuildId -or
        $activePredecessor.artifactManifestSha256 -ne $ExpectedActivePredecessorArtifactManifestSha256 -or
        $activePredecessor.runEvidenceId -ne $ExpectedActivePredecessorRunId -or
        $activePredecessor.runEvidenceSha256 -ne $ExpectedActivePredecessorRunSha256 -or
        $activePredecessor.predecessorEvidenceSha256 -ne $ExpectedImmediateCurrentPredecessorRunSha256 -or
        $activePredecessor.successorEvidenceSha256 -ne $ExpectedLatestActivePredecessorRunSha256 -or
        $activePredecessor.manifestRecord.path -ne $ExpectedActivePredecessorManifestRelativePath -or
        $activePredecessor.manifestRecord.sha256 -ne $ExpectedActivePredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v54 predecessor identity is invalid or reactivated.'
    }
    if ($latestActivePredecessor.status -ne 'superseded' -or
        $latestActivePredecessor.operationVersion -ne $ExpectedLatestActivePredecessorOperationVersion -or
        $latestActivePredecessor.buildId -ne $ExpectedLatestActivePredecessorBuildId -or
        $latestActivePredecessor.artifactManifestSha256 -ne $ExpectedLatestActivePredecessorArtifactManifestSha256 -or
        $latestActivePredecessor.runEvidenceId -ne $ExpectedLatestActivePredecessorRunId -or
        $latestActivePredecessor.runEvidenceSha256 -ne $ExpectedLatestActivePredecessorRunSha256 -or
        $latestActivePredecessor.predecessorEvidenceSha256 -ne $ExpectedActivePredecessorRunSha256 -or
        $latestActivePredecessor.successorEvidenceSha256 -ne $ExpectedImmediateActivePredecessorRunSha256 -or
        $latestActivePredecessor.manifestRecord.path -ne $ExpectedLatestActivePredecessorManifestRelativePath -or
        $latestActivePredecessor.manifestRecord.sha256 -ne $ExpectedLatestActivePredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v55 predecessor identity is invalid or reactivated.'
    }
    if ($immediateActivePredecessor.status -ne 'superseded' -or
        $immediateActivePredecessor.operationVersion -ne $ExpectedImmediateActivePredecessorOperationVersion -or
        $immediateActivePredecessor.buildId -ne $ExpectedImmediateActivePredecessorBuildId -or
        $immediateActivePredecessor.artifactManifestSha256 -ne $ExpectedImmediateActivePredecessorArtifactManifestSha256 -or
        $immediateActivePredecessor.runEvidenceId -ne $ExpectedImmediateActivePredecessorRunId -or
        $immediateActivePredecessor.runEvidenceSha256 -ne $ExpectedImmediateActivePredecessorRunSha256 -or
        $immediateActivePredecessor.predecessorEvidenceSha256 -ne $ExpectedLatestActivePredecessorRunSha256 -or
        $immediateActivePredecessor.successorEvidenceSha256 -ne $ExpectedNewestActivePredecessorRunSha256 -or
        $immediateActivePredecessor.manifestRecord.path -ne $ExpectedImmediateActivePredecessorManifestRelativePath -or
        $immediateActivePredecessor.manifestRecord.sha256 -ne $ExpectedImmediateActivePredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v56 predecessor identity is invalid or reactivated.'
    }
    if ($newestActivePredecessor.status -ne 'superseded' -or
        $newestActivePredecessor.operationVersion -ne $ExpectedNewestActivePredecessorOperationVersion -or
        $newestActivePredecessor.buildId -ne $ExpectedNewestActivePredecessorBuildId -or
        $newestActivePredecessor.artifactManifestSha256 -ne $ExpectedNewestActivePredecessorArtifactManifestSha256 -or
        $newestActivePredecessor.runEvidenceId -ne $ExpectedNewestActivePredecessorRunId -or
        $newestActivePredecessor.runEvidenceSha256 -ne $ExpectedNewestActivePredecessorRunSha256 -or
        $newestActivePredecessor.predecessorEvidenceSha256 -ne $ExpectedImmediateActivePredecessorRunSha256 -or
        $newestActivePredecessor.successorEvidenceSha256 -ne $ExpectedSimulationRunSha256 -or
        $newestActivePredecessor.manifestRecord.path -ne $ExpectedNewestActivePredecessorManifestRelativePath -or
        $newestActivePredecessor.manifestRecord.sha256 -ne $ExpectedNewestActivePredecessorManifestSha256) {
        throw 'BLOCKED: physically BLOCKED v57 predecessor identity is invalid or reactivated.'
    }
    if ($active.status -ne 'active' -or
        $active.operationVersion -ne $ExpectedOperationVersion -or
        $active.buildId -ne $ExpectedBuildId -or
        $active.artifactManifestSha256 -ne $ExpectedArtifactManifestSha256 -or
        $active.runEvidenceId -ne $ExpectedSimulationRunId -or
        $active.runEvidenceSha256 -ne $ExpectedSimulationRunSha256 -or
        $active.predecessorEvidenceSha256 -ne $ExpectedNewestActivePredecessorRunSha256 -or
        $null -ne $active.successorEvidenceSha256 -or
        $null -ne $active.manifestRecord) {
        throw 'BLOCKED: active v58 deterministic admission tuple/hash/link mismatch.'
    }
    if (($admissions | ConvertTo-Json -Depth 8).IndexOf('managed-power-scheme-v42', [StringComparison]::Ordinal) -ge 0) {
        throw 'BLOCKED: rejected v42 cannot belong to the deterministic admission chain.'
    }
    if (($admissions | ConvertTo-Json -Depth 8).IndexOf('managed-power-scheme-v48', [StringComparison]::Ordinal) -ge 0) {
        throw 'BLOCKED: pre-artifact v48 cannot belong to the deterministic admission chain.'
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
    $immediatePredecessorManifest = Join-Path $RepositoryRoot $ExpectedImmediatePredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $immediatePredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $immediatePredecessorManifest) -ne $ExpectedImmediatePredecessorManifestSha256) {
        throw 'BLOCKED: immutable v46 predecessor record is missing or changed.'
    }
    $immediatePredecessorDocument = [IO.File]::ReadAllText($immediatePredecessorManifest) | ConvertFrom-Json
    $immediatePredecessorStage = @($immediatePredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $immediatePredecessorAdmissions = @($immediatePredecessorDocument.deterministicAdmissions)
    if ($immediatePredecessorDocument.schemaVersion -ne 3 -or
        $immediatePredecessorDocument.operationVersion -ne $ExpectedImmediatePredecessorOperationVersion -or
        $immediatePredecessorDocument.immutableBuild.id -ne $ExpectedImmediatePredecessorBuildId -or
        $immediatePredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedImmediatePredecessorArtifactManifestSha256 -or
        $immediatePredecessorAdmissions.Count -ne 5 -or
        $immediatePredecessorAdmissions[0].operationVersion -ne $ExpectedHistoricalOperationVersion -or
        $immediatePredecessorAdmissions[0].status -ne 'superseded' -or
        $immediatePredecessorAdmissions[1].operationVersion -ne $ExpectedIntermediateOperationVersion -or
        $immediatePredecessorAdmissions[1].status -ne 'superseded' -or
        $immediatePredecessorAdmissions[2].operationVersion -ne $ExpectedOlderPredecessorOperationVersion -or
        $immediatePredecessorAdmissions[2].status -ne 'superseded' -or
        $immediatePredecessorAdmissions[3].operationVersion -ne $ExpectedPredecessorOperationVersion -or
        $immediatePredecessorAdmissions[3].status -ne 'superseded' -or
        $immediatePredecessorAdmissions[4].operationVersion -ne $ExpectedImmediatePredecessorOperationVersion -or
        $immediatePredecessorAdmissions[4].status -ne 'active' -or
        $immediatePredecessorAdmissions[4].predecessorEvidenceSha256 -ne $ExpectedPredecessorRunSha256 -or
        $immediatePredecessorStage.Count -ne 1 -or
        @($immediatePredecessorStage[0].runs).Count -ne 1 -or
        $immediatePredecessorStage[0].runs[0].id -ne $ExpectedImmediatePredecessorRunId -or
        $immediatePredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedPredecessorRunSha256) {
        throw 'BLOCKED: immutable v46 predecessor record identity is invalid.'
    }
    $priorPredecessorManifest = Join-Path $RepositoryRoot $ExpectedPriorPredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $priorPredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $priorPredecessorManifest) -ne $ExpectedPriorPredecessorManifestSha256) {
        throw 'BLOCKED: immutable v47 predecessor record is missing or changed.'
    }
    $priorPredecessorDocument = [IO.File]::ReadAllText($priorPredecessorManifest) | ConvertFrom-Json
    $priorPredecessorStage = @($priorPredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $priorPredecessorAdmissions = @($priorPredecessorDocument.deterministicAdmissions)
    if ($priorPredecessorDocument.schemaVersion -ne 3 -or
        $priorPredecessorDocument.operationVersion -ne $ExpectedPriorPredecessorOperationVersion -or
        $priorPredecessorDocument.immutableBuild.id -ne $ExpectedPriorPredecessorBuildId -or
        $priorPredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedPriorPredecessorArtifactManifestSha256 -or
        $priorPredecessorAdmissions.Count -ne 6 -or
        $priorPredecessorAdmissions[5].operationVersion -ne $ExpectedPriorPredecessorOperationVersion -or
        $priorPredecessorAdmissions[5].status -ne 'active' -or
        $priorPredecessorAdmissions[5].predecessorEvidenceSha256 -ne $ExpectedImmediatePredecessorRunSha256 -or
        $priorPredecessorStage.Count -ne 1 -or
        @($priorPredecessorStage[0].runs).Count -ne 1 -or
        $priorPredecessorStage[0].runs[0].id -ne $ExpectedPriorPredecessorRunId -or
        $priorPredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedImmediatePredecessorRunSha256) {
        throw 'BLOCKED: immutable v47 predecessor record identity is invalid.'
    }
    $latestPredecessorManifest = Join-Path $RepositoryRoot $ExpectedLatestPredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $latestPredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $latestPredecessorManifest) -ne $ExpectedLatestPredecessorManifestSha256) {
        throw 'BLOCKED: immutable v49 predecessor record is missing or changed.'
    }
    $latestPredecessorDocument = [IO.File]::ReadAllText($latestPredecessorManifest) | ConvertFrom-Json
    $latestPredecessorStage = @($latestPredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $latestPredecessorAdmissions = @($latestPredecessorDocument.deterministicAdmissions)
    if ($latestPredecessorDocument.schemaVersion -ne 3 -or
        $latestPredecessorDocument.operationVersion -ne $ExpectedLatestPredecessorOperationVersion -or
        $latestPredecessorDocument.immutableBuild.id -ne $ExpectedLatestPredecessorBuildId -or
        $latestPredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedLatestPredecessorArtifactManifestSha256 -or
        $latestPredecessorAdmissions.Count -ne 7 -or
        $latestPredecessorAdmissions[5].operationVersion -ne $ExpectedPriorPredecessorOperationVersion -or
        $latestPredecessorAdmissions[5].status -ne 'superseded' -or
        $latestPredecessorAdmissions[6].operationVersion -ne $ExpectedLatestPredecessorOperationVersion -or
        $latestPredecessorAdmissions[6].status -ne 'active' -or
        $latestPredecessorAdmissions[6].predecessorEvidenceSha256 -ne $ExpectedPriorPredecessorRunSha256 -or
        $latestPredecessorStage.Count -ne 1 -or
        @($latestPredecessorStage[0].runs).Count -ne 1 -or
        $latestPredecessorStage[0].runs[0].id -ne $ExpectedLatestPredecessorRunId -or
        $latestPredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedPriorPredecessorRunSha256) {
        throw 'BLOCKED: immutable v49 predecessor record identity is invalid.'
    }
    $newestPredecessorManifest = Join-Path $RepositoryRoot $ExpectedNewestPredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $newestPredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $newestPredecessorManifest) -ne $ExpectedNewestPredecessorManifestSha256) {
        throw 'BLOCKED: immutable v50 predecessor record is missing or changed.'
    }
    $newestPredecessorDocument = [IO.File]::ReadAllText($newestPredecessorManifest) | ConvertFrom-Json
    $newestPredecessorStage = @($newestPredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $newestPredecessorAdmissions = @($newestPredecessorDocument.deterministicAdmissions)
    if ($newestPredecessorDocument.schemaVersion -ne 3 -or
        $newestPredecessorDocument.operationVersion -ne $ExpectedNewestPredecessorOperationVersion -or
        $newestPredecessorDocument.immutableBuild.id -ne $ExpectedNewestPredecessorBuildId -or
        $newestPredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedNewestPredecessorArtifactManifestSha256 -or
        $newestPredecessorAdmissions.Count -ne 8 -or
        $newestPredecessorAdmissions[6].operationVersion -ne $ExpectedLatestPredecessorOperationVersion -or
        $newestPredecessorAdmissions[6].status -ne 'superseded' -or
        $newestPredecessorAdmissions[7].operationVersion -ne $ExpectedNewestPredecessorOperationVersion -or
        $newestPredecessorAdmissions[7].status -ne 'active' -or
        $newestPredecessorAdmissions[7].predecessorEvidenceSha256 -ne $ExpectedLatestPredecessorRunSha256 -or
        $newestPredecessorStage.Count -ne 1 -or
        @($newestPredecessorStage[0].runs).Count -ne 1 -or
        $newestPredecessorStage[0].runs[0].id -ne $ExpectedNewestPredecessorRunId -or
        $newestPredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedLatestPredecessorRunSha256) {
        throw 'BLOCKED: immutable v50 predecessor record identity is invalid.'
    }
    $currentPredecessorManifest = Join-Path $RepositoryRoot $ExpectedCurrentPredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $currentPredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $currentPredecessorManifest) -ne $ExpectedCurrentPredecessorManifestSha256) {
        throw 'BLOCKED: immutable v52 predecessor record is missing or changed.'
    }
    $currentPredecessorDocument = [IO.File]::ReadAllText($currentPredecessorManifest) | ConvertFrom-Json
    $currentPredecessorStage = @($currentPredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $currentPredecessorAdmissions = @($currentPredecessorDocument.deterministicAdmissions)
    if ($currentPredecessorDocument.schemaVersion -ne 3 -or
        $currentPredecessorDocument.operationVersion -ne $ExpectedCurrentPredecessorOperationVersion -or
        $currentPredecessorDocument.immutableBuild.id -ne $ExpectedCurrentPredecessorBuildId -or
        $currentPredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedCurrentPredecessorArtifactManifestSha256 -or
        $currentPredecessorAdmissions.Count -ne 9 -or
        $currentPredecessorAdmissions[7].operationVersion -ne $ExpectedNewestPredecessorOperationVersion -or
        $currentPredecessorAdmissions[7].status -ne 'superseded' -or
        $currentPredecessorAdmissions[8].operationVersion -ne $ExpectedCurrentPredecessorOperationVersion -or
        $currentPredecessorAdmissions[8].status -ne 'active' -or
        $currentPredecessorAdmissions[8].predecessorEvidenceSha256 -ne $ExpectedNewestPredecessorRunSha256 -or
        $currentPredecessorStage.Count -ne 1 -or
        @($currentPredecessorStage[0].runs).Count -ne 1 -or
        $currentPredecessorStage[0].runs[0].id -ne $ExpectedCurrentPredecessorRunId -or
        $currentPredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedNewestPredecessorRunSha256) {
        throw 'BLOCKED: immutable v52 predecessor record identity is invalid.'
    }
    $immediateCurrentPredecessorManifest = Join-Path $RepositoryRoot $ExpectedImmediateCurrentPredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $immediateCurrentPredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $immediateCurrentPredecessorManifest) -ne $ExpectedImmediateCurrentPredecessorManifestSha256) {
        throw 'BLOCKED: immutable v53 predecessor record is missing or changed.'
    }
    $immediateCurrentPredecessorDocument = [IO.File]::ReadAllText($immediateCurrentPredecessorManifest) | ConvertFrom-Json
    $immediateCurrentPredecessorStage = @($immediateCurrentPredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $immediateCurrentPredecessorAdmissions = @($immediateCurrentPredecessorDocument.deterministicAdmissions)
    if ($immediateCurrentPredecessorDocument.schemaVersion -ne 3 -or
        $immediateCurrentPredecessorDocument.operationVersion -ne $ExpectedImmediateCurrentPredecessorOperationVersion -or
        $immediateCurrentPredecessorDocument.immutableBuild.id -ne $ExpectedImmediateCurrentPredecessorBuildId -or
        $immediateCurrentPredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedImmediateCurrentPredecessorArtifactManifestSha256 -or
        $immediateCurrentPredecessorAdmissions.Count -ne 10 -or
        $immediateCurrentPredecessorAdmissions[8].operationVersion -ne $ExpectedCurrentPredecessorOperationVersion -or
        $immediateCurrentPredecessorAdmissions[8].status -ne 'superseded' -or
        $immediateCurrentPredecessorAdmissions[9].operationVersion -ne $ExpectedImmediateCurrentPredecessorOperationVersion -or
        $immediateCurrentPredecessorAdmissions[9].status -ne 'active' -or
        $immediateCurrentPredecessorAdmissions[9].predecessorEvidenceSha256 -ne $ExpectedCurrentPredecessorRunSha256 -or
        $immediateCurrentPredecessorStage.Count -ne 1 -or
        @($immediateCurrentPredecessorStage[0].runs).Count -ne 1 -or
        $immediateCurrentPredecessorStage[0].runs[0].id -ne $ExpectedImmediateCurrentPredecessorRunId -or
        $immediateCurrentPredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedCurrentPredecessorRunSha256) {
        throw 'BLOCKED: immutable v53 predecessor record identity is invalid.'
    }
    $activePredecessorManifest = Join-Path $RepositoryRoot $ExpectedActivePredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $activePredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $activePredecessorManifest) -ne $ExpectedActivePredecessorManifestSha256) {
        throw 'BLOCKED: immutable v54 predecessor record is missing or changed.'
    }
    $activePredecessorDocument = [IO.File]::ReadAllText($activePredecessorManifest) | ConvertFrom-Json
    $activePredecessorStage = @($activePredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $activePredecessorAdmissions = @($activePredecessorDocument.deterministicAdmissions)
    if ($activePredecessorDocument.schemaVersion -ne 3 -or
        $activePredecessorDocument.operationVersion -ne $ExpectedActivePredecessorOperationVersion -or
        $activePredecessorDocument.immutableBuild.id -ne $ExpectedActivePredecessorBuildId -or
        $activePredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedActivePredecessorArtifactManifestSha256 -or
        $activePredecessorAdmissions.Count -ne 11 -or
        $activePredecessorAdmissions[9].operationVersion -ne $ExpectedImmediateCurrentPredecessorOperationVersion -or
        $activePredecessorAdmissions[9].status -ne 'superseded' -or
        $activePredecessorAdmissions[10].operationVersion -ne $ExpectedActivePredecessorOperationVersion -or
        $activePredecessorAdmissions[10].status -ne 'active' -or
        $activePredecessorAdmissions[10].predecessorEvidenceSha256 -ne $ExpectedImmediateCurrentPredecessorRunSha256 -or
        $activePredecessorStage.Count -ne 1 -or
        @($activePredecessorStage[0].runs).Count -ne 1 -or
        $activePredecessorStage[0].runs[0].id -ne $ExpectedActivePredecessorRunId -or
        $activePredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedImmediateCurrentPredecessorRunSha256) {
        throw 'BLOCKED: immutable v54 predecessor record identity is invalid.'
    }
    $latestActivePredecessorManifest = Join-Path $RepositoryRoot $ExpectedLatestActivePredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $latestActivePredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $latestActivePredecessorManifest) -ne $ExpectedLatestActivePredecessorManifestSha256) {
        throw 'BLOCKED: immutable v55 predecessor record is missing or changed.'
    }
    $latestActivePredecessorDocument = [IO.File]::ReadAllText($latestActivePredecessorManifest) | ConvertFrom-Json
    $latestActivePredecessorStage = @($latestActivePredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $latestActivePredecessorAdmissions = @($latestActivePredecessorDocument.deterministicAdmissions)
    if ($latestActivePredecessorDocument.schemaVersion -ne 3 -or
        $latestActivePredecessorDocument.operationVersion -ne $ExpectedLatestActivePredecessorOperationVersion -or
        $latestActivePredecessorDocument.immutableBuild.id -ne $ExpectedLatestActivePredecessorBuildId -or
        $latestActivePredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedLatestActivePredecessorArtifactManifestSha256 -or
        $latestActivePredecessorAdmissions.Count -ne 12 -or
        $latestActivePredecessorAdmissions[10].operationVersion -ne $ExpectedActivePredecessorOperationVersion -or
        $latestActivePredecessorAdmissions[10].status -ne 'superseded' -or
        $latestActivePredecessorAdmissions[11].operationVersion -ne $ExpectedLatestActivePredecessorOperationVersion -or
        $latestActivePredecessorAdmissions[11].status -ne 'active' -or
        $latestActivePredecessorAdmissions[11].predecessorEvidenceSha256 -ne $ExpectedActivePredecessorRunSha256 -or
        $latestActivePredecessorStage.Count -ne 1 -or
        @($latestActivePredecessorStage[0].runs).Count -ne 1 -or
        $latestActivePredecessorStage[0].runs[0].id -ne $ExpectedLatestActivePredecessorRunId -or
        $latestActivePredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedActivePredecessorRunSha256) {
        throw 'BLOCKED: immutable v55 predecessor record identity is invalid.'
    }
    $immediateActivePredecessorManifest = Join-Path $RepositoryRoot $ExpectedImmediateActivePredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $immediateActivePredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $immediateActivePredecessorManifest) -ne $ExpectedImmediateActivePredecessorManifestSha256) {
        throw 'BLOCKED: immutable v56 predecessor record is missing or changed.'
    }
    $immediateActivePredecessorDocument = [IO.File]::ReadAllText($immediateActivePredecessorManifest) | ConvertFrom-Json
    $immediateActivePredecessorStage = @($immediateActivePredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $immediateActivePredecessorAdmissions = @($immediateActivePredecessorDocument.deterministicAdmissions)
    if ($immediateActivePredecessorDocument.schemaVersion -ne 3 -or
        $immediateActivePredecessorDocument.operationVersion -ne $ExpectedImmediateActivePredecessorOperationVersion -or
        $immediateActivePredecessorDocument.immutableBuild.id -ne $ExpectedImmediateActivePredecessorBuildId -or
        $immediateActivePredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedImmediateActivePredecessorArtifactManifestSha256 -or
        $immediateActivePredecessorAdmissions.Count -ne 13 -or
        $immediateActivePredecessorAdmissions[11].operationVersion -ne $ExpectedLatestActivePredecessorOperationVersion -or
        $immediateActivePredecessorAdmissions[11].status -ne 'superseded' -or
        $immediateActivePredecessorAdmissions[12].operationVersion -ne $ExpectedImmediateActivePredecessorOperationVersion -or
        $immediateActivePredecessorAdmissions[12].status -ne 'active' -or
        $immediateActivePredecessorAdmissions[12].predecessorEvidenceSha256 -ne $ExpectedLatestActivePredecessorRunSha256 -or
        $immediateActivePredecessorStage.Count -ne 1 -or
        @($immediateActivePredecessorStage[0].runs).Count -ne 1 -or
        $immediateActivePredecessorStage[0].runs[0].id -ne $ExpectedImmediateActivePredecessorRunId -or
        $immediateActivePredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedLatestActivePredecessorRunSha256) {
        throw 'BLOCKED: immutable v56 predecessor record identity is invalid.'
    }
    $newestActivePredecessorManifest = Join-Path $RepositoryRoot $ExpectedNewestActivePredecessorManifestRelativePath.Replace('/', '\')
    if (-not (Test-Path -LiteralPath $newestActivePredecessorManifest -PathType Leaf) -or
        (Get-FileSha256Hex -Path $newestActivePredecessorManifest) -ne $ExpectedNewestActivePredecessorManifestSha256) {
        throw 'BLOCKED: immutable v57 predecessor record is missing or changed.'
    }
    $newestActivePredecessorDocument = [IO.File]::ReadAllText($newestActivePredecessorManifest) | ConvertFrom-Json
    $newestActivePredecessorStage = @($newestActivePredecessorDocument.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    $newestActivePredecessorAdmissions = @($newestActivePredecessorDocument.deterministicAdmissions)
    if ($newestActivePredecessorDocument.schemaVersion -ne 3 -or
        $newestActivePredecessorDocument.operationVersion -ne $ExpectedNewestActivePredecessorOperationVersion -or
        $newestActivePredecessorDocument.immutableBuild.id -ne $ExpectedNewestActivePredecessorBuildId -or
        $newestActivePredecessorDocument.immutableBuild.artifactManifestSha256 -ne $ExpectedNewestActivePredecessorArtifactManifestSha256 -or
        $newestActivePredecessorAdmissions.Count -ne 14 -or
        $newestActivePredecessorAdmissions[12].operationVersion -ne $ExpectedImmediateActivePredecessorOperationVersion -or
        $newestActivePredecessorAdmissions[12].status -ne 'superseded' -or
        $newestActivePredecessorAdmissions[13].operationVersion -ne $ExpectedNewestActivePredecessorOperationVersion -or
        $newestActivePredecessorAdmissions[13].status -ne 'active' -or
        $newestActivePredecessorAdmissions[13].predecessorEvidenceSha256 -ne $ExpectedImmediateActivePredecessorRunSha256 -or
        $newestActivePredecessorStage.Count -ne 1 -or
        @($newestActivePredecessorStage[0].runs).Count -ne 1 -or
        $newestActivePredecessorStage[0].runs[0].id -ne $ExpectedNewestActivePredecessorRunId -or
        $newestActivePredecessorStage[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedImmediateActivePredecessorRunSha256) {
        throw 'BLOCKED: immutable v57 predecessor record identity is invalid.'
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
        $deterministic[0].runs[0].predecessorRunEvidenceSha256 -ne $ExpectedNewestActivePredecessorRunSha256 -or
        @($evidenceManifest.stages | Select-Object -Skip 1 | Where-Object {
            @($_.runs).Count -ne 0 -or @($_.consents).Count -ne 0 -or @($_.reviews).Count -ne 0
        }).Count -ne 0) {
        throw 'BLOCKED: deterministic simulation admission is not the exact active v58 authority.'
    }

    $CurrentAuthority | Add-Member -NotePropertyName Manifest -NotePropertyValue $manifest -Force
    $CurrentAuthority | Add-Member -NotePropertyName ConfigSha256 -NotePropertyValue (([string]$manifest.files.cleanWindowsVmConfig.sha256).Replace('sha256:', '')) -Force
    $CurrentAuthority | Add-Member -NotePropertyName RunnerSha256 -NotePropertyValue (([string]$manifest.files.runner.sha256).Replace('sha256:', '')) -Force
    return $CurrentAuthority
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
    $installed = @(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedInstalledCheckpoint -ErrorAction SilentlyContinue)
    if ($installed.Count -ne 0) {
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
    [void]$copies.Add([pscustomobject]@{ Source = $Authority.ArtifactManifest; Relative = 'artifact-manifest.json' })
    [void]$copies.Add([pscustomobject]@{ Source = $Authority.ArtifactSignature; Relative = 'artifact-manifest.json.p7s' })
    foreach ($role in $ExpectedManifestRoles) {
        $relative = ([string]$Authority.Manifest.files.$role.relativePath).Replace('/', '\')
        [void]$copies.Add([pscustomobject]@{ Source = (Join-Path $Authority.ArtifactRoot $relative); Relative = $relative })
    }
    if ($copies.Count -ne 11) {
        throw 'BLOCKED: exact staged file cardinality changed.'
    }
    foreach ($copy in $copies) {
        Copy-VMFile -VMName $ExpectedVmName -SourcePath $copy.Source -DestinationPath (Join-Path $Authority.GuestRoot $copy.Relative) -FileSource Host -CreateFullPath -ErrorAction Stop
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
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)]$Authority
    )

    Invoke-Command -VMName 'LiiiraaBoost-W11-25H2-Clean' -Credential $Credential -ScriptBlock {
        param($ClosedAuthority)
        $fixedRoot = [string]$ClosedAuthority.GuestRoot
        $expectedRoot = 'C:\LiiiraaBoost\Phase6\' + [string]$ClosedAuthority.BuildId
        if ($fixedRoot -cne $expectedRoot -or
            [string]$ClosedAuthority.GuestRunner -cne (Join-Path $fixedRoot 'phase6-physical-runner.exe') -or
            [string]$ClosedAuthority.GuestConfig -cne (Join-Path $fixedRoot 'configs\clean-windows-vm.run-config.json')) {
            throw 'BLOCKED:guest-root-mismatch'
        }
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
    } -ArgumentList $Authority
    [void]$CompletedBoundaries.Add('guest-artifact-acl-provisioned')
}

function Assert-ExactGuestArtifactCustody {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)]$Authority
    )

    $result = Invoke-Command -VMName 'LiiiraaBoost-W11-25H2-Clean' -Credential $Credential -ScriptBlock {
        param($ClosedAuthority)
        $fixedRoot = [string]$ClosedAuthority.GuestRoot
        $expectedRoot = 'C:\LiiiraaBoost\Phase6\' + [string]$ClosedAuthority.BuildId
        if ($fixedRoot -cne $expectedRoot -or
            [string]$ClosedAuthority.GuestRunner -cne (Join-Path $fixedRoot 'phase6-physical-runner.exe') -or
            [string]$ClosedAuthority.GuestConfig -cne (Join-Path $fixedRoot 'configs\clean-windows-vm.run-config.json')) {
            throw 'BLOCKED:guest-root-mismatch'
        }
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
    } -ArgumentList $Authority
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

function ConvertFrom-ExactMsiLogBytes {
    param([Parameter(Mandatory)][byte[]]$Bytes)

    if ($Bytes.Length -eq 0 -or ($Bytes.Length -ge 2 -and $Bytes[0] -eq 0xfe -and $Bytes[1] -eq 0xff)) {
        return $null
    }
    $hasUtf16LeBom = $Bytes.Length -ge 2 -and $Bytes[0] -eq 0xff -and $Bytes[1] -eq 0xfe
    $offset = if ($hasUtf16LeBom) { 2 } else { 0 }
    $bodyLength = $Bytes.Length - $offset
    $zeroHighBytes = 0
    if ($bodyLength -gt 0 -and $bodyLength % 2 -eq 0) {
        for ($index = $offset + 1; $index -lt $Bytes.Length; $index += 2) {
            if ($Bytes[$index] -eq 0) { $zeroHighBytes++ }
        }
    }
    $looksUtf16Le = $bodyLength -gt 0 -and $bodyLength % 2 -eq 0 -and ($zeroHighBytes * 4) -ge $bodyLength
    try {
        if ($hasUtf16LeBom -or $looksUtf16Le) {
            if ($bodyLength -le 0 -or $bodyLength % 2 -ne 0) { return $null }
            $encoding = [Text.UnicodeEncoding]::new($false, $false, $true)
            $text = $encoding.GetString($Bytes, $offset, $bodyLength)
        }
        else {
            $encoding = [Text.UTF8Encoding]::new($false, $true)
            $text = $encoding.GetString($Bytes)
        }
    }
    catch [Text.DecoderFallbackException] {
        return $null
    }
    if ($text.Contains([char]0)) { return $null }
    return $text
}

function Resolve-MsiLogSummary {
    param(
        [Parameter(Mandatory)][Int64]$ExitCode,
        [Parameter(Mandatory)][string]$FailureCode,
        [Parameter(Mandatory)][byte[]]$Bytes,
        [ValidateRange(1, 16777216)][int]$MaximumBytes = 16777216
    )

    $unavailable = [pscustomobject][ordered]@{
        InstallerExitCode = $null
        LogSha256 = $null
        LogSizeBytes = $null
        ReturnValue3ActionCode = 'unavailable'
        ReturnValue3ActionIdentifier = $null
    }
    if ($Bytes.Length -eq 0 -or $Bytes.Length -gt $MaximumBytes) { return $unavailable }

    $knownExit = $null
    if ($FailureCode -cmatch '^BLOCKED:installer-exit-(?<code>5|87|1601|1602|1603|1605|1618|1619|1620|1625|1638|1641|3010)$') {
        $knownExit = [int]$Matches.code
    }
    elseif ($FailureCode -cne 'BLOCKED:installer-exit-other') {
        return $unavailable
    }

    $text = ConvertFrom-ExactMsiLogBytes -Bytes $Bytes
    $tail = if ($null -eq $text) { '' } else { $text.Substring([Math]::Max(0, $text.Length - 262144)) }
    $matches = [regex]::Matches($tail, '(?m)^Action ended [^\r\n]*: (?<action>[A-Za-z][A-Za-z0-9]{0,63})\. Return value 3\.\r?$')
    $actionIdentifier = $null
    $actionCode = 'none'
    if ($matches.Count -gt 0) {
        $candidate = $matches[$matches.Count - 1].Groups['action'].Value
        $actions = @{
            'LaunchConditions' = 'launch-conditions'
            'CostFinalize' = 'cost-finalize'
            'InstallValidate' = 'install-validate'
            'InstallFiles' = 'install-files'
            'InstallServices' = 'install-services'
            'StartServices' = 'start-services'
            'InstallFinalize' = 'install-finalize'
            'INSTALL' = 'install'
        }
        if ($actions.ContainsKey($candidate)) {
            $actionIdentifier = $candidate
            $actionCode = $actions[$candidate]
        }
        else {
            $actionCode = 'other'
        }
    }

    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $logSha256 = 'sha256:' + ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
    return [pscustomobject][ordered]@{
        InstallerExitCode = $knownExit
        LogSha256 = $logSha256
        LogSizeBytes = $Bytes.Length
        ReturnValue3ActionCode = $actionCode
        ReturnValue3ActionIdentifier = $actionIdentifier
    }
}

function Resolve-InstallerSidecarSummary {
    param(
        $Sidecar,
        [Parameter(Mandatory)][string]$SidecarStatus,
        $SidecarSha256,
        $SidecarSizeBytes,
        [Parameter(Mandatory)][string]$FailureCode
    )

    $fallbackStatus = if ($SidecarStatus -cin @('sidecar-missing', 'sidecar-unparseable')) {
        $SidecarStatus
    }
    else {
        'sidecar-unparseable'
    }
    $fallbackExit = $null
    if ($FailureCode -cmatch '^BLOCKED:installer-exit-(?<code>5|87|1601|1602|1603|1605|1618|1619|1620|1625|1638|1641|3010)$') {
        $fallbackExit = [int]$Matches.code
    }
    $fallback = [pscustomobject][ordered]@{
        DiagnosticStatus = $fallbackStatus
        InstallerExitCode = $fallbackExit
        LogStatus = 'unknown'
        LogSha256 = $null
        LogSizeBytes = $null
        ReturnValue3ActionCode = 'unavailable'
        ReturnValue3ActionIdentifier = $null
        SidecarSha256 = $null
        SidecarSizeBytes = $null
    }
    if ($SidecarStatus -cne 'present' -or $null -eq $Sidecar) { return $fallback }

    $allowedExitCodes = @(5, 87, 1601, 1602, 1603, 1605, 1618, 1619, 1620, 1625, 1638, 1641, 3010)
    $allowedActionCodes = @(
        'unavailable', 'none', 'other', 'launch-conditions', 'cost-finalize',
        'install-validate', 'install-files', 'install-services', 'start-services',
        'install-finalize', 'install'
    )
    $allowedIdentifiers = @(
        'LaunchConditions', 'CostFinalize', 'InstallValidate', 'InstallFiles',
        'InstallServices', 'StartServices', 'InstallFinalize', 'INSTALL'
    )
    $expectedProperties = @(
        'kind', 'schemaVersion', 'installerExitCode', 'logStatus', 'logSha256',
        'logSizeBytes', 'returnValue3ActionCode', 'returnValue3ActionIdentifier'
    )
    $actualProperties = @($Sidecar.PSObject.Properties | ForEach-Object { $_.Name })
    $exit = if ($null -eq $Sidecar.installerExitCode) { $null } else { [int]$Sidecar.installerExitCode }
    $hash = if ($null -eq $Sidecar.logSha256) { $null } else { [string]$Sidecar.logSha256 }
    $size = if ($null -eq $Sidecar.logSizeBytes) { $null } else { [int64]$Sidecar.logSizeBytes }
    $actionCode = [string]$Sidecar.returnValue3ActionCode
    $actionIdentifier = if ($null -eq $Sidecar.returnValue3ActionIdentifier) { $null } else { [string]$Sidecar.returnValue3ActionIdentifier }
    $sidecarHash = if ($null -eq $SidecarSha256) { $null } else { [string]$SidecarSha256 }
    $sidecarSize = if ($null -eq $SidecarSizeBytes) { $null } else { [int64]$SidecarSizeBytes }
    $expectedFailure = if ($null -eq $exit) { $null } else { "BLOCKED:installer-exit-$exit" }
    $invalid = $actualProperties.Count -ne $expectedProperties.Count -or
        @($actualProperties | Where-Object { $expectedProperties -cnotcontains $_ }).Count -ne 0 -or
        [string]$Sidecar.kind -cne 'phase6-msi-safe-diagnostic' -or
        [string]$Sidecar.schemaVersion -cne '1.0' -or
        $null -eq $exit -or $allowedExitCodes -notcontains $exit -or
        $FailureCode -cne $expectedFailure -or
        [string]$Sidecar.logStatus -cnotin @('present', 'log-missing', 'log-unparseable') -or
        ($null -ne $hash -and $hash -cnotmatch '^sha256:[a-f0-9]{64}$') -or
        ($null -ne $size -and ($size -le 0 -or $size -gt 16777216)) -or
        ($allowedActionCodes -notcontains $actionCode) -or
        ($null -ne $actionIdentifier -and $allowedIdentifiers -notcontains $actionIdentifier) -or
        $sidecarHash -cnotmatch '^sha256:[a-f0-9]{64}$' -or
        $null -eq $sidecarSize -or $sidecarSize -le 0 -or $sidecarSize -gt 4096 -or
        ([string]$Sidecar.logStatus -ceq 'present' -and ($null -eq $hash -or $null -eq $size)) -or
        ([string]$Sidecar.logStatus -ceq 'log-missing' -and ($null -ne $hash -or $null -ne $size)) -or
        ([string]$Sidecar.logStatus -ceq 'log-unparseable' -and $actionCode -cnotin @('none', 'unavailable'))
    if ($invalid) { return $fallback }

    return [pscustomobject][ordered]@{
        DiagnosticStatus = 'present'
        InstallerExitCode = $exit
        LogStatus = [string]$Sidecar.logStatus
        LogSha256 = $hash
        LogSizeBytes = $size
        ReturnValue3ActionCode = $actionCode
        ReturnValue3ActionIdentifier = $actionIdentifier
        SidecarSha256 = $sidecarHash
        SidecarSizeBytes = $sidecarSize
    }
}

function Resolve-InstalledCustodySidecarSummary {
    param(
        $Sidecar,
        [Parameter(Mandatory)][string]$SidecarStatus,
        $SidecarSha256,
        $SidecarSizeBytes,
        [Parameter(Mandatory)][string]$FailureCode
    )

    $fallback = [pscustomobject][ordered]@{
        DiagnosticStatus = if ($SidecarStatus -cin @('sidecar-missing', 'sidecar-unparseable')) { $SidecarStatus } else { 'sidecar-unparseable' }
        ErrorCode = $null
        DetailCode = $null
        Role = $null
        PathClass = $null
        IoKind = $null
        Win32Code = $null
        SidecarSha256 = $null
        SidecarSizeBytes = $null
    }
    if ($SidecarStatus -cne 'present' -or $null -eq $Sidecar) { return $fallback }

    $allowedErrorCodes = @(
        'acl-invalid', 'authenticode-invalid', 'live-byte-mismatch', 'required-byte-missing',
        'canonical-path-invalid', 'generated-schema-invalid', 'signature-invalid', 'version-invalid'
    )
    $allowedDetailCodes = @(
        'unavailable', 'canonicalize', 'program-files-reparse', 'relative-path', 'root-reparse',
        'reparse-component', 'root-escape', 'duplicate-installed-path', 'installed-role',
        'last-admitted-reparse', 'last-admitted-parent', 'last-admitted-name',
        'last-admitted-path', 'other'
    )
    $allowedRoles = @(
        'portable-root', 'portable-manifest', 'portable-signature', 'portable-file',
        'installed-root', 'installed-manifest', 'installed-signature', 'installed-desktop',
        'installed-service', 'installed-runner', 'last-admitted-file', 'last-admitted-parent'
    )
    $allowedPathClasses = @('disk', 'verbatim-disk', 'unc', 'verbatim-unc', 'device', 'device-other', 'rooted-other', 'relative', 'absolute-other')
    $allowedIoKinds = @('not-found', 'permission-denied', 'invalid-input', 'invalid-data', 'already-exists', 'unsupported', 'other')
    $expectedProperties = @('kind', 'schemaVersion', 'errorCode', 'detailCode', 'role', 'pathClass', 'ioKind', 'win32Code')
    $actualProperties = @($Sidecar.PSObject.Properties | ForEach-Object { $_.Name })
    $errorCode = [string]$Sidecar.errorCode
    $detailCode = [string]$Sidecar.detailCode
    $role = if ($null -eq $Sidecar.role) { $null } else { [string]$Sidecar.role }
    $pathClass = if ($null -eq $Sidecar.pathClass) { $null } else { [string]$Sidecar.pathClass }
    $ioKind = if ($null -eq $Sidecar.ioKind) { $null } else { [string]$Sidecar.ioKind }
    $win32Code = if ($null -eq $Sidecar.win32Code) { $null } else { [int]$Sidecar.win32Code }
    $sidecarHash = if ($null -eq $SidecarSha256) { $null } else { [string]$SidecarSha256 }
    $sidecarSize = if ($null -eq $SidecarSizeBytes) { $null } else { [int64]$SidecarSizeBytes }
    $expectedFailure = "BLOCKED:installed-custody-$errorCode"
    $diagnosticFields = @($role, $pathClass, $ioKind)
    $invalid = $actualProperties.Count -ne $expectedProperties.Count -or
        @($actualProperties | Where-Object { $expectedProperties -cnotcontains $_ }).Count -ne 0 -or
        [string]$Sidecar.kind -cne 'phase6-installed-custody-safe-diagnostic' -or
        [string]$Sidecar.schemaVersion -cne '1.0' -or
        $allowedErrorCodes -notcontains $errorCode -or
        $allowedDetailCodes -notcontains $detailCode -or
        $FailureCode -cne $expectedFailure -or
        ($null -ne $role -and $allowedRoles -notcontains $role) -or
        ($null -ne $pathClass -and $allowedPathClasses -notcontains $pathClass) -or
        ($null -ne $ioKind -and $allowedIoKinds -notcontains $ioKind) -or
        ($null -ne $win32Code -and ($win32Code -lt 0 -or $win32Code -gt 65535)) -or
        $sidecarHash -cnotmatch '^sha256:[a-f0-9]{64}$' -or
        $null -eq $sidecarSize -or $sidecarSize -le 0 -or $sidecarSize -gt 4096 -or
        ($detailCode -ceq 'canonicalize' -and @($diagnosticFields | Where-Object { $null -eq $_ }).Count -ne 0) -or
        ($detailCode -cne 'canonicalize' -and @($diagnosticFields | Where-Object { $null -ne $_ }).Count -ne 0)
    if ($invalid) { return $fallback }

    return [pscustomobject][ordered]@{
        DiagnosticStatus = 'present'
        ErrorCode = $errorCode
        DetailCode = $detailCode
        Role = $role
        PathClass = $pathClass
        IoKind = $ioKind
        Win32Code = $win32Code
        SidecarSha256 = $sidecarHash
        SidecarSizeBytes = $sidecarSize
    }
}

function Resolve-WebDriverSidecarSummary {
    param(
        $Sidecar,
        [Parameter(Mandatory)][string]$SidecarStatus,
        $SidecarSha256,
        $SidecarSizeBytes,
        [Parameter(Mandatory)][string]$FailureCode
    )

    $fallback = [pscustomobject][ordered]@{
        DiagnosticStatus = if ($SidecarStatus -cin @('sidecar-missing', 'sidecar-unparseable')) { $SidecarStatus } else { 'sidecar-unparseable' }
        Stage = $null
        ErrorCode = $null
        DetailCode = $null
        ProcessExitCode = $null
        TauriDriverVersion = $null
        NativeDriverVersion = $null
        WebViewRuntimeVersion = $null
        WebDriverEndpointReady = $null
        NativeEndpointReady = $null
        OutputTruncated = $null
        SidecarSha256 = $null
        SidecarSizeBytes = $null
    }
    if ($SidecarStatus -cne 'present' -or $null -eq $Sidecar) { return $fallback }

    $expectedProperties = @(
        'kind', 'schemaVersion', 'stage', 'errorCode', 'detailCode', 'processExitCode',
        'tauriDriverVersion', 'nativeDriverVersion', 'webviewRuntimeVersion',
        'webdriverEndpointReady', 'nativeEndpointReady', 'outputTruncated'
    )
    $actualProperties = @($Sidecar.PSObject.Properties | ForEach-Object { $_.Name })
    $stage = [string]$Sidecar.stage
    $errorCode = [string]$Sidecar.errorCode
    $detailCode = [string]$Sidecar.detailCode
    $exitCode = if ($null -eq $Sidecar.processExitCode) { $null } else { [int]$Sidecar.processExitCode }
    $tauriVersion = [string]$Sidecar.tauriDriverVersion
    $nativeVersion = [string]$Sidecar.nativeDriverVersion
    $runtimeVersion = if ($null -eq $Sidecar.webviewRuntimeVersion) { $null } else { [string]$Sidecar.webviewRuntimeVersion }
    $webdriverReady = if ($Sidecar.webdriverEndpointReady -is [bool]) { [bool]$Sidecar.webdriverEndpointReady } else { $null }
    $nativeReady = if ($Sidecar.nativeEndpointReady -is [bool]) { [bool]$Sidecar.nativeEndpointReady } else { $null }
    $truncated = if ($Sidecar.outputTruncated -is [bool]) { [bool]$Sidecar.outputTruncated } else { $null }
    $sidecarHash = if ($null -eq $SidecarSha256) { $null } else { [string]$SidecarSha256 }
    $sidecarSize = if ($null -eq $SidecarSizeBytes) { $null } else { [int64]$SidecarSizeBytes }
    $versionPattern = '^(?:unavailable|[0-9]+(?:[.+-][0-9]+)*)$'
    $invalid = $actualProperties.Count -ne $expectedProperties.Count -or
        @($actualProperties | Where-Object { $expectedProperties -cnotcontains $_ }).Count -ne 0 -or
        [string]$Sidecar.kind -cne 'phase6-webdriver-safe-diagnostic' -or
        [string]$Sidecar.schemaVersion -cne '1.0' -or
        $stage -cnotin @('clean-windows-vm', 'owner-pc', 'friends-pc', 'reboot-pending', 'completed', 'unknown') -or
        $errorCode -cne 'webdriver-exited' -or
        $FailureCode -cne 'BLOCKED:webdriver-exited' -or
        $detailCode -cnotin @('native-driver-version-mismatch', 'access-denied', 'loopback-port-conflict', 'native-driver-launch', 'output-truncated', 'other') -or
        ($null -ne $exitCode -and ($exitCode -lt -2147483648 -or $exitCode -gt 2147483647)) -or
        $tauriVersion -cnotmatch $versionPattern -or $nativeVersion -cnotmatch $versionPattern -or
        ($null -ne $runtimeVersion -and $runtimeVersion -cnotmatch $versionPattern) -or
        $null -eq $webdriverReady -or $null -eq $nativeReady -or $null -eq $truncated -or
        $sidecarHash -cnotmatch '^sha256:[a-f0-9]{64}$' -or
        $null -eq $sidecarSize -or $sidecarSize -le 0 -or $sidecarSize -gt 16384
    if ($invalid) { return $fallback }

    return [pscustomobject][ordered]@{
        DiagnosticStatus = 'present'
        Stage = $stage
        ErrorCode = $errorCode
        DetailCode = $detailCode
        ProcessExitCode = $exitCode
        TauriDriverVersion = $tauriVersion
        NativeDriverVersion = $nativeVersion
        WebViewRuntimeVersion = $runtimeVersion
        WebDriverEndpointReady = $webdriverReady
        NativeEndpointReady = $nativeReady
        OutputTruncated = $truncated
        SidecarSha256 = $sidecarHash
        SidecarSizeBytes = $sidecarSize
    }
}

function Invoke-ExactGuestRunner {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [Parameter(Mandatory)]$Authority,
        [Parameter(Mandatory)][ValidateSet('installed-ready', 'reboot-pending', 'completed')][string]$Stage,
        [string]$ApprovalPhrase
    )

    if ($Authority.GuestRoot -cne $CurrentAuthority.GuestRoot -or
        $Authority.GuestRunner -cne $CurrentAuthority.GuestRunner -or
        $Authority.GuestConfig -cne $CurrentAuthority.GuestConfig) {
        throw 'BLOCKED: current runner authority mismatch.'
    }
    $script:RunnerFailureStage = $Stage
    $script:RunnerExitCode = $null
    $script:RunnerFailureCode = $null
    $script:InstallerDiagnostic = $null
    $script:InstalledCustodyDiagnostic = $null
    $script:WebDriverDiagnostic = $null
    $response = Invoke-Command -VMName $ExpectedVmName -Credential $Credential -ScriptBlock {
        param($ClosedAuthority, $Approval, $MaximumLines, $MaximumChars)
        $expectedRoot = 'C:\LiiiraaBoost\Phase6\' + [string]$ClosedAuthority.BuildId
        $RunnerPath = [string]$ClosedAuthority.GuestRunner
        $ConfigPath = [string]$ClosedAuthority.GuestConfig
        $sidecarPath = Join-Path $expectedRoot 'state\clean-windows-vm\diagnostics\msi-install.safe.json'
        $installedCustodySidecarPath = Join-Path $expectedRoot 'state\clean-windows-vm\diagnostics\installed-custody.safe.json'
        $webDriverSidecarPath = Join-Path $expectedRoot 'state\clean-windows-vm\diagnostics\webdriver-launch.safe.json'
        if ([string]$ClosedAuthority.GuestRoot -cne $expectedRoot -or
            $RunnerPath -cne (Join-Path $expectedRoot 'phase6-physical-runner.exe') -or
            $ConfigPath -cne (Join-Path $expectedRoot 'configs\clean-windows-vm.run-config.json')) {
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
        $installerSidecar = $null
        $installerSidecarStatus = 'sidecar-missing'
        $installerSidecarSha256 = $null
        $installerSidecarSizeBytes = $null
        if ($process.ExitCode -ne 0 -and (Test-Path -LiteralPath $sidecarPath -PathType Leaf)) {
            try {
                $sidecarItem = Get-Item -LiteralPath $sidecarPath -ErrorAction Stop
                if ($sidecarItem.Length -le 0 -or $sidecarItem.Length -gt 4096) {
                    throw 'sidecar bounds'
                }
                $sidecarBytes = [IO.File]::ReadAllBytes($sidecarPath)
                $installerSidecar = [Text.Encoding]::UTF8.GetString($sidecarBytes) | ConvertFrom-Json -ErrorAction Stop
                $sidecarHasher = [Security.Cryptography.SHA256]::Create()
                try {
                    $installerSidecarSha256 = 'sha256:' + ([BitConverter]::ToString($sidecarHasher.ComputeHash($sidecarBytes))).Replace('-', '').ToLowerInvariant()
                }
                finally {
                    $sidecarHasher.Dispose()
                }
                $installerSidecarSizeBytes = [int64]$sidecarBytes.Length
                $installerSidecarStatus = 'present'
            }
            catch {
                $installerSidecar = $null
                $installerSidecarStatus = 'sidecar-unparseable'
                $installerSidecarSha256 = $null
                $installerSidecarSizeBytes = $null
            }
        }
        $installedCustodySidecar = $null
        $installedCustodySidecarStatus = 'sidecar-missing'
        $installedCustodySidecarSha256 = $null
        $installedCustodySidecarSizeBytes = $null
        if ($process.ExitCode -ne 0 -and (Test-Path -LiteralPath $installedCustodySidecarPath -PathType Leaf)) {
            try {
                $installedSidecarItem = Get-Item -LiteralPath $installedCustodySidecarPath -ErrorAction Stop
                if ($installedSidecarItem.Length -le 0 -or $installedSidecarItem.Length -gt 4096) {
                    throw 'installed custody sidecar bounds'
                }
                $installedSidecarBytes = [IO.File]::ReadAllBytes($installedCustodySidecarPath)
                $installedCustodySidecar = [Text.Encoding]::UTF8.GetString($installedSidecarBytes) | ConvertFrom-Json -ErrorAction Stop
                $installedSidecarHasher = [Security.Cryptography.SHA256]::Create()
                try {
                    $installedCustodySidecarSha256 = 'sha256:' + ([BitConverter]::ToString($installedSidecarHasher.ComputeHash($installedSidecarBytes))).Replace('-', '').ToLowerInvariant()
                }
                finally {
                    $installedSidecarHasher.Dispose()
                }
                $installedCustodySidecarSizeBytes = [int64]$installedSidecarBytes.Length
                $installedCustodySidecarStatus = 'present'
            }
            catch {
                $installedCustodySidecar = $null
                $installedCustodySidecarStatus = 'sidecar-unparseable'
                $installedCustodySidecarSha256 = $null
                $installedCustodySidecarSizeBytes = $null
            }
        }
        $webDriverSidecar = $null
        $webDriverSidecarStatus = 'sidecar-missing'
        $webDriverSidecarSha256 = $null
        $webDriverSidecarSizeBytes = $null
        if ($process.ExitCode -ne 0 -and (Test-Path -LiteralPath $webDriverSidecarPath -PathType Leaf)) {
            try {
                $webDriverSidecarItem = Get-Item -LiteralPath $webDriverSidecarPath -ErrorAction Stop
                if ($webDriverSidecarItem.Length -le 0 -or $webDriverSidecarItem.Length -gt 16384) {
                    throw 'webdriver sidecar bounds'
                }
                $webDriverSidecarBytes = [IO.File]::ReadAllBytes($webDriverSidecarPath)
                $webDriverSidecar = [Text.Encoding]::UTF8.GetString($webDriverSidecarBytes) | ConvertFrom-Json -ErrorAction Stop
                $webDriverSidecarHasher = [Security.Cryptography.SHA256]::Create()
                try {
                    $webDriverSidecarSha256 = 'sha256:' + ([BitConverter]::ToString($webDriverSidecarHasher.ComputeHash($webDriverSidecarBytes))).Replace('-', '').ToLowerInvariant()
                }
                finally {
                    $webDriverSidecarHasher.Dispose()
                }
                $webDriverSidecarSizeBytes = [int64]$webDriverSidecarBytes.Length
                $webDriverSidecarStatus = 'present'
            }
            catch {
                $webDriverSidecar = $null
                $webDriverSidecarStatus = 'sidecar-unparseable'
                $webDriverSidecarSha256 = $null
                $webDriverSidecarSizeBytes = $null
            }
        }
        [pscustomobject]@{
            ExitCode = [int64]$process.ExitCode
            Stdout = $stdout
            Stderr = $stderr
            BoundsExceeded = $boundsExceeded
            InstallerSidecar = $installerSidecar
            InstallerSidecarStatus = $installerSidecarStatus
            InstallerSidecarSha256 = $installerSidecarSha256
            InstallerSidecarSizeBytes = $installerSidecarSizeBytes
            InstalledCustodySidecar = $installedCustodySidecar
            InstalledCustodySidecarStatus = $installedCustodySidecarStatus
            InstalledCustodySidecarSha256 = $installedCustodySidecarSha256
            InstalledCustodySidecarSizeBytes = $installedCustodySidecarSizeBytes
            WebDriverSidecar = $webDriverSidecar
            WebDriverSidecarStatus = $webDriverSidecarStatus
            WebDriverSidecarSha256 = $webDriverSidecarSha256
            WebDriverSidecarSizeBytes = $webDriverSidecarSizeBytes
        }
    } -ArgumentList $Authority, $ApprovalPhrase, $MaximumRunnerOutputLines, $MaximumRunnerOutputChars
    if ($response.ExitCode -ne 0) {
        $diagnostic = Resolve-RunnerFailureDiagnostic -ExitCode ([int64]$response.ExitCode) -Stdout @($response.Stdout) -Stderr @($response.Stderr) -BoundsExceeded ([bool]$response.BoundsExceeded)
        $script:RunnerExitCode = $diagnostic.RunnerExitCode
        $script:RunnerFailureCode = $diagnostic.RunnerFailureCode
        if ($null -ne $diagnostic.RunnerFailureCode -and $diagnostic.RunnerFailureCode -cmatch '^BLOCKED:installer-') {
            $script:InstallerDiagnostic = Resolve-InstallerSidecarSummary `
                -Sidecar $response.InstallerSidecar `
                -SidecarStatus ([string]$response.InstallerSidecarStatus) `
                -SidecarSha256 $response.InstallerSidecarSha256 `
                -SidecarSizeBytes $response.InstallerSidecarSizeBytes `
                -FailureCode $diagnostic.RunnerFailureCode
        }
        if ($null -ne $diagnostic.RunnerFailureCode -and $diagnostic.RunnerFailureCode -cmatch '^BLOCKED:installed-custody-') {
            $script:InstalledCustodyDiagnostic = Resolve-InstalledCustodySidecarSummary `
                -Sidecar $response.InstalledCustodySidecar `
                -SidecarStatus ([string]$response.InstalledCustodySidecarStatus) `
                -SidecarSha256 $response.InstalledCustodySidecarSha256 `
                -SidecarSizeBytes $response.InstalledCustodySidecarSizeBytes `
                -FailureCode $diagnostic.RunnerFailureCode
        }
        if ($diagnostic.RunnerFailureCode -ceq 'BLOCKED:webdriver-exited') {
            $script:WebDriverDiagnostic = Resolve-WebDriverSidecarSummary `
                -Sidecar $response.WebDriverSidecar `
                -SidecarStatus ([string]$response.WebDriverSidecarStatus) `
                -SidecarSha256 $response.WebDriverSidecarSha256 `
                -SidecarSizeBytes $response.WebDriverSidecarSizeBytes `
                -FailureCode $diagnostic.RunnerFailureCode
        }
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
    $path = Join-Path $CurrentAuthority.GuestRoot $relative
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
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        $created = @(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedInstalledCheckpoint -ErrorAction SilentlyContinue)
        if ($created.Count -eq 1) { break }
        if ($created.Count -gt 1) { throw 'BLOCKED: installed checkpoint create-once identity became ambiguous.' }
        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)
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
    $path = Join-Path $Authority.GuestRoot 'state\clean-windows-vm\checkpoint-ready.json'
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

function Test-IsGuestAuthenticationFailure {
    param([Parameter(Mandatory)]$ErrorRecord)

    $category = [string]$ErrorRecord.CategoryInfo.Category
    if (@('AuthenticationError', 'PermissionDenied', 'SecurityError') -contains $category) {
        return $true
    }
    $exception = $ErrorRecord.Exception
    while ($null -ne $exception) {
        if ([int]$exception.HResult -in @(-2147023570, -2147024891)) {
            return $true
        }
        $exception = $exception.InnerException
    }
    return $false
}

function Wait-ExactVmReady {
    param([Parameter(Mandatory)][PSCredential]$Credential)

    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    do {
        try {
            $ready = Invoke-Command -VMName $ExpectedVmName -Credential $Credential -ScriptBlock { 'ready' } -ErrorAction Stop
            if ($ready -eq 'ready') { return }
        }
        catch {
            if (Test-IsGuestAuthenticationFailure -ErrorRecord $_) {
                throw 'BLOCKED: guest credential was rejected by PowerShell Direct.'
            }
        }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'BLOCKED: exact VM did not become PowerShell Direct ready within 180 seconds.'
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
        installerDiagnostic = $InstallerDiagnostic
        installedCustodyDiagnostic = $InstalledCustodyDiagnostic
        webDriverDiagnostic = $WebDriverDiagnostic
        reason = $safeReason; recordedAt = [DateTime]::UtcNow.ToString('o')
    }
    [IO.File]::WriteAllText($path, ($record | ConvertTo-Json -Depth 4), [Text.UTF8Encoding]::new($false))
}

function Stop-ExactVmAfterRun {
    $currentVm = Get-VM -Name $ExpectedVmName -ErrorAction Stop
    if ($currentVm.State.ToString() -ne 'Off') {
        Stop-VM -Name $ExpectedVmName -Force -Confirm:$false -ErrorAction Stop
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        $currentVm = Get-VM -Name $ExpectedVmName -ErrorAction Stop
        if ($currentVm.State.ToString() -eq 'Off') {
            [void]$CompletedBoundaries.Add('run-vm-state-restored')
            return
        }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    throw 'BLOCKED: clean-VM run did not restore the exact VM to Off within 120 seconds.'
}

function Write-ApplyPromptReadyRecordOnce {
    param(
        [Parameter(Mandatory)]$Authority,
        [Parameter(Mandatory)]$InstalledCheckpoint
    )

    if ($Authority.OperationVersion -cne $ExpectedOperationVersion -or
        $Authority.BuildId -cne $ExpectedBuildId -or
        [string]$InstalledCheckpoint.Name -cne $ExpectedInstalledCheckpoint -or
        [string]$InstalledCheckpoint.Id -notmatch '^[0-9a-fA-F-]{36}$') {
        throw 'BLOCKED: apply prompt boundary checkpoint binding mismatch.'
    }
    $directory = Join-Path $LabRoot 'Evidence\phase6'
    [IO.Directory]::CreateDirectory($directory) | Out-Null
    $record = [ordered]@{
        kind = 'phase6-apply-prompt-ready'
        schemaVersion = '1.0'
        operationVersion = $ExpectedOperationVersion
        buildId = $ExpectedBuildId
        vmName = $ExpectedVmName
        installedCheckpoint = $ExpectedInstalledCheckpoint
        installedCheckpointId = ([string]$InstalledCheckpoint.Id).ToLowerInvariant()
        stage = 'approval-prompt-ready'
        recordedAt = [DateTime]::UtcNow.ToString('o')
    }
    $bytes = [Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))
    if ($bytes.Length -eq 0 -or $bytes.Length -gt 4096) {
        throw 'BLOCKED: apply prompt boundary exceeds fixed bounds.'
    }
    $fileName = (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + "-$ExpectedOperationVersion-APPLY-PROMPT-READY.json"
    $path = Join-Path $directory $fileName
    $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
    [void]$CompletedBoundaries.Add('apply-prompt-ready')
    return $fileName
}

function Invoke-CleanVmRun {
    param(
        [Parameter(Mandatory)]$Authority,
        [Parameter(Mandatory)][PSCredential]$Credential
    )

    Restore-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedCleanCheckpoint -Confirm:$false -ErrorAction Stop
    [void]$CompletedBoundaries.Add('clean-checkpoint-restored')
    $vm = Get-VM -Name $ExpectedVmName
    if ($vm.State -eq 'Off') { Start-VM -Name $ExpectedVmName | Out-Null }
    Wait-ExactVmReady -Credential $Credential
    [void](Wait-ExactIntegrationServicesHealthy)
    [void]$CompletedBoundaries.Add('integration-services-healthy')
    Copy-ExactArtifactToGuest -Authority $Authority
    Set-ExactGuestArtifactCustody -Credential $Credential -Authority $Authority
    Assert-ExactGuestArtifactCustody -Credential $Credential -Authority $Authority

    $first = Invoke-ExactGuestRunner -Credential $Credential -Stage 'installed-ready' -Authority $Authority
    $installed = Assert-InstalledReadyRecord -Credential $Credential -Authority $Authority -RunnerResult $first
    $installedCheckpoint = New-InstalledCheckpointOnce
    Write-CheckpointReadyRecordOnce -Credential $Credential -Authority $Authority -InstalledReadyBytes $installed.Bytes -InstalledCheckpoint $installedCheckpoint

    $expectedApproval = "APPLY phase6-physical-plan $ExpectedOperationVersion"
    $promptReadyRecord = Write-ApplyPromptReadyRecordOnce -Authority $Authority -InstalledCheckpoint $installedCheckpoint
    Write-Output "PHASE6_APPLY_PROMPT_READY:$($ExpectedOperationVersion):$promptReadyRecord"
    $approval = Read-Host "Type this exact phrase to authorize the guest apply: $expectedApproval"
    if ($approval -cne $expectedApproval) { throw 'BLOCKED: exact physical apply approval was refused.' }
    $second = Invoke-ExactGuestRunner -Credential $Credential -Stage 'reboot-pending' -Authority $Authority -ApprovalPhrase $approval
    [void](Assert-RebootPendingRecord -Credential $Credential -Authority $Authority -RunnerResult $second)

    Restart-VM -Name $ExpectedVmName -Force -Confirm:$false -ErrorAction Stop
    [void]$CompletedBoundaries.Add('operator-authorized-vm-restart')
    Wait-ExactVmReady -Credential $Credential
    $third = Invoke-ExactGuestRunner -Credential $Credential -Stage 'completed' -Authority $Authority
    if ($third.State -ne 'Completed') { throw 'BLOCKED: post-boot observation-first runner did not complete.' }
    [void]$CompletedBoundaries.Add('post-boot-observation-complete')
    Copy-BoundedEvidenceAndIngest -Credential $Credential -Authority $Authority
}

Assert-ExactInvocation
Assert-ClosedCurrentAuthority
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
finally {
    if ($Action -eq 'RunCleanVm') { Stop-ExactVmAfterRun }
}
