[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$expectedVmName = 'LiiiraaBoost-W11-25H2-Clean'
$expectedCheckpointName = 'Clean-Windows-Ready'
$expectedCheckpointId = 'a918f5c0-ade0-4bac-bca3-baa91686777e'
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$diagnosticSource = Join-Path $repositoryRoot 'target\x86_64-pc-windows-msvc\release\phase6-installed-custody-diagnostic.exe'
$diagnosticDestination = 'C:\Windows\Temp\liiiraa-phase6-installed-custody-diagnostic.exe'
$evidenceDirectory = Join-Path $env:USERPROFILE 'VM-Lab\Evidence\phase6'
$evidencePath = Join-Path $evidenceDirectory ((Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-v56-installed-custody-diagnostic.json')
$record = [ordered]@{
    schemaVersion = 1
    kind = 'phase6-installed-custody-read-only-diagnostic'
    operationVersion = 'v56'
    vmName = $expectedVmName
    checkpointId = $expectedCheckpointId
    diagnosticExecutableSha256 = $null
    diagnosticExecutableSizeBytes = $null
    diagnostic = $null
    beforeState = $null
    afterState = $null
    cleanup = 'BLOCKED'
    result = 'BLOCKED'
}

function Write-EvidenceCreateOnce {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)]$Value)
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($Path)) -Force | Out-Null
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($Value | ConvertTo-Json -Depth 6) + [Environment]::NewLine)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush($true)
    }
    finally { $stream.Dispose() }
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'BLOCKED:not-elevated'
    }
    $sourceItem = Get-Item -LiteralPath $diagnosticSource -ErrorAction Stop
    if ($sourceItem.Length -le 0 -or $sourceItem.Length -gt 16MB) { throw 'BLOCKED:diagnostic-source-bounds' }
    $sourceHash = (Get-FileHash -LiteralPath $diagnosticSource -Algorithm SHA256).Hash.ToLowerInvariant()
    $record.diagnosticExecutableSha256 = 'sha256:' + $sourceHash
    $record.diagnosticExecutableSizeBytes = [int64]$sourceItem.Length

    $vm = Get-VM -Name $expectedVmName -ErrorAction Stop
    $checkpoint = @(Get-VMSnapshot -VMName $expectedVmName -Name $expectedCheckpointName -ErrorAction Stop)
    if ($checkpoint.Count -ne 1 -or $checkpoint[0].Id.ToString() -cne $expectedCheckpointId) {
        throw 'BLOCKED:checkpoint-mismatch'
    }
    $record.beforeState = $vm.State.ToString()
    if ($record.beforeState -cne 'Off') { throw 'BLOCKED:vm-not-off' }

    $credential = Get-Credential -UserName 'LiiiraaLab' -Message 'Senha local da VM para diagnóstico read-only; mantida somente neste processo elevado'
    if ($null -eq $credential -or $credential.UserName -cne 'LiiiraaLab') { throw 'BLOCKED:guest-credential-invalid' }

    Start-VM -Name $expectedVmName -ErrorAction Stop | Out-Null
    $deadline = [DateTime]::UtcNow.AddSeconds(180)
    do {
        try {
            $ready = Invoke-Command -VMName $expectedVmName -Credential $credential -ScriptBlock { 'ready' } -ErrorAction Stop
        }
        catch { $ready = $null }
        if ($ready -ceq 'ready') { break }
        Start-Sleep -Seconds 2
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($ready -cne 'ready') { throw 'BLOCKED:guest-not-ready' }

    Copy-VMFile -VMName $expectedVmName -SourcePath $diagnosticSource -DestinationPath $diagnosticDestination -FileSource Host -CreateFullPath -ErrorAction Stop
    $response = Invoke-Command -VMName $expectedVmName -Credential $credential -ScriptBlock {
        param($Path, $ExpectedHash, $ExpectedSize)
        try {
            $item = Get-Item -LiteralPath $Path -ErrorAction Stop
            $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($item.Length -ne $ExpectedSize -or $hash -cne $ExpectedHash) { throw 'diagnostic-byte-mismatch' }
            $start = [Diagnostics.ProcessStartInfo]::new()
            $start.FileName = $Path
            $start.UseShellExecute = $false
            $start.CreateNoWindow = $true
            $start.RedirectStandardOutput = $true
            $start.RedirectStandardError = $true
            $process = [Diagnostics.Process]::Start($start)
            $stdout = $process.StandardOutput.ReadToEnd()
            $stderr = $process.StandardError.ReadToEnd()
            $process.WaitForExit()
            $text = if ($process.ExitCode -eq 0) { $stdout.Trim() } else { $stderr.Trim() }
            if ($text.Length -le 0 -or $text.Length -gt 1024 -or $text -match "[\r\n]") { throw 'diagnostic-output-bounds' }
            $value = $text | ConvertFrom-Json -ErrorAction Stop
            [pscustomobject]@{ ExitCode = [int]$process.ExitCode; Value = $value }
        }
        finally {
            Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        }
    } -ArgumentList $diagnosticDestination, $sourceHash, ([int64]$sourceItem.Length)

    $allowedProperties = @('status', 'errorCode', 'detailCode', 'role', 'pathClass', 'ioKind', 'win32Code')
    $actualProperties = @($response.Value.PSObject.Properties | ForEach-Object { $_.Name })
    $allowedErrorCodes = @('acl-invalid', 'authenticode-invalid', 'live-byte-mismatch', 'required-byte-missing', 'canonical-path-invalid', 'generated-schema-invalid', 'signature-invalid', 'version-invalid')
    $allowedDetails = @('unavailable', 'canonicalize', 'program-files-reparse', 'relative-path', 'root-reparse', 'reparse-component', 'root-escape', 'duplicate-installed-path', 'installed-role', 'last-admitted-reparse', 'last-admitted-parent', 'last-admitted-name', 'last-admitted-path', 'other')
    $allowedRoles = @('installed-root', 'installed-manifest', 'installed-signature', 'installed-desktop', 'installed-service', 'installed-runner', 'last-admitted-file', 'last-admitted-parent')
    $allowedClasses = @('disk', 'verbatim-disk', 'unc', 'verbatim-unc', 'device', 'device-other', 'rooted-other', 'relative', 'absolute-other')
    $allowedKinds = @('not-found', 'permission-denied', 'invalid-input', 'invalid-data', 'already-exists', 'unsupported', 'other')
    $value = $response.Value
    $invalid = $actualProperties.Count -ne $allowedProperties.Count -or
        @($actualProperties | Where-Object { $allowedProperties -cnotcontains $_ }).Count -ne 0 -or
        $response.ExitCode -ne 2 -or [string]$value.status -cne 'BLOCKED' -or
        $allowedErrorCodes -notcontains [string]$value.errorCode -or
        $allowedDetails -notcontains [string]$value.detailCode -or
        ($null -ne $value.role -and $allowedRoles -notcontains [string]$value.role) -or
        ($null -ne $value.pathClass -and $allowedClasses -notcontains [string]$value.pathClass) -or
        ($null -ne $value.ioKind -and $allowedKinds -notcontains [string]$value.ioKind) -or
        ($null -ne $value.win32Code -and ([int]$value.win32Code -lt 0 -or [int]$value.win32Code -gt 65535))
    if ($invalid) { throw 'BLOCKED:diagnostic-output-invalid' }
    $record.diagnostic = [ordered]@{
        status = [string]$value.status
        errorCode = [string]$value.errorCode
        detailCode = [string]$value.detailCode
        role = if ($null -eq $value.role) { $null } else { [string]$value.role }
        pathClass = if ($null -eq $value.pathClass) { $null } else { [string]$value.pathClass }
        ioKind = if ($null -eq $value.ioKind) { $null } else { [string]$value.ioKind }
        win32Code = if ($null -eq $value.win32Code) { $null } else { [int]$value.win32Code }
    }
    $record.result = 'PASSED'
}
catch {
    $safe = [string]$_.Exception.Message
    if ($safe -cnotmatch '^BLOCKED:[a-z0-9-]+$') { $safe = 'BLOCKED:diagnostic-collection-failed' }
    $record.diagnostic = [ordered]@{ status = 'BLOCKED'; errorCode = $safe.Substring(8); detailCode = 'unavailable'; role = $null; pathClass = $null; ioKind = $null; win32Code = $null }
}
finally {
    try {
        $vm = Get-VM -Name $expectedVmName -ErrorAction Stop
        if ($vm.State.ToString() -ne 'Off') { Stop-VM -Name $expectedVmName -Force -ErrorAction Stop }
        $deadline = [DateTime]::UtcNow.AddSeconds(120)
        do {
            $vm = Get-VM -Name $expectedVmName -ErrorAction Stop
            if ($vm.State.ToString() -eq 'Off') { break }
            Start-Sleep -Seconds 2
        } while ([DateTime]::UtcNow -lt $deadline)
        $record.afterState = $vm.State.ToString()
        if ($record.afterState -ceq 'Off') { $record.cleanup = 'PASSED' }
    }
    catch { $record.afterState = 'unknown' }
    Write-EvidenceCreateOnce -Path $evidencePath -Value $record
    Write-Output ($record | ConvertTo-Json -Depth 6)
    Write-Output ('EVIDENCE=' + $evidencePath)
}

if ($record.result -cne 'PASSED' -or $record.cleanup -cne 'PASSED') { exit 2 }
