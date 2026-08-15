import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const bridgePath = resolve(import.meta.dirname, 'Invoke-Phase6Physical.ps1');
const elevatedLoggerPath = resolve(import.meta.dirname, 'Run-LabElevated.ps1');
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
const cleanCheckpointId = 'ab2bc9c7-e0f7-49a7-84d7-5fb6a486f075';
const backupCheckpoint = 'Clean-Windows-Ready-PreLabAccount-v43';
const backupCheckpointId = 'ebccd5f3-5645-4089-b469-fa4d851fc6ef';
const installedCheckpoint = 'LiiiraaBoost-Installed';

const runBridge = (extra = []) =>
  spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
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

const invokeBridgeFunction = (name, input) => {
  const encoded = Buffer.from(JSON.stringify(input), 'utf8').toString('base64');
  const escapedBridgePath = bridgePath.replaceAll("'", "''");
  const command = [
    '$tokens = $null; $errors = $null',
    `$ast = [Management.Automation.Language.Parser]::ParseFile('${escapedBridgePath}', [ref]$tokens, [ref]$errors)`,
    `$function = $ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq '${name}' }, $true) | Select-Object -First 1`,
    "if ($null -eq $function) { throw 'required bridge function is missing' }",
    'Invoke-Expression $function.Extent.Text',
    `$input = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json`,
    `${name} -ExitCode ([int64]$input.exitCode) -Stdout @($input.stdout) -Stderr @($input.stderr) -BoundsExceeded ([bool]$input.boundsExceeded) | ConvertTo-Json -Compress`,
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
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
    cleanCheckpointId,
    backupCheckpoint,
    backupCheckpointId,
    installedCheckpoint,
    'managed-power-scheme-v45',
    'physical-68bb4f974e23ee26-managed-power-scheme-v45',
    '7c3525b12ce76619f711ff6f6183ec884c60764f',
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

  assert.match(source, /ValidateSet\('Audit',\s*'RunCleanVm'\)/u);
  assert.match(source, /phase6-physical-runner\.exe --run-config configs\\clean-windows-vm\.run-config\.json/u);
  assert.doesNotMatch(source, /\[string\]\$(?:Command|Script|Executable|Config|Arguments?|RemoteHost|EvidenceLabel)/u);
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

test('RED: dedicated bridge exposes only exact Audit and RunCleanVm authority', () => {
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

test('elevated logger records only the fixed Phase 6 Audit action', () => {
  const source = readFileSync(elevatedLoggerPath, 'utf8');
  assert.match(source, /'Phase6Audit'/u);
  assert.match(source, /Invoke-Phase6Physical\.ps1/u);
  assert.match(source, /'Audit'/u);
  assert.match(source, /06-31-SUMMARY\.md/u);
  assert.match(source, /06-38-SUMMARY\.md/u);
  assert.doesNotMatch(source, /RunCleanVm/u);
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
  ])
    assert.match(runnerBody, new RegExp(marker, 'u'));

  const recordBody = source.slice(
    source.indexOf('function Write-BlockedRecord'),
    source.indexOf('function Invoke-CleanVmRun'),
  );
  assert.match(recordBody, /stage\s*=\s*\$RunnerFailureStage/u);
  assert.match(recordBody, /runnerExitCode\s*=\s*\$RunnerExitCode/u);
  assert.match(recordBody, /runnerFailureCode\s*=\s*\$RunnerFailureCode/u);
  assert.doesNotMatch(recordBody, /(?:Output|Stdout|Stderr)\s*=/u);
  assert.match(source, /Invoke-ExactGuestRunner\s+-Credential\s+\$Credential\s+-Stage\s+'installed-ready'/u);
  assert.match(source, /Invoke-ExactGuestRunner\s+-Credential\s+\$Credential\s+-Stage\s+'reboot-pending'/u);
  assert.match(source, /Invoke-ExactGuestRunner\s+-Credential\s+\$Credential\s+-Stage\s+'completed'/u);
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
    ['64KB', '1GB'],
  ];
  for (const [expected, replacement] of mutations) {
    const mutated = source.replaceAll(expected, replacement);
    assert.throws(() => assertSourcePolicy(mutated), `mutation must be rejected: ${expected}`);
  }
});

test('dry-run audits the exact immutable v45 tuple without elevation or mutation', () => {
  const result = runBridge();
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.actions, ['Audit', 'RunCleanVm']);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.vmName, exactVm);
  assert.equal(report.cleanCheckpoint, cleanCheckpoint);
  assert.equal(report.cleanCheckpointId, cleanCheckpointId);
  assert.equal(report.backupCheckpoint, backupCheckpoint);
  assert.equal(report.backupCheckpointId, backupCheckpointId);
  assert.equal(report.installedCheckpoint, installedCheckpoint);
  assert.equal(report.operationVersion, 'managed-power-scheme-v45');
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

test('schema-v3 chain mutations fail closed before any bridge action', () => {
  const original = readFileSync(evidenceManifest);
  const mutations = [
    ['schema downgrade', (value) => (value.schemaVersion = 2)],
    ['v41 reactivation', (value) => (value.deterministicAdmissions[0].status = 'active')],
    [
      'second active',
      (value) => value.deterministicAdmissions.push({ ...value.deterministicAdmissions[3] }),
    ],
    [
      'missing predecessor',
      (value) => (value.deterministicAdmissions[3].predecessorEvidenceSha256 = null),
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
      (value) => (value.deterministicAdmissions[3].buildId = 'mismatched-build'),
    ],
    [
      'active run hash mismatch',
      (value) => (value.deterministicAdmissions[3].runEvidenceSha256 = '4'.repeat(64)),
    ],
  ];
  try {
    for (const [label, mutate] of mutations) {
      const value = JSON.parse(original.toString('utf8'));
      mutate(value);
      writeFileSync(evidenceManifest, `${JSON.stringify(value, null, 2)}\n`);
      const result = runBridge();
      assert.notEqual(result.status, 0, `${label} must be rejected`);
      writeFileSync(evidenceManifest, original);
    }
  } finally {
    writeFileSync(evidenceManifest, original);
  }
  assert.deepEqual(readFileSync(evidenceManifest), original);
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
