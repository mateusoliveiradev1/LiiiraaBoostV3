import assert from 'node:assert/strict';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const bridgePath = resolve(import.meta.dirname, 'Invoke-Phase6Physical.ps1');
const elevatedLoggerPath = resolve(import.meta.dirname, 'Run-LabElevated.ps1');
const prepare4GiBPath = resolve(import.meta.dirname, 'Prepare-Phase6Vm4GiB.ps1');
const artifactSummary = resolve(
  root,
  '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',
);
const simulationSummary = resolve(
  root,
  '.planning/phases/06-transactional-plans-and-recovery/06-38-SUMMARY.md',
);
const evidenceManifest = resolve(root, 'tooling/phase6-evidence/evidence-manifest.json');
const exactVm = 'LiiiraaBoost-W11-25H2-Clean';
const cleanCheckpoint = 'Clean-Windows-Ready';
const previousCleanCheckpointId = 'ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075';
const cleanCheckpointId = 'a918f5c0-ade0-4bac-bca3-baa91686777e';
const backupCheckpoint = 'Clean-Windows-Ready-PreLabAccount-v43';
const backupCheckpointId = 'ebccd5f3-5645-4089-b469-fa4d851fc6ef';
const installedCheckpoint = 'LiiiraaBoost-Installed';

test('fixed 4 GiB preparation preserves checkpoints and emits bounded append-only evidence', () => {
  const source = readFileSync(prepare4GiBPath, 'utf8');
  for (const literal of [
    exactVm,
    cleanCheckpoint,
    previousCleanCheckpointId,
    backupCheckpoint,
    backupCheckpointId,
    'Clean-Windows-Ready-Pre4GiB-v47',
    installedCheckpoint,
    '107680b1-d9cc-411a-843a-ab72019469cd',
    'C:\\Users\\Liiiraa\\VM-Lab\\VMs\\LiiiraaBoost-W11-25H2-Clean\\LiiiraaBoost-W11-25H2-Clean.vhdx',
    'Default Switch',
    'FileMode]::CreateNew',
    '65536',
  ]) {
    assert.match(source, new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'iu'));
  }
  assert.match(
    source,
    /Set-VMMemory\s+-VMName\s+\$ExpectedVmName\s+-DynamicMemoryEnabled\s+\$true\s+-MinimumBytes\s+4GB\s+-StartupBytes\s+4GB\s+-MaximumBytes\s+12GB/u,
  );
  assertInOrder(source, [
    'Restore-VMSnapshot',
    'Rename-VMSnapshot',
    'Set-VMMemory',
    'Checkpoint-VM',
  ]);
  assert.doesNotMatch(source, /Start-VM|Remove-VMSnapshot|Remove-VM|Stop-VM/u);
});

const runBridge = (extra = [], authority = {}) =>
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      authority.bridgePath ?? bridgePath,
      '-Action',
      'Audit',
      '-DryRun',
      '-VmName',
      exactVm,
      '-CheckpointName',
      cleanCheckpoint,
      '-ArtifactManifestFromSummary',
      authority.artifactSummary ?? artifactSummary,
      '-SimulationAdmissionFromSummary',
      authority.simulationSummary ?? simulationSummary,
      ...extra,
    ],
    { cwd: authority.root ?? root, encoding: 'utf8' },
  );

const createMutationSandbox = () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'phase6-bridge-authority-'));
  const sandboxRoot = join(sandbox, 'repo');
  const copyRelative = (relative) => {
    const destination = join(sandboxRoot, relative);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(root, relative), destination);
    return destination;
  };
  const artifactPrefix = join(
    'target',
    'phase6-physical',
    'a34efd18e38ac38463358ec989af4ed818ab4311',
    'physical-7304c595be0d094e-managed-power-scheme-v66',
  );
  const linkArtifactRelative = (relative) => {
    const artifactRelative = join(artifactPrefix, relative);
    const destination = join(sandboxRoot, artifactRelative);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(root, artifactRelative), destination);
  };

  const sandboxBridge = copyRelative('tooling/hyperv-lab/Invoke-Phase6Physical.ps1');
  const sandboxArtifactSummary = copyRelative(
    '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',
  );
  const sandboxSimulationSummary = copyRelative(
    '.planning/phases/06-transactional-plans-and-recovery/06-38-SUMMARY.md',
  );
  const sandboxEvidenceManifest = copyRelative('tooling/phase6-evidence/evidence-manifest.json');
  for (const relative of [
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v41-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v43-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v44-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v45-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v46-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v47-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v49-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v50-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v52-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v53-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v54-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v55-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v56-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v57-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v58-evidence-manifest.json',
    'tooling/phase6-evidence/records/superseded/managed-power-scheme-v65-evidence-manifest.json',
  ]) {
    copyRelative(relative);
  }
  const manifest = JSON.parse(
    readFileSync(join(root, artifactPrefix, 'artifact-manifest.json'), 'utf8'),
  );
  for (const relative of [
    'artifact-manifest.json',
    'artifact-manifest.json.p7s',
    ...Object.values(manifest.files).map((identity) => identity.relativePath),
  ]) {
    linkArtifactRelative(relative);
  }
  return {
    sandbox,
    root: sandboxRoot,
    bridgePath: sandboxBridge,
    artifactSummary: sandboxArtifactSummary,
    simulationSummary: sandboxSimulationSummary,
    evidenceManifest: sandboxEvidenceManifest,
  };
};

const bridgeSource = () => {
  assert.equal(existsSync(bridgePath), true, 'the dedicated Phase 6 bridge must exist');
  return readFileSync(bridgePath, 'utf8');
};

const invokeBridgeFunction = (name, input) => {
  const encoded = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
  const escapedBridgePath = bridgePath.replaceAll("'", "''");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    '$tokens = $null; $errors = $null',
    `$ast = [Management.Automation.Language.Parser]::ParseFile('${escapedBridgePath}', [ref]$tokens, [ref]$errors)`,
    `$function = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq '${name}' }, $true) | Select-Object -First 1`,
    "if ($null -eq $function) { throw 'required bridge function is missing' }",
    name === 'Resolve-MsiLogSummary'
      ? "$dependency = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'ConvertFrom-ExactMsiLogBytes' }, $true) | Select-Object -First 1; if ($null -eq $dependency) { throw 'required MSI decoder is missing' }; Invoke-Expression $dependency.Extent.Text"
      : '',
    'Invoke-Expression $function.Extent.Text',
    `$input = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    name === 'Resolve-MsiLogSummary'
      ? `${name} -ExitCode ([int64]$input.exitCode) -FailureCode ([string]$input.failureCode) -Bytes ([Convert]::FromBase64String([string]$input.bytesBase64)) -MaximumBytes ([int]$input.maximumBytes) | ConvertTo-Json -Compress`
      : `${name} -ExitCode ([int64]$input.exitCode) -Stdout @($input.stdout) -Stderr @($input.stderr) -BoundsExceeded ([bool]$input.boundsExceeded) | ConvertTo-Json -Compress`,
  ].join('; ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
};

const invokeAclSnapshotAssertion = (snapshot, expectedUserSid) => {
  const encoded = Buffer.from(JSON.stringify({ snapshot, expectedUserSid }), 'utf8').toString(
    'base64',
  );
  const escapedBridgePath = bridgePath.replaceAll("'", "''");
  const command = [
    '$tokens = $null; $errors = $null',
    `$ast = [Management.Automation.Language.Parser]::ParseFile('${escapedBridgePath}', [ref]$tokens, [ref]$errors)`,
    "$function = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-ExactGuestArtifactAclSnapshot' }, $true) | Select-Object -First 1",
    "if ($null -eq $function) { throw 'required bridge function is missing' }",
    'Invoke-Expression $function.Extent.Text',
    `$input = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    'try { Assert-ExactGuestArtifactAclSnapshot -Snapshot $input.snapshot -ExpectedUserSid $input.expectedUserSid; [pscustomobject]@{ ok = $true; code = $null } | ConvertTo-Json -Compress } catch { [pscustomobject]@{ ok = $false; code = $_.Exception.Message } | ConvertTo-Json -Compress }',
  ].join('; ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    {
      cwd: root,
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
};

const invokeGuestCustodyLayout = (lifecycle) => {
  const encoded = Buffer.from(JSON.stringify({ lifecycle }), 'utf8').toString('base64');
  const escapedBridgePath = bridgePath.replaceAll("'", "''");
  const command = [
    '$tokens = $null; $errors = $null',
    `$ast = [Management.Automation.Language.Parser]::ParseFile('${escapedBridgePath}', [ref]$tokens, [ref]$errors)`,
    "$function = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-ExactGuestArtifactCustodyLayout' }, $true) | Select-Object -First 1",
    "if ($null -eq $function) { throw 'required bridge function is missing' }",
    'Invoke-Expression $function.Extent.Text',
    `$input = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    'try { $layout = Get-ExactGuestArtifactCustodyLayout -Lifecycle ([string]$input.lifecycle); [pscustomobject]@{ ok = $true; code = $null; files = @($layout.Files); directories = @($layout.Directories) } | ConvertTo-Json -Compress } catch { [pscustomobject]@{ ok = $false; code = $_.Exception.Message; files = @(); directories = @() } | ConvertTo-Json -Compress }',
  ].join('; ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
};

const invokeInstallerSidecarAssertion = (input) => {
  const encoded = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
  const escapedBridgePath = bridgePath.replaceAll("'", "''");
  const command = [
    '$tokens = $null; $errors = $null',
    `$ast = [Management.Automation.Language.Parser]::ParseFile('${escapedBridgePath}', [ref]$tokens, [ref]$errors)`,
    "$function = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Resolve-InstallerSidecarSummary' }, $true) | Select-Object -First 1",
    "if ($null -eq $function) { throw 'required bridge function is missing' }",
    'Invoke-Expression $function.Extent.Text',
    `$input = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    'Resolve-InstallerSidecarSummary -Sidecar $input.sidecar -SidecarStatus ([string]$input.sidecarStatus) -SidecarSha256 $input.sidecarSha256 -SidecarSizeBytes $input.sidecarSizeBytes -FailureCode ([string]$input.failureCode) | ConvertTo-Json -Compress',
  ].join('; ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
};

const invokeInstalledCustodySidecarAssertion = (input) => {
  const encoded = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
  const escapedBridgePath = bridgePath.replaceAll("'", "''");
  const command = [
    '$tokens = $null; $errors = $null',
    `$ast = [Management.Automation.Language.Parser]::ParseFile('${escapedBridgePath}', [ref]$tokens, [ref]$errors)`,
    "$function = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Resolve-InstalledCustodySidecarSummary' }, $true) | Select-Object -First 1",
    "if ($null -eq $function) { throw 'required bridge function is missing' }",
    'Invoke-Expression $function.Extent.Text',
    `$input = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    'Resolve-InstalledCustodySidecarSummary -Sidecar $input.sidecar -SidecarStatus ([string]$input.sidecarStatus) -SidecarSha256 $input.sidecarSha256 -SidecarSizeBytes $input.sidecarSizeBytes -FailureCode ([string]$input.failureCode) | ConvertTo-Json -Compress',
  ].join('; ');
  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', command],
    { cwd: root, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
};

const guestSid = 'S-1-5-21-111111111-222222222-333333333-1001';
const exactDirectoryAcl = () => ({
  kind: 'directory',
  ownerSid: 'S-1-5-32-544',
  protected: true,
  rules: [
    {
      sid: 'S-1-5-18',
      rights: 2032127,
      accessType: 'Allow',
      inherited: false,
      inheritanceFlags: 3,
      propagationFlags: 0,
    },
    {
      sid: 'S-1-5-32-544',
      rights: 2032127,
      accessType: 'Allow',
      inherited: false,
      inheritanceFlags: 3,
      propagationFlags: 0,
    },
    {
      sid: guestSid,
      rights: 1179817,
      accessType: 'Allow',
      inherited: false,
      inheritanceFlags: 3,
      propagationFlags: 0,
    },
  ],
});
const exactFileAcl = () => ({
  ...exactDirectoryAcl(),
  kind: 'file',
  rules: exactDirectoryAcl().rules.map((rule) => ({ ...rule, inheritanceFlags: 0 })),
});

const assertInOrder = (source, markers) => {
  let cursor = -1;
  for (const marker of markers) {
    const next = source.indexOf(marker, cursor + 1);
    assert.notEqual(next, -1, `missing ordered boundary: ${marker}`);
    assert.ok(next > cursor, `boundary is out of order: ${marker}`);
    cursor = next;
  }
};

const assertSourcePolicy = (source) => {
  for (const literal of [
    exactVm,
    cleanCheckpoint,
    cleanCheckpointId,
    backupCheckpoint,
    backupCheckpointId,
    installedCheckpoint,
    'managed-power-scheme-v66',
    'physical-7304c595be0d094e-managed-power-scheme-v66',
    'a34efd18e38ac38463358ec989af4ed818ab4311',
    'f5093c1e464ea8dd563197283a2bdb7cfac4c68f7f30d398f5e3d5dc76137f4f',
    'faefe1cdfae5f546982ac31cdae3a627150d6a755e4de9d9b8a7fb1dd299bc64',
    'd76fb46767e525647df47f2c03efc8cefe42dec5a20832b554e98d72d96f6584',
    'managed-power-scheme-v65',
    'physical-7304c595be0d094e-managed-power-scheme-v65',
    'd1001ae367af98ab67ac022d0170dc1bbed8c351eb998a087ef2f06a016af7f0',
    '0aa34013eb5d3314ba31daa9382f439442d7c85df3337230c648e8190689a649',
    '788f6b5392365829659c008755c909903d50f99179f934d59e4fa12937f4432a',
    'managed-power-scheme-v58',
    'physical-9f5464923978c943-managed-power-scheme-v58',
    '2f407cc28495c09fdc8513c4dfd670749ba7b429d6133713af384f603e8aa888',
    'ee3f5275a39982715f5e38a731ed9a1617de9163f05963e68a0a5a23c1ff0e5f',
    'c74c3dd1bbe10949597fa938f4330856f6e6b3e18515468bf8ee4c84c772d90e',
    'managed-power-scheme-v57',
    'physical-9f5464923978c943-managed-power-scheme-v57',
    '4f291830874f31250147726467a1ce66e500d6657e0f4229124f280f1abd0cb3',
    '62aa6c83e3bd32022d238e75121f93ef2664712c707ed9ba29929b92cc59f762',
    '0f1deb2d1fa9e15044fa11f30cee8143a464dc896068de7117146d2480f5d0a1',
    'managed-power-scheme-v56',
    'physical-c013840c872b6f81-managed-power-scheme-v56',
    '4bffc051607994b34a29f96afd2ac12f173815f84519ab1855090ff89fcb060f',
    '858c24f08a246793aff101183a0e6876fdb4189d3bae4ad48d30cf74d2b65940',
    '29d024104cc942ef34e5d5dd8ae0bb906b9375341818587e9e102320fd359be4',
    'managed-power-scheme-v55',
    'physical-4c88acfffc6c9dc2-managed-power-scheme-v55',
    'e38830867effd2f71562a7732a12ab1645a6b88cc8c3f4ad36a44abd0197fb7a',
    'a5d3de5a10249b0f7c7bf7cf922668eea3073e31fc2862ab31e9c667c0b5d3cb',
    'eed0d494cae1778f4099a3ee90e97e22b81235b5fdc8ddc18876ce17cc75f8d8',
    'managed-power-scheme-v54',
    'physical-0fb27dbbc1f09383-managed-power-scheme-v54',
    '07e2e082d865bc3ccd22f167108f14e9ce9eb1b517ce624a79e64481b0687c40',
    'bc06bea9da9baa679e10c82703d4cf9588220fc8f0e976082fd438e8e5914965',
    '681e2c64cc0ee154149753e07fe4d78398d3eac79237b371b87a0d4d5da21e63',
    'managed-power-scheme-v53',
    'physical-468a05974898514d-managed-power-scheme-v53',
    '6d2e76a71014ea056c4fd0027d46f5fe26c500616885e1153b326d9dbf024271',
    '01666800658d5aac14e99b46a14e0a23497c937710f38168e9559e92d2bee7ba',
    '513ce2511f826316a2851c109bd7d433d5ade7b2c003d07d48b74cfd497a5833',
    'managed-power-scheme-v52',
    'physical-487e3c326b5066a0-managed-power-scheme-v52',
    'e11d36a6285af09417d397681692e9e65bce959ff87047686d435401c52b66b3',
    '1dfaa8be4dac42e9f5c45cba7dea0ffc08606d9828948112cf07ac9df6301644',
    '9c98b29b9d42539963944bd26e34106e95314ca3ccc26ac856a3ae175720b598',
    'managed-power-scheme-v50',
    'physical-487e3c326b5066a0-managed-power-scheme-v50',
    'c02d0310205662e0d9e3a8fc9b5240bd954d82b4e28924f4a9c30c10c8b5516b',
    'ceba27bb8e17dd0bf333300e29bbdab9bfbcf2b3bdf45854f2d7bd6cc95ac36b',
    '41260143ac410eeef9133a7a7b79ec5354e1278d2491c6c2a036eacfe727735c',
    'managed-power-scheme-v49',
    'physical-487e3c326b5066a0-managed-power-scheme-v49',
    'e3c904651333c0ac22b0706ffed4fc932a0ac18db76a87f02e863693ae78be09',
    '5fa130be15b8cc0e3da89b2825e791fd2d5e725f3bc2f296341f4a54d4daf92d',
    '2f197d2be921e8c46ca7913c7c76f8b6b2a5acc31f36968cbf1a6188d07fbd24',
    'managed-power-scheme-v47',
    'physical-50796b7236b2889c-managed-power-scheme-v47',
    '31a039f7a4e3d1a4ca6c431aace3778edb6d018e6a00db6e7f35f77eebf60a7b',
    'b9d29c44b13dd23b113413c5c64315783b2b176d3dfaa72ec76b096e163608f6',
    'b15aaf5068bc0f248bc426252afa6fb3b53d8ddf5ade3482abf2076f5d9675c8',
    'managed-power-scheme-v46',
    'physical-c714ca4c5ad147f4-managed-power-scheme-v46',
    'a2be09354be854fe9d010a6108d7199341593876779517bb6976a02c5255e4da',
    'ab98b0858a82d4436b032b6427560c20d8dfca673b03c53dcf1e74e62b786229',
    'd2091f8cc9d7a827bdc8c857799f391ee4840d3ea15740e6034450fa162546da',
    'managed-power-scheme-v45',
    'physical-68bb4f974e23ee26-managed-power-scheme-v45',
    '9c80d1f216eacf0416731fb859a951e766cc4214150d39de8cbf34e1f2a7bc40',
    '0eb8f328e9a007d3247c3095c5805011268430be1f936d0520e2e60db36c8f1e',
    '4293127293aadc9e7a006c61673953b6cacd37fe4e74809de9d6c7f06e8fbca6',
    'managed-power-scheme-v44',
    'physical-68bb4f974e23ee26-managed-power-scheme-v44',
    '71274d04fbdffc1e2444a7c8771c5f767b8ce1f04c6fa1f6988f23a192b63e6f',
    'a4a906c3e350a5d1c1d98a936ca350b67c76deb3b96b69646ae285d195852a9e',
    'da004988b19b58dc423894138919de9577d340322ebbaeb02ae3f7db2393e026',
    'managed-power-scheme-v43',
    'physical-3eec8d7e3665a7f3-managed-power-scheme-v43',
    'a94f83e0605b9ab7c501ec2c3d79c15a1a5b79a24f828c980bf2d4987fc163fa',
    'dee8f3c8f6dc117a1d14ee60aa3dfd50e943e9cb2e960c9aaa4e8e62422e44bd',
    '89c029cbe96f3a7822b0c842668e1bb27bbb22576ca5f017cef0598ddc55ca48',
    'managed-power-scheme-v41',
    'physical-8d162575a964ec77-managed-power-scheme-v41',
    '8789c54ca0a73e2f496fedb7710dae6eac4b1b4bad10864e0284b7591d607784',
    '626b9793c70f1271d28eff8f3a3e4bba37956c9138b08c345b72e2b22f7f02b7',
    'ead808d8fb26a01183d6522b0698f785daa0d25cbe9d7337bb662c13b53c5f7a',
    'deterministicAdmissions',
    'phase6-physical-runner.exe',
    'configs\\clean-windows-vm.run-config.json',
    'phase6-artifact-verifier',
    'physical-writer.ts',
    'SecureBoot',
    'TpmEnabled',
    'Get-VMIntegrationService',
    '64KB',
  ]) {
    assert.match(source, new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  for (const marker of [
    '$CurrentAuthority = [pscustomobject][ordered]',
    'function Assert-ClosedCurrentAuthority',
    '$Authority.ArtifactManifest',
    '$Authority.ArtifactSignature',
    '$Authority.GuestRoot',
    '$Authority.GuestRunner',
    '$Authority.GuestConfig',
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  const runtime = source.slice(source.indexOf('function Copy-ExactArtifactToGuest'));
  assert.doesNotMatch(
    runtime,
    /physical-[0-9a-f]{16}-managed-power-scheme-v(?:4[1-9]|5[0-5])/u,
  );
  assert.doesNotMatch(runtime, /C:\\LiiiraaBoost\\Phase6\\physical-/u);

  assert.match(source, /ValidateSet\('Audit',\s*'RunCleanVm',\s*'RecoverInstalledVm'\)/u);
  assert.match(
    source,
    /phase6-physical-runner\.exe --run-config configs\\clean-windows-vm\.run-config\.json/u,
  );
  assert.doesNotMatch(
    source,
    /\[string\]\$(?:Command|Script|Executable|Config|Arguments?|RemoteHost|EvidenceLabel)/u,
  );
  assert.doesNotMatch(source, /Restart-Computer|Stop-Computer|Set-VMHost|Set-VMHostCluster/u);
  assert.doesNotMatch(source, /(?:npm|pnpm|node|tsx|ts-node|typescript)\.exe.*Invoke-Command/iu);

  const runBody = source.slice(
    source.indexOf('function Invoke-CleanVmRun'),
    source.indexOf('Assert-ExactInvocation\n'),
  );
  assertInOrder(runBody, [
    'Copy-ExactArtifactToGuest',
    'Invoke-ExactGuestRunner',
    'Assert-InstalledReadyRecord',
    'New-InstalledCheckpointOnce',
    'Write-CheckpointReadyRecordOnce',
    'Invoke-ExactGuestRunner',
    'Assert-RebootPendingRecord',
    'Restart-VM',
    'Invoke-ExactGuestRunner',
    'Copy-BoundedEvidenceAndIngest',
  ]);
  const ingestBody = source.slice(
    source.indexOf('function Copy-BoundedEvidenceAndIngest'),
    source.indexOf('function Write-BlockedRecord'),
  );
  assertInOrder(ingestBody, [
    'Read-ExactGuestBytes',
    '64KB',
    'Assert-ArtifactVerifierPass',
    'physical-writer.ts',
  ]);
};

test('RED: dedicated bridge exposes only exact Audit, clean run, and installed recovery authority', () => {
  assertSourcePolicy(bridgeSource());
});

test('RED: Off pre-start audit requires six enabled services without claiming guest health', () => {
  const source = bridgeSource();
  const auditBody = source.slice(
    source.indexOf('function Assert-ExactHyperVAudit'),
    source.indexOf('function Wait-ExactIntegrationServicesHealthy'),
  );
  assert.match(auditBody, /\$integration\.Count\s+-ne\s+6/u);
  assert.match(auditBody, /Where-Object\s+\{\s*-not\s+\$_\.Enabled\s*\}/u);
  assert.doesNotMatch(auditBody, /PrimaryStatusDescription\s+-eq\s+'OK'/u);
});

test('RED: RunCleanVm waits boundedly for six healthy services before guest copy', () => {
  const source = bridgeSource();
  const healthStart = source.indexOf('function Wait-ExactIntegrationServicesHealthy');
  const healthEnd = source.indexOf('function Copy-ExactArtifactToGuest');
  assert.ok(healthStart >= 0 && healthEnd > healthStart);
  const healthBody = source.slice(healthStart, healthEnd);
  assert.match(healthBody, /AddSeconds\(180\)/u);
  assert.match(healthBody, /Get-VMIntegrationService\s+-VMName\s+\$ExpectedVmName/u);
  assert.match(healthBody, /PrimaryStatusDescription\s+-eq\s+'OK'/u);
  assert.match(healthBody, /\$integration\.Count\s+-eq\s+6/u);
  assert.match(healthBody, /\$healthy\.Count\s+-eq\s+6/u);
  assert.match(healthBody, /within 180 seconds/iu);

  const runBody = source.slice(
    source.indexOf('function Invoke-CleanVmRun'),
    source.indexOf('Assert-ExactInvocation\n'),
  );
  assertInOrder(runBody, [
    'Start-VM',
    'Wait-ExactVmReady',
    'Wait-ExactIntegrationServicesHealthy',
    'Copy-ExactArtifactToGuest',
    'Invoke-ExactGuestRunner',
  ]);
});

test('RED: staged artifact receives fixed protected guest custody before any runner call', () => {
  const source = bridgeSource();
  for (const marker of [
    'function Set-ExactGuestArtifactCustody',
    'function Assert-ExactGuestArtifactCustody',
    'function Assert-ExactGuestArtifactAclSnapshot',
    'O:S-1-5-32-544D:P',
    'S-1-5-18',
    'S-1-5-32-544',
    '0x1200a9',
  ]) {
    assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  const setter = source.slice(
    source.indexOf('function Set-ExactGuestArtifactCustody'),
    source.indexOf('function Assert-ExactGuestArtifactCustody'),
  );
  assert.match(setter, /\[PSCredential\]\$Credential/u);
  assert.match(setter, /\[Parameter\(Mandatory\)\]\$Authority/u);
  assert.match(setter, /-ArgumentList\s+\$Authority/u);
  assert.match(setter, /\$fixedRoot\s*=\s*\[string\]\$ClosedAuthority\.GuestRoot/u);
  assert.doesNotMatch(setter, /physical-[0-9a-f]{16}-managed-power-scheme-v(?:4[1-9]|5[01])/u);
  assert.doesNotMatch(setter, /\[string\]\$(?:Path|Root|Sid|Command|Script|Arguments?)/u);
  assert.doesNotMatch(setter, /icacls|takeown|Everyone|S-1-1-0|S-1-5-32-545/iu);

  const custodyAssertion = source.slice(
    source.indexOf('function Assert-ExactGuestArtifactCustody'),
    source.indexOf('function Resolve-RunnerFailureDiagnostic'),
  );
  assert.match(custodyAssertion, /-ArgumentList\s+\$Authority/u);
  assert.match(custodyAssertion, /\$fixedRoot\s*=\s*\[string\]\$ClosedAuthority\.GuestRoot/u);
  assert.doesNotMatch(custodyAssertion, /physical-[0-9a-f]{16}-managed-power-scheme-v(?:4[1-9]|5[01])/u);

  const copyBody = source.slice(
    source.indexOf('function Copy-ExactArtifactToGuest'),
    source.indexOf('function Assert-ExactGuestArtifactAclSnapshot'),
  );
  for (const marker of ['$Authority.ArtifactManifest', '$Authority.ArtifactSignature', '$Authority.GuestRoot']) {
    assert.match(copyBody, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }

  const runnerBody = source.slice(
    source.indexOf('function Invoke-ExactGuestRunner'),
    source.indexOf('function Read-ExactGuestBytes'),
  );
  assert.match(runnerBody, /\[Parameter\(Mandatory\)\]\$Authority/u);
  assert.match(runnerBody, /-ArgumentList\s+\$Authority/u);
  assert.match(runnerBody, /\$RunnerPath\s*=\s*\[string\]\$ClosedAuthority\.GuestRunner/u);
  assert.match(runnerBody, /\$ConfigPath\s*=\s*\[string\]\$ClosedAuthority\.GuestConfig/u);
  assert.doesNotMatch(runnerBody, /physical-[0-9a-f]{16}-managed-power-scheme-v(?:4[1-9]|5[01])/u);

  const runBody = source.slice(
    source.indexOf('function Invoke-CleanVmRun'),
    source.indexOf('Assert-ExactInvocation\n'),
  );
  assertInOrder(runBody, [
    'Copy-ExactArtifactToGuest',
    'Set-ExactGuestArtifactCustody',
    'Assert-ExactGuestArtifactCustody',
    'Invoke-ExactGuestRunner',
  ]);
});

test('RED: exact normal directory and staged file ACL snapshots are accepted', () => {
  assert.deepEqual(invokeAclSnapshotAssertion(exactDirectoryAcl(), guestSid), {
    ok: true,
    code: null,
  });
  assert.deepEqual(invokeAclSnapshotAssertion(exactFileAcl(), guestSid), {
    ok: true,
    code: null,
  });
});

test('RED: guest custody uses closed staged and installed-ready layouts', () => {
  const staged = invokeGuestCustodyLayout('staged');
  assert.equal(staged.ok, true);
  assert.equal(staged.files.length, 11);
  assert.deepEqual(staged.directories, ['configs']);

  const installed = invokeGuestCustodyLayout('installed-ready');
  assert.equal(installed.ok, true);
  assert.equal(installed.files.length, 13);
  assert.deepEqual(installed.directories, [
    'configs',
    'state',
    'state\\clean-windows-vm',
    'state\\clean-windows-vm\\diagnostics',
  ]);
  assert.equal(
    installed.files.includes('state\\clean-windows-vm\\diagnostics\\msi-install.log'),
    true,
  );
  assert.equal(
    installed.files.includes('state\\clean-windows-vm\\installed-ready.json'),
    true,
  );
  assert.deepEqual(invokeGuestCustodyLayout('completed'), {
    ok: false,
    code: 'BLOCKED:guest-acl-lifecycle',
    files: [],
    directories: [],
  });

  const source = bridgeSource();
  const setter = source.slice(
    source.indexOf('function Set-ExactGuestArtifactCustody'),
    source.indexOf('function Assert-ExactGuestArtifactCustody'),
  );
  const assertion = source.slice(
    source.indexOf('function Assert-ExactGuestArtifactCustody'),
    source.indexOf('function Resolve-RunnerFailureDiagnostic'),
  );
  for (const body of [setter, assertion]) {
    assert.match(body, /Get-ExactGuestArtifactCustodyLayout\s+-Lifecycle\s+\$Lifecycle/u);
    assert.match(body, /Compare-Object[\s\S]*-CaseSensitive/u);
    assert.match(body, /-ArgumentList\s+\$Authority,\s*\$layout/u);
  }

  const cleanBody = source.slice(
    source.indexOf('function Invoke-CleanVmRun'),
    source.indexOf('function Invoke-InstalledVmRecovery'),
  );
  assert.match(cleanBody, /Set-ExactGuestArtifactCustody[^\n]*-Lifecycle\s+'staged'/u);
  assert.match(cleanBody, /Assert-ExactGuestArtifactCustody[^\n]*-Lifecycle\s+'staged'/u);

  const recoveryBody = source.slice(
    source.indexOf('function Invoke-InstalledVmRecovery'),
    source.indexOf('Assert-ExactInvocation\n'),
  );
  assertInOrder(recoveryBody, [
    "Set-ExactGuestArtifactCustody -Credential $Credential -Authority $Authority -Lifecycle 'installed-ready'",
    "Assert-ExactGuestArtifactCustody -Credential $Credential -Authority $Authority -Lifecycle 'installed-ready'",
    'Assert-InstalledReadyRecord',
  ]);
});

test('RED: wrong owner, unprotected DACL, broad write, inherited drift, and principal mismatch fail closed', () => {
  const cases = [
    ['BLOCKED:guest-acl-owner', (value) => (value.ownerSid = guestSid)],
    ['BLOCKED:guest-acl-unprotected', (value) => (value.protected = false)],
    ['BLOCKED:guest-acl-broad-write', (value) => (value.rules[2].rights = 2032127)],
    ['BLOCKED:guest-acl-inherited-drift', (value) => (value.rules[0].inherited = true)],
    ['BLOCKED:guest-acl-principal-mismatch', (value) => (value.rules[2].sid = 'S-1-5-11')],
    ['BLOCKED:guest-acl-inheritance-drift', (value) => (value.rules[1].inheritanceFlags = 0)],
  ];
  for (const [code, mutate] of cases) {
    const snapshot = structuredClone(exactDirectoryAcl());
    mutate(snapshot);
    assert.deepEqual(invokeAclSnapshotAssertion(snapshot, guestSid), { ok: false, code });
  }
});

test('RED: read-only Audit restores an initially Off VM after bounded health observation', () => {
  const source = bridgeSource();
  const auditStart = source.indexOf('function Assert-ExactReadOnlyIntegrationHealth');
  const auditEnd = source.indexOf('function Copy-ExactArtifactToGuest');
  assert.ok(auditStart >= 0 && auditEnd > auditStart);
  const auditBody = source.slice(auditStart, auditEnd);
  assert.match(auditBody, /Start-VM\s+-Name\s+\$ExpectedVmName/u);
  assert.match(auditBody, /Wait-ExactIntegrationServicesHealthy/u);
  assert.match(auditBody, /finally/u);
  assert.match(auditBody, /Stop-VM\s+-Name\s+\$ExpectedVmName\s+-Force/u);
  assert.match(auditBody, /AddSeconds\(120\)/u);
});

test('elevated logger records fixed Phase 6 Audit and interactive RunCleanVm actions', () => {
  const source = readFileSync(elevatedLoggerPath, 'utf8');
  assert.match(source, /'Phase6Audit'/u);
  assert.match(source, /'Phase6RunCleanVm'/u);
  assert.match(source, /Invoke-Phase6Physical\.ps1/u);
  assert.match(source, /'Audit'/u);
  assert.match(source, /-Action RunCleanVm/u);
  assert.match(source, /06-31-SUMMARY\.md/u);
  assert.match(source, /06-38-SUMMARY\.md/u);
  const runStart = source.indexOf("if ($Action -eq 'Phase6RunCleanVm')");
  const runBody = source.slice(runStart);
  assert.ok(runStart >= 0);
  assert.match(runBody, /Get-Credential\s+-UserName\s+'LiiiraaLab'/u);
  assert.match(runBody, /Tee-Object\s+-FilePath\s+\$outputPath/u);
  assert.doesNotMatch(runBody, /-NonInteractive|CreateNoWindow|RedirectStandardInput/u);
});

test('elevated logger persists the exact child verdict and exit code', () => {
  const labRoot = mkdtempSync(join(tmpdir(), 'phase6-audit-logger-'));
  try {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        elevatedLoggerPath,
        '-Action',
        'Phase6Audit',
        '-LabRoot',
        labRoot,
      ],
      { cwd: root, encoding: 'utf8' },
    );
    assert.notEqual(result.status, 0, 'non-elevated child must preserve its blocking exit code');
    const logs = readdirSync(join(labRoot, 'Evidence')).filter((name) =>
      name.endsWith('-phase6audit-console.log'),
    );
    assert.equal(logs.length, 1);
    const content = readFileSync(join(labRoot, 'Evidence', logs[0]), 'utf8');
    assert.match(content, /open one elevated PowerShell/iu);
    assert.doesNotMatch(content, /RunCleanVm/u);
  } finally {
    rmSync(labRoot, { force: true, recursive: true });
  }
});

test('RED: observed Audit starts and stops only the exact VM with bounded health wait', () => {
  const source = readFileSync(elevatedLoggerPath, 'utf8');
  assert.match(source, /'Phase6ObservedAudit'/u);
  assert.match(source, /LiiiraaBoost-W11-25H2-Clean/u);
  assert.match(source, /Clean-Windows-Ready/u);
  assert.match(source, /Start-VM\s+-Name\s+\$expectedVmName/u);
  assert.match(source, /Get-VMIntegrationService\s+-VMName\s+\$expectedVmName/u);
  assert.match(source, /healthy\.Count\s+-eq\s+6/u);
  assert.match(source, /AddSeconds\(180\)/u);
  assert.match(source, /finally/u);
  assert.match(source, /Stop-VM\s+-Name\s+\$expectedVmName\s+-Force/u);
  assert.doesNotMatch(source, /Stop-VM[^\r\n]*-(?:Shutdown|TurnOff|Save)/u);
  assert.match(source, /Phase6Audit/u);
  assert.doesNotMatch(source, /Invoke-Command\s+-VMName/u);
  assert.doesNotMatch(source, /Restore-VMSnapshot|Checkpoint-VM|Remove-VMSnapshot/u);
});

test('RED: failed observation exposes cleanup-only authority for the exact VM', () => {
  const source = readFileSync(elevatedLoggerPath, 'utf8');
  assert.match(source, /'Phase6ObservationCleanup'/u);
  const cleanupStart = source.indexOf("if ($Action -eq 'Phase6ObservationCleanup')");
  const cleanupEnd = source.indexOf("if ($Action -eq 'Phase6ObservedAudit')");
  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart);
  const cleanup = source.slice(cleanupStart, cleanupEnd);
  assert.match(cleanup, /LiiiraaBoost-W11-25H2-Clean/u);
  assert.match(cleanup, /Clean-Windows-Ready/u);
  assert.match(cleanup, /Stop-VM\s+-Name\s+\$expectedVmName\s+-Force/u);
  assert.match(cleanup, /AddSeconds\(120\)/u);
  assert.doesNotMatch(cleanup, /Start-VM|Phase6Audit|Invoke-Command|TurnOff|Save/u);
});

test('RED: runner failures retain only a bounded exit code and one allowlisted code', () => {
  const diagnostic = invokeBridgeFunction('Resolve-RunnerFailureDiagnostic', {
    exitCode: 27,
    stdout: ['BLOCKED:msi-install-failed'],
    stderr: [],
    boundsExceeded: false,
  });
  assert.deepEqual(diagnostic, {
    Reason: 'runner-failure',
    RunnerExitCode: 27,
    RunnerFailureCode: 'BLOCKED:msi-install-failed',
  });

  const outOfRange = invokeBridgeFunction('Resolve-RunnerFailureDiagnostic', {
    exitCode: 70_000,
    stdout: ['BLOCKED:msi-install-failed'],
    stderr: [],
    boundsExceeded: false,
  });
  assert.deepEqual(outOfRange, {
    Reason: 'runner-output-redacted',
    RunnerExitCode: null,
    RunnerFailureCode: null,
  });
});

test('RED: secrets, arbitrary text, excess output, and multiple codes are fully redacted', () => {
  const cases = [
    ['password=not-for-evidence'],
    ['token=not-for-evidence'],
    ['bearer not-for-evidence'],
    ['S-1-5-21-111-222-333-1001'],
    ['serial=ABC123'],
    ['fatal: arbitrary runner text'],
    ['BLOCKED:first-code', 'BLOCKED:second-code'],
    ['BLOCKED:UPPERCASE-FORBIDDEN'],
  ];
  for (const stdout of cases) {
    const diagnostic = invokeBridgeFunction('Resolve-RunnerFailureDiagnostic', {
      exitCode: 9,
      stdout,
      stderr: [],
      boundsExceeded: false,
    });
    assert.deepEqual(diagnostic, {
      Reason: 'runner-output-redacted',
      RunnerExitCode: 9,
      RunnerFailureCode: null,
    });
    const serialized = JSON.stringify(diagnostic);
    for (const value of stdout) assert.equal(serialized.includes(value), false);
  }

  const bounded = invokeBridgeFunction('Resolve-RunnerFailureDiagnostic', {
    exitCode: 9,
    stdout: ['BLOCKED:valid-but-oversized-transport'],
    stderr: [],
    boundsExceeded: true,
  });
  assert.deepEqual(bounded, {
    Reason: 'runner-output-redacted',
    RunnerExitCode: 9,
    RunnerFailureCode: null,
  });
});

test('RED: blocked record persists stage and diagnostics without raw runner output', () => {
  const source = bridgeSource();
  const runnerBody = source.slice(
    source.indexOf('function Invoke-ExactGuestRunner'),
    source.indexOf('function Read-ExactGuestBytes'),
  );
  for (const marker of [
    'RedirectStandardOutput',
    'RedirectStandardError',
    'MaximumRunnerOutputLines',
    'MaximumRunnerOutputChars',
    'Resolve-RunnerFailureDiagnostic',
    'RunnerFailureStage',
    'RunnerExitCode',
    'RunnerFailureCode',
    'msi-install.safe.json',
    'Resolve-InstallerSidecarSummary',
  ])
    assert.match(runnerBody, new RegExp(marker, 'u'));

  const recordBody = source.slice(
    source.indexOf('function Write-BlockedRecord'),
    source.indexOf('function Invoke-CleanVmRun'),
  );
  assert.match(recordBody, /stage\s*=\s*\$RunnerFailureStage/u);
  assert.match(recordBody, /runnerExitCode\s*=\s*\$RunnerExitCode/u);
  assert.match(recordBody, /runnerFailureCode\s*=\s*\$RunnerFailureCode/u);
  assert.match(recordBody, /installerDiagnostic\s*=\s*\$InstallerDiagnostic/u);
  assert.match(recordBody, /installedCustodyDiagnostic\s*=\s*\$InstalledCustodyDiagnostic/u);
  assert.doesNotMatch(recordBody, /(?:Output|Stdout|Stderr)\s*=/u);
  assert.doesNotMatch(runnerBody, /Get-ExactGuestMsiDiagnostic/u);
  assert.match(
    source,
    /Invoke-ExactGuestRunner\s+-Credential\s+\$Credential\s+-Stage\s+'installed-ready'/u,
  );
  assert.match(
    source,
    /Invoke-ExactGuestRunner\s+-Credential\s+\$Credential\s+-Stage\s+'reboot-pending'/u,
  );
  assert.match(
    source,
    /Invoke-ExactGuestRunner\s+-Credential\s+\$Credential\s+-Stage\s+'completed'/u,
  );
});

test('RED: same-session installed custody sidecar is bounded and path-free', () => {
  const sidecarHash = `sha256:${'c'.repeat(64)}`;
  const present = invokeInstalledCustodySidecarAssertion({
    sidecarStatus: 'present',
    sidecarSha256: sidecarHash,
    sidecarSizeBytes: 256,
    failureCode: 'BLOCKED:installed-custody-canonical-path-invalid',
    sidecar: {
      kind: 'phase6-installed-custody-safe-diagnostic',
      schemaVersion: '1.0',
      errorCode: 'canonical-path-invalid',
      detailCode: 'canonicalize',
      role: 'last-admitted-parent',
      pathClass: 'disk',
      ioKind: 'permission-denied',
      win32Code: 5,
    },
  });
  assert.deepEqual(present, {
    DiagnosticStatus: 'present',
    ErrorCode: 'canonical-path-invalid',
    DetailCode: 'canonicalize',
    Role: 'last-admitted-parent',
    PathClass: 'disk',
    IoKind: 'permission-denied',
    Win32Code: 5,
    SidecarSha256: sidecarHash,
    SidecarSizeBytes: 256,
  });
  const poisoned = invokeInstalledCustodySidecarAssertion({
    sidecarStatus: 'present',
    sidecarSha256: sidecarHash,
    sidecarSizeBytes: 256,
    failureCode: 'BLOCKED:installed-custody-canonical-path-invalid',
    sidecar: {
      kind: 'phase6-installed-custody-safe-diagnostic',
      schemaVersion: '1.0',
      errorCode: 'canonical-path-invalid',
      detailCode: 'canonicalize',
      role: 'C:\\Users\\secret-user',
      pathClass: 'disk',
      ioKind: 'permission-denied',
      win32Code: 5,
    },
  });
  assert.equal(poisoned.DiagnosticStatus, 'sidecar-unparseable');
  assert.equal(JSON.stringify(poisoned).includes('secret-user'), false);
});

test('RED: same-session WebDriver diagnostic is hash-bound, bounded, and raw-free', () => {
  const source = bridgeSource();
  assert.match(source, /webdriver-launch\.safe\.json/u);
  assert.match(source, /Resolve-WebDriverSidecarSummary/u);
  assert.match(source, /WebDriverDiagnostic/u);
  assert.match(source, /WebDriverSidecarSha256/u);
  assert.match(source, /WebDriverSidecarSizeBytes/u);
  assert.match(source, /16384/u);
  assert.match(source, /phase6-webdriver-safe-diagnostic/u);
  assert.match(source, /native-driver-version-mismatch/u);
  assert.match(source, /dll-not-found/u);
  assert.match(source, /webdriverEndpointReady/u);
  assert.match(source, /nativeEndpointReady/u);
  assert.doesNotMatch(
    source,
    /WebDriverDiagnostic[^\n]*(?:Stdout|Stderr|RawPath|UserName|Sid|Secret)\s*=/u,
  );
});

test('RED: fixed installed-custody diagnostic is static-CRT and PE-gated before VM launch', () => {
  const buildPath = 'tooling/hyperv-lab/Build-Phase6InstalledCustodyDiagnostic.ps1';
  assert.equal(existsSync(buildPath), true, 'fixed diagnostic build entrypoint must exist');
  const build = readFileSync(buildPath, 'utf8');
  const collector = readFileSync(
    'tooling/hyperv-lab/Collect-Phase6InstalledCustodyDiagnostic.ps1',
    'utf8',
  );

  assert.match(build, /RUSTFLAGS[^\r\n]*-C target-feature=\+crt-static/u);
  assert.match(
    build,
    /cargo(?:\.exe)?['"]?\s+build[\s\S]{0,512}phase6-installed-custody-diagnostic[\s\S]{0,256}x86_64-pc-windows-msvc/u,
  );
  assert.match(build, /dumpbin\.exe/u);
  assert.match(build, /\/dependents/u);
  assert.match(build, /vcruntime\|msvcp\|ucrtbase\|api-ms-win-crt-/u);
  assert.match(build, /BLOCKED:diagnostic-dynamic-crt/u);

  const buildIndex = collector.indexOf('Build-Phase6InstalledCustodyDiagnostic.ps1');
  const sourceHashIndex = collector.indexOf('Get-FileHash -LiteralPath $diagnosticSource');
  const credentialIndex = collector.indexOf('Get-Credential');
  assert.ok(buildIndex >= 0 && buildIndex < sourceHashIndex && sourceHashIndex < credentialIndex);
});

test('RED: same-session MSI sidecar is always a bounded non-null diagnostic', () => {
  const safeHash = `sha256:${'a'.repeat(64)}`;
  const sidecarHash = `sha256:${'b'.repeat(64)}`;
  const present = invokeInstallerSidecarAssertion({
    sidecarStatus: 'present',
    sidecarSha256: sidecarHash,
    sidecarSizeBytes: 320,
    failureCode: 'BLOCKED:installer-exit-1603',
    sidecar: {
      kind: 'phase6-msi-safe-diagnostic',
      schemaVersion: '1.0',
      installerExitCode: 1603,
      logStatus: 'present',
      logSha256: safeHash,
      logSizeBytes: 512,
      returnValue3ActionCode: 'install-files',
      returnValue3ActionIdentifier: 'InstallFiles',
    },
  });
  assert.deepEqual(present, {
    DiagnosticStatus: 'present',
    InstallerExitCode: 1603,
    LogStatus: 'present',
    LogSha256: safeHash,
    LogSizeBytes: 512,
    ReturnValue3ActionCode: 'install-files',
    ReturnValue3ActionIdentifier: 'InstallFiles',
    SidecarSha256: sidecarHash,
    SidecarSizeBytes: 320,
  });

  const missing = invokeInstallerSidecarAssertion({
    sidecarStatus: 'sidecar-missing',
    sidecarSha256: null,
    sidecarSizeBytes: null,
    failureCode: 'BLOCKED:installer-log-create-once',
    sidecar: null,
  });
  assert.deepEqual(missing, {
    DiagnosticStatus: 'sidecar-missing',
    InstallerExitCode: null,
    LogStatus: 'unknown',
    LogSha256: null,
    LogSizeBytes: null,
    ReturnValue3ActionCode: 'unavailable',
    ReturnValue3ActionIdentifier: null,
    SidecarSha256: null,
    SidecarSizeBytes: null,
  });
  assert.equal(JSON.stringify(missing).includes('C:\\'), false);

  const malformed = invokeInstallerSidecarAssertion({
    sidecarStatus: 'present',
    sidecarSha256: sidecarHash,
    sidecarSizeBytes: 320,
    failureCode: 'BLOCKED:installer-exit-1603',
    sidecar: {
      kind: 'phase6-msi-safe-diagnostic',
      schemaVersion: '1.0',
      installerExitCode: 1603,
      logStatus: 'present',
      logSha256: safeHash,
      logSizeBytes: 512,
      returnValue3ActionCode: 'install-files',
      returnValue3ActionIdentifier: 'InstallFiles',
      rawLog: 'C:\\Users\\secret-user\\installer.log S-1-5-21-1 token=secret',
    },
  });
  assert.deepEqual(malformed, {
    DiagnosticStatus: 'sidecar-unparseable',
    InstallerExitCode: 1603,
    LogStatus: 'unknown',
    LogSha256: null,
    LogSizeBytes: null,
    ReturnValue3ActionCode: 'unavailable',
    ReturnValue3ActionIdentifier: null,
    SidecarSha256: null,
    SidecarSizeBytes: null,
  });
  for (const forbidden of ['secret-user', 'S-1-5-21', 'token=secret', 'C:\\Users']) {
    assert.equal(JSON.stringify(malformed).includes(forbidden), false);
  }
});

test('RED: MSI failure summary exposes only bounded allowlisted diagnostics', () => {
  const safeLog = [
    'MSI (s) (10:20) [12:00:00:000]: Product: Liiiraa Boost',
    'Action ended 12:00:00: InstallFiles. Return value 3.',
    'Property(S): USERNAME = secret-user',
    'Property(S): OriginalDatabase = C:\\Users\\secret-user\\liiiraa-boost.msi',
  ].join('\r\n');
  const summary = invokeBridgeFunction('Resolve-MsiLogSummary', {
    exitCode: 1603,
    failureCode: 'BLOCKED:installer-exit-1603',
    bytesBase64: Buffer.from(safeLog, 'utf8').toString('base64'),
    maximumBytes: 16 * 1024 * 1024,
  });
  assert.deepEqual(summary, {
    InstallerExitCode: 1603,
    LogSha256: `sha256:${createHash('sha256').update(safeLog).digest('hex')}`,
    LogSizeBytes: Buffer.byteLength(safeLog),
    ReturnValue3ActionCode: 'install-files',
    ReturnValue3ActionIdentifier: 'InstallFiles',
  });
  const serialized = JSON.stringify(summary);
  for (const forbidden of ['secret-user', 'C:\\Users', 'OriginalDatabase', 'Product:']) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test('RED: MSI failure summary decodes bounded UTF-16LE and preserves byte identity', () => {
  const safeFixture = [
    'MSI (s) (10:20) [12:00:00:000]: Product: REDACTED',
    'Action ended 12:00:00: InstallFiles. Return value 3.',
    'Property(S): USERNAME = REDACTED',
  ].join('\r\n');
  const body = Buffer.from(safeFixture, 'utf16le');
  for (const bytes of [Buffer.concat([Buffer.from([0xff, 0xfe]), body]), body]) {
    const summary = invokeBridgeFunction('Resolve-MsiLogSummary', {
      exitCode: 1603,
      failureCode: 'BLOCKED:installer-exit-1603',
      bytesBase64: bytes.toString('base64'),
      maximumBytes: 16 * 1024 * 1024,
    });
    assert.deepEqual(summary, {
      InstallerExitCode: 1603,
      LogSha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      LogSizeBytes: bytes.length,
      ReturnValue3ActionCode: 'install-files',
      ReturnValue3ActionIdentifier: 'InstallFiles',
    });
    assert.equal(JSON.stringify(summary).includes('REDACTED'), false);
  }

  const malformed = Buffer.from([0xff, 0xfe, 0x41, 0x00, 0x00, 0xd8, 0x58]);
  const rejected = invokeBridgeFunction('Resolve-MsiLogSummary', {
    exitCode: 1603,
    failureCode: 'BLOCKED:installer-exit-1603',
    bytesBase64: malformed.toString('base64'),
    maximumBytes: 16 * 1024 * 1024,
  });
  assert.deepEqual(rejected, {
    InstallerExitCode: 1603,
    LogSha256: `sha256:${createHash('sha256').update(malformed).digest('hex')}`,
    LogSizeBytes: malformed.length,
    ReturnValue3ActionCode: 'none',
    ReturnValue3ActionIdentifier: null,
  });
});

test('RED: visible apply confirmation is bounded and durably accepted before mutation', () => {
  const source = bridgeSource();
  for (const literal of [
    'Write-ApplyPromptReadyRecordOnce',
    'Invoke-VisibleApplyConfirmation',
    'Write-ApplyAcceptedRecordOnce',
    'apply-prompt-ready',
    'apply-accepted-before-mutation',
    'FileMode]::CreateNew',
    'PHASE6_APPLY_PROMPT_READY',
    'PHASE6_APPLY_ACCEPTED',
    'System.Windows.Forms',
    'TopMost',
    'AddMinutes(10)',
  ]) {
    assert.match(source, new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  assertInOrder(source, [
    'Write-CheckpointReadyRecordOnce',
    'Write-ApplyPromptReadyRecordOnce',
    'PHASE6_APPLY_PROMPT_READY',
    'Invoke-VisibleApplyConfirmation',
    'Write-ApplyAcceptedRecordOnce',
    'PHASE6_APPLY_ACCEPTED',
    "-Stage 'reboot-pending'",
  ]);
  assert.match(
    source,
    /kind\s*=\s*'phase6-apply-prompt-ready'[\s\S]*operationVersion\s*=\s*\$ExpectedOperationVersion[\s\S]*buildId\s*=\s*\$ExpectedBuildId/u,
  );
  assert.match(
    source,
    /kind\s*=\s*'phase6-apply-accepted-before-mutation'[\s\S]*promptReadySha256[\s\S]*installedCheckpointId/u,
  );
  const runBody = source.slice(
    source.indexOf('function Invoke-CleanVmRun'),
    source.indexOf('Assert-ExactInvocation\n'),
  );
  assert.doesNotMatch(runBody, /Read-Host/u);
});

test('RED: v65 recovery restores only the exact installed checkpoint and revalidates before approval', () => {
  const source = readFileSync(bridgePath, 'utf8');
  for (const literal of [
    'adea1580-a076-40f9-8bb2-2458701f47ac',
    '16fa3d1c36f5b0d904b330a148e9a0d82ebc71a5e56d8e7f4ca7af6afd8c3ce9',
    'c3b8f85bac7002bbc7880c45cd2c5c83f2dc4acd420ea8c201fa81b551b04bcf',
    '33dbb3ef5535161d245b5862edeec9ea2b5a2f8ed779c6fe3e41b396f436c401',
    'Assert-ExactInstalledRecoveryPreflight',
    'Invoke-InstalledVmRecovery',
    'RECOVERY-APPLY-PROMPT-READY',
    'RECOVERY-APPLY-ACCEPTED',
  ]) {
    assert.match(source, new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'));
  }
  const recoveryBody = source.slice(
    source.indexOf('function Invoke-InstalledVmRecovery'),
    source.indexOf('Assert-ExactInvocation\n'),
  );
  assertInOrder(recoveryBody, [
    'Assert-ExactInstalledRecoveryPreflight',
    'Restore-VMSnapshot',
    'Start-VM',
    'Wait-ExactVmReady',
    'Assert-ExactGuestArtifactCustody',
    'Assert-InstalledReadyRecord',
    'Write-CheckpointReadyRecordOnce',
    'Write-RecoveryApplyPromptReadyRecordOnce',
    'Invoke-VisibleApplyConfirmation',
    'Write-ApplyAcceptedRecordOnce',
    "-Stage 'reboot-pending'",
  ]);
  assert.doesNotMatch(recoveryBody, /Copy-ExactArtifactToGuest/u);
  assert.doesNotMatch(recoveryBody, /Invoke-ExactGuestRunner[^\n]*-Stage\s+'installed-ready'/u);
  assert.match(source, /finally\s*\{[\s\S]*\$Action\s+-in\s+@\('RunCleanVm',\s*'RecoverInstalledVm'\)[\s\S]*Stop-ExactVmAfterRun/u);
  assert.doesNotMatch(source, /Remove-VMSnapshot/u);
});

test('RED: every PowerShell Direct readiness wait is bounded, auth-aware, and cleanup-safe', () => {
  const source = readFileSync(bridgePath, 'utf8');
  const waitStart = source.indexOf('function Wait-ExactVmReady');
  const waitEnd = source.indexOf('function Copy-BoundedEvidenceAndIngest');
  assert.ok(waitStart >= 0 && waitEnd > waitStart);
  const waitBody = source.slice(waitStart, waitEnd);

  assert.match(waitBody, /AddSeconds\(180\)/u);
  assert.match(waitBody, /Start-Sleep\s+-Seconds\s+2/u);
  assert.match(waitBody, /Test-IsGuestAuthenticationFailure/u);
  assert.match(waitBody, /guest credential was rejected/iu);
  assert.match(waitBody, /PowerShell Direct ready within 180 seconds/iu);
  assert.doesNotMatch(waitBody, /AddSeconds\(60\)/u);

  const cleanupStart = source.indexOf('function Stop-ExactVmAfterRun');
  const cleanupEnd = source.indexOf('function Write-ApplyPromptReadyRecordOnce');
  assert.ok(cleanupStart >= 0 && cleanupEnd > cleanupStart);
  const cleanupBody = source.slice(cleanupStart, cleanupEnd);
  assert.match(cleanupBody, /Get-VM\s+-Name\s+\$ExpectedVmName/u);
  assert.match(cleanupBody, /Stop-VM\s+-Name\s+\$ExpectedVmName\s+-Force/u);
  assert.match(cleanupBody, /AddSeconds\(120\)/u);

  const executionBody = source.slice(source.indexOf('try {\n    Assert-ArtifactVerifierPass'));
  assert.match(executionBody, /finally\s*\{[\s\S]*Stop-ExactVmAfterRun/u);
});

test('RED: MSI summary fails closed for unknown actions, secrets, and oversized logs', () => {
  const unknown = invokeBridgeFunction('Resolve-MsiLogSummary', {
    exitCode: 2,
    failureCode: 'BLOCKED:installer-exit-other',
    bytesBase64: Buffer.from(
      'Action ended 12:00:00: AttackerControlled. Return value 3.\r\npassword=hidden',
      'utf8',
    ).toString('base64'),
    maximumBytes: 16 * 1024 * 1024,
  });
  assert.equal(unknown.InstallerExitCode, null);
  assert.equal(unknown.ReturnValue3ActionCode, 'other');
  assert.equal(unknown.ReturnValue3ActionIdentifier, null);
  assert.equal(JSON.stringify(unknown).includes('AttackerControlled'), false);
  assert.equal(JSON.stringify(unknown).includes('password'), false);

  const oversized = invokeBridgeFunction('Resolve-MsiLogSummary', {
    exitCode: 1603,
    failureCode: 'BLOCKED:installer-exit-1603',
    bytesBase64: Buffer.alloc(5, 65).toString('base64'),
    maximumBytes: 4,
  });
  assert.deepEqual(oversized, {
    InstallerExitCode: null,
    LogSha256: null,
    LogSizeBytes: null,
    ReturnValue3ActionCode: 'unavailable',
    ReturnValue3ActionIdentifier: null,
  });
});

test('mutation corpus detects target, custody, lifecycle, command, and evidence widening', () => {
  const source = bridgeSource();
  const mutations = [
    [exactVm, 'Attacker-VM'],
    [cleanCheckpoint, 'Wrong-Clean'],
    [installedCheckpoint, cleanCheckpoint],
    ['SecureBoot', 'BootPolicyIgnored'],
    ['TpmEnabled', 'VirtualSecuritySkipped'],
    ['phase6-artifact-verifier', 'Write-Host'],
    ['phase6-physical-runner.exe', 'powershell.exe'],
    ['configs\\clean-windows-vm.run-config.json', 'configs\\attacker.json'],
    ['Assert-InstalledReadyRecord', 'SkipInstallBoundary'],
    ['Write-CheckpointReadyRecordOnce', 'OverwriteLifecycleBoundary'],
    ['Assert-RebootPendingRecord', 'TrustRequestedState'],
    ['physical-writer.ts', 'relabel-physical-output.ts'],
    ['$Authority.GuestRoot', 'C:\\LiiiraaBoost\\Phase6\\physical-deadbeefdeadbeef-managed-power-scheme-v49'],
    ['$Authority.GuestRunner', 'powershell.exe'],
    ['$Authority.GuestConfig', 'configs\\attacker.json'],
    ['64KB', '1GB'],
  ];
  for (const [expected, replacement] of mutations) {
    const mutated = source.replaceAll(expected, replacement);
    assert.throws(() => assertSourcePolicy(mutated), `mutation must be rejected: ${expected}`);
  }
});

test('dry-run audits the exact immutable v66 tuple without elevation or mutation', () => {
  const result = runBridge();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.actions, ['Audit', 'RunCleanVm', 'RecoverInstalledVm']);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.vmName, exactVm);
  assert.equal(report.cleanCheckpoint, cleanCheckpoint);
  assert.equal(report.cleanCheckpointId, cleanCheckpointId);
  assert.equal(report.backupCheckpoint, backupCheckpoint);
  assert.equal(report.backupCheckpointId, backupCheckpointId);
  assert.equal(report.installedCheckpoint, installedCheckpoint);
  assert.equal(report.operationVersion, 'managed-power-scheme-v66');
  assert.equal(
    report.runnerCommand,
    'phase6-physical-runner.exe --run-config configs\\clean-windows-vm.run-config.json',
  );
  assert.equal(report.hostPowerMutation, false);
  assert.equal(report.guestDevelopmentRuntime, false);
  assert.equal(report.artifactManifestSha256.length, 64);
  assert.equal(report.simulationRunSha256.length, 64);
  assert.doesNotMatch(result.stdout, /password|S-1-5-|serial(?:number)?|bearer|token/iu);
});

test('RED: schema mutation corpus operates only on an isolated authority copy', () => {
  const source = readFileSync(import.meta.filename, 'utf8');
  const mutationTest = source.slice(
    source.lastIndexOf("test('schema-v3 chain mutations fail closed before any bridge action'"),
    source.lastIndexOf(
      "test('wrong target, checkpoint, summaries, and generic authority fail closed'",
    ),
  );
  assert.match(mutationTest, /createMutationSandbox/u);
  assert.doesNotMatch(mutationTest, /writeFileSync\(evidenceManifest/u);
});

test('schema-v3 chain mutations fail closed before any bridge action', () => {
  const liveAuthority = readFileSync(evidenceManifest);
  const sandbox = createMutationSandbox();
  const original = readFileSync(sandbox.evidenceManifest);
  const mutations = [
    ['schema downgrade', (value) => (value.schemaVersion = 2)],
    ['v41 reactivation', (value) => (value.deterministicAdmissions[0].status = 'active')],
    [
      'second active',
      (value) => value.deterministicAdmissions.push({ ...value.deterministicAdmissions[14] }),
    ],
    [
      'missing predecessor',
      (value) => (value.deterministicAdmissions[14].predecessorEvidenceSha256 = null),
    ],
    [
      'fork',
      (value) => (value.deterministicAdmissions[2].successorEvidenceSha256 = 'f'.repeat(64)),
    ],
    [
      'v42 injection',
      (value) =>
        value.deterministicAdmissions.splice(1, 0, {
          ...value.deterministicAdmissions[0],
          operationVersion: 'managed-power-scheme-v42',
          buildId: 'forbidden-v42',
          artifactManifestSha256: '2'.repeat(64),
          runEvidenceId: 'forbidden-v42-run',
          runEvidenceSha256: '3'.repeat(64),
        }),
    ],
    [
      'active tuple mismatch',
      (value) => (value.deterministicAdmissions[14].buildId = 'mismatched-build'),
    ],
    [
      'active run hash mismatch',
      (value) => (value.deterministicAdmissions[14].runEvidenceSha256 = '4'.repeat(64)),
    ],
  ];
  try {
    for (const [label, mutate] of mutations) {
      const value = JSON.parse(original.toString('utf8'));
      mutate(value);
      writeFileSync(sandbox.evidenceManifest, `${JSON.stringify(value, null, 2)}\n`);
      const result = runBridge([], sandbox);
      assert.notEqual(result.status, 0, `${label} must be rejected`);
      writeFileSync(sandbox.evidenceManifest, original);
    }
  } finally {
    rmSync(sandbox.sandbox, { force: true, recursive: true });
  }
  assert.deepEqual(readFileSync(evidenceManifest), liveAuthority);
});

test('wrong target, checkpoint, summaries, and generic authority fail closed', () => {
  for (const extra of [
    ['-VmName', 'Attacker-VM'],
    ['-CheckpointName', 'Wrong-Clean'],
    ['-ArtifactManifestFromSummary', simulationSummary],
    ['-SimulationAdmissionFromSummary', artifactSummary],
    ['-Command', 'whoami'],
    ['-Script', 'Write-Host attacker'],
    ['-Executable', 'powershell.exe'],
    ['-RunConfig', 'C:\\attacker.json'],
    ['-Argument', '-EncodedCommand'],
    ['-RemoteHost', 'attacker.example'],
  ]) {
    const result = runBridge(extra);
    assert.notEqual(result.status, 0, `must reject ${extra.join(' ')}`);
  }
});
