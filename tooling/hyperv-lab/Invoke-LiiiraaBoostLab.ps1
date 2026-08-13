[CmdletBinding()]
param(
    [ValidateSet('Audit', 'RepairHost', 'Create', 'Status', 'Open', 'StageGuest', 'Checkpoint')]
    [string]$Action = 'Status',

    [string]$LabRoot = (Join-Path $env:USERPROFILE 'VM-Lab'),

    [string]$IsoPath = (Join-Path $env:USERPROFILE 'VM-Lab\ISOs\Win11Enterprise25H2-ptBR.iso'),

    [string]$VmName = 'LiiiraaBoost-W11-25H2-Clean',

    [string]$CheckpointName = 'Clean-Windows-Ready',

    [switch]$StartAfterCreate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Assert-SafeLabRoot {
    param([Parameter(Mandatory)][string]$Path)

    $fullPath = [IO.Path]::GetFullPath($Path).TrimEnd('\')
    $profilePath = [IO.Path]::GetFullPath($env:USERPROFILE).TrimEnd('\')
    $driveRoot = [IO.Path]::GetPathRoot($fullPath).TrimEnd('\')

    if ($fullPath -eq $profilePath -or $fullPath -eq $driveRoot) {
        throw "LabRoot inseguro: '$fullPath'. Use uma subpasta dedicada."
    }

    if (-not $fullPath.StartsWith($profilePath + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "LabRoot precisa permanecer dentro do perfil atual: '$profilePath'."
    }

    return $fullPath
}

function Assert-HyperVReady {
    $feature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
    if ($feature.State -ne 'Enabled') {
        throw 'O Hyper-V não está habilitado neste Windows.'
    }

    foreach ($serviceName in @('vmms', 'vmcompute')) {
        $service = Get-Service -Name $serviceName
        if ($service.Status -ne 'Running') {
            throw "O serviço obrigatório '$serviceName' não está em execução."
        }
    }
}

function New-EvidenceRecord {
    param(
        [Parameter(Mandatory)][string]$EvidenceDirectory,
        [Parameter(Mandatory)][string]$Operation,
        [Parameter(Mandatory)][hashtable]$Payload
    )

    New-Item -ItemType Directory -Path $EvidenceDirectory -Force | Out-Null
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $record = [ordered]@{
        schemaVersion = 1
        recordedAt = (Get-Date).ToUniversalTime().ToString('o')
        operation = $Operation
        computerName = $env:COMPUTERNAME
        operator = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        payload = $Payload
    }
    $path = Join-Path $EvidenceDirectory "$timestamp-$Operation.json"
    $record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $path -Encoding utf8
    return $path
}

function Get-LabStatus {
    param([Parameter(Mandatory)][string]$Name)

    $vm = Get-VM -Name $Name -ErrorAction SilentlyContinue
    if ($null -eq $vm) {
        return [ordered]@{
            exists = $false
            name = $Name
        }
    }

    $firmware = Get-VMFirmware -VMName $Name
    $security = Get-VMSecurity -VMName $Name
    $memory = Get-VMMemory -VMName $Name
    $processor = Get-VMProcessor -VMName $Name
    $dvd = Get-VMDvdDrive -VMName $Name -ErrorAction SilentlyContinue
    $checkpoints = @(Get-VMSnapshot -VMName $Name -ErrorAction SilentlyContinue | Select-Object Name, CreationTime)

    return [ordered]@{
        exists = $true
        name = $vm.Name
        state = $vm.State.ToString()
        generation = $vm.Generation
        processorCount = $processor.Count
        startupMemoryBytes = $memory.Startup
        minimumMemoryBytes = $memory.Minimum
        maximumMemoryBytes = $memory.Maximum
        dynamicMemoryEnabled = $memory.DynamicMemoryEnabled
        secureBootEnabled = $firmware.SecureBoot.ToString()
        tpmEnabled = $security.TpmEnabled
        isoPath = $dvd.Path
        checkpointCount = $checkpoints.Count
        checkpoints = $checkpoints
    }
}

if (-not (Test-IsAdministrator)) {
    throw 'Abra este script em um PowerShell elevado. Nenhuma alteração foi aplicada.'
}

$safeLabRoot = Assert-SafeLabRoot -Path $LabRoot
Assert-HyperVReady

$isoDirectory = Join-Path $safeLabRoot 'ISOs'
$vmDirectory = Join-Path $safeLabRoot 'VMs'
$evidenceDirectory = Join-Path $safeLabRoot 'Evidence'
New-Item -ItemType Directory -Path $isoDirectory, $vmDirectory, $evidenceDirectory -Force | Out-Null

switch ($Action) {
    'Audit' {
        $switches = @(Get-VMSwitch | Select-Object Name, SwitchType)
        $payload = @{
            hyperVFeature = 'Enabled'
            services = @(Get-Service vmms, vmcompute | Select-Object Name, Status)
            switches = $switches
            integrationServices = @(Get-VMIntegrationService -VMName $VmName -ErrorAction SilentlyContinue | Select-Object Name, Enabled, PrimaryStatusDescription, SecondaryStatusDescription)
            vm = Get-LabStatus -Name $VmName
        }
        $evidencePath = New-EvidenceRecord -EvidenceDirectory $evidenceDirectory -Operation 'audit' -Payload $payload
        $payload | ConvertTo-Json -Depth 8
        Write-Host "Evidência: $evidencePath"
    }

    'RepairHost' {
        $integrationServices = @(
            'vmicguestinterface',
            'vmicheartbeat',
            'vmickvpexchange',
            'vmicrdv',
            'vmicshutdown',
            'vmictimesync',
            'vmicvmsession',
            'vmicvss'
        )
        $hostServices = @('hvservice', 'hvhost') + $integrationServices
        $before = @(Get-Service -Name $hostServices | Select-Object Name, Status, StartType)
        $vidBefore = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Services\Vid' -Name Start).Start
        $vmbusBefore = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Services\vmbus' -Name Start).Start
        $deviceGuardPath = 'HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard'
        $deviceGuardBefore = Get-ItemProperty -LiteralPath $deviceGuardPath -ErrorAction SilentlyContinue
        $vidConfigOutput = & sc.exe config vid start= system 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Não foi possível restaurar o driver Vid para System Start: $vidConfigOutput"
        }
        $vmbusConfigOutput = & sc.exe config vmbus start= boot 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to restore the VMBus driver to Boot Start: $vmbusConfigOutput"
        }
        Set-Service -Name hvservice -StartupType Manual
        Set-Service -Name hvhost -StartupType Manual
        foreach ($serviceName in $integrationServices) {
            Set-Service -Name $serviceName -StartupType Manual
        }
        New-Item -Path $deviceGuardPath -Force | Out-Null
        New-ItemProperty -LiteralPath $deviceGuardPath -Name EnableVirtualizationBasedSecurity -PropertyType DWord -Value 1 -Force | Out-Null
        New-ItemProperty -LiteralPath $deviceGuardPath -Name RequirePlatformSecurityFeatures -PropertyType DWord -Value 1 -Force | Out-Null
        New-ItemProperty -LiteralPath $deviceGuardPath -Name Locked -PropertyType DWord -Value 0 -Force | Out-Null
        $vbsWasEnabled = $null -ne $deviceGuardBefore -and $deviceGuardBefore.EnableVirtualizationBasedSecurity -eq 1
        $restartRequired = ($vidBefore -ne 1) -or ($vmbusBefore -ne 0) -or (-not $vbsWasEnabled)
        $startError = $null
        try {
            Start-Service -Name hvhost
        }
        catch {
            $restartRequired = $true
            $startError = $_.Exception.Message
        }
        $after = @(Get-Service -Name $hostServices | Select-Object Name, Status, StartType)
        $vidAfter = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Services\Vid' -Name Start).Start
        $vmbusAfter = (Get-ItemProperty -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Services\vmbus' -Name Start).Start
        $deviceGuardAfter = Get-ItemProperty -LiteralPath $deviceGuardPath
        $payload = @{
            reason = 'Restore the Windows INF startup modes required by the Hyper-V lab.'
            before = $before
            after = $after
            vidStartBefore = $vidBefore
            vidStartAfter = $vidAfter
            vmbusStartBefore = $vmbusBefore
            vmbusStartAfter = $vmbusAfter
            vbsEnabledBefore = $vbsWasEnabled
            vbsEnabledAfter = $deviceGuardAfter.EnableVirtualizationBasedSecurity -eq 1
            vbsPlatformSecurityAfter = $deviceGuardAfter.RequirePlatformSecurityFeatures
            restartRequired = $restartRequired
            startError = $startError
        }
        $evidencePath = New-EvidenceRecord -EvidenceDirectory $evidenceDirectory -Operation 'repair-host' -Payload $payload
        $payload | ConvertTo-Json -Depth 8
        Write-Host "Evidência: $evidencePath"
        if ($restartRequired) {
            Write-Warning 'O host precisa ser reiniciado antes de iniciar a VM.'
        }
    }

    'Create' {
        if (-not (Test-Path -LiteralPath $IsoPath -PathType Leaf)) {
            throw "ISO não encontrado em '$IsoPath'. A VM não foi criada."
        }

        $existingVm = Get-VM -Name $VmName -ErrorAction SilentlyContinue
        if ($null -ne $existingVm) {
            throw "A VM '$VmName' já existe. Use -Action Status ou escolha outro nome."
        }

        $defaultSwitch = Get-VMSwitch -Name 'Default Switch' -ErrorAction SilentlyContinue
        if ($null -eq $defaultSwitch) {
            throw "O 'Default Switch' do Hyper-V não está disponível. Nenhum switch externo será criado automaticamente."
        }

        $vmPath = Join-Path $vmDirectory $VmName
        $vhdPath = Join-Path $vmPath "$VmName.vhdx"
        New-Item -ItemType Directory -Path $vmPath -Force | Out-Null

        $vm = New-VM `
            -Name $VmName `
            -Generation 2 `
            -MemoryStartupBytes 8GB `
            -NewVHDPath $vhdPath `
            -NewVHDSizeBytes 96GB `
            -Path $vmDirectory `
            -SwitchName $defaultSwitch.Name

        Set-VMProcessor -VMName $VmName -Count 4
        Set-VMMemory -VMName $VmName -DynamicMemoryEnabled $true -MinimumBytes 4GB -StartupBytes 8GB -MaximumBytes 12GB
        Set-VM -VMName $VmName -AutomaticCheckpointsEnabled $false -AutomaticStartAction Nothing -AutomaticStopAction ShutDown
        Set-VMFirmware -VMName $VmName -EnableSecureBoot On -SecureBootTemplate MicrosoftWindows
        Set-VMKeyProtector -VMName $VmName -NewLocalKeyProtector
        Enable-VMTPM -VMName $VmName

        $dvd = Add-VMDvdDrive -VMName $VmName -Path $IsoPath -Passthru
        Set-VMFirmware -VMName $VmName -FirstBootDevice $dvd

        $status = Get-LabStatus -Name $VmName
        $evidencePath = New-EvidenceRecord -EvidenceDirectory $evidenceDirectory -Operation 'create' -Payload @{ vm = $status }
        $status | ConvertTo-Json -Depth 8
        Write-Host "Evidência: $evidencePath"

        if ($StartAfterCreate) {
            Start-VM -Name $VmName | Out-Null
            Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\vmconnect.exe') -ArgumentList 'localhost', $VmName
        }
    }

    'Status' {
        $status = Get-LabStatus -Name $VmName
        $status | ConvertTo-Json -Depth 8
    }

    'Open' {
        $vm = Get-VM -Name $VmName -ErrorAction Stop
        if ($vm.State -eq 'Off') {
            Start-VM -Name $VmName | Out-Null
        }
        $evidencePath = New-EvidenceRecord -EvidenceDirectory $evidenceDirectory -Operation 'open' -Payload @{
            vm = Get-LabStatus -Name $VmName
        }
        Write-Host "Evidência: $evidencePath"
        Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\vmconnect.exe') -ArgumentList 'localhost', $VmName
    }

    'StageGuest' {
        $vm = Get-VM -Name $VmName -ErrorAction Stop
        if ($vm.State -ne 'Running') {
            throw "A VM '$VmName' precisa estar em execução para receber a preparação."
        }

        $guestDirectory = Join-Path $PSScriptRoot 'guest'
        $files = @(
            Join-Path $guestDirectory 'Prepare-LiiiraaBoostGuest.ps1'
            Join-Path $guestDirectory 'Preparar-Laboratorio.cmd'
        )
        foreach ($file in $files) {
            if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
                throw "Arquivo de preparação ausente: '$file'."
            }
        }

        $guestService = Get-VMIntegrationService -VMName $VmName | Where-Object {
            $_.Name -match 'Guest Service|Interface de Serviço|Serviço de Convidado|Convidado'
        } | Select-Object -First 1
        if ($null -eq $guestService) {
            throw 'A Interface de Serviço de Convidado do Hyper-V não foi localizada.'
        }
        if (-not $guestService.Enabled) {
            Enable-VMIntegrationService -VMName $VmName -Name $guestService.Name
        }

        $targetRoot = 'C:\Users\Public\Desktop\LiiiraaBoost-Lab'
        foreach ($file in $files) {
            $targetPath = Join-Path $targetRoot (Split-Path -Leaf $file)
            Copy-VMFile `
                -VMName $VmName `
                -SourcePath $file `
                -DestinationPath $targetPath `
                -FileSource Host `
                -CreateFullPath `
                -Force
        }

        $dvd = Get-VMDvdDrive -VMName $VmName -ErrorAction SilentlyContinue
        $mountedIso = $dvd.Path
        if ($null -ne $dvd -and -not [string]::IsNullOrWhiteSpace($mountedIso)) {
            Set-VMDvdDrive -VMName $VmName -ControllerNumber $dvd.ControllerNumber -ControllerLocation $dvd.ControllerLocation -Path $null
        }

        $evidencePath = New-EvidenceRecord -EvidenceDirectory $evidenceDirectory -Operation 'stage-guest' -Payload @{
            vmName = $VmName
            integrationService = $guestService.Name
            targetRoot = $targetRoot
            files = @($files | ForEach-Object { Split-Path -Leaf $_ })
            ejectedIso = $mountedIso
        }
        Write-Host "Preparação copiada para: $targetRoot"
        Write-Host "Evidência: $evidencePath"
    }

    'Checkpoint' {
        $vm = Get-VM -Name $VmName -ErrorAction Stop
        $existingCheckpoint = Get-VMSnapshot -VMName $VmName -Name $CheckpointName -ErrorAction SilentlyContinue
        if ($null -ne $existingCheckpoint) {
            throw "O checkpoint '$CheckpointName' já existe. Nada foi sobrescrito."
        }

        Checkpoint-VM -Name $VmName -SnapshotName $CheckpointName | Out-Null
        $evidencePath = New-EvidenceRecord -EvidenceDirectory $evidenceDirectory -Operation 'checkpoint' -Payload @{
            vmName = $VmName
            checkpointName = $CheckpointName
            vmState = $vm.State.ToString()
        }
        Write-Host "Checkpoint criado: $CheckpointName"
        Write-Host "Evidência: $evidencePath"
    }
}
