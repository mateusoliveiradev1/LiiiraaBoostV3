import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const bridgePath = resolve(import.meta.dirname, 'Invoke-Phase6Physical.ps1');
const artifactSummary = resolve(
  root,
  '.planning/phases/06-transactional-plans-and-recovery/06-31-SUMMARY.md',
);
const simulationSummary = resolve(
  root,
  '.planning/phases/06-transactional-plans-and-recovery/06-38-SUMMARY.md',
);
const exactVm = 'LiiiraaBoost-W11-25H2-Clean';
const cleanCheckpoint = 'Clean-Windows-Ready';
const installedCheckpoint = 'LiiiraaBoost-Installed';

const runBridge = (extra = []) =>
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-File',
      bridgePath,
      '-Action',
      'Audit',
      '-DryRun',
      '-VmName',
      exactVm,
      '-CheckpointName',
      cleanCheckpoint,
      '-ArtifactManifestFromSummary',
      artifactSummary,
      '-SimulationAdmissionFromSummary',
      simulationSummary,
      ...extra,
    ],
    { cwd: root, encoding: 'utf8' },
  );

const bridgeSource = () => {
  assert.equal(existsSync(bridgePath), true, 'the dedicated Phase 6 bridge must exist');
  return readFileSync(bridgePath, 'utf8');
};

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
    installedCheckpoint,
    'managed-power-scheme-v41',
    'physical-8d162575a964ec77-managed-power-scheme-v41',
    '994994ec4e61b45013930a7f650aaf0b46918d68',
    '8789c54ca0a73e2f496fedb7710dae6eac4b1b4bad10864e0284b7591d607784',
    '626b9793c70f1271d28eff8f3a3e4bba37956c9138b08c345b72e2b22f7f02b7',
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

  assert.match(source, /ValidateSet\('Audit',\s*'RunCleanVm'\)/u);
  assert.match(source, /phase6-physical-runner\.exe['"]?\s*,?\s*['"]--run-config/u);
  assert.doesNotMatch(source, /\[string\]\$(?:Command|Script|Executable|Config|Arguments?|RemoteHost|EvidenceLabel)/u);
  assert.doesNotMatch(source, /Restart-Computer|Stop-Computer|Set-VMHost|Set-VMHostCluster/u);
  assert.doesNotMatch(source, /(?:npm|pnpm|node|tsx|ts-node|typescript)\.exe.*Invoke-Command/iu);

  assertInOrder(source, [
    'Assert-ArtifactVerifierPass',
    'Copy-ExactArtifactToGuest',
    'Invoke-ExactGuestRunner',
    'Assert-InstalledReadyRecord',
    'New-InstalledCheckpointOnce',
    'Write-CheckpointReadyRecordOnce',
    'Invoke-ExactGuestRunner',
    'Assert-RebootPendingRecord',
    'Restart-VM',
    'Invoke-ExactGuestRunner',
    'Assert-ArtifactVerifierPass',
    'physical-writer.ts',
  ]);
};

test('RED: dedicated bridge exposes only exact Audit and RunCleanVm authority', () => {
  assertSourcePolicy(bridgeSource());
});

test('mutation corpus detects target, custody, lifecycle, command, and evidence widening', () => {
  const source = bridgeSource();
  const mutations = [
    [exactVm, 'Attacker-VM'],
    [cleanCheckpoint, 'Wrong-Clean'],
    [installedCheckpoint, cleanCheckpoint],
    ['SecureBoot', 'SecureBootIgnored'],
    ['TpmEnabled', 'TpmSkipped'],
    ['phase6-artifact-verifier', 'Write-Host'],
    ['phase6-physical-runner.exe', 'powershell.exe'],
    ['configs\\clean-windows-vm.run-config.json', 'configs\\attacker.json'],
    ['Assert-InstalledReadyRecord', 'Skip-InstalledReadyRecord'],
    ['Write-CheckpointReadyRecordOnce', 'Overwrite-CheckpointReadyRecord'],
    ['Assert-RebootPendingRecord', 'Trust-RequestedReboot'],
    ['physical-writer.ts', 'relabel-physical-output.ts'],
    ['64KB', '1GB'],
  ];
  for (const [expected, replacement] of mutations) {
    const mutated = source.replace(expected, replacement);
    assert.throws(() => assertSourcePolicy(mutated), `mutation must be rejected: ${expected}`);
  }
});

test('dry-run audits the exact immutable v41 tuple without elevation or mutation', () => {
  const result = runBridge();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.actions, ['Audit', 'RunCleanVm']);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.vmName, exactVm);
  assert.equal(report.cleanCheckpoint, cleanCheckpoint);
  assert.equal(report.installedCheckpoint, installedCheckpoint);
  assert.equal(report.operationVersion, 'managed-power-scheme-v41');
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

