[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$MsiPath,
  [Parameter(Mandatory = $true)][string]$DowngradeMsiPath,
  [Parameter(Mandatory = $true)][string]$ProductCode,
  [Parameter(Mandatory = $true)][string]$OutputRoot,
  [Parameter(Mandatory = $true)][string]$ExpectedWebView2Version,
  [Parameter(Mandatory = $true)][string]$ExpectedWebView2Sha256,
  [Parameter(Mandatory = $true)][string]$ExpectedInstallationManifestSha256,
  [Parameter(Mandatory = $true)][string]$ExpectedInstallationSignatureSha256,
  [Parameter(Mandatory = $true)][string]$ResultPath
)

$ErrorActionPreference = 'Stop'
$serviceName = 'LiiiraaBoostOptimizer'
$installedRoot = Join-Path $env:ProgramFiles 'Liiiraa Boost'
$installedRoleNames = @(
  'liiiraa-desktop.exe',
  'liiiraa-optimizer-service.exe',
  'phase6-physical-runner.exe'
)
$portableDriverNames = @('tauri-driver.exe', 'msedgedriver.exe')
$installed = $false
$brokerProbeSequence = 0

function Write-Result([hashtable]$Value) {
  $json = $Value | ConvertTo-Json -Depth 8
  [IO.File]::WriteAllText($ResultPath, $json, [Text.UTF8Encoding]::new($false))
}

function Assert-ContainedPath([string]$Candidate, [string]$Root, [string]$Label) {
  $candidateFull = [IO.Path]::GetFullPath($Candidate)
  $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd('\')
  if (-not $candidateFull.StartsWith($rootFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label is outside the exact lifecycle output root"
  }
}

function Get-VerifiedWebView2Runtime {
  $clientId = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
  if ($ExpectedWebView2Version -notmatch '^[1-9][0-9]*\.[0-9]+\.[0-9]+\.[0-9]+$') {
    throw 'expected WebView2 Runtime version is invalid'
  }
  if ($ExpectedWebView2Sha256 -notmatch '^sha256:[0-9a-f]{64}$') {
    throw 'expected WebView2 Runtime SHA-256 is invalid'
  }
  $registrations = @(
    [pscustomobject]@{ Path = "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$clientId"; Roots = @([Environment]::GetFolderPath('ProgramFilesX86'), $env:ProgramFiles) },
    [pscustomobject]@{ Path = "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$clientId"; Roots = @($env:ProgramFiles, [Environment]::GetFolderPath('ProgramFilesX86')) },
    [pscustomobject]@{ Path = "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$clientId"; Roots = @($env:LOCALAPPDATA) }
  )
  foreach ($registration in $registrations) {
    if (-not (Test-Path -LiteralPath $registration.Path)) { continue }
    $version = [string](Get-ItemPropertyValue -LiteralPath $registration.Path -Name 'pv' -ErrorAction Stop)
    if ($version -ne $ExpectedWebView2Version) { continue }
    foreach ($root in ($registration.Roots | Where-Object { $_ })) {
      $runtimePath = Join-Path $root "Microsoft\EdgeWebView\Application\$version\msedgewebview2.exe"
      if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) { continue }
      $item = Get-Item -LiteralPath $runtimePath
      $signature = Get-AuthenticodeSignature -LiteralPath $runtimePath
      $publisher = if ($signature.SignerCertificate) {
        $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName, $false)
      } else { $null }
      $hash = 'sha256:' + (Get-FileHash -Algorithm SHA256 -LiteralPath $runtimePath).Hash.ToLowerInvariant()
      if ($item.VersionInfo.FileVersion -ne $version) { throw 'WebView2 Runtime file version does not match the registry' }
      if ($item.VersionInfo.ProductName -ne 'Microsoft Edge WebView2') { throw 'WebView2 Runtime product identity is invalid' }
      if ($signature.Status.ToString() -ne 'Valid') { throw 'WebView2 Runtime signature is invalid' }
      if ($publisher -ne 'Microsoft Corporation') { throw 'WebView2 Runtime is not signed by Microsoft Corporation' }
      if ($hash -ne $ExpectedWebView2Sha256) { throw 'WebView2 Runtime executable changed after builder preflight' }
      return [ordered]@{ Version = $version; Sha256 = $hash; Path = $runtimePath }
    }
  }
  throw 'verified Microsoft Edge WebView2 Runtime is unavailable'
}

function Invoke-Msi([string[]]$Arguments, [string]$LogName) {
  $logPath = Join-Path $OutputRoot "$LogName.msiexec.log"
  $allArguments = @($Arguments + @('/qn', '/norestart', '/l*v', ('"' + $logPath + '"')))
  $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $allArguments -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "msiexec $LogName exited $($process.ExitCode)"
  }
  return $process.ExitCode
}

function Invoke-MsiExpectedFailure([string[]]$Arguments, [string]$LogName) {
  $logPath = Join-Path $OutputRoot "$LogName.msiexec.log"
  $allArguments = @($Arguments + @('/qn', '/norestart', '/l*v', ('"' + $logPath + '"')))
  $process = Start-Process -FilePath 'msiexec.exe' -ArgumentList $allArguments -Wait -PassThru
  if ($process.ExitCode -eq 0) {
    throw "msiexec $LogName unexpectedly succeeded"
  }
  if ($process.ExitCode -eq 3010) {
    throw "msiexec $LogName requested a forbidden reboot"
  }
  return $process.ExitCode
}

function Assert-ServiceRunning {
  $service = Get-Service -Name $serviceName -ErrorAction Stop
  if ($service.Status -ne [ServiceProcess.ServiceControllerStatus]::Running) {
    throw 'optimizer service did not reach RUNNING state'
  }
}

function Assert-BrokerClientBinding {
  $desktopPath = Join-Path $installedRoot 'liiiraa-desktop.exe'
  if (-not (Test-Path -LiteralPath $desktopPath -PathType Leaf)) {
    throw 'installed desktop broker client is missing'
  }
  foreach ($attempt in 1..2) {
    $script:brokerProbeSequence += 1
    $stdoutPath = Join-Path $OutputRoot "broker-probe-$brokerProbeSequence.stdout.log"
    $stderrPath = Join-Path $OutputRoot "broker-probe-$brokerProbeSequence.stderr.log"
    $process = Start-Process -FilePath $desktopPath -ArgumentList @('--phase6-lifecycle-broker-probe') -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -Wait -PassThru
    if ($process.ExitCode -ne 0) {
      $stderr = if (Test-Path -LiteralPath $stderrPath -PathType Leaf) {
        ([IO.File]::ReadAllText($stderrPath) -replace '[\r\n]+', ' ').Trim()
      } else { '' }
      if ($stderr.Length -gt 512) {
        $stderr = $stderr.Substring(0, 512)
      }
      $detail = if ($stderr) { "; stderr: $stderr" } else { '' }
      throw "installed desktop broker probe $attempt exited $($process.ExitCode)$detail"
    }
    Assert-ServiceRunning
  }
}

function Get-ExpectedInstallationManifestCustody {
  $manifestPath = Join-Path $OutputRoot 'installation-manifest.json'
  $signaturePath = "$manifestPath.p7s"
  Assert-ContainedPath $manifestPath $OutputRoot 'installation manifest'
  Assert-ContainedPath $signaturePath $OutputRoot 'installation manifest signature'
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or -not (Test-Path -LiteralPath $signaturePath -PathType Leaf)) {
    throw 'verified artifact installation manifest custody pair is missing'
  }
  $manifestBytes = [IO.File]::ReadAllBytes($manifestPath)
  $signatureBytes = [IO.File]::ReadAllBytes($signaturePath)
  $manifestSha256 = 'sha256:' + [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($manifestBytes)).Replace('-', '').ToLowerInvariant()
  $signatureSha256 = 'sha256:' + [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($signatureBytes)).Replace('-', '').ToLowerInvariant()
  if ($manifestSha256 -ne $ExpectedInstallationManifestSha256 -or $signatureSha256 -ne $ExpectedInstallationSignatureSha256) {
    throw 'artifact installation manifest custody changed after canonical CMS verification'
  }
  $manifest = [Text.Encoding]::UTF8.GetString($manifestBytes) | ConvertFrom-Json
  if ($manifest.kind -ne 'installation-manifest' -or $manifest.schemaVersion -ne '1.0' -or @($manifest.files.PSObject.Properties).Count -ne 3) {
    throw 'artifact installation manifest shape is invalid'
  }
  return [pscustomobject]@{
    Document = $manifest
    ManifestSha256 = $manifestSha256
    SignatureSha256 = $signatureSha256
  }
}

function Assert-InstalledManifestAdministratorReadDenied {
  $manifestPath = Join-Path $installedRoot 'installation-manifest.json'
  $signaturePath = "$manifestPath.p7s"
  if (-not (Test-Path -LiteralPath $manifestPath) -or -not (Test-Path -LiteralPath $signaturePath)) {
    throw 'installed manifest custody pair is missing'
  }
  $denied = $false
  try {
    [IO.File]::ReadAllBytes($manifestPath) | Out-Null
  } catch {
    $exception = $_.Exception
    if ($exception -is [UnauthorizedAccessException] -or $exception.InnerException -is [UnauthorizedAccessException]) {
      $denied = $true
    } else {
      throw
    }
  }
  if (-not $denied) { throw 'administrator unexpectedly read protected installed manifest' }
}

function Get-InstalledSetHash([object]$ExpectedCustody) {
  Assert-InstalledManifestAdministratorReadDenied
  $entries = foreach ($property in ($ExpectedCustody.Document.files.PSObject.Properties | Sort-Object Name)) {
    $entry = $property.Value
    $path = Join-Path $installedRoot $entry.relativePath
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
      throw "installed role is missing: $($entry.relativePath)"
    }
    $item = Get-Item -LiteralPath $path
    $hash = 'sha256:' + (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant()
    if ($item.Length -ne $entry.sizeBytes -or $hash -ne $entry.sha256) {
      throw "installed live identity mismatch: $($entry.relativePath)"
    }
    if ($item.VersionInfo.FileVersion -ne $entry.version) {
      throw "installed file version mismatch: $($entry.relativePath)"
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $path
    if (-not $signature.SignerCertificate -or $signature.Status -notin @('Valid', 'UnknownError')) {
      throw "installed Authenticode verification failed: $($entry.relativePath)"
    }
    $certificateSha256 = 'sha256:' + [BitConverter]::ToString($signature.SignerCertificate.GetCertHash([Security.Cryptography.HashAlgorithmName]::SHA256)).Replace('-', '').ToLowerInvariant()
    if ($certificateSha256 -ne $entry.authenticodeThumbprint) {
      throw "installed Authenticode signer mismatch: $($entry.relativePath)"
    }
    [ordered]@{ role = $entry.role; relativePath = $entry.relativePath; version = $item.VersionInfo.FileVersion; sizeBytes = $item.Length; sha256 = $hash; authenticodeThumbprint = $certificateSha256 }
  }
  foreach ($driver in $portableDriverNames) {
    if (Test-Path -LiteralPath (Join-Path $installedRoot $driver)) {
      throw "portable driver was installed: $driver"
    }
  }
  $document = [ordered]@{
    manifestSha256 = $ExpectedCustody.ManifestSha256
    signatureSha256 = $ExpectedCustody.SignatureSha256
    roles = @($entries)
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes(($document | ConvertTo-Json -Depth 6 -Compress))
  return 'sha256:' + [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
}

function Get-RecoveryCustodyHash {
  $programDataRoot = Join-Path $env:ProgramData 'Liiiraa Boost'
  $entries = foreach ($name in @('recovery', 'journal', 'evidence')) {
    $path = Join-Path $programDataRoot $name
    if (-not (Test-Path -LiteralPath $path)) {
      [ordered]@{ path = $name; state = 'absent' }
      continue
    }
    foreach ($file in (Get-ChildItem -LiteralPath $path -Recurse -File | Sort-Object FullName)) {
      [ordered]@{
        path = $file.FullName.Substring($programDataRoot.Length).TrimStart('\').Replace('\', '/')
        sizeBytes = $file.Length
        sha256 = 'sha256:' + (Get-FileHash -Algorithm SHA256 -LiteralPath $file.FullName).Hash.ToLowerInvariant()
      }
    }
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes((@($entries) | ConvertTo-Json -Depth 5 -Compress))
  return 'sha256:' + [BitConverter]::ToString([Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
}

try {
  $isElevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )
  if (-not $isElevated) { throw 'lifecycle helper requires administrator elevation' }

  $OutputRoot = [IO.Path]::GetFullPath($OutputRoot)
  $MsiPath = [IO.Path]::GetFullPath($MsiPath)
  $DowngradeMsiPath = [IO.Path]::GetFullPath($DowngradeMsiPath)
  $ResultPath = [IO.Path]::GetFullPath($ResultPath)
  Assert-ContainedPath $MsiPath $OutputRoot 'MSI'
  Assert-ContainedPath $DowngradeMsiPath $OutputRoot 'downgrade probe'
  Assert-ContainedPath $ResultPath $OutputRoot 'result'
  if (-not (Test-Path -LiteralPath $MsiPath -PathType Leaf)) { throw 'MSI is missing' }
  if (-not (Test-Path -LiteralPath $DowngradeMsiPath -PathType Leaf)) { throw 'downgrade probe is missing' }
  $webView2Runtime = Get-VerifiedWebView2Runtime
  $expectedCustody = Get-ExpectedInstallationManifestCustody

  Invoke-Msi @('/i', ('"' + $MsiPath + '"')) 'install' | Out-Null
  $installed = $true
  Assert-ServiceRunning
  Assert-BrokerClientBinding
  $installedSet = Get-InstalledSetHash $expectedCustody
  $recoveryCustody = Get-RecoveryCustodyHash

  Invoke-Msi @('/fa', ('"' + $MsiPath + '"')) 'repair-update' | Out-Null
  Assert-ServiceRunning
  Assert-BrokerClientBinding
  if ((Get-InstalledSetHash $expectedCustody) -ne $installedSet) { throw 'repair changed the coherent installed set' }
  if ((Get-RecoveryCustodyHash) -ne $recoveryCustody) { throw 'repair changed recovery custody' }

  $desktopPath = Join-Path $installedRoot 'liiiraa-desktop.exe'
  $lock = [IO.File]::Open($desktopPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
  try {
    $rollbackExit = Invoke-MsiExpectedFailure @('/fa', ('"' + $MsiPath + '"'), 'MSIRESTARTMANAGERCONTROL=Disable', 'REINSTALLMODE=amus', 'REINSTALL=ALL') 'rollback-failure'
  } finally {
    $lock.Dispose()
  }
  Assert-ServiceRunning
  if ((Get-InstalledSetHash $expectedCustody) -ne $installedSet) { throw 'failed repair did not restore the coherent installed set' }
  if ((Get-RecoveryCustodyHash) -ne $recoveryCustody) { throw 'failed repair changed recovery custody' }

  $downgradeExit = Invoke-MsiExpectedFailure @('/i', ('"' + $DowngradeMsiPath + '"')) 'downgrade-rejection'
  Assert-ServiceRunning
  if ((Get-InstalledSetHash $expectedCustody) -ne $installedSet) { throw 'downgrade attempt changed the installed set' }
  if ((Get-RecoveryCustodyHash) -ne $recoveryCustody) { throw 'downgrade attempt changed recovery custody' }

  Invoke-Msi @('/x', $ProductCode) 'uninstall' | Out-Null
  $installed = $false
  foreach ($name in ($installedRoleNames + @('installation-manifest.json', 'installation-manifest.json.p7s') + $portableDriverNames)) {
    if (Test-Path -LiteralPath (Join-Path $installedRoot $name)) { throw "uninstall retained residue: $name" }
  }
  if (Get-Service -Name $serviceName -ErrorAction SilentlyContinue) { throw 'uninstall retained optimizer service' }
  if ((Get-RecoveryCustodyHash) -ne $recoveryCustody) { throw 'uninstall changed recovery custody' }

  Write-Result ([ordered]@{
    kind = 'phase6-physical-elevated-lifecycle'
    schemaVersion = '1.0'
    status = 'PASSED'
    install = 'passed'
    brokerClientBinding = 'passed'
    brokerClientConnections = 4
    installedManifestAdministratorReadDenied = $true
    artifactManifestCanonicalCmsVerified = $true
    installedBinaryIdentitiesVerified = 3
    serviceAcceptedProtectedManifest = $true
    repairUpdate = 'passed'
    rollbackFailureDrill = 'passed'
    rollbackFailureExitCode = $rollbackExit
    downgradeRejected = $true
    downgradeExitCode = $downgradeExit
    uninstall = 'passed'
    recoveryCustodyPreserved = $true
    forcedReboot = $false
    residualsAbsent = $true
    webView2RuntimeVersion = $webView2Runtime.Version
    webView2RuntimeSha256 = $webView2Runtime.Sha256
    installedSetSha256 = $installedSet
    recoveryCustodySha256 = $recoveryCustody
    completedAt = [DateTime]::UtcNow.ToString('o')
  })
  exit 0
} catch {
  if ($installed) {
    try { Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/x', $ProductCode, '/qn', '/norestart') -Wait | Out-Null } catch {}
  }
  Write-Result ([ordered]@{
    kind = 'phase6-physical-elevated-lifecycle'
    schemaVersion = '1.0'
    status = 'BLOCKED'
    reason = $_.Exception.Message
    completedAt = [DateTime]::UtcNow.ToString('o')
  })
  exit 1
}
