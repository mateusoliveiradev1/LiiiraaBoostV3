export type PostgresHarnessStrategy = 'unit' | 'testcontainers' | 'synthetic-url';

export interface PostgresHarnessEnvironment {
  readonly CI?: string;
  readonly POSTGRES_TEST_STRATEGY?: string;
  readonly TEST_DATABASE_URL?: string;
}

export interface PostgresHarness {
  readonly databaseUrl: string | undefined;
  readonly requiresDatabaseDaemon: boolean;
  readonly strategy: PostgresHarnessStrategy;
}

interface ParsedDatabaseUrl {
  readonly hostname: string;
  readonly pathname: string;
  readonly protocol: string;
  readonly username: string;
}

type UrlConstructor = new (value: string) => ParsedDatabaseUrl;

const SYNTHETIC_IDENTITY = /(?:^|[-_])(synthetic|test)(?:[-_]|$)/iu;
const PRODUCTION_IDENTITY = /(?:^|[-_])(live|prod|production)(?:[-_]|$)/iu;
const UNSAFE_DATABASE_MESSAGE =
  'TEST_DATABASE_URL must identify an explicitly synthetic PostgreSQL database.';

const rejectUnsafeDatabase = (): never => {
  throw new Error(UNSAFE_DATABASE_MESSAGE);
};

const parseDatabaseUrl = (databaseUrl: string): ParsedDatabaseUrl => {
  try {
    const constructor = (globalThis as unknown as { readonly URL: UrlConstructor }).URL;
    return new constructor(databaseUrl);
  } catch {
    return rejectUnsafeDatabase();
  }
};

export const requireSyntheticDatabase = (databaseUrl: string): string => {
  if (databaseUrl.trim().length === 0) {
    return rejectUnsafeDatabase();
  }

  const parsed = parseDatabaseUrl(databaseUrl);
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    return rejectUnsafeDatabase();
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//u, ''));
  const identity = [parsed.hostname, parsed.username, databaseName].join('-');
  if (
    databaseName.length === 0 ||
    PRODUCTION_IDENTITY.test(identity) ||
    !SYNTHETIC_IDENTITY.test(identity)
  ) {
    return rejectUnsafeDatabase();
  }

  return databaseUrl;
};

const wantsTestcontainers = (environment: PostgresHarnessEnvironment): boolean =>
  environment.POSTGRES_TEST_STRATEGY === 'unit'
    ? false
    : environment.POSTGRES_TEST_STRATEGY === 'testcontainers' ||
      environment.CI === '1' ||
      environment.CI === 'true';

const readProcessEnvironment = (): PostgresHarnessEnvironment =>
  (globalThis as unknown as { readonly process?: { readonly env?: PostgresHarnessEnvironment } })
    .process?.env ?? {};

export const createPostgresHarness = (
  environment: PostgresHarnessEnvironment = readProcessEnvironment(),
): PostgresHarness => {
  const databaseUrl = environment.TEST_DATABASE_URL?.trim();
  if (databaseUrl !== undefined && databaseUrl.length > 0) {
    return Object.freeze({
      databaseUrl: requireSyntheticDatabase(databaseUrl),
      requiresDatabaseDaemon: false,
      strategy: 'synthetic-url' as const,
    });
  }

  if (wantsTestcontainers(environment)) {
    return Object.freeze({
      databaseUrl: undefined,
      requiresDatabaseDaemon: true,
      strategy: 'testcontainers' as const,
    });
  }

  return Object.freeze({
    databaseUrl: undefined,
    requiresDatabaseDaemon: false,
    strategy: 'unit' as const,
  });
};

export const withSerializableTransactions = async <TTransaction, TResult>(
  database: {
    transaction(): {
      setIsolationLevel(isolationLevel: 'serializable'): {
        execute(
          operation: (transaction: TTransaction) => Promise<TResult> | TResult,
        ): Promise<TResult>;
      };
    };
  },
  operation: (transaction: TTransaction) => Promise<TResult> | TResult,
): Promise<TResult> => database.transaction().setIsolationLevel('serializable').execute(operation);
