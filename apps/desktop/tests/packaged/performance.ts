import { spawnSync } from 'node:child_process';

import { executeScript, type PackagedSession } from './journeys.ts';

export type PerformanceResult = Readonly<{
  domResponseMs: number;
  openUiWithinBudget: boolean;
  processWorkingSetBytes: number | null;
  startupMs: number;
  startupWithinBudget: boolean;
}>;

const fail = (message: string): never => {
  throw new Error(`[packaged-performance] ${message}`);
};

const readWorkingSet = (): number | null => {
  const script = [
    '$process = Get-Process -Name liiiraa-desktop -ErrorAction SilentlyContinue |',
    'Sort-Object WorkingSet64 -Descending | Select-Object -First 1;',
    'if ($null -eq $process) { "null" } else { [string]$process.WorkingSet64 }',
  ].join(' ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    shell: false,
    timeout: 10_000,
    windowsHide: true,
  });
  const value = Number(result.stdout.trim());
  return result.status === 0 && Number.isFinite(value) && value > 0 ? value : null;
};

export const measurePackagedPerformance = async (
  session: PackagedSession,
  startupMs: number,
): Promise<PerformanceResult> => {
  const started = performance.now();
  const domReady = await executeScript<boolean>(
    session,
    "return document.readyState === 'complete' && !!document.querySelector('.desktop-app-shell');",
  );
  const domResponseMs = performance.now() - started;
  if (!domReady) {
    fail('desktop shell was not ready during the response measurement.');
  }
  const processWorkingSetBytes = readWorkingSet();
  const result: PerformanceResult = Object.freeze({
    domResponseMs,
    openUiWithinBudget:
      processWorkingSetBytes !== null && processWorkingSetBytes <= 250 * 1024 * 1024,
    processWorkingSetBytes,
    startupMs,
    startupWithinBudget: startupMs <= 2_000,
  });
  if (domResponseMs > 250) {
    fail(`DOM response exceeded 250 ms (${domResponseMs.toFixed(1)} ms).`);
  }
  if (!result.openUiWithinBudget) {
    fail('open UI working set is unavailable or exceeds 250 MB.');
  }
  return result;
};
