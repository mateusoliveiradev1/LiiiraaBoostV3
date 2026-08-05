import { readFile } from 'node:fs/promises';

import { admitStagingRuntime } from '../src/staging-runtime.ts';

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const flag = process.argv[index];
  const value = process.argv[index + 1];
  if (!flag?.startsWith('--') || value === undefined) {
    throw new Error(`Invalid validator argument at position ${index - 1}`);
  }
  values.set(flag, value);
}

const required = (flag) => {
  const value = values.get(flag);
  if (value === undefined || value.length === 0) throw new Error(`Missing ${flag}`);
  return value;
};

const manifestPath = new URL('../staging/internal-channel.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const channel = required('--channel');
const buildId = required('--build-id');
const rollbackBuildId = required('--rollback-build-id');
if (channel !== 'internal' || manifest.channel !== channel) {
  throw new Error('Only the restricted Internal channel is admitted');
}
if (manifest.buildId !== buildId || manifest.rollbackBuildId !== rollbackBuildId) {
  throw new Error('CI build or rollback identity differs from the checked-in manifest');
}

const result = admitStagingRuntime(manifest, {
  apiOrigin: 'https://liiiraa-api-staging.onrender.com',
  apiVersion: 'v1',
  contractVersion: '1.0',
  entitlementKeyIds: ['staging-entitlement-current'],
});
if (!result.ok) throw new Error(`Internal channel rejected: ${result.reason}`);

process.stdout.write(`${result.value.badge} admitted (${result.value.buildId})\n`);
