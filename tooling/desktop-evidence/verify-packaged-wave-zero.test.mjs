import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const workspaceRoot = resolve(import.meta.dirname, '../..');
const verifierPath = resolve(
  workspaceRoot,
  'tooling/desktop-evidence/verify-packaged-wave-zero.mjs',
);

const clone = (value) => structuredClone(value);

const writeJson = (directory, name, value) => {
  const path = join(directory, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
  return path;
};

const runCli = (...arguments_) =>
  spawnSync(process.execPath, [verifierPath, ...arguments_], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });

const review = Object.freeze({
  status: 'reviewed',
  provenance: Object.freeze({
    kind: 'controlled-machine-review',
    source: 'local packaged Wave 0 review',
  }),
  observer: 'phase-02-reviewer',
  reviewedAt: '2026-07-28T00:00:00.000Z',
});

const reviewedEnvironment = () => ({
  schemaVersion: '1.0',
  evidenceKind: 'desktop-packaged-environment',
  records: [
    {
      recordType: 'windows-image',
      id: 'windows-10',
      ...clone(review),
      windows: {
        family: 'Windows',
        release: '10',
        edition: 'Pro',
        build: '19045.6093',
        architecture: 'x64',
      },
      imageIdentity: 'win10-22h2-clean-2026-07',
      runnerIdentity: 'controlled-vm-win10',
      webView2: {
        status: 'available',
        version: '138.0.3351.95',
      },
      developmentSigningAccess: 'current-user-local-only',
      evidencePath: 'quality/evidence/phase-02/environment/windows-10-image.json',
    },
    {
      recordType: 'windows-image',
      id: 'windows-11',
      ...clone(review),
      windows: {
        family: 'Windows',
        release: '11',
        edition: 'Pro',
        build: '26200.5710',
        architecture: 'x64',
      },
      imageIdentity: 'win11-pro-clean-2026-07',
      runnerIdentity: 'controlled-vm-win11',
      webView2: {
        status: 'available',
        version: '138.0.3351.95',
      },
      developmentSigningAccess: 'current-user-local-only',
      evidencePath: 'quality/evidence/phase-02/environment/windows-11-image.json',
    },
    {
      recordType: 'development-signing',
      id: 'local-development-signing',
      ...clone(review),
      trustClass: 'self-signed-development',
      certificateStore: 'Cert:\\CurrentUser\\My',
      certificateThumbprint: '0123456789ABCDEF0123456789ABCDEF01234567',
      extendedKeyUsage: '1.3.6.1.5.5.7.3.3',
      digestAlgorithm: 'SHA-256',
      keyProvider: 'Microsoft Software Key Storage Provider',
      keyCustody: {
        scope: 'current-user',
        technology: 'CNG',
        exportable: false,
        ciPrivateKeyAccess: false,
      },
      timestamp: {
        state: 'not-applicable',
      },
      publicTrust: false,
      smartScreenReputation: false,
      productionReady: false,
      distributionAllowed: false,
      productionSigningDeferredTo: 'Phase 10',
      evidencePath: 'quality/evidence/phase-02/environment/signing-access.json',
    },
  ],
});

const requiredManualIds = Object.freeze([
  'authenticode',
  'non-elevation',
  'startup',
  'single-instance',
  'tray',
  'deep-link',
  'startup-timing',
  'working-set',
  'nvda',
  'forced-colors',
  'scale',
]);

const observedManualEvidence = (directory) => {
  const records = requiredManualIds.map((id) => {
    const relativeAttachment = `attachments/${id}.txt`;
    const attachmentPath = join(directory, relativeAttachment);
    mkdirSync(dirname(attachmentPath), { recursive: true });
    writeFileSync(attachmentPath, `synthetic ${id} evidence\n`, 'utf8');
    return {
      recordType: 'manual-observation',
      id,
      status: 'observed',
      provenance: {
        kind: 'controlled-packaged-observation',
        source: 'clean-machine packaged run',
      },
      observer: 'phase-02-reviewer',
      observedAt: '2026-07-28T00:00:00.000Z',
      attachments: [relativeAttachment],
    };
  });
  return {
    schemaVersion: '1.0',
    evidenceKind: 'desktop-packaged-manual-observations',
    records,
  };
};

test('dry-run remains planned and names every unavailable packaged prerequisite', () => {
  const result = runCli('--dry-run');

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.acceptance, 'planned');
  assert.equal(report.packagedAcceptance, false);
  assert.equal(report.observationsCreated, false);
  for (const prerequisite of [
    'Windows 10',
    'Windows 11',
    'development signing',
    'NVDA',
    'forced colors',
    'scale',
  ]) {
    assert.match(report.prerequisites.join('\n'), new RegExp(prerequisite, 'iu'));
  }
});

test('reviewed environment mode accepts exactly two supported images and free local signing', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'liiiraa-packaged-environment-'));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const environmentPath = writeJson(directory, 'environment.json', reviewedEnvironment());

  const result = runCli('--environment', environmentPath, '--require-reviewed');

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'reviewed-environment');
  assert.equal(report.acceptance, 'reviewed');
  assert.equal(report.packagedAcceptance, false);
  assert.deepEqual(report.recordIds, ['windows-10', 'windows-11', 'local-development-signing']);
});

test('reviewed environment mutations fail with stable diagnostics', async (t) => {
  const mutations = [
    [
      'missing Windows 10 record',
      (fixture) => fixture.records.splice(0, 1),
      'exactly one Windows 10 image record is required',
    ],
    [
      'extra environment record',
      (fixture) => fixture.records.push(clone(fixture.records[0])),
      'exactly three environment records are required',
    ],
    [
      'unsupported edition metadata',
      (fixture) => {
        fixture.records[0].windows.edition = '';
      },
      'windows-10 edition must be a non-empty reviewed value',
    ],
    [
      'browser substitution',
      (fixture) => {
        fixture.records[0].provenance.kind = 'browser-observation';
      },
      'browser evidence cannot substitute for packaged evidence',
    ],
    [
      'unresolved record',
      (fixture) => {
        fixture.records[1].status = 'unresolved';
      },
      'windows-11 status must be reviewed',
    ],
    [
      'missing provenance timestamp',
      (fixture) => {
        delete fixture.records[1].reviewedAt;
      },
      'windows-11 reviewedAt must be an ISO timestamp',
    ],
    [
      'wrong certificate store',
      (fixture) => {
        fixture.records[2].certificateStore = 'Cert:\\LocalMachine\\My';
      },
      'development signing certificateStore must be Cert:\\CurrentUser\\My',
    ],
    [
      'wrong CNG provider',
      (fixture) => {
        fixture.records[2].keyProvider = 'legacy CSP';
      },
      'development signing keyProvider must be Microsoft Software Key Storage Provider',
    ],
    [
      'exportable key',
      (fixture) => {
        fixture.records[2].keyCustody.exportable = true;
      },
      'development signing key must be non-exportable',
    ],
    [
      'CI private-key access',
      (fixture) => {
        fixture.records[2].keyCustody.ciPrivateKeyAccess = true;
      },
      'CI private-key access must remain false',
    ],
    [
      'public trust claim',
      (fixture) => {
        fixture.records[2].publicTrust = true;
      },
      'development signing publicTrust must be false',
    ],
    [
      'release-ready claim',
      (fixture) => {
        fixture.records[2].productionReady = true;
      },
      'development signing productionReady must be false',
    ],
    [
      'publishable claim',
      (fixture) => {
        fixture.records[2].distributionAllowed = true;
      },
      'development signing distributionAllowed must be false',
    ],
    [
      'invalid timestamp applicability',
      (fixture) => {
        fixture.records[2].timestamp = { state: 'present' };
      },
      'development signing timestamp state is invalid',
    ],
    [
      'missing official-free timestamp evidence',
      (fixture) => {
        fixture.records[2].timestamp = { state: 'verified-official-free' };
      },
      'verified official-free timestamp requires authority and evidencePath',
    ],
    [
      'secret-shaped signing material',
      (fixture) => {
        fixture.records[2].privateKey = 'forbidden';
      },
      'secret-shaped field is forbidden: privateKey',
    ],
  ];

  for (const [name, mutate, expectedDiagnostic] of mutations) {
    await t.test(name, () => {
      const directory = mkdtempSync(join(tmpdir(), 'liiiraa-packaged-mutation-'));
      t.after(() => rmSync(directory, { force: true, recursive: true }));
      const fixture = reviewedEnvironment();
      mutate(fixture);
      const environmentPath = writeJson(directory, 'environment.json', fixture);

      const result = runCli('--environment', environmentPath, '--require-reviewed');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(expectedDiagnostic.replaceAll('\\', '\\\\'), 'u'));
    });
  }
});

test('manual mode validates observed records and reachable attachments without creating evidence', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'liiiraa-packaged-manual-'));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const manualPath = writeJson(directory, 'manual.json', observedManualEvidence(directory));

  const result = runCli('--manual', manualPath, '--require-observed');

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, 'observed-manual');
  assert.equal(report.acceptance, 'observed');
  assert.equal(report.observationsCreated, false);
  assert.deepEqual(report.recordIds, requiredManualIds);
});

test('manual mode fails closed for unresolved, browser, and unreachable attachment evidence', async (t) => {
  const mutations = [
    [
      'unresolved observation',
      (fixture) => {
        fixture.records[0].status = 'planned';
      },
      'authenticode status must be observed',
    ],
    [
      'browser substitution',
      (fixture) => {
        fixture.records[1].provenance.kind = 'browser-observation';
      },
      'browser evidence cannot substitute for packaged evidence',
    ],
    [
      'missing attachment',
      (fixture) => {
        fixture.records[2].attachments = ['attachments/missing.txt'];
      },
      'startup attachment is not reachable',
    ],
    [
      'attachment escape',
      (fixture) => {
        fixture.records[3].attachments = ['../outside.txt'];
      },
      'single-instance attachment must stay beside the manual evidence file',
    ],
  ];

  for (const [name, mutate, expectedDiagnostic] of mutations) {
    await t.test(name, () => {
      const directory = mkdtempSync(join(tmpdir(), 'liiiraa-packaged-manual-mutation-'));
      t.after(() => rmSync(directory, { force: true, recursive: true }));
      const fixture = observedManualEvidence(directory);
      mutate(fixture);
      const manualPath = writeJson(directory, 'manual.json', fixture);

      const result = runCli('--manual', manualPath, '--require-observed');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, new RegExp(expectedDiagnostic, 'u'));
    });
  }
});

test('unsupported CLI combinations fail deterministically', () => {
  const result = runCli('--environment', 'missing.json');

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--environment requires --require-reviewed/u);
});
