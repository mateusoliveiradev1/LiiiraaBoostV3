CREATE TABLE IF NOT EXISTS identity_step_up_receipts (
  id UUID PRIMARY KEY,
  receipt_digest CHAR(64) NOT NULL UNIQUE CHECK (receipt_digest ~ '^[0-9a-f]{64}$'),
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  factor_id UUID NOT NULL REFERENCES security_factors(id) ON DELETE RESTRICT,
  authorization_context_id TEXT NOT NULL CHECK (char_length(authorization_context_id) BETWEEN 1 AND 256),
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 256),
  resource TEXT NOT NULL CHECK (char_length(resource) BETWEEN 1 AND 256),
  redacted_target TEXT NOT NULL CHECK (char_length(redacted_target) BETWEEN 1 AND 256),
  verified_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > verified_at),
  CHECK (used_at IS NULL OR used_at >= verified_at)
);

CREATE INDEX IF NOT EXISTS ix_identity_step_up_receipts_active
  ON identity_step_up_receipts (identity_id, session_id, expires_at)
  WHERE used_at IS NULL;

REVOKE UPDATE, DELETE, TRUNCATE ON identity_step_up_receipts FROM PUBLIC;
