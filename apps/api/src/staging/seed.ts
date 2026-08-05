export interface SyntheticSeedInput {
  readonly buildId: string;
  readonly developerEmail: string;
  readonly testerEmails: readonly string[];
}

export interface SyntheticStagingIdentity {
  readonly kind: 'developer' | 'tester';
  readonly email: string;
  readonly accountId: string;
  readonly datasetId: string;
  readonly deviceId: string;
  readonly premiumTestGrant: boolean;
  readonly activeAdminRole: null;
}

export interface SyntheticStagingSeed {
  readonly buildId: string;
  readonly classification: 'synthetic';
  readonly identities: readonly SyntheticStagingIdentity[];
}

const syntheticEmail = (email: string): string => {
  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.test$/u.test(normalized)) {
    throw new Error('SYNTHETIC_SEED_REJECTED:email');
  }
  return normalized;
};

const stableToken = (value: string): string => {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export const syntheticIdentityFor = (
  buildId: string,
  email: string,
  kind: 'developer' | 'tester',
): SyntheticStagingIdentity => {
  const normalizedEmail = syntheticEmail(email);
  const token = stableToken(`${buildId}:${normalizedEmail}`);
  return Object.freeze({
    kind,
    email: normalizedEmail,
    accountId: `staging-account-${token}`,
    datasetId: `staging-dataset-${token}`,
    deviceId: `staging-device-${token}`,
    premiumTestGrant: kind === 'developer',
    activeAdminRole: null,
  });
};

export const seedSyntheticStaging = (input: SyntheticSeedInput): SyntheticStagingSeed => {
  if (!/^[a-z0-9][a-z0-9._-]{7,127}$/u.test(input.buildId)) {
    throw new Error('SYNTHETIC_SEED_REJECTED:buildId');
  }
  const emails = [input.developerEmail, ...input.testerEmails].map(syntheticEmail);
  if (new Set(emails).size !== emails.length) {
    throw new Error('SYNTHETIC_SEED_REJECTED:shared-account');
  }
  const identities = Object.freeze([
    syntheticIdentityFor(input.buildId, emails[0] ?? '', 'developer'),
    ...emails.slice(1).map((email) => syntheticIdentityFor(input.buildId, email, 'tester')),
  ]);
  return Object.freeze({
    buildId: input.buildId,
    classification: 'synthetic',
    identities,
  });
};
