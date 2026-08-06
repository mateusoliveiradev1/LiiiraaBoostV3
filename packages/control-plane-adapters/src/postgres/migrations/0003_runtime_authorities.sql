CREATE TABLE stripe_customer_links (
  identity_id UUID PRIMARY KEY REFERENCES identities(id) ON DELETE CASCADE,
  provider_customer_id TEXT NOT NULL UNIQUE CHECK (provider_customer_id LIKE 'cus\_%' ESCAPE '\'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE runtime_aggregates (
  authority TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  aggregate_version BIGINT NOT NULL CHECK (aggregate_version >= 0),
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (authority, aggregate_id)
);

CREATE INDEX ix_runtime_aggregates_identity
  ON runtime_aggregates (identity_id, authority, updated_at DESC);

CREATE TABLE control_plane_command_results (
  authority TEXT NOT NULL,
  command_id TEXT NOT NULL,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (authority, command_id)
);

CREATE INDEX ix_control_plane_command_results_identity
  ON control_plane_command_results (identity_id, authority, created_at DESC);

CREATE TABLE device_transfer_exceptions (
  exception_id TEXT PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  state JSONB NOT NULL,
  aggregate_version BIGINT NOT NULL CHECK (aggregate_version >= 1),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE runtime_audit_receipts (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  authority TEXT NOT NULL,
  event_type TEXT NOT NULL,
  command_id TEXT NOT NULL,
  redacted_target_digest CHAR(64) NOT NULL CHECK (redacted_target_digest ~ '^[0-9a-f]{64}$'),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_runtime_audit_receipts_identity
  ON runtime_audit_receipts (identity_id, occurred_at DESC);

CREATE FUNCTION reject_runtime_audit_mutation() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'runtime_audit_receipts is insert-only';
END;
$$;

CREATE TRIGGER runtime_audit_receipts_insert_only
  BEFORE UPDATE OR DELETE ON runtime_audit_receipts
  FOR EACH ROW EXECUTE FUNCTION reject_runtime_audit_mutation();

CREATE TRIGGER runtime_audit_receipts_reject_truncate
  BEFORE TRUNCATE ON runtime_audit_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION reject_runtime_audit_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON runtime_audit_receipts FROM PUBLIC;
