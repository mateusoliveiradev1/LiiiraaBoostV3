import { describe, expect, it, vi } from 'vitest';

import type { ControlPlaneDatabase } from './database.ts';
import {
  requireStagingDatabaseUrl,
  runStagingMigration,
  StagingMigrationAdmissionError,
} from './staging-migration.ts';

const stagingUrl =
  'postgresql://staging_owner:synthetic-secret@ep-liiiraa-staging.us-east-1.aws.neon.tech/liiiraa_staging?sslmode=require';

describe('staging migration database admission', () => {
  it('admits an explicitly staging Neon database with required TLS', () => {
    expect(requireStagingDatabaseUrl(stagingUrl)).toBe(stagingUrl);
  });

  it.each([
    undefined,
    '',
    'postgresql://owner:secret@ep-example.neon.tech/neondb?sslmode=require',
    'postgresql://owner:secret@ep-live.neon.tech/liiiraa_staging?sslmode=require',
    'postgresql://owner:secret@example.test/liiiraa_staging?sslmode=require',
    'postgresql://owner:secret@ep-staging.neon.tech/liiiraa_staging?sslmode=disable',
  ])('rejects a database without the complete staging authority: %s', (candidate) => {
    expect(() => requireStagingDatabaseUrl(candidate)).toThrow(StagingMigrationAdmissionError);
  });
});

describe('staging migration execution', () => {
  it('migrates, inspects, returns bounded metadata, and closes the database', async () => {
    const close = vi.fn(() => Promise.resolve());
    const database = { close } as unknown as ControlPlaneDatabase;
    const createDatabase = vi.fn(() => database);
    const migrate = vi.fn(() =>
      Promise.resolve({
        applied: true,
        schemaHash: 'a'.repeat(64),
        version: '0001_control_plane',
      }),
    );
    const inspect = vi.fn(() =>
      Promise.resolve({
        columns: [],
        indexes: [],
        publicAuditPrivileges: [],
        schemaHash: 'a'.repeat(64),
        tables: ['identities', 'sessions'],
        triggers: [],
      }),
    );

    await expect(
      runStagingMigration(stagingUrl, { createDatabase, inspect, migrate }),
    ).resolves.toEqual({
      applied: true,
      schemaHash: 'a'.repeat(64),
      tableCount: 2,
      version: '0001_control_plane',
    });
    expect(createDatabase).toHaveBeenCalledWith(stagingUrl);
    expect(migrate).toHaveBeenCalledWith(database);
    expect(inspect).toHaveBeenCalledWith(database);
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes the database when migration application fails', async () => {
    const close = vi.fn(() => Promise.resolve());
    const database = { close } as unknown as ControlPlaneDatabase;

    await expect(
      runStagingMigration(stagingUrl, {
        createDatabase: () => database,
        inspect: vi.fn(),
        migrate: vi.fn(() => Promise.reject(new Error('synthetic interruption'))),
      }),
    ).rejects.toThrow(/synthetic interruption/iu);
    expect(close).toHaveBeenCalledOnce();
  });
});
