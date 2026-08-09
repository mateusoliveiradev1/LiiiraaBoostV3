import {
  constants,
  createCipheriv,
  createDecipheriv,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';

const AAD = Buffer.from('liiiraa-boost-staging-invitations-v1', 'utf8');
const execFileAsync = promisify(execFile);

interface InvitationEnvelope {
  readonly algorithm: 'RSA-OAEP-3072+AES-256-GCM';
  readonly authTag: string;
  readonly ciphertext: string;
  readonly encryptedKey: string;
  readonly iv: string;
  readonly version: 1;
}

const writeProtected = async (path: string, contents: string | Buffer): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${String(process.pid)}`;
  await writeFile(temporaryPath, contents, { flag: 'wx', mode: 0o600 });
  await rename(temporaryPath, path);
  await chmod(path, 0o600);
  if (process.platform === 'win32') {
    await execFileAsync('icacls.exe', [
      path,
      '/inheritance:r',
      '/grant:r',
      `${userInfo().username}:(F)`,
    ]);
  }
};

export const generateInvitationRecoveryKeyPair = async (input: {
  readonly privateKeyPath: string;
  readonly publicKeyPath: string;
}): Promise<void> => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  await writeProtected(resolve(input.privateKeyPath), privateKey);
  await writeProtected(resolve(input.publicKeyPath), publicKey);
};

export const encryptInvitationOutput = async (input: {
  readonly encryptedPath: string;
  readonly plaintextPath: string;
  readonly publicKeyBase64: string;
}): Promise<void> => {
  const plaintextPath = resolve(input.plaintextPath);
  const encryptedPath = resolve(input.encryptedPath);
  const plaintext = await readFile(plaintextPath);
  const publicKey = Buffer.from(input.publicKeyBase64, 'base64').toString('utf8');
  const contentKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', contentKey, iv);
  cipher.setAAD(AAD);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope: InvitationEnvelope = {
    algorithm: 'RSA-OAEP-3072+AES-256-GCM',
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    encryptedKey: publicEncrypt(
      {
        key: publicKey,
        oaepHash: 'sha256',
        padding: constants.RSA_PKCS1_OAEP_PADDING,
      },
      contentKey,
    ).toString('base64'),
    iv: iv.toString('base64'),
    version: 1,
  };
  await writeProtected(encryptedPath, `${JSON.stringify(envelope)}\n`);
  await rm(plaintextPath, { force: false });
};

export const decryptInvitationOutput = async (input: {
  readonly encryptedPath: string;
  readonly privateKeyPath: string;
  readonly plaintextPath: string;
}): Promise<void> => {
  const candidate = JSON.parse(
    await readFile(resolve(input.encryptedPath), 'utf8'),
  ) as Partial<InvitationEnvelope>;
  if (
    candidate.version !== 1 ||
    candidate.algorithm !== 'RSA-OAEP-3072+AES-256-GCM' ||
    typeof candidate.authTag !== 'string' ||
    typeof candidate.ciphertext !== 'string' ||
    typeof candidate.encryptedKey !== 'string' ||
    typeof candidate.iv !== 'string'
  ) {
    throw new Error('STAGING_INVITATION_ENVELOPE_REJECTED');
  }
  const envelope = candidate as InvitationEnvelope;
  const privateKey = await readFile(resolve(input.privateKeyPath), 'utf8');
  const contentKey = privateDecrypt(
    {
      key: privateKey,
      oaepHash: 'sha256',
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(envelope.encryptedKey, 'base64'),
  );
  const decipher = createDecipheriv('aes-256-gcm', contentKey, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  await writeProtected(resolve(input.plaintextPath), plaintext);
};

const run = async (): Promise<void> => {
  const [mode, first, second, third] = process.argv.slice(2);
  if (mode === 'generate' && first && second && third === undefined) {
    await generateInvitationRecoveryKeyPair({ privateKeyPath: first, publicKeyPath: second });
  } else if (mode === 'encrypt' && first && second && third === undefined) {
    const publicKeyBase64 = process.env['STAGING_INVITATION_RECOVERY_PUBLIC_KEY_B64'];
    if (!publicKeyBase64) throw new Error('STAGING_INVITATION_PUBLIC_KEY_REQUIRED');
    await encryptInvitationOutput({
      plaintextPath: first,
      encryptedPath: second,
      publicKeyBase64,
    });
  } else if (mode === 'decrypt' && first && second && third) {
    await decryptInvitationOutput({
      encryptedPath: first,
      privateKeyPath: second,
      plaintextPath: third,
    });
  } else {
    throw new Error('STAGING_INVITATION_CRYPTO_USAGE');
  }
  process.stdout.write(`${JSON.stringify({ mode, status: 'complete' })}\n`);
};

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  run().catch((error: unknown) => {
    const candidate =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as Readonly<{ code?: unknown }>).code)
        : 'UNKNOWN';
    const safeCode = /^[A-Z0-9_]{2,40}$/u.test(candidate) ? candidate : 'UNKNOWN';
    process.stderr.write(`STAGING_INVITATION_CRYPTO_REJECTED:${safeCode}\n`);
    process.exitCode = 1;
  });
}
