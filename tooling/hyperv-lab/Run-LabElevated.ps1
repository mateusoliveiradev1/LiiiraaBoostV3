[CmdletBinding()]
param(
    [ValidateSet('Audit', 'RepairHost', 'Create', 'Status', 'Open', 'StageGuest', 'Checkpoint', 'Phase6Audit', 'Phase6ObservedAudit')]
    [string]$Action = 'Status',

    [string]$LabRoot = (Join-Path $env:USERPROFILE 'VM-Lab'),

    [string]$IsoPath = (Join-Path $env:USERPROFILE 'VM-Lab\ISOs\Win11Enterprise25H2-ptBR.iso'),

    [string]$VmName = 'LiiiraaBoost-W11-25H2-Clean',

    [string]$CheckpointName = 'Clean-Windows-Ready',

    [switch]$StartAfterCreate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$labScript = Join-Path $PSScriptRoot 'Invoke-LiiiraaBoostLab.ps1'
$phase6Script = Join-Path $PSScriptRoot 'Invoke-Phase6Physical.ps1'
$evidenceDirectory = Join-Path $LabRoot 'Evidence'
New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputPath = Join-Path $evidenceDirectory "$timestamp-$($Action.ToLowerInvariant())-console.log"

if ($Action -eq 'Phase6ObservedAudit') {
    $expectedVmName = 'LiiiraaBoost-W11-25H2-Clean'
    $expectedCheckpointName = 'Clean-Windows-Ready'
    $repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    $record = [ordered]@{
        schemaVersion = 1
        action = 'Phase6ObservedAudit'
        vmName = $expectedVmName
        checkpointName = $expectedCheckpointName
        commands = @(
            "Get-VM -Name $expectedVmName"
            "Get-VMSnapshot -VMName $expectedVmName -Name $expectedCheckpointName"
            "Get-VMIntegrationService -VMName $expectedVmName"
            "Start-VM -Name $expectedVmName"
            "Run-LabElevated.ps1 -Action Phase6Audit -VmName $expectedVmName -CheckpointName $expectedCheckpointName"
            "Stop-VM -Name $expectedVmName -Shutdown -Force"
        )
        before = $null
        health = $null
        audit = $null
        stop = $null
        after = $null
        failure = $null
    }
    $startedByObservation = $false
    $exitCode = 1

    try {
        if ($VmName -cne $expectedVmName -or $CheckpointName -cne $expectedCheckpointName) {
            throw 'BLOCKED: observed Audit target or checkpoint override rejected.'
        }
        $vm = Get-VM -Name $expectedVmName -ErrorAction Stop
        $checkpoints = @(Get-VMSnapshot -VMName $expectedVmName -Name $expectedCheckpointName -ErrorAction SilentlyContinue)
        $integration = @(Get-VMIntegrationService -VMName $expectedVmName -ErrorAction Stop)
        $record.before = [ordered]@{
            vmState = $vm.State.ToString()
            checkpoints = @($checkpoints | Select-Object Name, Id, CreationTime)
            integrationServices = @($integration | Select-Object Name, Enabled, PrimaryStatusDescription, SecondaryStatusDescription)
        }
        if ($vm.State.ToString() -ne 'Off') {
            throw 'BLOCKED: observed Audit requires the exact VM to start in Off state.'
        }
        if ($checkpoints.Count -ne 1) {
            throw 'BLOCKED: observed Audit requires exactly one clean checkpoint.'
        }
        if ($integration.Count -ne 6 -or @($integration | Where-Object { -not $_.Enabled }).Count -ne 0) {
            throw 'BLOCKED: observed Audit requires exactly six enabled built-in integration services.'
        }

        Start-VM -Name $expectedVmName -ErrorAction Stop | Out-Null
        $startedByObservation = $true
        $deadline = [DateTime]::UtcNow.AddSeconds(180)
        do {
            $integration = @(Get-VMIntegrationService -VMName $expectedVmName -ErrorAction Stop)
            $healthy = @($integration | Where-Object { $_.Enabled -and $_.PrimaryStatusDescription -eq 'OK' })
            if ($integration.Count -eq 6 -and $healthy.Count -eq 6) {
                break
            }
            Start-Sleep -Seconds 2
        } while ([DateTime]::UtcNow -lt $deadline)
        $record.health = [ordered]@{
            deadlineUtc = $deadline.ToString('o')
            healthyCount = $healthy.Count
            integrationServices = @($integration | Select-Object Name, Enabled, PrimaryStatusDescription, SecondaryStatusDescription)
        }
        if ($integration.Count -ne 6 -or $healthy.Count -ne 6) {
            throw 'BLOCKED: integration services did not become healthy within 180 seconds.'
        }

        $auditOutput = (& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PSCommandPath `
            -Action Phase6Audit `
            -LabRoot $LabRoot `
            -VmName $expectedVmName `
            -CheckpointName $expectedCheckpointName *>&1 | Out-String).Trim()
        $auditExitCode = $LASTEXITCODE
        $record.audit = [ordered]@{
            exitCode = $auditExitCode
            output = $auditOutput
        }
        if ($auditExitCode -ne 0) {
            throw "BLOCKED: Phase 6 Audit exited with code $auditExitCode."
        }
        $exitCode = 0
    }
    catch {
        $record.failure = $_.Exception.Message
        $exitCode = 1
    }
    finally {
        $stopFailure = $null
        try {
            $currentVm = Get-VM -Name $expectedVmName -ErrorAction Stop
            if ($startedByObservation -and $currentVm.State.ToString() -ne 'Off') {
                Stop-VM -Name $expectedVmName -Shutdown -Force -ErrorAction Stop
                $stopDeadline = [DateTime]::UtcNow.AddSeconds(120)
                do {
                    Start-Sleep -Seconds 2
                    $currentVm = Get-VM -Name $expectedVmName -ErrorAction Stop
                } while ($currentVm.State.ToString() -ne 'Off' -and [DateTime]::UtcNow -lt $stopDeadline)
                if ($currentVm.State.ToString() -ne 'Off') {
                    throw 'BLOCKED: exact VM did not return to Off state within 120 seconds.'
                }
            }
            $record.stop = [ordered]@{
                requested = $startedByObservation
                finalState = $currentVm.State.ToString()
                result = if ($currentVm.State.ToString() -eq 'Off') { 'Off' } else { 'BLOCKED' }
            }
        }
        catch {
            $stopFailure = $_.Exception.Message
            $record.stop = [ordered]@{ requested = $startedByObservation; finalState = 'Unknown'; result = 'BLOCKED'; error = $stopFailure }
            $exitCode = 1
        }

        try {
            $afterVm = Get-VM -Name $expectedVmName -ErrorAction Stop
            $afterCheckpoints = @(Get-VMSnapshot -VMName $expectedVmName -Name $expectedCheckpointName -ErrorAction SilentlyContinue)
            $afterIntegration = @(Get-VMIntegrationService -VMName $expectedVmName -ErrorAction Stop)
            $record.after = [ordered]@{
                vmState = $afterVm.State.ToString()
                checkpoints = @($afterCheckpoints | Select-Object Name, Id, CreationTime)
                integrationServices = @($afterIntegration | Select-Object Name, Enabled, PrimaryStatusDescription, SecondaryStatusDescription)
            }
            if ($afterVm.State.ToString() -ne 'Off' -or $afterCheckpoints.Count -ne 1) {
                $exitCode = 1
                if ($null -eq $record.failure) {
                    $record.failure = 'BLOCKED: final VM state or clean checkpoint invariant failed.'
                }
            }
        }
        catch {
            $exitCode = 1
            if ($null -eq $record.failure) {
                $record.failure = $_.Exception.Message
            }
        }
        if ($null -ne $stopFailure -and $null -eq $record.failure) {
            $record.failure = $stopFailure
        }
        $json = $record | ConvertTo-Json -Depth 8
        [IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
        Write-Output $json
    }
    exit $exitCode
}

if ($Action -eq 'Phase6Audit') {
    $repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
    $phase6Arguments = @(
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        $phase6Script,
        '-Action',
        'Audit',
        '-VmName',
        $VmName,
        '-CheckpointName',
        $CheckpointName,
        '-ArtifactManifestFromSummary',
        (Join-Path $repositoryRoot '.planning\phases\06-transactional-plans-and-recovery\06-31-SUMMARY.md'),
        '-SimulationAdmissionFromSummary',
        (Join-Path $repositoryRoot '.planning\phases\06-transactional-plans-and-recovery\06-38-SUMMARY.md')
    )
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = 'powershell.exe'
    $start.WorkingDirectory = $repositoryRoot
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.Arguments = (($phase6Arguments | ForEach-Object {
        '"' + $_.Replace('"', '\"') + '"'
    }) -join ' ')
    $process = [Diagnostics.Process]::Start($start)
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    $combined = ($stdout + $stderr).TrimEnd() + [Environment]::NewLine
    [IO.File]::WriteAllText($outputPath, $combined, [Text.UTF8Encoding]::new($false))
    Write-Output $combined.TrimEnd()
    exit $process.ExitCode
}

$arguments = @{
    Action = $Action
    LabRoot = $LabRoot
    IsoPath = $IsoPath
    VmName = $VmName
    CheckpointName = $CheckpointName
}
if ($StartAfterCreate) {
    $arguments.StartAfterCreate = $true
}

try {
    & $labScript @arguments *>&1 | Tee-Object -FilePath $outputPath
    exit 0
}
catch {
    $_ | Format-List * -Force | Out-String | Tee-Object -FilePath $outputPath
    exit 1
}
