export * from './storage/audit-anchor.js';
export * from './storage/consent-stream.js';
export * from './storage/s3-object-lifecycle.js';
export * from './crypto/staging-entitlement-signer.js';
export * from './email/ses-email.js';
export {
  createBetterAuthAdapter,
  createPostgresSessionAuthority,
  type BetterAuthAdapterOptions,
  type BetterAuthGateway,
  type BetterAuthGatewaySession,
  type IdentityRuntimeDependencies,
  type PostgresSessionDatabase,
} from './identity/better-auth-adapter.js';
export {
  createPostgresIdentityPersistence,
  createRealIdentityAuthority,
  digestOpaqueToken,
  hashIdentityPassword,
  migrateRealIdentity,
  realIdentitySchemaHash,
  verifyIdentityPassword,
  type AuthenticationResult,
  type DesktopAuthorizationChallenge,
  type DesktopChallengeRecord,
  type IdentityActor,
  type IdentityLocale,
  type IdentityPersistence,
  type IdentityRecord,
  type IdentityRole,
  type InvitationRecord,
  type PersistedSessionRecord,
} from './postgres/real-identity.js';
