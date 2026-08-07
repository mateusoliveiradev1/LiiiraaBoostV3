CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_governance_environment (
  environment_identity TEXT PRIMARY KEY
    CHECK (environment_identity = 'synthetic-non-production'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_governance_environment (environment_identity)
VALUES ('synthetic-non-production')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_governance_memberships (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL UNIQUE REFERENCES identities(id) ON DELETE RESTRICT,
  environment_identity TEXT NOT NULL DEFAULT 'synthetic-non-production'
    REFERENCES admin_governance_environment(environment_identity) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('active', 'suspended', 'offboarded')),
  strong_factor TEXT NOT NULL CHECK (strong_factor IN ('passkey', 'mfa')),
  version BIGINT NOT NULL CHECK (version > 0),
  activated_at TIMESTAMPTZ NOT NULL,
  offboarded_at TIMESTAMPTZ,
  offboarding_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((status = 'offboarded') = (offboarded_at IS NOT NULL)),
  CHECK ((offboarded_at IS NULL) = (offboarding_reason IS NULL))
);

CREATE TABLE IF NOT EXISTS admin_membership_functions (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  function TEXT NOT NULL CHECK (function IN ('support', 'operations', 'security', 'audit')),
  assigned_at TIMESTAMPTZ NOT NULL,
  assigned_by UUID REFERENCES identities(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_membership_functions_active
  ON admin_membership_functions (membership_id, function)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_membership_capabilities (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  capability TEXT NOT NULL CHECK (capability IN (
    'support:reply', 'support:view', 'device:manage', 'entitlement:correct',
    'session:revoke', 'diagnostics:view', 'audit:reveal-sensitive', 'audit:export'
  )),
  assigned_at TIMESTAMPTZ NOT NULL,
  assigned_by UUID REFERENCES identities(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_membership_capabilities_active
  ON admin_membership_capabilities (membership_id, capability)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_membership_scopes (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  scope TEXT NOT NULL CHECK (scope IN (
    'support-cases', 'devices', 'entitlements', 'sessions',
    'diagnostic-metadata', 'audit-events'
  )),
  assigned_at TIMESTAMPTZ NOT NULL,
  assigned_by UUID REFERENCES identities(id) ON DELETE RESTRICT,
  revoked_at TIMESTAMPTZ,
  CHECK (revoked_at IS NULL OR revoked_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_membership_scopes_active
  ON admin_membership_scopes (membership_id, scope)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_function_sessions (
  id UUID PRIMARY KEY,
  session_id TEXT NOT NULL,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  active_function TEXT NOT NULL CHECK (active_function IN ('support', 'operations', 'security', 'audit')),
  simulation BOOLEAN NOT NULL DEFAULT FALSE CHECK (simulation = FALSE),
  version BIGINT NOT NULL CHECK (version > 0),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_function_sessions_one_active
  ON admin_function_sessions (session_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_admin_function_sessions_membership_active
  ON admin_function_sessions (membership_id, started_at DESC)
  WHERE ended_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_delegations (
  id TEXT PRIMARY KEY,
  delegator_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  delegate_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  capabilities TEXT[] NOT NULL CHECK (cardinality(capabilities) > 0),
  scopes TEXT[] NOT NULL CHECK (cardinality(scopes) > 0),
  purpose TEXT NOT NULL CHECK (char_length(trim(purpose)) > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'revoked')),
  version BIGINT NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  expired_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  CHECK (delegator_id <> delegate_id),
  CHECK (expires_at > created_at),
  CHECK ((status = 'expired') = (expired_at IS NOT NULL)),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_admin_delegations_active_expiry
  ON admin_delegations (expires_at, id)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS admin_permission_impacts (
  id TEXT PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  membership_version BIGINT NOT NULL CHECK (membership_version > 0),
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  gained_functions TEXT[] NOT NULL,
  lost_functions TEXT[] NOT NULL,
  gained_capabilities TEXT[] NOT NULL,
  lost_capabilities TEXT[] NOT NULL,
  gained_scopes TEXT[] NOT NULL,
  lost_scopes TEXT[] NOT NULL,
  projected_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_approval_requests (
  id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  beneficiary_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  capability TEXT NOT NULL,
  scope TEXT NOT NULL,
  risk TEXT NOT NULL CHECK (risk IN ('routine', 'sensitive', 'critical', 'irreversible')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'cancelled', 'expired')),
  assigned_approver_id UUID REFERENCES identities(id) ON DELETE RESTRICT,
  version BIGINT NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  CHECK (expires_at > created_at),
  CHECK (expires_at <= created_at + INTERVAL '15 minutes'),
  CHECK (assigned_approver_id IS NULL OR (
    assigned_approver_id <> author_id AND assigned_approver_id <> beneficiary_id
  )),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_admin_approval_requests_pending_expiry
  ON admin_approval_requests (expires_at, id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS admin_approval_decisions (
  id UUID PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES admin_approval_requests(id) ON DELETE RESTRICT,
  approver_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  decided_at TIMESTAMPTZ NOT NULL,
  UNIQUE (request_id)
);

CREATE TABLE IF NOT EXISTS admin_access_reviews (
  id TEXT PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  reviewer_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  access_class TEXT NOT NULL CHECK (access_class IN ('critical', 'read-only', 'other')),
  outcome TEXT NOT NULL CHECK (outcome IN ('retained', 'suspended')),
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  reviewed_at TIMESTAMPTZ NOT NULL,
  next_review_at TIMESTAMPTZ NOT NULL,
  CHECK (next_review_at = reviewed_at + CASE
    WHEN access_class = 'critical' THEN INTERVAL '30 days'
    ELSE INTERVAL '90 days'
  END)
);

CREATE INDEX IF NOT EXISTS ix_admin_access_reviews_due
  ON admin_access_reviews (next_review_at, membership_id);

CREATE TABLE IF NOT EXISTS admin_inactivity_notices (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('warn', 'suspend')),
  inactivity_days INTEGER NOT NULL CHECK (inactivity_days IN (38, 45, 80, 90)),
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_offboarding_events (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  compromised BOOLEAN NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_work_reassignments (
  id UUID PRIMARY KEY,
  membership_id UUID NOT NULL REFERENCES admin_governance_memberships(id) ON DELETE RESTRICT,
  work_reference TEXT NOT NULL,
  replacement_owner_id UUID REFERENCES identities(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL,
  UNIQUE (membership_id, work_reference)
);

CREATE TABLE IF NOT EXISTS admin_audit_reveals (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  redacted_target TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  authorization_context_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_governance_commands (
  command_id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_governance_receipts (
  id UUID PRIMARY KEY,
  command_id TEXT NOT NULL UNIQUE,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  audit_reference TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_governance_audit (
  id UUID PRIMARY KEY,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION reject_admin_standing_super_admin()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  active_function_count INTEGER;
BEGIN
  IF NEW.revoked_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  SELECT count(DISTINCT assignment.function) INTO active_function_count
  FROM admin_membership_functions AS assignment
  WHERE assignment.membership_id = NEW.membership_id
    AND assignment.revoked_at IS NULL
    AND assignment.id <> NEW.id;
  IF active_function_count >= 3 THEN
    RAISE EXCEPTION 'standing super-admin authority is forbidden';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_membership_functions_reject_super_admin ON admin_membership_functions;
CREATE TRIGGER admin_membership_functions_reject_super_admin
  BEFORE INSERT OR UPDATE OF revoked_at ON admin_membership_functions
  FOR EACH ROW EXECUTE FUNCTION reject_admin_standing_super_admin();

CREATE OR REPLACE FUNCTION reject_admin_self_approval()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  approval admin_approval_requests%ROWTYPE;
BEGIN
  SELECT * INTO approval FROM admin_approval_requests
  WHERE id = NEW.request_id FOR UPDATE;
  IF NOT FOUND OR approval.status <> 'pending' THEN
    RAISE EXCEPTION 'approval request is unavailable';
  END IF;
  IF NEW.approver_id = approval.author_id OR NEW.approver_id = approval.beneficiary_id THEN
    RAISE EXCEPTION 'author or beneficiary cannot approve';
  END IF;
  IF approval.assigned_approver_id IS NOT NULL
    AND NEW.approver_id <> approval.assigned_approver_id THEN
    RAISE EXCEPTION 'approval is assigned to another actor';
  END IF;
  IF approval.expires_at <= NEW.decided_at THEN
    RAISE EXCEPTION 'approval request expired';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_approval_decisions_validate ON admin_approval_decisions;
CREATE TRIGGER admin_approval_decisions_validate
  BEFORE INSERT ON admin_approval_decisions
  FOR EACH ROW EXECUTE FUNCTION reject_admin_self_approval();

CREATE OR REPLACE FUNCTION reject_admin_governance_history_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin governance history is insert-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_governance_audit_insert_only ON admin_governance_audit;
CREATE TRIGGER admin_governance_audit_insert_only
  BEFORE UPDATE OR DELETE ON admin_governance_audit
  FOR EACH ROW EXECUTE FUNCTION reject_admin_governance_history_mutation();

DROP TRIGGER IF EXISTS admin_governance_audit_reject_truncate ON admin_governance_audit;
CREATE TRIGGER admin_governance_audit_reject_truncate
  BEFORE TRUNCATE ON admin_governance_audit
  FOR EACH STATEMENT EXECUTE FUNCTION reject_admin_governance_history_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON admin_governance_audit FROM PUBLIC;

DO $$
BEGIN
  IF to_regclass('identities') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'identities'
        AND column_name = 'role'
    ) THEN
    INSERT INTO admin_governance_memberships (
      id, identity_id, status, strong_factor, version, activated_at, created_at, updated_at
    )
    SELECT identity.id, identity.id, 'active',
      CASE WHEN EXISTS (
        SELECT 1 FROM security_factors AS factor
        WHERE factor.identity_id = identity.id AND factor.factor_kind = 'passkey'
          AND factor.revoked_at IS NULL
      ) THEN 'passkey' ELSE 'mfa' END,
      1, identity.updated_at,
      identity.created_at, identity.updated_at
    FROM identities AS identity
    WHERE identity.role IN ('support', 'operations', 'security', 'audit')
      AND EXISTS (
        SELECT 1 FROM security_factors AS factor
        WHERE factor.identity_id = identity.id
          AND factor.factor_kind IN ('passkey', 'totp') AND factor.revoked_at IS NULL
      )
    ON CONFLICT DO NOTHING;

    INSERT INTO admin_membership_functions (id, membership_id, function, assigned_at)
    SELECT gen_random_uuid(), identity.id, identity.role, identity.updated_at
    FROM identities AS identity
    WHERE identity.role IN ('support', 'operations', 'security', 'audit')
      AND EXISTS (
        SELECT 1 FROM security_factors AS factor
        WHERE factor.identity_id = identity.id
          AND factor.factor_kind IN ('passkey', 'totp') AND factor.revoked_at IS NULL
      )
    ON CONFLICT DO NOTHING;

    INSERT INTO admin_membership_capabilities (id, membership_id, capability, assigned_at)
    SELECT gen_random_uuid(), identity.id, capability.value, identity.updated_at
    FROM identities AS identity
    JOIN LATERAL unnest(CASE identity.role
      WHEN 'support' THEN ARRAY['support:reply', 'support:view']
      WHEN 'operations' THEN ARRAY['device:manage', 'entitlement:correct']
      WHEN 'security' THEN ARRAY['session:revoke', 'diagnostics:view', 'audit:reveal-sensitive']
      WHEN 'audit' THEN ARRAY['audit:export', 'audit:reveal-sensitive']
      ELSE ARRAY[]::TEXT[]
    END) AS capability(value) ON TRUE
    WHERE identity.role IN ('support', 'operations', 'security', 'audit')
      AND EXISTS (
        SELECT 1 FROM security_factors AS factor
        WHERE factor.identity_id = identity.id
          AND factor.factor_kind IN ('passkey', 'totp') AND factor.revoked_at IS NULL
      )
    ON CONFLICT DO NOTHING;

    INSERT INTO admin_membership_scopes (id, membership_id, scope, assigned_at)
    SELECT gen_random_uuid(), identity.id, scope.value, identity.updated_at
    FROM identities AS identity
    JOIN LATERAL unnest(CASE identity.role
      WHEN 'support' THEN ARRAY['support-cases']
      WHEN 'operations' THEN ARRAY['devices', 'entitlements']
      WHEN 'security' THEN ARRAY['sessions', 'diagnostic-metadata']
      WHEN 'audit' THEN ARRAY['audit-events']
      ELSE ARRAY[]::TEXT[]
    END) AS scope(value) ON TRUE
    WHERE identity.role IN ('support', 'operations', 'security', 'audit')
      AND EXISTS (
        SELECT 1 FROM security_factors AS factor
        WHERE factor.identity_id = identity.id
          AND factor.factor_kind IN ('passkey', 'totp') AND factor.revoked_at IS NULL
      )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
