import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

type VisualEntry = Readonly<{
  captureId: string;
  snapshotPath: string;
}>;

const visualManifest = JSON.parse(
  readFileSync(new URL('../visual-manifest.json', import.meta.url), 'utf8'),
) as Readonly<{ entries: readonly VisualEntry[] }>;

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli');

describe('candidate capture Playwright selection', () => {
  it('dry-lists exactly one owning project for each W01-W18 and G01-G07 identity', () => {
    const result = spawnSync(
      process.execPath,
      [
        playwrightCli,
        'test',
        'tests/accessibility-responsive.spec.ts',
        '--list',
        '--grep',
        '@candidate-capture',
      ],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        shell: false,
        timeout: 30_000,
      },
    );

    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);

    const listed = result.stdout
      .split(/\r?\n/u)
      .flatMap((line) => {
        const match =
          /^\s*\[([^\]]+)\].*\s([WG]\d{2})\s(?:canonical accessible visual|qualitative review capture)$/u.exec(
            line,
          );
        return match === null || match[1] === undefined || match[2] === undefined
          ? []
          : [{ captureId: match[2], project: match[1] }];
      })
      .sort(({ captureId: left }, { captureId: right }) => left.localeCompare(right));

    const expected = visualManifest.entries
      .map(({ captureId, snapshotPath }) => {
        const match = /\/([WG]\d{2})-(.+)\.png$/u.exec(snapshotPath);
        if (match === null || match[1] === undefined || match[2] === undefined) {
          throw new Error(`Manifest snapshot path must encode ${captureId}'s project.`);
        }
        expect(match[1]).toBe(captureId);
        return { captureId, project: match[2] };
      })
      .sort(({ captureId: left }, { captureId: right }) => left.localeCompare(right));

    expect(visualManifest.entries.map(({ captureId }) => captureId)).toEqual([
      ...Array.from({ length: 18 }, (_, index) => `W${String(index + 1).padStart(2, '0')}`),
      ...Array.from({ length: 7 }, (_, index) => `G${String(index + 1).padStart(2, '0')}`),
    ]);
    expect(listed).toHaveLength(25);
    expect(new Set(listed.map(({ captureId }) => captureId)).size).toBe(25);
    expect(listed).toEqual(expected);
    expect(result.stdout).toMatch(/Total: 25 tests in 1 file/u);
  });
});
