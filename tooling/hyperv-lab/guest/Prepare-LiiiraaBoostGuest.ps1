#requires -RunAsAdministrator
[CmdletBinding()]
param([switch]$Continue)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$labRoot = Join-Path $env:ProgramData 'LiiiraaBoostLab'
$evidenceRoot = Join-Path $labRoot 'Evidence'
$statePath = Join-Path $labRoot 'preparation-state.json'
$completeMarker = Join-Path $env:PUBLIC 'Desktop\Liiiraa Boost Lab - PREPARADO.txt'
$taskName = 'LiiiraaBoostLab-Prepare'
$targetComputerName = 'LIIIRAA-LAB'
$maxAttempts = 5
$preparationMutex = [Threading.Mutex]::new($false, 'Global\LiiiraaBoostLabPrepare')
$ownsPreparationMutex = $false

New-Item -ItemType Directory -Path $labRoot, $evidenceRoot -Force | Out-Null

try {
    $ownsPreparationMutex = $preparationMutex.WaitOne(0)
}
catch [Threading.AbandonedMutexException] {
    $ownsPreparationMutex = $true
}

if (-not $ownsPreparationMutex) {
    Write-Host 'A preparacao do laboratorio ja esta em andamento. Mantenha apenas a primeira janela aberta.'
    $preparationMutex.Dispose()
    exit 0
}

$state = if (Test-Path -LiteralPath $statePath) {
    Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
}
else {
    [pscustomobject]@{ attempt = 0 }
}
$attempt = [int]$state.attempt + 1

function Write-State {
    param([Parameter(Mandatory)][hashtable]$Payload)

    $Payload.recordedAt = (Get-Date).ToUniversalTime().ToString('o')
    $Payload.computerName = $env:COMPUTERNAME
    $Payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $statePath -Encoding utf8
}

function Remove-PreparationTask {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

try {
    Set-TimeZone -Id 'E. South America Standard Time'

    $renameRequired = $env:COMPUTERNAME -ne $targetComputerName
    if ($renameRequired) {
        Rename-Computer -NewName $targetComputerName -Force
    }

    if (-not $Continue) {
        $scriptPath = $MyInvocation.MyCommand.Path
        $action = New-ScheduledTaskAction `
            -Execute 'powershell.exe' `
            -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Continue"
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet `
            -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
            -RestartCount 2 `
            -RestartInterval (New-TimeSpan -Minutes 2)
        Register-ScheduledTask `
            -TaskName $taskName `
            -Action $action `
            -Trigger $trigger `
            -Principal $principal `
            -Settings $settings `
            -Force | Out-Null
    }

    Set-Service -Name wuauserv -StartupType Manual
    Start-Service -Name wuauserv

    Write-Host "Verificando atualizacoes oficiais do Windows (tentativa $attempt de $maxAttempts)..."
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $searchResult = $searcher.Search("IsInstalled=0 and IsHidden=0 and Type='Software'")
    $updates = New-Object -ComObject Microsoft.Update.UpdateColl
    $titles = [Collections.Generic.List[string]]::new()

    foreach ($update in $searchResult.Updates) {
        if (-not $update.EulaAccepted) {
            $update.AcceptEula()
        }
        [void]$updates.Add($update)
        $titles.Add([string]$update.Title)
        Write-Host "Admitida: $($update.Title)"
    }

    if ($updates.Count -eq 0) {
        if ($renameRequired -and $attempt -lt $maxAttempts) {
            Write-State -Payload @{
                status = 'computer-rename-pending'
                attempt = $attempt
                admittedUpdates = 0
                rebootRequired = $true
            }
            Write-Host 'O nome seguro do computador foi configurado. A VM reiniciará em 15 segundos.'
            Start-Sleep -Seconds 15
            Restart-Computer -Force
        }
        Remove-PreparationTask
        $payload = @{
            status = 'complete'
            attempt = $attempt
            admittedUpdates = 0
            rebootRequired = $false
        }
        Write-State -Payload $payload
        $payload | ConvertTo-Json -Depth 6 | Set-Content `
            -LiteralPath (Join-Path $evidenceRoot 'guest-preparation-complete.json') `
            -Encoding utf8
        @"
Liiiraa Boost Lab preparado.

Windows Update: nenhuma atualizacao de software pendente.
Computador: $targetComputerName
Concluido em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz')
"@ | Set-Content -LiteralPath $completeMarker -Encoding utf8
        Write-Host 'Preparacao concluida. Nenhuma atualizacao pendente.'
        exit 0
    }

    Write-Host "Baixando $($updates.Count) atualizacao(oes)..."
    $downloader = $session.CreateUpdateDownloader()
    $downloader.Updates = $updates
    $downloadResult = $downloader.Download()

    Write-Host 'Instalando atualizacoes admitidas...'
    $installer = $session.CreateUpdateInstaller()
    $installer.Updates = $updates
    $installationResult = $installer.Install()

    $payload = @{
        status = 'updates-installed'
        attempt = $attempt
        admittedUpdates = $updates.Count
        updateTitles = @($titles)
        downloadResultCode = [int]$downloadResult.ResultCode
        installationResultCode = [int]$installationResult.ResultCode
        rebootRequired = [bool]$installationResult.RebootRequired
    }
    Write-State -Payload $payload
    $payload | ConvertTo-Json -Depth 6 | Set-Content `
        -LiteralPath (Join-Path $evidenceRoot "guest-preparation-attempt-$attempt.json") `
        -Encoding utf8

    if ($attempt -ge $maxAttempts) {
        Remove-PreparationTask
        throw "A preparacao atingiu o limite seguro de $maxAttempts tentativas. Revise o Windows Update manualmente."
    }

    Write-Host 'A VM sera reiniciada em 15 segundos para concluir e verificar novamente.'
    Start-Sleep -Seconds 15
    Restart-Computer -Force
}
catch {
    Remove-PreparationTask
    $failure = @{
        status = 'failed'
        attempt = $attempt
        error = $_.Exception.Message
        recordedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    $failure | ConvertTo-Json -Depth 6 | Set-Content `
        -LiteralPath (Join-Path $evidenceRoot 'guest-preparation-failed.json') `
        -Encoding utf8
    throw
}
finally {
    if ($ownsPreparationMutex) {
        $preparationMutex.ReleaseMutex()
    }
    $preparationMutex.Dispose()
}
