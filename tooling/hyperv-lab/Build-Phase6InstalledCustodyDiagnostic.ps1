[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$diagnosticPath = Join-Path $repositoryRoot 'target\x86_64-pc-windows-msvc\release\phase6-installed-custody-diagnostic.exe'
$visualStudioRoot = 'C:\Program Files (x86)\Microsoft Visual Studio\2022'
$previousRustFlags = $env:RUSTFLAGS
$stage = 'build'

function Get-Sha256Hex {
    param([Parameter(Mandatory)][string]$Path)
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally {
        $sha256.Dispose()
        $stream.Dispose()
    }
}

try {
    $env:RUSTFLAGS = '-C target-feature=+crt-static'
    Push-Location $repositoryRoot
    try {
        cargo.exe build --release -p liiiraa-optimizer-service --bin phase6-installed-custody-diagnostic --target x86_64-pc-windows-msvc
        if ($LASTEXITCODE -ne 0) { throw 'BLOCKED:diagnostic-build-failed' }
    }
    finally { Pop-Location }

    $stage = 'artifact'
    $item = Get-Item -LiteralPath $diagnosticPath -ErrorAction Stop
    if ($item.Length -le 0 -or $item.Length -gt 16MB) { throw 'BLOCKED:diagnostic-build-bounds' }

    $stage = 'dumpbin'
    $forbiddenRuntimePattern = 'vcruntime|msvcp|ucrtbase|api-ms-win-crt-'
    $dumpbin = Get-ChildItem -LiteralPath $visualStudioRoot -Directory -ErrorAction Stop |
        Sort-Object Name |
        ForEach-Object {
            $toolsRoot = Join-Path $_.FullName 'VC\Tools\MSVC'
            if (Test-Path -LiteralPath $toolsRoot -PathType Container) {
                Get-ChildItem -LiteralPath $toolsRoot -Directory |
                    Sort-Object Name -Descending |
                    ForEach-Object { Join-Path $_.FullName 'bin\Hostx64\x64\dumpbin.exe' }
            }
        } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
    if ([string]::IsNullOrWhiteSpace([string]$dumpbin)) { throw 'BLOCKED:diagnostic-dumpbin-unavailable' }

    $stage = 'dependency-inspection'
    $dependencyLines = @(& $dumpbin /dependents $diagnosticPath 2>&1 | ForEach-Object { [string]$_ })
    if ($LASTEXITCODE -ne 0) { throw 'BLOCKED:diagnostic-dependency-inspection-failed' }
    $dependencyText = $dependencyLines -join [Environment]::NewLine
    if ($dependencyText.Length -le 0 -or $dependencyText.Length -gt 256KB) {
        throw 'BLOCKED:diagnostic-dependency-output-bounds'
    }
    $stage = 'dependency-validation'
    $dependencies = @($dependencyLines |
        ForEach-Object { $_.Trim().ToLowerInvariant() } |
        Where-Object { $_ -match '^[a-z0-9._-]+\.dll$' } |
        Sort-Object -Unique)
    if ($dependencies -cnotcontains 'kernel32.dll') { throw 'BLOCKED:diagnostic-dependency-set-invalid' }
    if (@($dependencies | Where-Object { $_ -match ('^(' + $forbiddenRuntimePattern + ')') }).Count -ne 0) {
        throw 'BLOCKED:diagnostic-dynamic-crt'
    }

    $stage = 'result'
    [ordered]@{
        status = 'PASSED'
        sha256 = 'sha256:' + (Get-Sha256Hex -Path $diagnosticPath)
        sizeBytes = [int64]$item.Length
        runtimeDependencies = $dependencies
    } | ConvertTo-Json -Depth 3
}
catch {
    $safe = [string]$_.Exception.Message
    if ($safe -cnotmatch '^BLOCKED:[a-z0-9-]+$') { $safe = 'BLOCKED:diagnostic-' + $stage + '-failed' }
    Write-Error $safe
    exit 2
}
finally {
    $env:RUSTFLAGS = $previousRustFlags
}
