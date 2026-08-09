import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { decryptInvitationOutput, encryptInvitationOutput } from './invitation-output-crypto.js';

describe('protected invitation output transport', () => {
  it('removes plaintext after envelope encryption and restores it only with the private key', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'liiiraa-invitation-crypto-'));
    const plaintextPath = join(directory, 'invitations.json');
    const encryptedPath = join(directory, 'invitations.encrypted.json');
    const privateKeyPath = join(directory, 'recovery-private.pem');
    const restoredPath = join(directory, 'restored.json');
    const payload = JSON.stringify({ invitations: [{ invitationUrl: 'https://secret.invalid' }] });
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 3072,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    await writeFile(plaintextPath, payload, { encoding: 'utf8', mode: 0o600 });
    await writeFile(privateKeyPath, privateKey, { encoding: 'utf8', mode: 0o600 });

    await encryptInvitationOutput({
      encryptedPath,
      plaintextPath,
      publicKeyBase64: Buffer.from(publicKey, 'utf8').toString('base64'),
    });

    await expect(stat(plaintextPath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await readFile(encryptedPath, 'utf8')).not.toContain('secret.invalid');

    await decryptInvitationOutput({ encryptedPath, privateKeyPath, plaintextPath: restoredPath });
    expect(await readFile(restoredPath, 'utf8')).toBe(payload);
    if (process.platform !== 'win32') {
      expect((await stat(restoredPath)).mode & 0o777).toBe(0o600);
    }
  });
});
