export interface ApiEnvironmentInput {
  readonly STAGING_DATABASE_URL?: string;
  readonly STAGING_DATA_CLASSIFICATION?: string;
  readonly PUBLIC_STAGING_ORIGIN?: string;
  readonly ACCOUNT_STAGING_ORIGIN?: string;
  readonly ADMIN_STAGING_ORIGIN?: string;
  readonly DESKTOP_STAGING_ORIGIN?: string;
  readonly STRIPE_SECRET_KEY?: string;
  readonly STRIPE_WEBHOOK_SECRET?: string;
  readonly AWS_REGION?: string;
  readonly SUPPORT_BUCKET?: string;
  readonly AUDIT_ANCHOR_BUCKET?: string;
  readonly STAGING_BUILD_ID?: string;
  readonly STAGING_INVITATION_ONLY?: string;
  readonly STAGING_PUBLIC_SIGNUP?: string;
  readonly STAGING_CHANNEL?: string;
}

export interface AdmittedApiEnvironment {
  readonly databaseUrl: string;
  readonly dataClassification: 'synthetic';
  readonly origins: readonly [string, string, string, string];
  readonly publicOrigin: string;
  readonly accountOrigin: string;
  readonly adminOrigin: string;
  readonly desktopOrigin: string;
  readonly stripeSecretKey: string;
  readonly stripeWebhookSecret: string;
  readonly awsRegion: string;
  readonly supportBucket: string;
  readonly auditAnchorBucket: string;
  readonly buildId: string;
  readonly invitationOnly: true;
  readonly publicSignup: false;
  readonly channel: 'internal';
}

export interface AdmittedStagingInfrastructureEnvironment {
  readonly buildId: string;
  readonly dataClassification: 'synthetic';
  readonly invitationOnly: true;
  readonly publicSignup: false;
  readonly channel: 'internal';
}

export class ApiEnvironmentAdmissionError extends Error {
  readonly code = 'STAGING_ENVIRONMENT_REJECTED';

  constructor(readonly field: keyof ApiEnvironmentInput) {
    super(`STAGING_ENVIRONMENT_REJECTED:${field}`);
    this.name = 'ApiEnvironmentAdmissionError';
  }
}

const reject = (field: keyof ApiEnvironmentInput): never => {
  throw new ApiEnvironmentAdmissionError(field);
};

const required = (input: ApiEnvironmentInput, field: keyof ApiEnvironmentInput): string => {
  const value = input[field];
  return typeof value === 'string' && value.length > 0 ? value : reject(field);
};

const forbiddenAuthority = /(?:^|[._/-])(?:prod|production|customer|live)(?:$|[._/?-])/iu;
const syntheticAuthority = /(?:^|[._/-])(?:staging|synthetic)(?:$|[._/?-])/iu;

const exactOrigin = (
  input: ApiEnvironmentInput,
  field:
    | 'PUBLIC_STAGING_ORIGIN'
    | 'ACCOUNT_STAGING_ORIGIN'
    | 'ADMIN_STAGING_ORIGIN'
    | 'DESKTOP_STAGING_ORIGIN',
  desktop = false,
): string => {
  const value = required(input, field);
  if (value === '*' || value.includes('*') || /\s/u.test(value)) reject(field);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return reject(field);
  }
  const loopbackDesktop =
    desktop && url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port.length > 0;
  if (
    url.origin !== value ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    (url.protocol !== 'https:' && !loopbackDesktop)
  ) {
    reject(field);
  }
  return value;
};

const syntheticDatabase = (input: ApiEnvironmentInput): string => {
  const value = required(input, 'STAGING_DATABASE_URL');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return reject('STAGING_DATABASE_URL');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname.endsWith('.neon.tech') ||
    forbiddenAuthority.test(value) ||
    !syntheticAuthority.test(value) ||
    url.searchParams.get('sslmode') !== 'require'
  ) {
    reject('STAGING_DATABASE_URL');
  }
  return value;
};

const sandboxStripeKey = (input: ApiEnvironmentInput): string => {
  const value = required(input, 'STRIPE_SECRET_KEY');
  return /^sk_test_[A-Za-z0-9_]+$/u.test(value) ? value : reject('STRIPE_SECRET_KEY');
};

const sandboxWebhookSecret = (input: ApiEnvironmentInput): string => {
  const value = required(input, 'STRIPE_WEBHOOK_SECRET');
  return /^whsec_[A-Za-z0-9_]+$/u.test(value) && !forbiddenAuthority.test(value)
    ? value
    : reject('STRIPE_WEBHOOK_SECRET');
};

const stagingBucket = (
  input: ApiEnvironmentInput,
  field: 'SUPPORT_BUCKET' | 'AUDIT_ANCHOR_BUCKET',
): string => {
  const value = required(input, field);
  if (
    !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u.test(value) ||
    forbiddenAuthority.test(value) ||
    !syntheticAuthority.test(value)
  ) {
    reject(field);
  }
  return value;
};

export const admitApiEnvironment = (input: ApiEnvironmentInput): AdmittedApiEnvironment => {
  if (input.STAGING_DATA_CLASSIFICATION !== 'synthetic') {
    reject('STAGING_DATA_CLASSIFICATION');
  }
  if (input.STAGING_INVITATION_ONLY !== 'true') reject('STAGING_INVITATION_ONLY');
  if (input.STAGING_PUBLIC_SIGNUP !== 'false') reject('STAGING_PUBLIC_SIGNUP');
  if (input.STAGING_CHANNEL !== 'internal') reject('STAGING_CHANNEL');

  const publicOrigin = exactOrigin(input, 'PUBLIC_STAGING_ORIGIN');
  const accountOrigin = exactOrigin(input, 'ACCOUNT_STAGING_ORIGIN');
  const adminOrigin = exactOrigin(input, 'ADMIN_STAGING_ORIGIN');
  const desktopOrigin = exactOrigin(input, 'DESKTOP_STAGING_ORIGIN', true);
  const origins = [publicOrigin, accountOrigin, adminOrigin, desktopOrigin] as const;
  if (new Set(origins).size !== origins.length) reject('PUBLIC_STAGING_ORIGIN');

  const supportBucket = stagingBucket(input, 'SUPPORT_BUCKET');
  const auditAnchorBucket = stagingBucket(input, 'AUDIT_ANCHOR_BUCKET');
  if (supportBucket === auditAnchorBucket) reject('AUDIT_ANCHOR_BUCKET');

  const awsRegion = required(input, 'AWS_REGION');
  if (!/^[a-z]{2}(?:-gov)?-[a-z]+-[1-9][0-9]*$/u.test(awsRegion)) reject('AWS_REGION');
  const buildId = required(input, 'STAGING_BUILD_ID');
  if (!/^[a-z0-9][a-z0-9._-]{7,127}$/u.test(buildId) || forbiddenAuthority.test(buildId)) {
    reject('STAGING_BUILD_ID');
  }

  return Object.freeze({
    databaseUrl: syntheticDatabase(input),
    dataClassification: 'synthetic',
    origins,
    publicOrigin,
    accountOrigin,
    adminOrigin,
    desktopOrigin,
    stripeSecretKey: sandboxStripeKey(input),
    stripeWebhookSecret: sandboxWebhookSecret(input),
    awsRegion,
    supportBucket,
    auditAnchorBucket,
    buildId,
    invitationOnly: true,
    publicSignup: false,
    channel: 'internal',
  });
};

export const admitStagingInfrastructureEnvironment = (
  input: ApiEnvironmentInput,
): AdmittedStagingInfrastructureEnvironment => {
  if (input.STAGING_DATA_CLASSIFICATION !== 'synthetic') {
    reject('STAGING_DATA_CLASSIFICATION');
  }
  if (input.STAGING_INVITATION_ONLY !== 'true') reject('STAGING_INVITATION_ONLY');
  if (input.STAGING_PUBLIC_SIGNUP !== 'false') reject('STAGING_PUBLIC_SIGNUP');
  if (input.STAGING_CHANNEL !== 'internal') reject('STAGING_CHANNEL');
  const buildId = required(input, 'STAGING_BUILD_ID');
  if (!/^[a-z0-9][a-z0-9._-]{7,127}$/u.test(buildId) || forbiddenAuthority.test(buildId)) {
    reject('STAGING_BUILD_ID');
  }
  return Object.freeze({
    buildId,
    dataClassification: 'synthetic',
    invitationOnly: true,
    publicSignup: false,
    channel: 'internal',
  });
};
