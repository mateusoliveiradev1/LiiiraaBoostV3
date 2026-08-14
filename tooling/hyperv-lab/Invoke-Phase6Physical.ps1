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
$ExpectedInstalledCheckpoint = 'LiiiraaBoost-Installed'
$ExpectedOperationVersion = 'managed-power-scheme-v41'
$ExpectedBuildId = 'physical-8d162575a964ec77-managed-power-scheme-v41'
$ExpectedSourceCommit = '994994ec4e61b45013930a7f650aaf0b46918d68'
$ExpectedArtifactManifestSha256 = '8789c54ca0a73e2f496fedb7710dae6eac4b1b4bad10864e0284b7591d607784'
$ExpectedSimulationRunSha256 = '626b9793c70f1271d28eff8f3a3e4bba37956c9138b08c345b72e2b22f7f02b7'
$ExpectedEvidenceManifestSha256 = 'ead808d8fb26a01183d6522b0698f785daa0d25cbe9d7337bb662c13b53c5f7a'
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
        $ExpectedBuildId,
        $ExpectedOperationVersion,
        $ExpectedSourceCommit,
        $ExpectedArtifactManifestSha256,
        $ExpectedSimulationRunSha256,
        $ExpectedEvidenceManifestSha256
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

    $evidenceManifest = [IO.File]::ReadAllText($ExpectedEvidenceManifest) | ConvertFrom-Json
    $deterministic = @($evidenceManifest.stages | Where-Object { $_.stage -eq 'deterministic-simulation' })
    if ($evidenceManifest.operationVersion -ne $ExpectedOperationVersion -or
        $evidenceManifest.immutableBuild.id -ne $ExpectedBuildId -or
        $evidenceManifest.immutableBuild.artifactManifestSha256 -ne $ExpectedArtifactManifestSha256 -or
        $deterministic.Count -ne 1 -or
        @($deterministic[0].runs).Count -ne 1) {
        throw 'BLOCKED: deterministic simulation admission is not the exact v41 predecessor.'
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
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [pscustomobject]@{ ExitCode = $process.ExitCode; Stdout = $stdout; Stderr = $stderr }
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
    if ($clean.Count -ne 1) {
        throw 'BLOCKED: exactly one clean checkpoint is required.'
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
    $healthy = @($integration | Where-Object { $_.Enabled -and $_.PrimaryStatusDescription -eq 'OK' })
    if ($healthy.Count -lt 6) {
        throw 'BLOCKED: Hyper-V integration services are not healthy.'
    }
    [void]$CompletedBoundaries.Add('hyper-v-audit-pass')
    return [pscustomobject]@{ Vm = $vm; CleanCheckpoint = $clean[0]; Integration = $healthy }
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

function Invoke-ExactGuestRunner {
    param(
        [Parameter(Mandatory)][PSCredential]$Credential,
        [string]$ApprovalPhrase
    )

    $response = Invoke-Command -VMName $ExpectedVmName -Credential $Credential -ScriptBlock {
        param($RunnerPath, $ConfigPath, $Approval)
        if ($RunnerPath -ne 'C:\LiiiraaBoost\Phase6\physical-8d162575a964ec77-managed-power-scheme-v41\phase6-physical-runner.exe' -or
            $ConfigPath -ne 'C:\LiiiraaBoost\Phase6\physical-8d162575a964ec77-managed-power-scheme-v41\configs\clean-windows-vm.run-config.json') {
            throw 'fixed runner/config path mismatch'
        }
        $output = if ([string]::IsNullOrEmpty($Approval)) {
            & $RunnerPath '--run-config' $ConfigPath 2>&1
        }
        else {
            ($Approval + [Environment]::NewLine) | & $RunnerPath '--run-config' $ConfigPath 2>&1
        }
        [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = @($output | ForEach-Object { [string]$_ }) }
    } -ArgumentList $ExpectedGuestRunner, $ExpectedGuestConfig, $ApprovalPhrase
    if ($response.ExitCode -ne 0) {
        throw 'BLOCKED: exact guest runner failed; no later mutation is authorized.'
    }
    $text = (@($response.Output) -join "`n")
    if ($text -match '(?i)(password|bearer|token\s*[=:]|S-1-5-\d|serial(?:number)?\s*[=:])') {
        throw 'BLOCKED: guest runner output contains forbidden secret or identity data.'
    }
    return [pscustomobject]@{ State = (@($response.Output)[-1]).Trim(); Output = $text }
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
    $safeReason = if ($Reason -match '(?i)(password|bearer|token\s*[=:]|S-1-5-\d|serial(?:number)?\s*[=:])') { 'redacted-blocker' } else { $Reason }
    $record = [ordered]@{
        status = 'BLOCKED'; operationVersion = $ExpectedOperationVersion; buildId = $ExpectedBuildId
        vmName = $ExpectedVmName; cleanCheckpoint = $ExpectedCleanCheckpoint; installedCheckpoint = $ExpectedInstalledCheckpoint
        completedBoundaries = @($CompletedBoundaries); reason = $safeReason; recordedAt = [DateTime]::UtcNow.ToString('o')
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
    Copy-ExactArtifactToGuest -Authority $Authority

    $first = Invoke-ExactGuestRunner -Credential $Credential
    $installed = Assert-InstalledReadyRecord -Credential $Credential -Authority $Authority -RunnerResult $first
    $installedCheckpoint = New-InstalledCheckpointOnce
    Write-CheckpointReadyRecordOnce -Credential $Credential -Authority $Authority -InstalledReadyBytes $installed.Bytes -InstalledCheckpoint $installedCheckpoint

    $expectedApproval = "APPLY phase6-physical-plan $ExpectedOperationVersion"
    $approval = Read-Host "Type this exact phrase to authorize the guest apply: $expectedApproval"
    if ($approval -cne $expectedApproval) { throw 'BLOCKED: exact physical apply approval was refused.' }
    $second = Invoke-ExactGuestRunner -Credential $Credential -ApprovalPhrase $approval
    [void](Assert-RebootPendingRecord -Credential $Credential -Authority $Authority -RunnerResult $second)

    Restart-VM -Name $ExpectedVmName -Force -Confirm:$false -ErrorAction Stop
    [void]$CompletedBoundaries.Add('operator-authorized-vm-restart')
    Wait-ExactVmReady -Credential $Credential
    $third = Invoke-ExactGuestRunner -Credential $Credential
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
        [ordered]@{
            status = 'PASSED'; action = 'Audit'; readOnly = $true; vmName = $ExpectedVmName
            cleanCheckpoint = $ExpectedCleanCheckpoint; operationVersion = $ExpectedOperationVersion
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
