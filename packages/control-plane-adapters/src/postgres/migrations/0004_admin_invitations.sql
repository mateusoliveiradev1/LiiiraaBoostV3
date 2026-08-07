CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_invitation_capacity (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  active_beta_count INTEGER NOT NULL DEFAULT 0
    CHECK (active_beta_count BETWEEN 0 AND 25),
  version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_invitation_capacity (singleton) VALUES (TRUE)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_invitations (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('beta', 'administrative-team')),
  recipient_digest CHAR(64) NOT NULL
    CHECK (recipient_digest ~ '^[0-9a-f]{64}$'),
  status TEXT NOT NULL
    CHECK (status IN ('queued', 'pending', 'accepted', 'expired', 'declined', 'revoked', 'permanently-bounced')),
  version BIGINT NOT NULL CHECK (version > 0),
  locale TEXT NOT NULL CHECK (locale IN ('en', 'pt-BR')),
  campaign TEXT,
  cohort TEXT,
  note_reference TEXT,
  queue_position BIGINT CHECK (queue_position > 0),
  expires_at TIMESTAMPTZ,
  reminder_count INTEGER NOT NULL DEFAULT 0 CHECK (reminder_count BETWEEN 0 AND 2),
  reminder_window_started_at TIMESTAMPTZ NOT NULL,
  delivery_state TEXT NOT NULL DEFAULT 'not-requested'
    CHECK (delivery_state IN ('not-requested', 'queued', 'delivered', 'failed', 'permanently-bounced')),
  owner_reference TEXT,
  administrative_role TEXT,
  account_reference TEXT,
  closed_at TIMESTAMPTZ,
  retention_state TEXT NOT NULL DEFAULT 'operational'
    CHECK (retention_state IN ('operational', 'retained', 'pseudonymized', 'personal-data-deleted')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CHECK ((status = 'queued') = (queue_position IS NOT NULL)),
  CHECK ((status = 'pending') = (expires_at IS NOT NULL)),
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK ((kind = 'administrative-team') = (administrative_role IS NOT NULL)),
  CHECK ((status IN ('accepted', 'expired', 'declined', 'revoked', 'permanently-bounced')) = (closed_at IS NOT NULL)),
  CHECK ((status = 'accepted') = (account_reference IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_invitations_active_recipient
  ON admin_invitations (recipient_digest)
  WHERE status IN ('queued', 'pending');

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_invitations_queue_position
  ON admin_invitations (queue_position)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS ix_admin_invitations_status_created
  ON admin_invitations (status, created_at, id);

CREATE TABLE IF NOT EXISTS admin_invitation_secrets (
  id UUID PRIMARY KEY,
  invitation_id UUID NOT NULL REFERENCES admin_invitations(id) ON DELETE RESTRICT,
  secret_digest CHAR(64) NOT NULL UNIQUE
    CHECK (secret_digest ~ '^[0-9a-f]{64}$'),
  issued_at TIMESTAMPTZ NOT NULL,
  invalidated_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  CHECK (NOT (invalidated_at IS NOT NULL AND consumed_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_invitation_secrets_one_active
  ON admin_invitation_secrets (invitation_id)
  WHERE invalidated_at IS NULL AND consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS admin_invitation_events (
  invitation_id UUID NOT NULL REFERENCES admin_invitations(id) ON DELETE RESTRICT,
  sequence_number BIGINT NOT NULL CHECK (sequence_number > 0),
  invitation_version BIGINT NOT NULL CHECK (invitation_version > 0),
  event_kind TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  PRIMARY KEY (invitation_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS admin_invitation_commands (
  command_key TEXT PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_invitation_jobs (
  id UUID PRIMARY KEY,
  command_id TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('resend', 'revoke')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'completed-with-failures', 'failed')),
  items JSONB NOT NULL,
  progress JSONB NOT NULL DEFAULT '{"issued":[],"queued":[],"skipped":[],"failed":[]}'::JSONB,
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_invitation_receipts (
  id UUID PRIMARY KEY,
  command_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  results JSONB,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_invitation_audit (
  id UUID PRIMARY KEY,
  actor_digest CHAR(64) NOT NULL CHECK (actor_digest ~ '^[0-9a-f]{64}$'),
  action TEXT NOT NULL,
  command_id TEXT NOT NULL,
  redacted_target TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION reject_admin_invitation_event_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin invitation events are insert-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_invitation_events_insert_only ON admin_invitation_events;
CREATE TRIGGER admin_invitation_events_insert_only
  BEFORE UPDATE OR DELETE ON admin_invitation_events
  FOR EACH ROW EXECUTE FUNCTION reject_admin_invitation_event_mutation();

CREATE OR REPLACE FUNCTION reject_admin_invitation_event_truncate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin invitation events are insert-only';
END;
$$;

DROP TRIGGER IF EXISTS admin_invitation_events_reject_truncate ON admin_invitation_events;
CREATE TRIGGER admin_invitation_events_reject_truncate
  BEFORE TRUNCATE ON admin_invitation_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_admin_invitation_event_truncate();

REVOKE UPDATE, DELETE, TRUNCATE ON admin_invitation_events FROM PUBLIC;

CREATE OR REPLACE FUNCTION enforce_admin_beta_invitation_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  was_active BOOLEAN := TG_OP = 'UPDATE' AND OLD.kind = 'beta' AND OLD.status = 'pending';
  becomes_active BOOLEAN := NEW.kind = 'beta' AND NEW.status = 'pending';
  capacity_count INTEGER;
BEGIN
  IF was_active = becomes_active THEN
    RETURN NEW;
  END IF;
  SELECT active_beta_count INTO capacity_count
    FROM admin_invitation_capacity WHERE singleton = TRUE FOR UPDATE;
  IF becomes_active THEN
    IF capacity_count >= 25 THEN
      RAISE EXCEPTION 'active beta invitation capacity exhausted';
    END IF;
    UPDATE admin_invitation_capacity
      SET active_beta_count = active_beta_count + 1, version = version + 1,
          updated_at = CURRENT_TIMESTAMP WHERE singleton = TRUE;
  ELSE
    UPDATE admin_invitation_capacity
      SET active_beta_count = active_beta_count - 1, version = version + 1,
          updated_at = CURRENT_TIMESTAMP WHERE singleton = TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_invitations_capacity ON admin_invitations;
CREATE TRIGGER admin_invitations_capacity
  BEFORE INSERT OR UPDATE OF status ON admin_invitations
  FOR EACH ROW EXECUTE FUNCTION enforce_admin_beta_invitation_capacity();

CREATE OR REPLACE FUNCTION claim_admin_invitation_jobs(worker_id TEXT, claim_limit INTEGER)
RETURNS SETOF admin_invitation_jobs LANGUAGE sql AS $$
  UPDATE admin_invitation_jobs AS job
    SET status = 'running', locked_at = CURRENT_TIMESTAMP, locked_by = worker_id
  WHERE job.id IN (
    SELECT candidate.id FROM admin_invitation_jobs AS candidate
    WHERE candidate.status = 'queued' AND candidate.available_at <= CURRENT_TIMESTAMP
    ORDER BY candidate.available_at, candidate.id
    FOR UPDATE SKIP LOCKED LIMIT claim_limit
  )
  RETURNING job.*;
$$;

DO $$
BEGIN
  IF to_regclass('identity_invitations') IS NOT NULL THEN
    WITH deduplicated AS (
      SELECT DISTINCT ON (encode(digest(lower(trim(legacy.email)), 'sha256'), 'hex'))
        legacy.*,
        encode(digest(lower(trim(legacy.email)), 'sha256'), 'hex') AS recipient_digest
      FROM identity_invitations AS legacy
      ORDER BY encode(digest(lower(trim(legacy.email)), 'sha256'), 'hex'), legacy.issued_at DESC
    ), ranked AS (
      SELECT
        deduplicated.*,
        CASE
          WHEN deduplicated.role = 'tester'
            AND deduplicated.redeemed_at IS NULL
            AND deduplicated.expires_at > CURRENT_TIMESTAMP
          THEN row_number() OVER (ORDER BY deduplicated.issued_at, deduplicated.id)
          ELSE NULL
        END AS active_beta_rank
      FROM deduplicated
    )
    INSERT INTO admin_invitations (
      id, kind, recipient_digest, status, version, locale, queue_position, expires_at,
      reminder_window_started_at, delivery_state, administrative_role, account_reference,
      closed_at, retention_state, created_at, updated_at
    )
    SELECT
      ranked.id,
      CASE WHEN ranked.role = 'tester' THEN 'beta' ELSE 'administrative-team' END,
      ranked.recipient_digest,
      CASE
        WHEN ranked.redeemed_at IS NOT NULL THEN 'accepted'
        WHEN ranked.expires_at <= CURRENT_TIMESTAMP THEN 'expired'
        WHEN ranked.role = 'tester' AND ranked.active_beta_rank > 25 THEN 'queued'
        ELSE 'pending'
      END,
      1,
      'pt-BR',
      CASE
        WHEN ranked.role = 'tester' AND ranked.active_beta_rank > 25
        THEN ranked.active_beta_rank - 25
        ELSE NULL
      END,
      CASE
        WHEN ranked.redeemed_at IS NULL
          AND ranked.expires_at > CURRENT_TIMESTAMP
          AND NOT (ranked.role = 'tester' AND ranked.active_beta_rank > 25)
        THEN ranked.expires_at
        ELSE NULL
      END,
      ranked.issued_at,
      'not-requested',
      CASE WHEN ranked.role = 'tester' THEN NULL ELSE ranked.role END,
      ranked.redeemed_by::TEXT,
      CASE
        WHEN ranked.redeemed_at IS NOT NULL THEN ranked.redeemed_at
        WHEN ranked.expires_at <= CURRENT_TIMESTAMP THEN ranked.expires_at
        ELSE NULL
      END,
      CASE
        WHEN ranked.redeemed_at IS NULL AND ranked.expires_at > CURRENT_TIMESTAMP
        THEN 'operational'
        ELSE 'retained'
      END,
      ranked.issued_at,
      COALESCE(ranked.redeemed_at, ranked.issued_at)
    FROM ranked
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
