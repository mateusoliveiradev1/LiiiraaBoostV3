import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

import { captureDesktopProduct, verifyDesktopCapture } from './capture-desktop.js';

const serializedArguments = process.env['LIIIRAA_DESKTOP_CAPTURE_ARGS'];
const cliTest = serializedArguments === undefined ? it.skip : it;

cliTest('desktop capture CLI executes an explicit capture or check mode', async () => {
  const arguments_ = JSON.parse(serializedArguments ?? '[]') as string[];
  const capture = arguments_.includes('--capture');
  const check = arguments_.includes('--check');
  expect(capture).not.toBe(check);

  const optionIndex = arguments_.indexOf('--capture-manifest');
  const manifestPath =
    optionIndex === -1 ? 'tooling/web-evidence/capture-manifest.json' : arguments_[optionIndex + 1];
  if (manifestPath === undefined) {
    throw new Error('--capture-manifest requires a path.');
  }
  expect(manifestPath).toBe('tooling/web-evidence/capture-manifest.json');

  const repositoryRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
  const result = capture
    ? await captureDesktopProduct({ manifestPath, repositoryRoot })
    : await verifyDesktopCapture({ manifestPath, repositoryRoot });

  expect(result).toEqual({
    captures: 2,
    diagnostics: [],
    ok: true,
  });
});
