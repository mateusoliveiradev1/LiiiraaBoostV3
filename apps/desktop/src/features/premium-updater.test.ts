import { describe, expect, it, vi } from 'vitest';

import { createPremiumUpdater } from './premium-updater.js';

const immediateWait = vi.fn(() => Promise.resolve());

describe('premium updater simulation', () => {
  it('checks a signed manifest through deterministic stages', async () => {
    const updater = createPremiumUpdater(immediateWait);
    const progress: number[] = [];

    const result = await updater.check({
      onProgress: (stage) => progress.push(stage.progress),
    });

    expect(progress).toEqual([18, 48, 76, 100]);
    expect(result).toMatchObject({
      kind: 'available',
      manifest: {
        currentVersion: '0.0.0',
        version: '0.1.0',
      },
    });
  });

  it('reports bounded download progress and completes at 100 percent', async () => {
    const updater = createPremiumUpdater(immediateWait);
    const check = await updater.check();
    if (check.kind !== 'available') {
      throw new Error('expected simulated update');
    }
    const progress: number[] = [];

    await updater.download(check.manifest, {
      onProgress: (update) => progress.push(update.progress),
    });

    expect(progress[0]).toBeGreaterThan(0);
    expect(progress.at(-1)).toBe(100);
    expect(progress.every((value) => value >= 0 && value <= 100)).toBe(true);
  });

  it('honors cancellation without completing a check', async () => {
    const updater = createPremiumUpdater(immediateWait);
    const controller = new AbortController();
    controller.abort();

    await expect(updater.check({ signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('prepares installation without executing an installer', async () => {
    const updater = createPremiumUpdater(immediateWait);

    await expect(updater.prepareInstall()).resolves.toBeUndefined();
  });
});
