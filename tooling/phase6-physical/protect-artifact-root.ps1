param(
    [Parameter(Mandatory)][string]$ArtifactRoot,
    [Parameter(Mandatory)][string]$ExpectedUserSid
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'artifact ACL helper requires elevation'
}
if ($ExpectedUserSid -notmatch '^S-1-5-21-(?:[0-9]+-){3}[0-9]+$') {
    throw 'artifact ACL helper received an invalid user SID'
}

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$allowedParent = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'target\phase6-physical\_work'))
$resolvedRoot = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $ArtifactRoot -ErrorAction Stop).Path)
if (-not $resolvedRoot.StartsWith($allowedParent + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'artifact ACL helper path is outside target/phase6-physical/_work'
}

$manifestPath = Join-Path $resolvedRoot 'artifact-manifest.json'
$manifest = [IO.File]::ReadAllText($manifestPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
$leaf = Split-Path -Leaf $resolvedRoot
$expectedPrefix = [string]$manifest.buildId + '-'
if (-not $leaf.StartsWith($expectedPrefix, [StringComparison]::Ordinal) -or
    $leaf -notmatch '^physical-[0-9a-f]{16}-managed-power-scheme-v[1-9][0-9]*-[1-9][0-9]*-[0-9a-fA-F-]{36}$') {
    throw 'artifact ACL helper staging identity does not match the manifest build'
}

foreach ($fileIdentity in $manifest.files.psobject.Properties.Value) {
    $candidate = [IO.Path]::GetFullPath((Join-Path $resolvedRoot ([string]$fileIdentity.relativePath)))
    if (-not $candidate.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        throw 'artifact ACL helper found a missing or escaping manifest role'
    }
}

function New-ArtifactDirectorySecurity {
    $security = [Security.AccessControl.DirectorySecurity]::new()
    $security.SetSecurityDescriptorSddlForm("O:S-1-5-32-544D:P(A;OICI;FA;;;S-1-5-18)(A;OICI;FA;;;S-1-5-32-544)(A;OICI;0x1200a9;;;$ExpectedUserSid)")
    return $security
}

function New-ArtifactFileSecurity {
    $security = [Security.AccessControl.FileSecurity]::new()
    $security.SetSecurityDescriptorSddlForm("O:S-1-5-32-544D:P(A;;FA;;;S-1-5-18)(A;;FA;;;S-1-5-32-544)(A;;0x1200a9;;;$ExpectedUserSid)")
    return $security
}

foreach ($item in @(Get-ChildItem -LiteralPath $resolvedRoot -Force -Recurse | Sort-Object { $_.FullName.Length } -Descending)) {
    if ($item.PSIsContainer) {
        Set-Acl -LiteralPath $item.FullName -AclObject (New-ArtifactDirectorySecurity)
    } else {
        Set-Acl -LiteralPath $item.FullName -AclObject (New-ArtifactFileSecurity)
    }
}
Set-Acl -LiteralPath $resolvedRoot -AclObject (New-ArtifactDirectorySecurity)

$actual = Get-Acl -LiteralPath $resolvedRoot
$ownerSid = ([Security.Principal.NTAccount]::new($actual.Owner)).Translate([Security.Principal.SecurityIdentifier]).Value
$rules = @($actual.Access)
if ($ownerSid -ne 'S-1-5-32-544' -or -not $actual.AreAccessRulesProtected -or $rules.Count -ne 3) {
    throw 'artifact ACL helper native verification failed'
}
