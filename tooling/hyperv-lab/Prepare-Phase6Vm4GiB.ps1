[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedVmName = 'LiiiraaBoost-W11-25H2-Clean'
$ExpectedVmId = '107680b1-d9cc-411a-843a-ab72019469cd'
$ExpectedCleanName = 'Clean-Windows-Ready'
$ExpectedCleanId = 'ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075'
$ExpectedExistingBackupName = 'Clean-Windows-Ready-PreLabAccount-v43'
$ExpectedExistingBackupId = 'ebccd5f3-5645-4089-b469-fa4d851fc6ef'
$NewBackupName = 'Clean-Windows-Ready-Pre4GiB-v47'
$ExpectedInstalledName = 'LiiiraaBoost-Installed'
$ExpectedBaseVhdPath = 'C:\Users\Liiiraa\VM-Lab\VMs\LiiiraaBoost-W11-25H2-Clean\LiiiraaBoost-W11-25H2-Clean.vhdx'
$ExpectedVmStorageRoot = 'C:\Users\Liiiraa\VM-Lab\VMs\LiiiraaBoost-W11-25H2-Clean'
$ExpectedSwitchName = 'Default Switch'
$EvidenceDirectory = 'C:\Users\Liiiraa\VM-Lab\Evidence\phase6'
$MaximumEvidenceBytes = 65536
$CompletedBoundaries = [Collections.Generic.List[string]]::new()

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-PathInsideFixedRoot {
    param([Parameter(Mandatory)][string]$Path)

    $resolvedRoot = [IO.Path]::GetFullPath($ExpectedVmStorageRoot).TrimEnd('\')
    $resolvedPath = [IO.Path]::GetFullPath($Path)
    if ($resolvedPath -cne $ExpectedBaseVhdPath -and
        -not $resolvedPath.StartsWith($resolvedRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'BLOCKED: VM disk escaped the exact fixed storage root.'
    }
    if ([IO.Path]::GetExtension($resolvedPath) -notin @('.vhdx', '.avhdx')) {
        throw 'BLOCKED: VM disk is not a fixed-root VHDX checkpoint-chain member.'
    }
}

function Get-ExactTopology {
    param([Parameter(Mandatory)][bool]$RequireOriginalMemory)

    $vms = @(Get-VM -Name $ExpectedVmName -ErrorAction SilentlyContinue)
    if ($vms.Count -ne 1) {
        throw 'BLOCKED: exactly one fixed VM is required.'
    }
    $vm = $vms[0]
    if ($vm.Name -cne $ExpectedVmName -or
        $vm.Id.ToString() -ine $ExpectedVmId -or
        $vm.Generation -ne 2 -or
        $vm.State.ToString() -ne 'Off') {
        throw 'BLOCKED: exact VM identity, Generation 2, and Off state are required.'
    }
    if ($vm.AutomaticCheckpointsEnabled -or
        $vm.AutomaticStartAction.ToString() -ne 'Nothing' -or
        $vm.AutomaticStopAction.ToString() -ne 'ShutDown' -or
        $vm.CheckpointType.ToString() -ne 'Standard') {
        throw 'BLOCKED: exact create-once VM lifecycle topology is required.'
    }

    $processor = Get-VMProcessor -VMName $ExpectedVmName -ErrorAction Stop
    $memory = Get-VMMemory -VMName $ExpectedVmName -ErrorAction Stop
    if ($processor.Count -ne 4 -or -not $memory.DynamicMemoryEnabled -or
        $memory.Minimum -ne 4GB -or $memory.Maximum -ne 12GB) {
        throw 'BLOCKED: exact processor and dynamic-memory envelope are required.'
    }
    if ($RequireOriginalMemory -and $memory.Startup -ne 8GB) {
        throw 'BLOCKED: original startup memory is not the expected 8 GiB.'
    }
    if (-not $RequireOriginalMemory -and $memory.Startup -ne 4GB) {
        throw 'BLOCKED: startup memory is not the approved 4 GiB.'
    }

    $firmware = Get-VMFirmware -VMName $ExpectedVmName -ErrorAction Stop
    $security = Get-VMSecurity -VMName $ExpectedVmName -ErrorAction Stop
    if ($firmware.SecureBoot.ToString() -ne 'On' -or -not $security.TpmEnabled) {
        throw 'BLOCKED: Secure Boot and TPM topology must remain enabled.'
    }

    $disks = @(Get-VMHardDiskDrive -VMName $ExpectedVmName -ErrorAction Stop)
    if ($disks.Count -ne 1 -or
        $disks[0].ControllerType.ToString() -ne 'SCSI' -or
        $disks[0].ControllerNumber -ne 0 -or
        $disks[0].ControllerLocation -ne 0) {
        throw 'BLOCKED: exact single-disk SCSI topology is required.'
    }
    Assert-PathInsideFixedRoot -Path $disks[0].Path

    $dvds = @(Get-VMDvdDrive -VMName $ExpectedVmName -ErrorAction Stop)
    if ($dvds.Count -ne 1 -or
        $dvds[0].ControllerType.ToString() -ne 'SCSI' -or
        $dvds[0].ControllerNumber -ne 0 -or
        $dvds[0].ControllerLocation -ne 1 -or
        -not [string]::IsNullOrEmpty($dvds[0].Path)) {
        throw 'BLOCKED: exact ejected DVD topology is required.'
    }

    $network = @(Get-VMNetworkAdapter -VMName $ExpectedVmName -ErrorAction Stop)
    if ($network.Count -ne 1 -or $network[0].SwitchName -cne $ExpectedSwitchName) {
        throw 'BLOCKED: exact single Default Switch adapter topology is required.'
    }

    $integration = @(Get-VMIntegrationService -VMName $ExpectedVmName -ErrorAction Stop)
    if ($integration.Count -ne 6 -or @($integration | Where-Object { -not $_.Enabled }).Count -ne 0) {
        throw 'BLOCKED: exactly six enabled built-in integration services are required.'
    }

    return [ordered]@{
        vmId = $vm.Id.ToString()
        state = $vm.State.ToString()
        generation = $vm.Generation
        processorCount = $processor.Count
        dynamicMemoryEnabled = $memory.DynamicMemoryEnabled
        startupMemoryBytes = $memory.Startup
        minimumMemoryBytes = $memory.Minimum
        maximumMemoryBytes = $memory.Maximum
        checkpointType = $vm.CheckpointType.ToString()
        secureBoot = $firmware.SecureBoot.ToString()
        tpmEnabled = $security.TpmEnabled
        disk = [ordered]@{
            controllerType = $disks[0].ControllerType.ToString()
            controllerNumber = $disks[0].ControllerNumber
            controllerLocation = $disks[0].ControllerLocation
            path = $disks[0].Path
        }
        dvd = [ordered]@{
            controllerType = $dvds[0].ControllerType.ToString()
            controllerNumber = $dvds[0].ControllerNumber
            controllerLocation = $dvds[0].ControllerLocation
            path = $dvds[0].Path
        }
        network = [ordered]@{ count = $network.Count; switchName = $network[0].SwitchName }
        integrationServiceCount = $integration.Count
    }
}

function Get-ExactSnapshots {
    $snapshots = @(Get-VMSnapshot -VMName $ExpectedVmName -ErrorAction SilentlyContinue)
    return @($snapshots | Sort-Object CreationTime | ForEach-Object {
        [ordered]@{
            name = $_.Name
            id = $_.Id.ToString()
            creationTimeUtc = $_.CreationTime.ToUniversalTime().ToString('o')
        }
    })
}

function Write-AppendOnlyEvidence {
    param([Parameter(Mandatory)]$Record)

    if (-not (Test-Path -LiteralPath $EvidenceDirectory -PathType Container)) {
        throw 'BLOCKED: fixed external Evidence directory is absent.'
    }
    $timestamp = [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff')
    $path = Join-Path $EvidenceDirectory "$timestamp-phase6-pre4gib-v47.json"
    $json = $Record | ConvertTo-Json -Depth 10
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes($json + [Environment]::NewLine)
    if ($bytes.Length -gt $MaximumEvidenceBytes) {
        throw 'BLOCKED: fixed preparation evidence exceeded 65536 bytes.'
    }
    $stream = [IO.FileStream]::new($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try {
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
    }
    finally {
        $stream.Dispose()
    }
    return $path
}

if (-not (Test-IsAdministrator)) {
    throw 'BLOCKED: fixed VM preparation requires one elevated process.'
}

$record = [ordered]@{
    schemaVersion = 1
    action = 'prepare-phase6-vm-4gib-create-once'
    vmName = $ExpectedVmName
    originalCleanCheckpoint = [ordered]@{ name = $ExpectedCleanName; id = $ExpectedCleanId }
    preservedBackups = @(
        [ordered]@{ name = $ExpectedExistingBackupName; id = $ExpectedExistingBackupId },
        [ordered]@{ name = $NewBackupName; id = $ExpectedCleanId }
    )
    before = $null
    after = $null
    completedBoundaries = $CompletedBoundaries
    result = 'BLOCKED'
    failure = $null
    recordedAt = [DateTime]::UtcNow.ToString('o')
}
$exitCode = 1

try {
    $beforeTopology = Get-ExactTopology -RequireOriginalMemory $true
    $beforeSnapshots = @(Get-ExactSnapshots)
    $clean = @($beforeSnapshots | Where-Object { $_.name -ceq $ExpectedCleanName -and $_.id -ieq $ExpectedCleanId })
    $existingBackup = @($beforeSnapshots | Where-Object { $_.name -ceq $ExpectedExistingBackupName -and $_.id -ieq $ExpectedExistingBackupId })
    $newBackup = @($beforeSnapshots | Where-Object { $_.name -ceq $NewBackupName })
    $installed = @($beforeSnapshots | Where-Object { $_.name -ceq $ExpectedInstalledName })
    if ($beforeSnapshots.Count -ne 2 -or $clean.Count -ne 1 -or $existingBackup.Count -ne 1 -or
        $newBackup.Count -ne 0 -or $installed.Count -ne 0) {
        throw 'BLOCKED: exact pre-operation checkpoint inventory is required and create-once backup must be absent.'
    }
    $record.before = [ordered]@{ topology = $beforeTopology; checkpoints = $beforeSnapshots }
    [void]$CompletedBoundaries.Add('exact-preflight-pass')

    Restore-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedCleanName -Confirm:$false -ErrorAction Stop
    if ((Get-VM -Name $ExpectedVmName -ErrorAction Stop).State.ToString() -ne 'Off') {
        throw 'BLOCKED: clean restore did not preserve Off state.'
    }
    [void]$CompletedBoundaries.Add('clean-checkpoint-restored-off')

    Rename-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedCleanName -NewName $NewBackupName -ErrorAction Stop
    $renamed = @(Get-VMSnapshot -VMName $ExpectedVmName -Name $NewBackupName -ErrorAction SilentlyContinue)
    if ($renamed.Count -ne 1 -or $renamed[0].Id.ToString() -ine $ExpectedCleanId -or
        @(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedCleanName -ErrorAction SilentlyContinue).Count -ne 0) {
        throw 'BLOCKED: original clean checkpoint was not preserved under the create-once v47 backup name.'
    }
    [void]$CompletedBoundaries.Add('original-clean-renamed-create-once')

    Set-VMMemory -VMName $ExpectedVmName -DynamicMemoryEnabled $true -MinimumBytes 4GB -StartupBytes 4GB -MaximumBytes 12GB -ErrorAction Stop
    [void](Get-ExactTopology -RequireOriginalMemory $false)
    [void]$CompletedBoundaries.Add('dynamic-memory-4gib-4gib-12gib-verified')

    Checkpoint-VM -Name $ExpectedVmName -SnapshotName $ExpectedCleanName -Confirm:$false -ErrorAction Stop
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    do {
        $newClean = @(Get-VMSnapshot -VMName $ExpectedVmName -Name $ExpectedCleanName -ErrorAction SilentlyContinue)
        if ($newClean.Count -eq 1) { break }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($newClean.Count -ne 1 -or $newClean[0].Id.ToString() -ieq $ExpectedCleanId -or
        $newClean[0].Id.ToString() -ieq $ExpectedExistingBackupId) {
        throw 'BLOCKED: new Standard clean checkpoint was not created with a new identity.'
    }
    [void]$CompletedBoundaries.Add('new-standard-clean-checkpoint-created')

    $afterTopology = Get-ExactTopology -RequireOriginalMemory $false
    $afterSnapshots = @(Get-ExactSnapshots)
    $afterClean = @($afterSnapshots | Where-Object { $_.name -ceq $ExpectedCleanName -and $_.id -ieq $newClean[0].Id.ToString() })
    $afterExistingBackup = @($afterSnapshots | Where-Object { $_.name -ceq $ExpectedExistingBackupName -and $_.id -ieq $ExpectedExistingBackupId })
    $afterNewBackup = @($afterSnapshots | Where-Object { $_.name -ceq $NewBackupName -and $_.id -ieq $ExpectedCleanId })
    $afterInstalled = @($afterSnapshots | Where-Object { $_.name -ceq $ExpectedInstalledName })
    if ($afterSnapshots.Count -ne 3 -or $afterClean.Count -ne 1 -or $afterExistingBackup.Count -ne 1 -or
        $afterNewBackup.Count -ne 1 -or $afterInstalled.Count -ne 0) {
        throw 'BLOCKED: final checkpoint inventory or preservation invariant failed.'
    }
    $record.after = [ordered]@{ topology = $afterTopology; checkpoints = $afterSnapshots; cleanCheckpointId = $newClean[0].Id.ToString() }
    [void]$CompletedBoundaries.Add('final-off-memory-checkpoint-invariants-pass')
    $record.result = 'PASSED'
    $exitCode = 0
}
catch {
    $record.failure = $_.Exception.Message
    try {
        $record.after = [ordered]@{
            vmState = (Get-VM -Name $ExpectedVmName -ErrorAction Stop).State.ToString()
            checkpoints = @(Get-ExactSnapshots)
        }
    }
    catch {
        $record.after = [ordered]@{ observationFailure = 'bounded-post-failure-observation-unavailable' }
    }
    $exitCode = 1
}

$record.recordedAt = [DateTime]::UtcNow.ToString('o')
$evidencePath = Write-AppendOnlyEvidence -Record $record
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $evidencePath).Hash.ToLowerInvariant()
[pscustomobject]@{
    result = $record.result
    evidencePath = $evidencePath
    evidenceSha256 = $hash
    cleanCheckpointId = if ($null -ne $record.after -and $record.after.Contains('cleanCheckpointId')) { $record.after.cleanCheckpointId } else { $null }
    completedBoundaries = $CompletedBoundaries
    failure = $record.failure
} | ConvertTo-Json -Depth 5
exit $exitCode
