import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const probeScript = readFileSync(
  fileURLToPath(String(new URL('../src/windows-probe.ps1', import.meta.url))),
  'utf8',
);

describe('Windows physical evidence probe', () => {
  it('keeps the packaged authority alive beyond the complete sampling window', () => {
    expect(probeScript).toContain('$probeDuration = $SampleSeconds + 60');
    expect(probeScript).toContain('$deadlineAt = $collectedAt.AddSeconds($SampleSeconds + 120)');
  });

  it('captures native process diagnostics before reporting an early exit', () => {
    expect(probeScript).toContain('[System.Diagnostics.ProcessStartInfo]::new()');
    expect(probeScript).toContain('$startInfo.UseShellExecute = $false');
    expect(probeScript).toContain('$startInfo.RedirectStandardError = $true');
    expect(probeScript).toContain('Get-ProbeFailureDetail');
    expect(probeScript).toContain('$process.WaitForExit()');
    expect(probeScript).toContain('[string]::Concat($rawContents).Trim()');
  });
});
