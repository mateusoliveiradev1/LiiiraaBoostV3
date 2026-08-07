import { createHash } from 'node:crypto';
import { chmod, open, rm, type FileHandle } from 'node:fs/promises';
import { isAbsolute, relative, resolve, win32 } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createControlPlaneDatabase,
  createPostgresIdentityPersistence,
  createRealIdentityAuthority,
} from '@liiiraa/control-plane-adapters/runtime-identity';

const INVITATION_LIFETIME_MS = 14 * 86_400_000;
const REJECTION = 'STAGING_INVITATION_PROVISIONING_REJECTED';

export interface StagingInvitationProvisioningEnvironment {
  readonly ACCOUNT_STAGING_ORIGIN?: string;
  readonly STAGING_DATABASE_URL?: string;
  readonly STAGING_INVITATION_EMAILS_JSON?: string;
  readonly STAGING_INVITATION_OUTPUT_PATH?: string;
  readonly STAGING_INVITATION_REPAIR_OUTPUT?: string;
}

export interface ProtectedInvitationOutput {
  abort(): Promise<void>;
  commit(payload: string): Promise<void>;
}

interface ProvisioningDatabase {
  query(
    statement: string,
    values?: readonly unknown[],
  ): Promise<
    Readonly<{ rowCount?: number | null; rows: readonly Readonly<Record<string, unknown>>[] }>
  >;
}

interface InvitationIssuer {
  issueInvitation(
    input: Readonly<{ email: string; expiresAt: string; role: 'tester' }>,
  ): Promise<Readonly<{ expiresAt: string; token: string; tokenDigest: string }>>;
}

interface ProvisioningDependencies {
  readonly clock?: Readonly<{ now(): Date }>;
  readonly database: ProvisioningDatabase;
  readonly invitations: InvitationIssuer;
  readonly openProtectedOutput?: (path: string) => Promise<ProtectedInvitationOutput>;
  readonly repositoryRoot: string;
}

export interface StagingInvitationProvisioningResult {
  readonly created: number;
  readonly skipped: number;
  readonly status: 'complete';
}

const reject = (reason = 'INPUT'): never => {
  const error = new Error(REJECTION) as Error & { code: string };
  error.code = `PROVISION_${reason}`;
  throw error;
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const digestEmail = (value: string): string =>
  createHash('sha256').update(normalizeEmail(value), 'utf8').digest('hex');

const exactHttpsOrigin = (value: string): string => {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.origin !== value ||
      url.pathname !== '/' ||
      url.search.length > 0 ||
      url.hash.length > 0 ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      return reject('ORIGIN');
    }
    return url.origin;
  } catch {
    return reject('ORIGIN');
  }
};

const parseEmails = (value: string | undefined): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(value ?? '');
    if (!Array.isArray(parsed) || parsed.length !== 3) return reject('EMAILS');
    const emails = parsed.map((email) => (typeof email === 'string' ? normalizeEmail(email) : ''));
    if (
      emails.some(
        (email) =>
          email.length === 0 || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email),
      ) ||
      new Set(emails).size !== 3
    ) {
      return reject('EMAILS');
    }
    return emails;
  } catch {
    return reject('EMAILS');
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const repairInvitationOutputPayload = (payload: string, accountOrigin: string): string => {
  const origin = exactHttpsOrigin(accountOrigin);
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return reject('OUTPUT_PAYLOAD');
  }
  if (!isRecord(parsed) || !Array.isArray(parsed['invitations'])) {
    return reject('OUTPUT_PAYLOAD');
  }
  const invitations = parsed['invitations'];
  const invitationRecords = invitations.filter(isRecord);
  if (invitations.length !== 3 || invitationRecords.length !== invitations.length) {
    return reject('OUTPUT_PAYLOAD');
  }
  const normalizedEmails = parseEmails(
    JSON.stringify(invitationRecords.map((invitation) => invitation['email'])),
  );
  const repaired = invitationRecords.map((invitation, index) => {
    const email = normalizedEmails[index];
    const expiresAt = invitation['expiresAt'];
    const invitationUrl = invitation['invitationUrl'];
    if (
      email === undefined ||
      typeof expiresAt !== 'string' ||
      !Number.isFinite(Date.parse(expiresAt)) ||
      typeof invitationUrl !== 'string'
    ) {
      return reject('OUTPUT_PAYLOAD');
    }
    let url: URL;
    try {
      url = new URL(invitationUrl);
    } catch {
      return reject('OUTPUT_PAYLOAD');
    }
    const tokenValues = url.searchParams.getAll('invitation');
    if (
      url.origin !== origin ||
      url.username.length > 0 ||
      url.password.length > 0 ||
      url.hash.length > 0 ||
      (url.pathname !== '/pt-BR/account/sign-up' && url.pathname !== '/pt-BR/register') ||
      url.searchParams.size !== 1 ||
      tokenValues.length !== 1 ||
      !/^[A-Za-z0-9_-]{43,256}$/u.test(tokenValues[0] ?? '')
    ) {
      return reject('OUTPUT_PAYLOAD');
    }
    url.pathname = '/pt-BR/register';
    return {
      email,
      expiresAt,
      invitationUrl: url.toString(),
    };
  });
  return `${JSON.stringify({ invitations: repaired }, null, 2)}\n`;
};

const outputPathOutsideRepository = (
  outputPath: string | undefined,
  repositoryRoot: string,
): string => {
  if (!outputPath) return reject('OUTPUT_PATH');
  const windowsPath = win32.isAbsolute(outputPath);
  if (!windowsPath && !isAbsolute(outputPath)) return reject('OUTPUT_PATH');
  const resolvePath = (value: string): string =>
    windowsPath ? win32.resolve(value) : resolve(value);
  const relativePath = (from: string, to: string): string =>
    windowsPath ? win32.relative(from, to) : relative(from, to);
  const absoluteCheck = (value: string): boolean =>
    windowsPath ? win32.isAbsolute(value) : isAbsolute(value);
  const absoluteOutput = resolvePath(outputPath);
  const absoluteRepository = resolvePath(repositoryRoot);
  const fromRepository = relativePath(absoluteRepository, absoluteOutput);
  if (
    fromRepository === '' ||
    (!fromRepository.startsWith('..') && !absoluteCheck(fromRepository))
  ) {
    return reject('OUTPUT_PATH');
  }
  return absoluteOutput;
};

const protectedFileOutput = async (path: string): Promise<ProtectedInvitationOutput> => {
  let handle: FileHandle | undefined = await open(path, 'wx', 0o600);
  try {
    await chmod(path, 0o600);
  } catch {
    // Windows applies access control through the containing directory and file owner.
  }
  const close = async (): Promise<void> => {
    if (handle !== undefined) {
      await handle.close();
      handle = undefined;
    }
  };
  return {
    async abort() {
      await close();
      await rm(path, { force: true });
    },
    async commit(payload) {
      if (handle === undefined) return reject('OUTPUT_STATE');
      await handle.writeFile(payload, { encoding: 'utf8' });
      await handle.sync();
      await close();
    },
  };
};

export const provisionStagingInvitations = async (
  environment: StagingInvitationProvisioningEnvironment,
  dependencies: ProvisioningDependencies,
): Promise<StagingInvitationProvisioningResult> => {
  const emails = parseEmails(environment.STAGING_INVITATION_EMAILS_JSON);
  const accountOrigin = exactHttpsOrigin(environment.ACCOUNT_STAGING_ORIGIN ?? '');
  const outputPath = outputPathOutsideRepository(
    environment.STAGING_INVITATION_OUTPUT_PATH,
    dependencies.repositoryRoot,
  );
  const now = (dependencies.clock ?? { now: () => new Date() }).now();
  if (!Number.isFinite(now.getTime())) return reject('CLOCK');
  const nowIso = now.toISOString();
  const pending: string[] = [];

  for (const email of emails) {
    const active = await dependencies.database.query(
      `SELECT token_digest FROM identity_invitations
       WHERE email = $1 AND redeemed_at IS NULL AND expires_at > $2
       LIMIT 1`,
      [digestEmail(email), nowIso],
    );
    if ((active.rowCount ?? active.rows.length) === 0) pending.push(email);
  }

  if (pending.length === 0) return { created: 0, skipped: 3, status: 'complete' };

  const output = await (dependencies.openProtectedOutput ?? protectedFileOutput)(outputPath);
  try {
    const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString();
    const invitations = [];
    for (const email of pending) {
      const invitation = await dependencies.invitations.issueInvitation({
        email,
        expiresAt,
        role: 'tester',
      });
      const invitationUrl = new URL('/pt-BR/register', accountOrigin);
      invitationUrl.searchParams.set('invitation', invitation.token);
      invitations.push({
        email,
        expiresAt: invitation.expiresAt,
        invitationUrl: invitationUrl.toString(),
      });
    }
    await output.commit(`${JSON.stringify({ invitations }, null, 2)}\n`);
    return { created: invitations.length, skipped: 3 - invitations.length, status: 'complete' };
  } catch (error) {
    await output.abort();
    throw error;
  }
};

export const repairStagingInvitationOutput = async (
  environment: StagingInvitationProvisioningEnvironment,
  repositoryRoot: string,
): Promise<Readonly<{ repaired: 3; status: 'complete' }>> => {
  const accountOrigin = exactHttpsOrigin(environment.ACCOUNT_STAGING_ORIGIN ?? '');
  const outputPath = outputPathOutsideRepository(
    environment.STAGING_INVITATION_OUTPUT_PATH,
    repositoryRoot,
  );
  const handle = await open(outputPath, 'r+', 0o600);
  try {
    const repaired = repairInvitationOutputPayload(await handle.readFile('utf8'), accountOrigin);
    await handle.truncate(0);
    await handle.write(repaired, 0, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  return { repaired: 3, status: 'complete' };
};

const run = async (): Promise<void> => {
  const environment = process.env as StagingInvitationProvisioningEnvironment;
  if (environment.STAGING_INVITATION_REPAIR_OUTPUT === 'true') {
    const result = await repairStagingInvitationOutput(environment, process.cwd());
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }
  const databaseUrl = environment.STAGING_DATABASE_URL;
  if (!databaseUrl) return reject('DATABASE_URL');
  const database = createControlPlaneDatabase(databaseUrl);
  try {
    const result = await provisionStagingInvitations(environment, {
      database,
      invitations: createRealIdentityAuthority(createPostgresIdentityPersistence(database)),
      repositoryRoot: process.cwd(),
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await database.close();
  }
};

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  run().catch((error: unknown) => {
    const candidate =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as Readonly<{ code?: unknown }>).code)
        : 'UNKNOWN';
    const safeCode = /^[A-Z0-9_]{2,40}$/u.test(candidate) ? candidate : 'UNKNOWN';
    process.stderr.write(`${REJECTION}:${safeCode}\n`);
    process.exitCode = 1;
  });
}
