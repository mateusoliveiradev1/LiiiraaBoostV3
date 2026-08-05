import { describe, expect, it } from 'vitest';

import { buildApp, REQUIRED_API_MODULES, type ApiModuleRegistrar } from '../app.js';
import { admitApiEnvironment, type ApiEnvironmentInput } from '../config/env.js';
import { issueInvitation, redeemInvitation, type StagingInvitation } from './invitations.js';
import { seedSyntheticStaging } from './seed.js';
import { buildStagingInfrastructureApp } from './infrastructure-server.js';

const baseEnvironment = (): ApiEnvironmentInput => ({
  STAGING_DATABASE_URL:
    'postgresql://staging:synthetic@ep-staging-synthetic.us-east-1.aws.neon.tech/staging?sslmode=require',
  STAGING_DATA_CLASSIFICATION: 'synthetic',
  PUBLIC_STAGING_ORIGIN: 'https://public-staging.example.test',
  ACCOUNT_STAGING_ORIGIN: 'https://account-staging.example.test',
  ADMIN_STAGING_ORIGIN: 'https://admin-staging.example.test',
  DESKTOP_STAGING_ORIGIN: 'http://127.0.0.1:43121',
  STRIPE_SECRET_KEY: 'sk_test_synthetic_only',
  STRIPE_WEBHOOK_SECRET: 'whsec_staging_synthetic_only',
  AWS_REGION: 'us-east-1',
  SUPPORT_BUCKET: 'liiiraa-staging-synthetic-support',
  AUDIT_ANCHOR_BUCKET: 'liiiraa-staging-synthetic-audit-object-lock',
  STAGING_BUILD_ID: 'phase-04-22-test-0001',
  STAGING_INVITATION_ONLY: 'true',
  STAGING_PUBLIC_SIGNUP: 'false',
  STAGING_CHANNEL: 'internal',
});

describe('staging environment admission', () => {
  it('admits only the exact public, account, admin, and desktop origins', () => {
    const admitted = admitApiEnvironment(baseEnvironment());

    expect(admitted.origins).toEqual([
      'https://public-staging.example.test',
      'https://account-staging.example.test',
      'https://admin-staging.example.test',
      'http://127.0.0.1:43121',
    ]);
    expect(admitted.invitationOnly).toBe(true);
    expect(admitted.dataClassification).toBe('synthetic');
  });

  it.each([
    ['missing origin', { ACCOUNT_STAGING_ORIGIN: '' }],
    ['wildcard origin', { PUBLIC_STAGING_ORIGIN: '*' }],
    [
      'production database',
      {
        STAGING_DATABASE_URL:
          'postgresql://app:secret@production.cluster.example.com/customer?sslmode=require',
      },
    ],
    ['non-synthetic classification', { STAGING_DATA_CLASSIFICATION: 'production' }],
    ['live Stripe key', { STRIPE_SECRET_KEY: 'sk_live_real_money' }],
    ['production support bucket', { SUPPORT_BUCKET: 'liiiraa-production-support' }],
    ['production audit bucket', { AUDIT_ANCHOR_BUCKET: 'liiiraa-prod-audit' }],
    ['public signup', { STAGING_PUBLIC_SIGNUP: 'true' }],
    ['non-invited admission', { STAGING_INVITATION_ONLY: 'false' }],
    ['Stable channel', { STAGING_CHANNEL: 'stable' }],
    ['Beta channel', { STAGING_CHANNEL: 'beta' }],
  ])('rejects %s before app composition', (_caseName, override) => {
    expect(() => admitApiEnvironment({ ...baseEnvironment(), ...override })).toThrow(
      /STAGING_ENVIRONMENT_REJECTED/u,
    );
  });
});

describe('synthetic seed and invitation admission', () => {
  it('creates isolated deterministic developer and tester identities without a shared account', () => {
    const input = {
      buildId: 'phase-04-22-test-0001',
      developerEmail: 'developer@example.test',
      testerEmails: ['tester-one@example.test', 'tester-two@example.test'],
    } as const;

    const first = seedSyntheticStaging(input);
    const replay = seedSyntheticStaging(input);

    expect(replay).toEqual(first);
    expect(new Set(first.identities.map(({ accountId }) => accountId)).size).toBe(3);
    expect(new Set(first.identities.map(({ datasetId }) => datasetId)).size).toBe(3);
    expect(first.identities[0]).toMatchObject({
      kind: 'developer',
      premiumTestGrant: true,
      activeAdminRole: null,
    });
    expect(first.identities.slice(1).every(({ premiumTestGrant }) => !premiumTestGrant)).toBe(true);
  });

  it('redeems one unexpired invitation once into one isolated identity and dataset', () => {
    const invitations = new Map<string, StagingInvitation>();
    const invitation = issueInvitation(invitations, {
      code: 'invite-tester-0001',
      email: 'invited-tester@example.test',
      issuedAt: '2026-08-05T12:00:00.000Z',
      expiresAt: '2026-08-06T12:00:00.000Z',
      buildId: 'phase-04-22-test-0001',
    });

    const redeemed = redeemInvitation(invitations, {
      code: invitation.code,
      now: '2026-08-05T13:00:00.000Z',
    });
    expect(redeemed.ok).toBe(true);
    if (redeemed.ok) {
      expect(redeemed.identity.accountId).not.toBe(redeemed.identity.datasetId);
      expect(redeemed.identity.email).toBe('invited-tester@example.test');
    }
    expect(
      redeemInvitation(invitations, {
        code: invitation.code,
        now: '2026-08-05T13:01:00.000Z',
      }),
    ).toEqual({ ok: false, code: 'INVITATION_USED' });
  });

  it('rejects expired invitations without creating authority', () => {
    const invitations = new Map<string, StagingInvitation>();
    issueInvitation(invitations, {
      code: 'invite-expired-0001',
      email: 'expired-tester@example.test',
      issuedAt: '2026-08-05T12:00:00.000Z',
      expiresAt: '2026-08-05T12:30:00.000Z',
      buildId: 'phase-04-22-test-0001',
    });

    expect(
      redeemInvitation(invitations, {
        code: 'invite-expired-0001',
        now: '2026-08-05T13:00:00.000Z',
      }),
    ).toEqual({ ok: false, code: 'INVITATION_EXPIRED' });
  });
});

describe('Fastify staging composition', () => {
  it('starts the bounded provider preview entrypoint without claiming live authority', async () => {
    const app = await buildStagingInfrastructureApp(baseEnvironment());

    await expect(app.inject({ method: 'GET', url: '/health' })).resolves.toMatchObject({
      statusCode: 200,
    });
    const readiness = await app.inject({ method: 'GET', url: '/ready' });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json()).toMatchObject({
      authorityConnected: false,
      buildId: 'phase-04-22-test-0001',
      mode: 'bounded-provider-preview',
      ready: true,
    });
    await app.close();
  });

  it('registers every authority module and exposes health/readiness under Node', async () => {
    const registered: string[] = [];
    const modules: ApiModuleRegistrar[] = REQUIRED_API_MODULES.map((name) => ({
      name,
      register: () => {
        registered.push(name);
        return Promise.resolve();
      },
    }));
    const app = await buildApp({ environment: baseEnvironment(), modules });

    await expect(app.inject({ method: 'GET', url: '/health' })).resolves.toMatchObject({
      statusCode: 200,
    });
    const readiness = await app.inject({ method: 'GET', url: '/ready' });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json()).toMatchObject({
      buildId: 'phase-04-22-test-0001',
      dataClassification: 'synthetic',
      invitationOnly: true,
      ready: true,
    });
    expect(registered).toEqual(REQUIRED_API_MODULES);
    await app.close();
  });

  it('refuses to compose when any authority module is missing', async () => {
    const modules: ApiModuleRegistrar[] = REQUIRED_API_MODULES.slice(1).map((name) => ({
      name,
      register: () => Promise.resolve(),
    }));

    await expect(buildApp({ environment: baseEnvironment(), modules })).rejects.toThrow(
      /API_MODULE_COMPOSITION_REJECTED/u,
    );
  });
});
