import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

export interface ControlPlaneDatabaseSchema {
  readonly audit_chain_heads: Record<string, unknown>;
  readonly audit_events: Record<string, unknown>;
  readonly case_messages: Record<string, unknown>;
  readonly deletion_requests: Record<string, unknown>;
  readonly device_bindings: Record<string, unknown>;
  readonly diagnostic_consents: Record<string, unknown>;
  readonly identities: Record<string, unknown>;
  readonly invoices: Record<string, unknown>;
  readonly object_metadata: Record<string, unknown>;
  readonly outbox_jobs: Record<string, unknown>;
  readonly premium_entitlements: Record<string, unknown>;
  readonly provider_inbox: Record<string, unknown>;
  readonly recovery_holds: Record<string, unknown>;
  readonly security_factors: Record<string, unknown>;
  readonly sessions: Record<string, unknown>;
  readonly subscriptions: Record<string, unknown>;
  readonly support_cases: Record<string, unknown>;
}

export interface ControlPlaneQueryResult<
  TRow extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly rowCount: number;
  readonly rows: readonly TRow[];
}

export interface ControlPlaneTransaction {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    statement: string,
    values?: readonly unknown[],
  ): Promise<ControlPlaneQueryResult<TRow>>;
}

export interface ControlPlaneMigrationDatabase extends ControlPlaneTransaction {
  transaction<TResult>(
    operation: (transaction: ControlPlaneTransaction) => Promise<TResult>,
  ): Promise<TResult>;
}

export interface ControlPlaneDatabase extends ControlPlaneMigrationDatabase {
  readonly kysely: Kysely<ControlPlaneDatabaseSchema>;
  close(): Promise<void>;
}

interface PgQueryResult {
  readonly rowCount: number | null;
  readonly rows: readonly Record<string, unknown>[];
}

type PgQueryResponse = PgQueryResult | readonly PgQueryResult[];

interface PgClient {
  query(statement: string, values?: readonly unknown[]): Promise<PgQueryResponse>;
  release(): void;
}

interface PgPool {
  connect(): Promise<PgClient>;
  end(): Promise<void>;
  off(event: 'remove', listener: () => void): void;
  on(event: 'remove', listener: () => void): void;
  query(statement: string, values?: readonly unknown[]): Promise<PgQueryResponse>;
  readonly totalCount: number;
}

export const closePostgresPool = async (
  pool: Pick<PgPool, 'off' | 'on' | 'totalCount'>,
  destroy: () => Promise<void>,
): Promise<void> => {
  let pendingClients = pool.totalCount;
  if (pendingClients === 0) {
    await destroy();
    return;
  }

  let resolveClientShutdown: (() => void) | undefined;
  const clientShutdown = new Promise<void>((resolve) => {
    resolveClientShutdown = resolve;
  });
  const handleClientRemoval = () => {
    pendingClients -= 1;
    if (pendingClients === 0) {
      resolveClientShutdown?.();
    }
  };

  pool.on('remove', handleClientRemoval);
  try {
    await destroy();
    await clientShutdown;
  } finally {
    pool.off('remove', handleClientRemoval);
  }
};

export const normalizePostgresResult = <TRow extends Record<string, unknown>>(
  response: PgQueryResponse,
): ControlPlaneQueryResult<TRow> => {
  const results: readonly PgQueryResult[] = Array.isArray(response) ? response : [response];

  return {
    rowCount: results.reduce((total, result) => total + (result.rowCount ?? result.rows.length), 0),
    rows: results.flatMap(({ rows }) => rows) as readonly TRow[],
  };
};

const queryWith = async <TRow extends Record<string, unknown>>(
  executor: Pick<PgPool, 'query'>,
  statement: string,
  values: readonly unknown[] = [],
): Promise<ControlPlaneQueryResult<TRow>> =>
  normalizePostgresResult<TRow>(await executor.query(statement, values));

export const createControlPlaneDatabase = (databaseUrl: string): ControlPlaneDatabase => {
  if (databaseUrl.trim().length === 0) {
    throw new Error('A PostgreSQL connection URL is required.');
  }

  const pool = new pg.Pool({
    application_name: 'liiiraa-boost-control-plane',
    connectionString: databaseUrl,
    max: 5,
    statement_timeout: 15_000,
  }) as unknown as PgPool;
  const kysely = new Kysely<ControlPlaneDatabaseSchema>({
    dialect: new PostgresDialect({ pool: pool as never }),
  });

  return Object.freeze({
    kysely,
    query: <TRow extends Record<string, unknown>>(
      statement: string,
      values: readonly unknown[] = [],
    ) => queryWith<TRow>(pool, statement, values),
    transaction: async <TResult>(
      operation: (transaction: ControlPlaneTransaction) => Promise<TResult>,
    ): Promise<TResult> => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
        const transaction: ControlPlaneTransaction = Object.freeze({
          query: <TRow extends Record<string, unknown>>(
            statement: string,
            values: readonly unknown[] = [],
          ) => queryWith<TRow>(client, statement, values),
        });
        const result = await operation(transaction);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: async (): Promise<void> => {
      await closePostgresPool(pool, () => kysely.destroy());
    },
  });
};
