import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  AdminAccessReviewRecord,
  AdminApprovalRequest,
  AdminGovernanceCommandResult,
  AdminGovernanceReceipt,
  AdminGovernanceRepositoryPort,
  AdminGovernanceTransaction,
  AdminPermissionImpact,
  PersistedAdminMembership,
} from '@liiiraa/control-plane-application';
import {
  ADMIN_FUNCTION_POLICIES,
  type AdminCapability,
  type AdminDataScope,
  type AdminDelegationState,
  type AdminFunction,
  type AdminGovernedSession,
} from '@liiiraa/control-plane-domain';

import type { ControlPlaneMigrationDatabase, ControlPlaneTransaction } from './database.ts';

const migrationVersion = '0005_admin_governance';
const migrationSql = readFileSync(
  new URL('./migrations/0005_admin_governance.sql', import.meta.url),
  'utf8',
);
export const adminGovernanceSchemaHash = createHash('sha256').update(migrationSql).digest('hex');

const encode = (value: unknown): string =>
  JSON.stringify(value, (_key, item: unknown) => (typeof item === 'bigint' ? String(item) : item));

const decode = (value: unknown): unknown => {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return JSON.parse(serialized, (key, item: unknown) =>
    key.toLowerCase().includes('version') &&
    typeof item === 'string' &&
    /^(?:0|[1-9][0-9]*)$/u.test(item)
      ? BigInt(item)
      : item,
  );
};

const iso = (value: string | Date): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export const migrateAdminGovernance = async (
  database: ControlPlaneMigrationDatabase,
): Promise<Readonly<{ applied: boolean; schemaHash: string; version: string }>> =>
  database.transaction(async (transaction) => {
    await transaction.query(
      `SELECT pg_advisory_xact_lock(hashtext('liiiraa-boost-control-plane-migrations'))`,
    );
    const existing = await transaction.query<{ checksum: string }>(
      `SELECT checksum FROM control_plane_schema_migrations WHERE version = $1`,
      [migrationVersion],
    );
    const applied = existing.rows[0];
    if (applied !== undefined) {
      if (applied.checksum !== adminGovernanceSchemaHash) {
        throw new Error(`Migration ${migrationVersion} checksum does not match reviewed SQL.`);
      }
      return {
        applied: false,
        schemaHash: adminGovernanceSchemaHash,
        version: migrationVersion,
      };
    }
    await transaction.query(migrationSql);
    await transaction.query(
      `INSERT INTO control_plane_schema_migrations (version, checksum) VALUES ($1, $2)`,
      [migrationVersion, adminGovernanceSchemaHash],
    );
    return { applied: true, schemaHash: adminGovernanceSchemaHash, version: migrationVersion };
  });

interface MembershipRow extends Record<string, unknown> {
  readonly id: string;
  readonly identity_id: string;
  readonly status: PersistedAdminMembership['status'];
  readonly strong_factor: PersistedAdminMembership['strongFactor'];
  readonly version: string | number | bigint;
  readonly activated_at: string | Date;
  readonly offboarded_at: string | Date | null;
  readonly offboarding_reason: string | null;
}

type GrantKind = 'capability' | 'function' | 'scope';

const grantTable = Object.freeze({
  capability: 'admin_membership_capabilities',
  function: 'admin_membership_functions',
  scope: 'admin_membership_scopes',
} as const satisfies Readonly<Record<GrantKind, string>>);

const loadGrants = async (
  transaction: ControlPlaneTransaction,
  membershipId: string,
  kind: GrantKind,
): Promise<readonly string[]> => {
  const table = grantTable[kind];
  const result = await transaction.query<{ value: string }>(
    `SELECT ${kind} AS value FROM ${table}
     WHERE membership_id = $1 AND revoked_at IS NULL ORDER BY ${kind}`,
    [membershipId],
  );
  return result.rows.map(({ value }) => value);
};

const loadMembership = async (
  transaction: ControlPlaneTransaction,
  identityId: string,
  lock: boolean,
): Promise<PersistedAdminMembership | null> => {
  const result = await transaction.query<MembershipRow>(
    `SELECT membership.id, membership.identity_id, membership.status, membership.strong_factor,
       membership.version, membership.activated_at, membership.offboarded_at, membership.offboarding_reason
     FROM admin_governance_memberships AS membership
     WHERE membership.identity_id = $1${lock ? ' FOR UPDATE' : ''}`,
    [identityId],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const [functions, capabilities, scopes] = await Promise.all([
    loadGrants(transaction, row.id, 'function'),
    loadGrants(transaction, row.id, 'capability'),
    loadGrants(transaction, row.id, 'scope'),
  ]);
  return {
    membershipId: row.id,
    identityId: row.identity_id,
    status: row.status,
    functions: functions as readonly AdminFunction[],
    strongFactor: row.strong_factor,
    version: BigInt(row.version),
    activatedAt: iso(row.activated_at),
    permissions: {
      functions: functions as readonly AdminFunction[],
      capabilities: capabilities as readonly AdminCapability[],
      scopes: scopes as readonly AdminDataScope[],
    },
    ...(row.offboarded_at === null ? {} : { offboardedAt: iso(row.offboarded_at) }),
    ...(row.offboarding_reason === null ? {} : { offboardingReason: row.offboarding_reason }),
  };
};

const syncGrants = async (
  transaction: ControlPlaneTransaction,
  membershipId: string,
  kind: GrantKind,
  desired: readonly string[],
): Promise<void> => {
  const table = grantTable[kind];
  await transaction.query(
    `UPDATE ${table} SET revoked_at = CURRENT_TIMESTAMP
     WHERE membership_id = $1 AND revoked_at IS NULL AND NOT (${kind} = ANY($2::text[]))`,
    [membershipId, desired],
  );
  await transaction.query(
    `INSERT INTO ${table} (id, membership_id, ${kind}, assigned_at)
     SELECT gen_random_uuid(), $1, desired.value, CURRENT_TIMESTAMP
     FROM unnest($2::text[]) AS desired(value)
     WHERE NOT EXISTS (
       SELECT 1 FROM ${table} AS active
       WHERE active.membership_id = $1 AND active.${kind} = desired.value AND active.revoked_at IS NULL
     )`,
    [membershipId, desired],
  );
};

const saveMembership = async (
  transaction: ControlPlaneTransaction,
  state: PersistedAdminMembership,
): Promise<void> => {
  await transaction.query(
    `INSERT INTO admin_governance_memberships
       (id, identity_id, status, strong_factor, version, activated_at, offboarded_at, offboarding_reason, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, strong_factor = EXCLUDED.strong_factor,
       version = EXCLUDED.version, offboarded_at = EXCLUDED.offboarded_at,
       offboarding_reason = EXCLUDED.offboarding_reason, updated_at = CURRENT_TIMESTAMP
     WHERE admin_governance_memberships.version < EXCLUDED.version`,
    [
      state.membershipId,
      state.identityId,
      state.status,
      state.strongFactor,
      state.version.toString(),
      state.activatedAt,
      state.offboardedAt ?? null,
      state.offboardingReason ?? null,
    ],
  );
  await syncGrants(transaction, state.membershipId, 'function', state.permissions.functions);
  await syncGrants(transaction, state.membershipId, 'capability', state.permissions.capabilities);
  await syncGrants(transaction, state.membershipId, 'scope', state.permissions.scopes);
};

interface SessionRow extends Record<string, unknown> {
  readonly session_id: string;
  readonly identity_id: string;
  readonly active_function: AdminFunction;
  readonly simulation: boolean;
  readonly version: string | number | bigint;
}

const loadSession = async (
  transaction: ControlPlaneTransaction,
  sessionId: string,
): Promise<AdminGovernedSession | null> => {
  const result = await transaction.query<SessionRow>(
    `SELECT governed.session_id, membership.identity_id, governed.active_function,
       governed.simulation, governed.version
     FROM admin_function_sessions AS governed
     INNER JOIN admin_governance_memberships AS membership ON membership.id = governed.membership_id
     WHERE governed.session_id = $1 AND governed.ended_at IS NULL FOR UPDATE`,
    [sessionId],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const policy = ADMIN_FUNCTION_POLICIES[row.active_function];
  return {
    sessionId: row.session_id,
    actorId: row.identity_id,
    activeFunction: row.active_function,
    navigation: [...policy.navigation],
    dataScopes: [...policy.dataScopes],
    capabilities: [...policy.capabilities],
    simulation: row.simulation,
    version: BigInt(row.version),
  };
};

const saveSession = async (
  transaction: ControlPlaneTransaction,
  state: AdminGovernedSession,
): Promise<void> => {
  await transaction.query(
    `WITH ended AS (
       UPDATE admin_function_sessions SET ended_at = CURRENT_TIMESTAMP
       WHERE session_id = $1 AND ended_at IS NULL AND version < $4 RETURNING id
     )
     INSERT INTO admin_function_sessions
       (id, session_id, membership_id, active_function, simulation, version, started_at)
     SELECT $2, $1, membership.id, $3, FALSE, $4, CURRENT_TIMESTAMP
     FROM admin_governance_memberships AS membership
     WHERE membership.identity_id = $5
       AND NOT EXISTS (
         SELECT 1 FROM admin_function_sessions AS active
         WHERE active.session_id = $1 AND active.ended_at IS NULL AND active.version >= $4
       )`,
    [state.sessionId, randomUUID(), state.activeFunction, state.version.toString(), state.actorId],
  );
};

interface DelegationRow extends Record<string, unknown> {
  readonly id: string;
  readonly delegator_id: string;
  readonly delegate_id: string;
  readonly capabilities: readonly string[];
  readonly scopes: readonly string[];
  readonly purpose: string;
  readonly status: AdminDelegationState['status'];
  readonly version: string | number | bigint;
  readonly created_at: string | Date;
  readonly expires_at: string | Date;
  readonly expired_at: string | Date | null;
}

const loadDelegation = async (
  transaction: ControlPlaneTransaction,
  delegationId: string,
): Promise<AdminDelegationState | null> => {
  const result = await transaction.query<DelegationRow>(
    `SELECT * FROM admin_delegations WHERE id = $1 FOR UPDATE`,
    [delegationId],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  return {
    delegationId: row.id,
    delegatorId: row.delegator_id,
    delegateId: row.delegate_id,
    capabilities: row.capabilities,
    scopes: row.scopes,
    purpose: row.purpose,
    status: row.status,
    version: BigInt(row.version),
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    ...(row.expired_at === null ? {} : { expiredAt: iso(row.expired_at) }),
  };
};

const saveDelegation = async (
  transaction: ControlPlaneTransaction,
  state: AdminDelegationState,
): Promise<void> => {
  await transaction.query(
    `INSERT INTO admin_delegations
       (id, delegator_id, delegate_id, capabilities, scopes, purpose, status, version, created_at, expires_at, expired_at, revoked_at)
     VALUES ($1, $2, $3, $4::text[], $5::text[], $6, $7, $8, $9, $10, $11,
       CASE WHEN $7 = 'revoked' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, version = EXCLUDED.version,
       expired_at = EXCLUDED.expired_at, revoked_at = EXCLUDED.revoked_at
     WHERE admin_delegations.version < EXCLUDED.version`,
    [
      state.delegationId,
      state.delegatorId,
      state.delegateId,
      state.capabilities,
      state.scopes,
      state.purpose,
      state.status,
      state.version.toString(),
      state.createdAt,
      state.expiresAt,
      state.expiredAt ?? null,
    ],
  );
};

interface ApprovalRow extends Record<string, unknown> {
  readonly id: string;
  readonly command_id: string;
  readonly author_id: string;
  readonly beneficiary_id: string;
  readonly capability: string;
  readonly scope: string;
  readonly risk: AdminApprovalRequest['risk'];
  readonly status: AdminApprovalRequest['status'];
  readonly assigned_approver_id: string | null;
  readonly version: string | number | bigint;
  readonly created_at: string | Date;
  readonly expires_at: string | Date;
  readonly cancelled_at: string | Date | null;
  readonly approver_id: string | null;
  readonly approved_at: string | Date | null;
}

const loadApproval = async (
  transaction: ControlPlaneTransaction,
  requestId: string,
): Promise<AdminApprovalRequest | null> => {
  const result = await transaction.query<ApprovalRow>(
    `SELECT request.*, decision.approver_id, decision.decided_at AS approved_at
     FROM admin_approval_requests AS request
     LEFT JOIN LATERAL (
       SELECT approver_id, decided_at FROM admin_approval_decisions
       WHERE request_id = request.id AND decision = 'approved'
       ORDER BY decided_at DESC LIMIT 1
     ) AS decision ON TRUE
     WHERE request.id = $1 FOR UPDATE OF request`,
    [requestId],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  return {
    requestId: row.id,
    commandId: row.command_id,
    authorId: row.author_id,
    beneficiaryId: row.beneficiary_id,
    capability: row.capability,
    scope: row.scope,
    risk: row.risk,
    status: row.status,
    version: BigInt(row.version),
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
    ...(row.assigned_approver_id === null ? {} : { assignedApproverId: row.assigned_approver_id }),
    ...(row.approver_id === null ? {} : { approverId: row.approver_id }),
    ...(row.approved_at === null ? {} : { approvedAt: iso(row.approved_at) }),
    ...(row.cancelled_at === null ? {} : { cancelledAt: iso(row.cancelled_at) }),
  };
};

const saveApproval = async (
  transaction: ControlPlaneTransaction,
  state: AdminApprovalRequest,
): Promise<void> => {
  if (state.status === 'approved' && state.approverId !== undefined) {
    await transaction.query(
      `INSERT INTO admin_approval_decisions (id, request_id, approver_id, decision, reason, decided_at)
       VALUES ($1, $2, $3, 'approved', $4, $5) ON CONFLICT (request_id) DO NOTHING`,
      [
        randomUUID(),
        state.requestId,
        state.approverId,
        state.decisionReason ?? 'approved through governance authority',
        state.approvedAt,
      ],
    );
  }
  await transaction.query(
    `INSERT INTO admin_approval_requests
       (id, command_id, author_id, beneficiary_id, capability, scope, risk, status,
        assigned_approver_id, version, created_at, expires_at, cancelled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status,
       assigned_approver_id = EXCLUDED.assigned_approver_id, version = EXCLUDED.version,
       cancelled_at = EXCLUDED.cancelled_at
     WHERE admin_approval_requests.version < EXCLUDED.version`,
    [
      state.requestId,
      state.commandId,
      state.authorId,
      state.beneficiaryId,
      state.capability,
      state.scope,
      state.risk,
      state.status,
      state.assignedApproverId ?? null,
      state.version.toString(),
      state.createdAt,
      state.expiresAt,
      state.cancelledAt ?? null,
    ],
  );
};

const redactedAuditDetails = (event: Readonly<Record<string, unknown>>): string => {
  const allowed = [
    'reason',
    'membershipId',
    'functions',
    'impactId',
    'risk',
    'independentApprovalIds',
    'targetFunction',
    'delegateId',
    'purpose',
    'capability',
    'scope',
    'newApproverId',
    'compromise',
    'effects',
    'governance',
    'reviewId',
    'activeFunction',
    'authorizationContextId',
  ] as const;
  const details: Record<string, unknown> = {};
  for (const key of allowed) {
    if (event[key] !== undefined) details[key] = event[key];
  }
  return encode(details);
};

const transactionPort = (
  transaction: ControlPlaneTransaction,
  subjectId: string,
): AdminGovernanceTransaction => ({
  findCommandResult: async (commandId) => {
    const result = await transaction.query<{ result: unknown }>(
      `SELECT result FROM admin_governance_commands WHERE command_id = $1`,
      [commandId],
    );
    return result.rows[0] === undefined
      ? null
      : (decode(result.rows[0].result) as AdminGovernanceCommandResult);
  },
  rememberCommandResult: async (commandId, result) => {
    await transaction.query(
      `INSERT INTO admin_governance_commands (command_id, subject_id, result)
       VALUES ($1, $2, $3::jsonb) ON CONFLICT (command_id) DO NOTHING`,
      [commandId, subjectId, encode(result)],
    );
  },
  loadMembership: (identityId) => loadMembership(transaction, identityId, true),
  saveMembership: (state) => saveMembership(transaction, state),
  loadSession: (sessionId) => loadSession(transaction, sessionId),
  saveSession: (state) => saveSession(transaction, state),
  loadDelegation: (delegationId) => loadDelegation(transaction, delegationId),
  saveDelegation: (state) => saveDelegation(transaction, state),
  loadApproval: (requestId) => loadApproval(transaction, requestId),
  saveApproval: (state) => saveApproval(transaction, state),
  saveImpact: async (impact: AdminPermissionImpact) => {
    await transaction.query(
      `INSERT INTO admin_permission_impacts
        (id, membership_id, membership_version, before_state, after_state,
         gained_functions, lost_functions, gained_capabilities, lost_capabilities,
         gained_scopes, lost_scopes, projected_at)
       SELECT $1, membership.id, $3, $4::jsonb, $5::jsonb, $6::text[], $7::text[],
         $8::text[], $9::text[], $10::text[], $11::text[], $12
       FROM admin_governance_memberships AS membership WHERE membership.identity_id = $2
       ON CONFLICT (id) DO NOTHING`,
      [
        impact.impactId,
        impact.identityId,
        impact.membershipVersion.toString(),
        encode(impact.before),
        encode(impact.after),
        impact.gainedFunctions,
        impact.lostFunctions,
        impact.gainedCapabilities,
        impact.lostCapabilities,
        impact.gainedScopes,
        impact.lostScopes,
        impact.projectedAt,
      ],
    );
  },
  saveAccessReview: async (review: AdminAccessReviewRecord) => {
    await transaction.query(
      `INSERT INTO admin_access_reviews
        (id, membership_id, reviewer_id, access_class, outcome, reason, reviewed_at, next_review_at)
       SELECT $1, membership.id, $3, $4, $5, $6, $7,
         $7::timestamptz + CASE WHEN $4 = 'critical' THEN INTERVAL '30 days' ELSE INTERVAL '90 days' END
       FROM admin_governance_memberships AS membership WHERE membership.identity_id = $2`,
      [
        review.reviewId,
        review.identityId,
        review.reviewerId,
        review.accessClass,
        review.outcome,
        review.reason,
        review.reviewedAt,
      ],
    );
  },
  revokeSessions: async (identityId, occurredAt) => {
    await transaction.query(
      `UPDATE sessions SET revoked_at = $2, version = version + 1
       WHERE identity_id = $1 AND revoked_at IS NULL`,
      [identityId, occurredAt],
    );
    await transaction.query(
      `UPDATE admin_function_sessions AS governed SET ended_at = $2
       FROM admin_governance_memberships AS membership
       WHERE governed.membership_id = membership.id AND membership.identity_id = $1
         AND governed.ended_at IS NULL`,
      [identityId, occurredAt],
    );
  },
  revokeDelegations: async (identityId, occurredAt) => {
    await transaction.query(
      `UPDATE admin_delegations SET status = 'revoked', revoked_at = $2, version = version + 1
       WHERE status = 'active' AND (delegator_id = $1 OR delegate_id = $1)`,
      [identityId, occurredAt],
    );
  },
  removeFutureApprovals: async (identityId) => {
    await transaction.query(
      `UPDATE admin_approval_requests SET status = 'expired', version = version + 1
       WHERE status = 'pending'
         AND (author_id = $1 OR beneficiary_id = $1 OR assigned_approver_id = $1)`,
      [identityId],
    );
  },
  reassignPendingWork: async (identityId, occurredAt) => {
    const result = await transaction.query<{ work_reference: string }>(
      `INSERT INTO admin_work_reassignments
        (id, membership_id, work_reference, replacement_owner_id, occurred_at)
       SELECT gen_random_uuid(), membership.id, request.id, NULL, $2
       FROM admin_governance_memberships AS membership
       INNER JOIN admin_approval_requests AS request ON request.beneficiary_id = membership.identity_id
       WHERE membership.identity_id = $1 AND request.status = 'pending'
       ON CONFLICT (membership_id, work_reference) DO NOTHING RETURNING work_reference`,
      [identityId, occurredAt],
    );
    return result.rows.map(({ work_reference }) => work_reference);
  },
  appendAudit: async (event) => {
    const auditId = randomUUID();
    await transaction.query(
      `INSERT INTO admin_governance_audit (id, actor_id, subject_id, action, details, occurred_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        auditId,
        String(event['actorId']),
        String(event['subjectId']),
        String(event['action']),
        redactedAuditDetails(event),
        String(event['occurredAt']),
      ],
    );
    if (event['action'] === 'audit-revealed') {
      await transaction.query(
        `INSERT INTO admin_audit_reveals
          (id, actor_id, redacted_target, reason, authorization_context_id, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          randomUUID(),
          String(event['actorId']),
          String(event['subjectId']),
          String(event['reason']),
          String(event['authorizationContextId']),
          String(event['occurredAt']),
        ],
      );
    }
    if (event['action'] === 'identity-offboarded') {
      await transaction.query(
        `INSERT INTO admin_offboarding_events
          (id, membership_id, actor_id, reason, compromised, occurred_at)
         SELECT $1, membership.id, $3::uuid, $4, $5, $6
         FROM admin_governance_memberships AS membership WHERE membership.identity_id = $2::uuid`,
        [
          randomUUID(),
          String(event['subjectId']),
          String(event['actorId']),
          String(event['reason']),
          event['compromise'] === true,
          String(event['occurredAt']),
        ],
      );
    }
    return auditId;
  },
  enqueueOutbox: async (event) => {
    await transaction.query(
      `INSERT INTO outbox_jobs
        (id, topic, aggregate_type, aggregate_id, aggregate_version, payload, available_at)
       VALUES ($1, $2, 'admin-governance', $3, 0, $4::jsonb, $5) ON CONFLICT (id) DO NOTHING`,
      [
        String(event['outboxId']),
        String(event['topic']),
        String(event['subjectId']),
        redactedAuditDetails(event),
        String(event['availableAt']),
      ],
    );
  },
  saveReceipt: async (receipt: AdminGovernanceReceipt) => {
    await transaction.query(
      `INSERT INTO admin_governance_receipts
        (id, command_id, actor_id, subject_id, outcome, audit_reference, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (command_id) DO NOTHING`,
      [
        receipt.receiptId,
        receipt.commandId,
        receipt.actorId,
        receipt.subjectId,
        receipt.outcome,
        receipt.auditReference,
        receipt.occurredAt,
      ],
    );
  },
});

export const createPostgresAdminGovernanceRepository = (
  database: ControlPlaneMigrationDatabase,
): AdminGovernanceRepositoryPort => ({
  loadMembership: (identityId) => loadMembership(database, identityId, false),
  transaction: (subjectId, operation) =>
    database.transaction(async (transaction) => {
      await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `admin-governance:${subjectId}`,
      ]);
      return operation(transactionPort(transaction, subjectId));
    }),
});
