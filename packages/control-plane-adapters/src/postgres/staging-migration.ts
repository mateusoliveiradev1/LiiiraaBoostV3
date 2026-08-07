import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createControlPlaneDatabase, type ControlPlaneDatabase } from './database.ts';
import { migrateAdminAuthorityGrants } from './admin-authority-grants.ts';
import { migrateAdminGovernance } from './admin-governance.ts';
import { migrateAdminInvitations } from './admin-invitations.ts';
import { migrateAdminOperations } from './admin-operations.ts';
import { migrateIdentityStrongAuth } from './identity-strong-auth.ts';
import {
  inspectControlPlaneSchema,
  migrateControlPlane,
  type ControlPlaneMigrationResult,
  type ControlPlaneSchemaInspection,
} from './migrate.ts';
import { migrateRealIdentity } from './real-identity.ts';
import { migrateRuntimeAuthorities } from './runtime-authorities.ts';

export const STAGING_MIGRATION_VERSIONS = Object.freeze([
  '0001_control_plane',
  '0002_real_identity',
  '0003_runtime_authorities',
  '0004_admin_invitations',
  '0005_admin_governance',
  '0006_admin_operations',
  '0007_identity_strong_auth',
  '0008_admin_authority_grants',
] as const);

const forbiddenAuthority = /(?:^|[._/-])(?:prod|production|customer|live)(?:$|[._/?-])/iu;
const stagingAuthority = /(?:^|[._/-])(?:staging|synthetic)(?:$|[._/?-])/iu;

export class StagingMigrationAdmissionError extends Error {
  readonly code = 'STAGING_MIGRATION_DATABASE_REJECTED';

  constructor() {
    super('STAGING_MIGRATION_DATABASE_REJECTED');
    this.name = 'StagingMigrationAdmissionError';
  }
}

const rejectDatabase = (): never => {
  throw new StagingMigrationAdmissionError();
};

export const requireStagingDatabaseUrl = (value: string | undefined): string => {
  if (value === undefined || value.length === 0 || /\s/u.test(value)) {
    return rejectDatabase();
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return rejectDatabase();
  }

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname.endsWith('.neon.tech') ||
    url.username.length === 0 ||
    url.pathname === '/' ||
    url.searchParams.get('sslmode') !== 'require' ||
    forbiddenAuthority.test(value) ||
    !stagingAuthority.test(value)
  ) {
    return rejectDatabase();
  }

  return value;
};

export interface StagingMigrationReport {
  readonly applied: boolean;
  readonly schemaHash: string;
  readonly tableCount: number;
  readonly version: string;
}

interface StagingMigrationDependencies {
  readonly createDatabase: (databaseUrl: string) => ControlPlaneDatabase;
  readonly inspect: (database: ControlPlaneDatabase) => Promise<ControlPlaneSchemaInspection>;
  readonly migrate: (database: ControlPlaneDatabase) => Promise<ControlPlaneMigrationResult>;
}

const migrateStagingAuthority = async (
  database: ControlPlaneDatabase,
): Promise<ControlPlaneMigrationResult> => {
  const controlPlane = await migrateControlPlane(database);
  const identity = await migrateRealIdentity(database);
  const runtimeAuthorities = await migrateRuntimeAuthorities(database);
  const adminInvitations = await migrateAdminInvitations(database);
  const adminGovernance = await migrateAdminGovernance(database);
  const adminOperations = await migrateAdminOperations(database);
  const identityStrongAuth = await migrateIdentityStrongAuth(database);
  const adminAuthorityGrants = await migrateAdminAuthorityGrants(database);
  return Object.freeze({
    applied:
      controlPlane.applied ||
      identity.applied ||
      runtimeAuthorities.applied ||
      adminInvitations.applied ||
      adminGovernance.applied ||
      adminOperations.applied ||
      identityStrongAuth.applied ||
      adminAuthorityGrants.applied,
    schemaHash: adminAuthorityGrants.schemaHash,
    version: adminAuthorityGrants.version,
  });
};

const inspectStagingAuthority = async (
  database: ControlPlaneDatabase,
): Promise<ControlPlaneSchemaInspection> => {
  const inspection = await inspectControlPlaneSchema(database);
  const latestMigration = await database.query<{ checksum: string }>(
    `SELECT checksum
     FROM control_plane_schema_migrations
     WHERE version = $1`,
    [STAGING_MIGRATION_VERSIONS.at(-1)],
  );
  return Object.freeze({
    ...inspection,
    schemaHash: latestMigration.rows[0]?.checksum,
  });
};

const defaultDependencies: StagingMigrationDependencies = Object.freeze({
  createDatabase: createControlPlaneDatabase,
  inspect: inspectStagingAuthority,
  migrate: migrateStagingAuthority,
});

export const runStagingMigration = async (
  databaseUrl: string | undefined,
  dependencies: StagingMigrationDependencies = defaultDependencies,
): Promise<StagingMigrationReport> => {
  const admittedUrl = requireStagingDatabaseUrl(databaseUrl);
  const database = dependencies.createDatabase(admittedUrl);

  try {
    const migration = await dependencies.migrate(database);
    const inspection = await dependencies.inspect(database);
    if (inspection.schemaHash !== migration.schemaHash) {
      throw new Error('STAGING_MIGRATION_SCHEMA_INSPECTION_FAILED');
    }

    return Object.freeze({
      applied: migration.applied,
      schemaHash: migration.schemaHash,
      tableCount: inspection.tables.length,
      version: migration.version,
    });
  } finally {
    await database.close();
  }
};

interface MigrationRuntime {
  readonly argv?: readonly string[];
  readonly env?: Readonly<Record<string, string | undefined>>;
  exitCode?: number;
}

const runtime = (globalThis as unknown as { readonly process?: MigrationRuntime }).process;
const invokedPath = runtime?.argv?.[1];
const isDirectInvocation =
  invokedPath !== undefined && pathToFileURL(resolve(invokedPath)).href === import.meta.url;

if (isDirectInvocation) {
  try {
    const report = await runStagingMigration(runtime?.env?.['STAGING_DATABASE_URL']);
    console.log(JSON.stringify(report));
  } catch {
    console.error('STAGING_MIGRATION_FAILED');
    if (runtime !== undefined) runtime.exitCode = 1;
  }
}
