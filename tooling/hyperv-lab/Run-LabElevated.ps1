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

$labScript = Join-Path $PSScriptRoot 'Invoke-LiiiraaBoostLab.ps1'
$evidenceDirectory = Join-Path $LabRoot 'Evidence'
New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputPath = Join-Path $evidenceDirectory "$timestamp-$($Action.ToLowerInvariant())-console.log"

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
