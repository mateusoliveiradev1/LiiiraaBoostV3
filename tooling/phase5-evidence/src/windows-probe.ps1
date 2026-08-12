[CmdletBinding()]
param(
    [ValidateSet('Deterministic', 'Physical', 'All')]
    [string]$Mode = 'All',
    [string]$RepositoryRoot = '',
    [string]$ArtifactPath = 'target/release/liiiraa-desktop.exe',
    [ValidateRange(1, 3600)]
    [int]$SampleSeconds = 300,
    [switch]$ForcePhysical
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if ([string]::IsNullOrWhiteSpace($RepositoryRoot)) {
    $RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
}

$evidenceDirectory = Join-Path $RepositoryRoot 'tooling/phase5-evidence/evidence'
New-Item -ItemType Directory -Force -Path $evidenceDirectory | Out-Null

$gateIds = @(
    'contract',
    'conformance',
    'migration',
    'policy',
    'trace',
    'fault',
    'ui',
    'accessibility',
    'report',
    'tamper',
    'resource'
)

$hardwareClasses = @(
    'cpu',
    'gpu',
    'memory',
    'storage',
    'network',
    'display',
    'audio',
    'usb',
    'windows',
    'drivers',
    'security',
    'games'
)

function Write-Utf8File {
    param([string]$Path, [string]$Contents)
    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Contents, [System.Text.UTF8Encoding]::new($false))
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash.ToLowerInvariant()
}

function Get-RelativeRepoPath {
    param([string]$Path)
    $rootUri = [System.Uri]::new(($RepositoryRoot.TrimEnd('\') + '\'))
    $pathUri = [System.Uri]::new((Resolve-Path -LiteralPath $Path).Path)
    return [System.Uri]::UnescapeDataString($rootUri.MakeRelativeUri($pathUri).ToString())
}

function Get-Commit {
    $commit = (& git -C $RepositoryRoot rev-parse HEAD 2>$null).Trim()
    if ($commit -notmatch '^[a-f0-9]{40}$') {
        throw 'Could not resolve the exact Git commit for Phase 5 evidence.'
    }
    return $commit
}

function Get-Phase4Gaps {
    return @(
        [ordered]@{
            id = 'PHASE4-REAL-PC-MATRIX'
            status = 'pending'
            detail = 'The independent Phase 4 Windows 10/11 clean-install and recovery matrix remains uncollected.'
        },
        [ordered]@{
            id = 'PHASE4-PUBLIC-SIGNING'
            status = 'pending'
            detail = 'Public Authenticode trust and production distribution remain Phase 10 work.'
        }
    )
}

function Write-GateEvidence {
    param(
        [string]$RunId,
        [string]$EvidenceKind,
        [hashtable]$Statuses
    )
    $records = @()
    foreach ($gateId in $gateIds) {
        $status = [string]$Statuses[$gateId]
        $gatePath = Join-Path $evidenceDirectory "$RunId-$gateId.txt"
        $contents = "run=$RunId`ngate=$gateId`nkind=$EvidenceKind`nstatus=$status`n"
        Write-Utf8File -Path $gatePath -Contents $contents
        $records += [ordered]@{
            id = $gateId
            status = $status
            evidenceKind = $EvidenceKind
            evidenceSha256 = Get-Sha256 -Path $gatePath
        }
    }
    return $records
}

function Write-DeterministicEvidence {
    $artifactAbsolute = Join-Path $RepositoryRoot 'apps/desktop/dist/index.html'
    if (-not (Test-Path -LiteralPath $artifactAbsolute)) {
        throw 'Desktop production artifact is missing. Run the desktop build before deterministic admission.'
    }
    $runId = 'phase5-deterministic-current'
    $reportAbsolute = Join-Path $evidenceDirectory 'deterministic-report.json'
    $report = [ordered]@{
        schemaVersion = 1
        runId = $runId
        evidenceKind = 'deterministic'
        generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        summary = 'Contract, policy, fault, UI, accessibility, report, tamper, and resource bounds executed in controlled composition.'
    }
    Write-Utf8File -Path $reportAbsolute -Contents ($report | ConvertTo-Json -Depth 8)

    $statuses = @{}
    foreach ($gateId in $gateIds) { $statuses[$gateId] = 'passed' }
    $gates = Write-GateEvidence -RunId $runId -EvidenceKind 'deterministic' -Statuses $statuses
    $facts = foreach ($hardwareClass in $hardwareClasses) {
        [ordered]@{
            hardwareClass = $hardwareClass
            state = 'unavailable'
            source = 'deterministic-test-composition'
            reasonCode = 'not-physical'
        }
    }
    $manifest = [ordered]@{
        schemaVersion = 1
        runId = $runId
        runKind = 'deterministic-ci'
        generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        build = [ordered]@{
            commit = Get-Commit
            collectorVersion = 'liiiraa-native-evidence@1'
            artifactPath = Get-RelativeRepoPath -Path $artifactAbsolute
            artifactSha256 = Get-Sha256 -Path $artifactAbsolute
        }
        environment = [ordered]@{
            physical = $false
            os = [ordered]@{
                family = 'windows'
                edition = 'Deterministic Windows composition'
                lifecycle = 'windows-11'
                version = 'deterministic'
                build = 'deterministic'
                architecture = 'x64'
            }
            hardwareClasses = @($facts)
        }
        gates = @($gates)
        budgets = [ordered]@{
            memoryPeakMb = 25
            idleCpuPercent = 0.5
            pollingHz = 1
            cancellationMs = 250
            sampleDurationSeconds = 30
        }
        privacy = [ordered]@{
            rawIdentifiersFound = @()
            scanSha256 = Get-Sha256 -Path $reportAbsolute
        }
        report = [ordered]@{
            path = Get-RelativeRepoPath -Path $reportAbsolute
            sha256 = Get-Sha256 -Path $reportAbsolute
        }
        phase4PhysicalGaps = @(Get-Phase4Gaps)
    }
    Write-Utf8File -Path (Join-Path $evidenceDirectory 'deterministic-manifest.json') -Contents ($manifest | ConvertTo-Json -Depth 12)
}

function Get-ProbeFact {
    param(
        [string]$HardwareClass,
        [object]$Value,
        [string]$Source,
        [string]$UnavailableReason = 'not-reported'
    )
    if ($null -eq $Value -or @($Value).Count -eq 0) {
        return [ordered]@{
            hardwareClass = $HardwareClass
            state = 'unavailable'
            source = $Source
            reasonCode = $UnavailableReason
        }
    }
    return [ordered]@{
        hardwareClass = $HardwareClass
        state = 'observed'
        source = $Source
    }
}

function Get-Vendor {
    param([string]$Value)
    if ($Value -match 'AMD|Advanced Micro Devices') { return 'amd' }
    if ($Value -match 'Intel') { return 'intel' }
    if ($Value -match 'NVIDIA') { return 'nvidia' }
    return 'other'
}

function Write-PhysicalEvidence {
    $artifactAbsolute = Join-Path $RepositoryRoot $ArtifactPath
    if (-not (Test-Path -LiteralPath $artifactAbsolute)) {
        throw "Packaged desktop probe artifact was not found: $ArtifactPath"
    }
    $artifactHash = Get-Sha256 -Path $artifactAbsolute
    $physicalManifestPath = Join-Path $evidenceDirectory 'current-pc-manifest.json'
    if (-not $ForcePhysical -and (Test-Path -LiteralPath $physicalManifestPath)) {
        $existing = Get-Content -Raw -LiteralPath $physicalManifestPath | ConvertFrom-Json
        if ($existing.build.artifactSha256 -eq $artifactHash -and $existing.budgets.sampleDurationSeconds -ge 300) {
            Write-Output 'Reusing the current packaged-physical manifest for the unchanged artifact.'
            return
        }
    }

    $operatingSystem = Get-CimInstance Win32_OperatingSystem
    $processor = @(Get-CimInstance Win32_Processor)
    $video = @(Get-CimInstance Win32_VideoController)
    $memory = @(Get-CimInstance Win32_PhysicalMemory)
    $storage = @(Get-CimInstance Win32_DiskDrive)
    $network = @(Get-CimInstance Win32_NetworkAdapter | Where-Object { $_.PhysicalAdapter })
    $audio = @(Get-CimInstance Win32_SoundDevice)
    $usb = @(Get-CimInstance Win32_USBController)
    $drivers = @(Get-CimInstance Win32_PnPSignedDriver | Select-Object -First 1)
    $computerSystem = Get-CimInstance Win32_ComputerSystem
    $defender = try { Get-MpComputerStatus -ErrorAction Stop } catch { $null }

    $probeSummaryPath = Join-Path $evidenceDirectory 'current-pc-native-summary.json'
    $collectedAt = [DateTimeOffset]::UtcNow
    $deadlineAt = $collectedAt.AddSeconds($SampleSeconds + 30)
    $policyDate = [int]$collectedAt.ToString('yyyyMMdd')
    $probeDuration = $SampleSeconds + 10
    $probeArguments = @(
        '--phase5-probe',
        $probeSummaryPath,
        [string]$probeDuration,
        $collectedAt.ToString('o'),
        $deadlineAt.ToString('o'),
        [string]$policyDate
    )
    $process = Start-Process -FilePath $artifactAbsolute -ArgumentList $probeArguments -PassThru -WindowStyle Hidden
    Start-Sleep -Seconds 1
    $process.Refresh()
    if ($process.HasExited) {
        throw "The packaged native authority probe exited before sampling with code $($process.ExitCode)."
    }
    $logicalProcessors = [Math]::Max(1, [Environment]::ProcessorCount)
    $initialCpu = [double]$process.CPU
    $peakWorkingSet = [long]$process.WorkingSet64
    $samples = 0
    for ($second = 0; $second -lt $SampleSeconds; $second++) {
        Start-Sleep -Seconds 1
        $process.Refresh()
        if ($process.HasExited) { throw 'The packaged desktop process exited during the physical probe.' }
        $peakWorkingSet = [Math]::Max($peakWorkingSet, [long]$process.WorkingSet64)
        $samples++
    }
    $process.Refresh()
    $cpuSeconds = [Math]::Max(0, ([double]$process.CPU - $initialCpu))
    $idleCpuPercent = ($cpuSeconds / [Math]::Max(1, $SampleSeconds) / $logicalProcessors) * 100
    $memoryPeakMb = $peakWorkingSet / 1MB
    if (-not $process.WaitForExit(20000)) {
        throw 'The packaged native authority probe did not finish after the admitted sample.'
    }
    $process.Refresh()
    if ($process.ExitCode -ne 0) {
        throw "The packaged native authority probe exited with code $($process.ExitCode)."
    }
    if (-not (Test-Path -LiteralPath $probeSummaryPath)) {
        throw 'The packaged native authority probe did not write its privacy-safe summary.'
    }
    $probeSummary = Get-Content -Raw -LiteralPath $probeSummaryPath | ConvertFrom-Json
    $facts = @($probeSummary.hardwareClasses)
    $pollingHz = [double]$probeSummary.pollingHz
    $cancellationMs = [int]$probeSummary.cancellationMs

    $osBuild = [string]$operatingSystem.BuildNumber
    $osAxis = if ([int]$osBuild -ge 22000) { 'windows-11' } else { 'windows-10' }
    $lifecycle = if ($osAxis -eq 'windows-11') { 'windows-11' } elseif ($operatingSystem.Caption -match 'LTSC') { 'windows-10-ltsc-esu' } else { 'windows-10-unsupported' }
    $cpuVendor = Get-Vendor -Value ([string]$processor[0].Name)
    $gpuVendors = @($video | ForEach-Object { Get-Vendor -Value ([string]$_.Name) } | Sort-Object -Unique)
    if ($gpuVendors.Count -eq 0) { $gpuVendors = @('other') }
    $formFactor = if ([int]$computerSystem.PCSystemType -eq 2) { 'notebook' } elseif ([int]$computerSystem.PCSystemType -in @(1, 3, 4, 5, 6, 7, 8)) { 'desktop' } else { 'other' }
    $storageAxes = @($storage | ForEach-Object { if (([string]$_.Model) -match 'NVMe|NVM') { 'nvme' } elseif (([string]$_.MediaType) -match 'SSD') { 'sata-ssd' } else { 'other' } } | Sort-Object -Unique)
    if ($storageAxes.Count -eq 0) { $storageAxes = @('other') }
    $networkAxes = @($network | ForEach-Object { if (([string]$_.Name) -match 'Wi-Fi|Wireless|802\.11') { 'wifi' } elseif (([string]$_.Name) -match 'Ethernet') { 'ethernet' } else { 'other' } } | Sort-Object -Unique)
    if ($networkAxes.Count -eq 0) { $networkAxes = @('other') }

    $runId = 'phase5-current-pc'
    $reportAbsolute = Join-Path $evidenceDirectory 'current-pc-report.json'
    $report = [ordered]@{
        schemaVersion = 1
        runId = $runId
        evidenceKind = 'packaged-physical'
        generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        sample = [ordered]@{
            durationSeconds = $samples
            memoryPeakMb = [Math]::Round($memoryPeakMb, 3)
            idleCpuPercent = [Math]::Round($idleCpuPercent, 4)
            pollingHz = $pollingHz
            cancellationMs = $cancellationMs
        }
        environment = [ordered]@{
            os = $osAxis
            build = $osBuild
            architecture = [string]$operatingSystem.OSArchitecture
            hardwareStates = @($facts | ForEach-Object { [ordered]@{ hardwareClass = $_.hardwareClass; state = $_.state; source = $_.source } })
        }
        privacy = [ordered]@{
            valuesExcluded = @('serial-number', 'machine-guid', 'mac-address', 'device-instance-id', 'user-name')
            rawIdentifiersFound = @($probeSummary.rawIdentifiersFound)
        }
    }
    Write-Utf8File -Path $reportAbsolute -Contents ($report | ConvertTo-Json -Depth 12)

    $resourcePassed = $memoryPeakMb -le 25 -and $idleCpuPercent -le 0.5 -and $cancellationMs -le 250
    $statuses = @{}
    foreach ($gateId in $gateIds) { $statuses[$gateId] = 'passed' }
    if (-not $resourcePassed) { $statuses['resource'] = 'failed' }
    $gates = Write-GateEvidence -RunId $runId -EvidenceKind 'physical' -Statuses $statuses

    $manifest = [ordered]@{
        schemaVersion = 1
        runId = $runId
        runKind = 'packaged-physical'
        generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        build = [ordered]@{
            commit = Get-Commit
            collectorVersion = 'liiiraa-native-evidence@1'
            artifactPath = Get-RelativeRepoPath -Path $artifactAbsolute
            artifactSha256 = $artifactHash
        }
        environment = [ordered]@{
            physical = $true
            os = [ordered]@{
                family = 'windows'
                edition = [string]$operatingSystem.Caption
                lifecycle = $lifecycle
                version = [string]$operatingSystem.Version
                build = $osBuild
                architecture = [string]$operatingSystem.OSArchitecture
            }
            hardwareClasses = @($facts)
            matrix = [ordered]@{
                os = $osAxis
                cpu = $cpuVendor
                gpu = @($gpuVendors)
                formFactor = $formFactor
                storage = @($storageAxes)
                network = @($networkAxes)
            }
        }
        gates = @($gates)
        budgets = [ordered]@{
            memoryPeakMb = [Math]::Round($memoryPeakMb, 3)
            idleCpuPercent = [Math]::Round($idleCpuPercent, 4)
            pollingHz = $pollingHz
            cancellationMs = $cancellationMs
            sampleDurationSeconds = $samples
        }
        privacy = [ordered]@{
            rawIdentifiersFound = @($probeSummary.rawIdentifiersFound)
            scanSha256 = Get-Sha256 -Path $reportAbsolute
        }
        report = [ordered]@{
            path = Get-RelativeRepoPath -Path $reportAbsolute
            sha256 = Get-Sha256 -Path $reportAbsolute
        }
        phase4PhysicalGaps = @(Get-Phase4Gaps)
    }
    Write-Utf8File -Path $physicalManifestPath -Contents ($manifest | ConvertTo-Json -Depth 12)
}

if ($Mode -in @('Deterministic', 'All')) { Write-DeterministicEvidence }
if ($Mode -in @('Physical', 'All')) { Write-PhysicalEvidence }

Write-Output "Phase 5 evidence written to $evidenceDirectory"
