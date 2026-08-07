CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_operational_environments (
  id UUID PRIMARY KEY,
  environment_identity TEXT NOT NULL UNIQUE
    CHECK (environment_identity = 'synthetic-non-production'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_operational_environments (id, environment_identity)
VALUES ('00000000-0000-4000-8000-000000000006', 'synthetic-non-production')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_saved_views (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('official', 'personal')),
  name TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  query_text TEXT NOT NULL DEFAULT '',
  allowed_scopes TEXT[] NOT NULL CHECK (cardinality(allowed_scopes) > 0),
  owner_id TEXT,
  version BIGINT NOT NULL CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, id),
  CHECK (kind = 'official' OR owner_id = actor_id)
);

CREATE TABLE IF NOT EXISTS admin_inbox_items (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  record_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  owner_id TEXT,
  masked_title TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'acknowledged', 'closed')),
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent', 'critical')),
  version BIGINT NOT NULL CHECK (version > 0),
  occurred_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, record_id)
);

CREATE INDEX IF NOT EXISTS ix_admin_inbox_scope_owner_cursor
  ON admin_inbox_items (environment_id, scope, owner_id, occurred_at DESC, record_id);

CREATE TABLE IF NOT EXISTS admin_operational_jobs (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  job_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'queued', 'running', 'paused', 'completed', 'partial', 'failed', 'cancelled'
  )),
  version BIGINT NOT NULL CHECK (version > 0),
  progress INTEGER NOT NULL CHECK (progress BETWEEN 0 AND 100),
  affected_items INTEGER NOT NULL CHECK (affected_items >= 0),
  idempotency_key TEXT NOT NULL CHECK (char_length(trim(idempotency_key)) > 0),
  receipt_id TEXT,
  expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  claim_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, job_id),
  UNIQUE (environment_id, idempotency_key),
  CHECK ((claimed_at IS NULL) = (claimed_by IS NULL)),
  CHECK ((claim_expires_at IS NULL) = (claimed_at IS NULL)),
  CHECK (claim_expires_at IS NULL OR claim_expires_at > claimed_at)
);

CREATE INDEX IF NOT EXISTS ix_admin_operational_jobs_claim
  ON admin_operational_jobs (environment_id, status, claim_expires_at, created_at, job_id)
  WHERE status IN ('queued', 'running', 'partial', 'failed');

CREATE TABLE IF NOT EXISTS admin_operational_job_items (
  environment_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  item_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL CHECK (char_length(trim(idempotency_key)) > 0),
  expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
  version BIGINT NOT NULL CHECK (version > 0),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  claimed_at TIMESTAMPTZ,
  claimed_by TEXT,
  claim_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, item_id),
  UNIQUE (environment_id, idempotency_key),
  UNIQUE (environment_id, job_id, item_reference),
  FOREIGN KEY (environment_id, job_id)
    REFERENCES admin_operational_jobs(environment_id, job_id) ON DELETE RESTRICT,
  CHECK ((claimed_at IS NULL) = (claimed_by IS NULL)),
  CHECK ((claim_expires_at IS NULL) = (claimed_at IS NULL)),
  CHECK (claim_expires_at IS NULL OR claim_expires_at > claimed_at),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_admin_operational_job_items_claim
  ON admin_operational_job_items (environment_id, status, claim_expires_at, created_at, item_id)
  WHERE status IN ('queued', 'failed');

CREATE TABLE IF NOT EXISTS admin_operational_conflicts (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  draft_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
  actual_version BIGINT NOT NULL CHECK (actual_version >= 0),
  local_draft JSONB NOT NULL,
  remote_state JSONB NOT NULL,
  conflicting_fields TEXT[] NOT NULL CHECK (cardinality(conflicting_fields) > 0),
  preserved_at TIMESTAMPTZ NOT NULL,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, draft_id),
  CHECK (retention_expires_at > preserved_at)
);

CREATE TABLE IF NOT EXISTS admin_procedures (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  procedure_version TEXT NOT NULL,
  operation_kind TEXT NOT NULL,
  bounded BOOLEAN NOT NULL CHECK (bounded = TRUE),
  validation_reference TEXT NOT NULL,
  compensation_reference TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  retired_at TIMESTAMPTZ,
  PRIMARY KEY (environment_id, procedure_version),
  CHECK (retired_at IS NULL OR retired_at >= created_at)
);

CREATE TABLE IF NOT EXISTS admin_incidents (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  incident_id TEXT NOT NULL,
  procedure_version TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('normal', 'urgent', 'critical')),
  owner_id TEXT NOT NULL,
  substitute_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'recovery-started', 'recovered', 'closed')),
  version BIGINT NOT NULL CHECK (version > 0),
  started_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, incident_id),
  FOREIGN KEY (environment_id, procedure_version)
    REFERENCES admin_procedures(environment_id, procedure_version) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admin_incident_timeline (
  environment_id UUID NOT NULL,
  event_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  redacted_details JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, event_id),
  FOREIGN KEY (environment_id, incident_id)
    REFERENCES admin_incidents(environment_id, incident_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admin_sensitive_exports (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  export_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (char_length(trim(purpose)) > 0),
  fields TEXT[] NOT NULL CHECK (cardinality(fields) > 0),
  encrypted BOOLEAN NOT NULL CHECK (encrypted = TRUE),
  masked BOOLEAN NOT NULL CHECK (masked = TRUE),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'expired', 'revoked')),
  object_reference TEXT,
  checksum CHAR(64) CHECK (checksum IS NULL OR checksum ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, export_id),
  CHECK (expires_at > created_at),
  CHECK (retention_expires_at >= expires_at)
);

CREATE TABLE IF NOT EXISTS admin_configuration_versions (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  configuration_id TEXT NOT NULL,
  version BIGINT NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'rolling-out', 'paused', 'published', 'rolled-back')),
  cohort TEXT NOT NULL,
  known_version TEXT NOT NULL,
  previous_version BIGINT,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, configuration_id, version),
  CHECK (previous_version IS NULL OR previous_version < version)
);

CREATE INDEX IF NOT EXISTS ix_admin_configuration_current
  ON admin_configuration_versions (environment_id, configuration_id, version DESC);

CREATE TABLE IF NOT EXISTS admin_configuration_rollouts (
  environment_id UUID NOT NULL,
  rollout_id TEXT NOT NULL,
  configuration_id TEXT NOT NULL,
  configuration_version BIGINT NOT NULL,
  cohort TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'paused', 'completed', 'rolled-back')),
  expected_version BIGINT NOT NULL CHECK (expected_version >= 0),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, rollout_id),
  FOREIGN KEY (environment_id, configuration_id, configuration_version)
    REFERENCES admin_configuration_versions(environment_id, configuration_id, version) ON DELETE RESTRICT,
  CHECK (completed_at IS NULL OR started_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS admin_capacity_samples (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  sample_id TEXT NOT NULL,
  resource TEXT NOT NULL CHECK (resource IN ('invitations', 'jobs', 'email', 'database', 'storage', 'provider')),
  current_use BIGINT NOT NULL CHECK (current_use >= 0),
  safe_limit BIGINT NOT NULL CHECK (safe_limit > 0),
  sampled_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, sample_id)
);

CREATE TABLE IF NOT EXISTS admin_capacity_forecasts (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  forecast_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('healthy', 'warning', 'exhausted')),
  forecast_exhaustion_days INTEGER CHECK (forecast_exhaustion_days IS NULL OR forecast_exhaustion_days >= 0),
  early_action_required BOOLEAN NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, forecast_id),
  CHECK (retention_expires_at > calculated_at)
);

CREATE TABLE IF NOT EXISTS admin_ownership_assignments (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  assignment_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  substitute_id TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('normal', 'urgent', 'critical')),
  deadline TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL CHECK (version > 0),
  assigned_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  PRIMARY KEY (environment_id, assignment_id),
  CHECK (ended_at IS NULL OR ended_at >= assigned_at)
);

CREATE TABLE IF NOT EXISTS admin_escalations (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  escalation_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  owner_reference TEXT NOT NULL,
  substitute_reference TEXT NOT NULL,
  severity TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, escalation_id)
);

CREATE TABLE IF NOT EXISTS admin_alerts (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  alert_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  channel_reference TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'acknowledged')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, alert_id)
);

CREATE TABLE IF NOT EXISTS admin_alert_acknowledgements (
  environment_id UUID NOT NULL,
  acknowledgement_id TEXT NOT NULL,
  alert_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, acknowledgement_id),
  UNIQUE (environment_id, alert_id),
  FOREIGN KEY (environment_id, alert_id)
    REFERENCES admin_alerts(environment_id, alert_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS admin_privacy_cases (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  case_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  legal_basis TEXT NOT NULL CHECK (char_length(trim(legal_basis)) > 0),
  status TEXT NOT NULL CHECK (status IN ('execution-pending', 'running', 'completed', 'failed')),
  version BIGINT NOT NULL CHECK (version > 0),
  final_receipt_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, case_id),
  CHECK (retention_expires_at > created_at),
  CHECK ((status = 'completed') = (final_receipt_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS admin_emergency_controls (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  stop_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  capability TEXT NOT NULL CHECK (capability <> '*' AND char_length(trim(capability)) > 0),
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'restored')),
  version BIGINT NOT NULL CHECK (version > 0),
  requested_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  restored_at TIMESTAMPTZ,
  PRIMARY KEY (environment_id, stop_id),
  CHECK (expires_at > requested_at),
  CHECK (expires_at <= requested_at + INTERVAL '30 minutes'),
  CHECK (restored_at IS NULL OR restored_at >= requested_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_emergency_capability_active
  ON admin_emergency_controls (environment_id, capability)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS admin_operations_commands (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  command_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (environment_id, command_id),
  UNIQUE (environment_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS admin_operations_receipts (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  receipt_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  audit_reference TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, receipt_id),
  UNIQUE (environment_id, command_id),
  UNIQUE (environment_id, idempotency_key),
  CHECK (retention_expires_at > occurred_at)
);

CREATE TABLE IF NOT EXISTS admin_operations_audit (
  environment_id UUID NOT NULL REFERENCES admin_operational_environments(id) ON DELETE RESTRICT,
  event_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  action TEXT NOT NULL,
  scope TEXT NOT NULL,
  reason TEXT NOT NULL,
  origin TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  redacted_before TEXT NOT NULL,
  redacted_after TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  retention_expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (environment_id, event_id),
  CHECK (retention_expires_at > occurred_at)
);

CREATE OR REPLACE FUNCTION reject_admin_operations_environment_crossing()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.environment_id <> OLD.environment_id THEN
    RAISE EXCEPTION 'admin operations environment crossing is forbidden';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'admin_saved_views', 'admin_inbox_items', 'admin_operational_jobs',
    'admin_operational_job_items', 'admin_incidents', 'admin_sensitive_exports',
    'admin_configuration_rollouts', 'admin_ownership_assignments', 'admin_alerts',
    'admin_privacy_cases', 'admin_emergency_controls'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS admin_operations_environment_guard ON %I', table_name);
    EXECUTE format(
      'CREATE TRIGGER admin_operations_environment_guard BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION reject_admin_operations_environment_crossing()',
      table_name
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION reject_admin_operations_history_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin operations history is insert-only';
END;
$$;

CREATE TRIGGER admin_operational_conflicts_insert_only
  BEFORE UPDATE OR DELETE ON admin_operational_conflicts
  FOR EACH ROW EXECUTE FUNCTION reject_admin_operations_history_mutation();

CREATE TRIGGER admin_incident_timeline_insert_only
  BEFORE UPDATE OR DELETE ON admin_incident_timeline
  FOR EACH ROW EXECUTE FUNCTION reject_admin_operations_history_mutation();

CREATE TRIGGER admin_operations_receipts_insert_only
  BEFORE UPDATE OR DELETE ON admin_operations_receipts
  FOR EACH ROW EXECUTE FUNCTION reject_admin_operations_history_mutation();

CREATE TRIGGER admin_operations_audit_insert_only
  BEFORE UPDATE OR DELETE ON admin_operations_audit
  FOR EACH ROW EXECUTE FUNCTION reject_admin_operations_history_mutation();

CREATE TRIGGER admin_operations_audit_reject_truncate
  BEFORE TRUNCATE ON admin_operations_audit
  FOR EACH STATEMENT EXECUTE FUNCTION reject_admin_operations_history_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON admin_operational_conflicts FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON admin_incident_timeline FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON admin_operations_receipts FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON admin_operations_audit FROM PUBLIC;

CREATE OR REPLACE FUNCTION claim_admin_operational_job_items(
  selected_environment UUID,
  worker_id TEXT,
  maximum_items INTEGER,
  lease_until TIMESTAMPTZ
)
RETURNS SETOF admin_operational_job_items
LANGUAGE plpgsql AS $$
BEGIN
  IF maximum_items < 1 OR maximum_items > 100 THEN
    RAISE EXCEPTION 'bounded job item claim required';
  END IF;
  RETURN QUERY
  WITH claimable AS (
    SELECT item.environment_id, item.item_id
    FROM admin_operational_job_items AS item
    WHERE item.environment_id = selected_environment
      AND item.status IN ('queued', 'failed')
      AND (item.claim_expires_at IS NULL OR item.claim_expires_at <= CURRENT_TIMESTAMP)
    ORDER BY item.created_at, item.item_id
    LIMIT maximum_items
    FOR UPDATE SKIP LOCKED
  )
  UPDATE admin_operational_job_items AS item
  SET status = 'running', claimed_at = CURRENT_TIMESTAMP, claimed_by = worker_id,
      claim_expires_at = lease_until, attempt_count = item.attempt_count + 1,
      version = item.version + 1, updated_at = CURRENT_TIMESTAMP
  FROM claimable
  WHERE item.environment_id = claimable.environment_id AND item.item_id = claimable.item_id
  RETURNING item.*;
END;
$$;
