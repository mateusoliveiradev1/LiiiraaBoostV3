CREATE TABLE identities (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  password_hash TEXT,
  locale TEXT NOT NULL DEFAULT 'pt-BR',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'locked', 'deletion-pending', 'deleted')),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (password_hash IS NULL OR char_length(password_hash) >= 20)
);

CREATE UNIQUE INDEX uq_identities_normalized_email ON identities (lower(email));

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  provider_session_id TEXT NOT NULL UNIQUE,
  session_kind TEXT NOT NULL CHECK (session_kind IN ('web', 'desktop', 'admin')),
  token_digest CHAR(64) NOT NULL CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > issued_at)
);

CREATE INDEX ix_sessions_identity_active
  ON sessions (identity_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE security_factors (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  factor_kind TEXT NOT NULL CHECK (factor_kind IN ('totp', 'passkey', 'recovery-code')),
  credential_reference TEXT NOT NULL,
  public_material BYTEA,
  encrypted_secret BYTEA,
  verified_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (identity_id, factor_kind, credential_reference),
  CHECK (public_material IS NOT NULL OR encrypted_secret IS NOT NULL)
);

CREATE TABLE recovery_holds (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  recovery_route TEXT NOT NULL CHECK (recovery_route IN ('verified-email', 'recovery-code', 'security-review')),
  status TEXT NOT NULL CHECK (status IN ('active', 'contested', 'released', 'expired')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  contested_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ends_at > starts_at)
);

CREATE INDEX ix_recovery_holds_identity_active
  ON recovery_holds (identity_id, ends_at)
  WHERE status IN ('active', 'contested');

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_customer_id TEXT NOT NULL,
  provider_subscription_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past-due', 'grace', 'canceled', 'expired')),
  currency CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, provider_subscription_id),
  CHECK (current_period_end > current_period_start)
);

CREATE INDEX ix_subscriptions_identity_status ON subscriptions (identity_id, status);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_invoice_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible', 'refunded')),
  currency CHAR(3) NOT NULL CHECK (currency = upper(currency)),
  amount_total_minor BIGINT NOT NULL CHECK (amount_total_minor >= 0),
  amount_paid_minor BIGINT NOT NULL DEFAULT 0 CHECK (amount_paid_minor >= 0),
  provider_created_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (provider, provider_invoice_id),
  CHECK (amount_paid_minor <= amount_total_minor)
);

CREATE TABLE provider_inbox (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_digest CHAR(64) NOT NULL CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processing_state TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_state IN ('received', 'processing', 'processed', 'retryable', 'rejected')),
  aggregate_type TEXT,
  aggregate_id UUID,
  aggregate_version BIGINT CHECK (aggregate_version IS NULL OR aggregate_version >= 0),
  processed_at TIMESTAMPTZ,
  error_code TEXT,
  UNIQUE (provider, provider_event_id),
  CHECK ((aggregate_type IS NULL) = (aggregate_id IS NULL))
);

CREATE INDEX ix_provider_inbox_claim
  ON provider_inbox (processing_state, received_at)
  WHERE processing_state IN ('received', 'retryable');

CREATE TABLE outbox_jobs (
  id UUID PRIMARY KEY,
  topic TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_version BIGINT NOT NULL CHECK (aggregate_version >= 0),
  payload JSONB NOT NULL,
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  completed_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((locked_at IS NULL) = (locked_by IS NULL))
);

CREATE INDEX ix_outbox_jobs_claim
  ON outbox_jobs (available_at, created_at)
  WHERE completed_at IS NULL AND locked_at IS NULL;

CREATE TABLE premium_entitlements (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'revoked')),
  source TEXT NOT NULL CHECK (source IN ('subscription', 'support-exception', 'promotion')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  offline_valid_until TIMESTAMPTZ,
  version BIGINT NOT NULL CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (offline_valid_until IS NULL OR offline_valid_until >= valid_from)
);

CREATE INDEX ix_premium_entitlements_identity_status
  ON premium_entitlements (identity_id, status);

CREATE TABLE device_bindings (
  id UUID PRIMARY KEY,
  premium_entitlement_id UUID NOT NULL REFERENCES premium_entitlements(id) ON DELETE RESTRICT,
  device_digest CHAR(64) NOT NULL CHECK (device_digest ~ '^[0-9a-f]{64}$'),
  wrapped_evidence BYTEA,
  display_label TEXT,
  bound_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replacement_available_at TIMESTAMPTZ,
  version BIGINT NOT NULL CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (replacement_available_at IS NULL OR replacement_available_at >= bound_at)
);

CREATE UNIQUE INDEX uq_device_bindings_one_active_per_entitlement
  ON device_bindings (premium_entitlement_id)
  WHERE revoked_at IS NULL;

CREATE INDEX ix_device_bindings_digest ON device_bindings (device_digest);

CREATE TABLE support_cases (
  id UUID PRIMARY KEY,
  identity_id UUID REFERENCES identities(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'awaiting-customer', 'awaiting-support', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  subject TEXT NOT NULL,
  assigned_role TEXT,
  resolved_at TIMESTAMPTZ,
  retain_until TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_support_cases_identity_created ON support_cases (identity_id, created_at DESC);
CREATE INDEX ix_support_cases_retention ON support_cases (retain_until);

CREATE TABLE case_messages (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  author_identity_id UUID REFERENCES identities(id) ON DELETE SET NULL,
  author_kind TEXT NOT NULL CHECK (author_kind IN ('customer', 'support', 'system')),
  body_ciphertext BYTEA NOT NULL,
  encryption_key_reference TEXT NOT NULL,
  retain_until TIMESTAMPTZ NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_case_messages_case_created ON case_messages (case_id, created_at);
CREATE INDEX ix_case_messages_retention ON case_messages (retain_until);

CREATE TABLE diagnostic_consents (
  id UUID PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE CASCADE,
  consent_scope TEXT NOT NULL CHECK (consent_scope IN ('single-package', 'case-session')),
  access_reason TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > granted_at)
);

CREATE INDEX ix_diagnostic_consents_active
  ON diagnostic_consents (case_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE object_metadata (
  id UUID PRIMARY KEY,
  case_id UUID REFERENCES support_cases(id) ON DELETE SET NULL,
  bucket_class TEXT NOT NULL CHECK (bucket_class IN ('support-attachment', 'diagnostic-package', 'audit-anchor')),
  object_key TEXT NOT NULL,
  content_digest CHAR(64) NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  encryption_key_reference TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  retain_until TIMESTAMPTZ NOT NULL,
  legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (bucket_class, object_key)
);

CREATE INDEX ix_object_metadata_retention
  ON object_metadata (retain_until)
  WHERE deleted_at IS NULL AND legal_hold = FALSE;

CREATE TABLE audit_chain_heads (
  stream_id TEXT PRIMARY KEY,
  last_sequence BIGINT NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  last_hash CHAR(64) NOT NULL CHECK (last_hash ~ '^[0-9a-f]{64}$'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  stream_id TEXT NOT NULL REFERENCES audit_chain_heads(stream_id) ON DELETE RESTRICT,
  sequence_number BIGINT NOT NULL CHECK (sequence_number >= 1),
  event_type TEXT NOT NULL,
  actor_kind TEXT NOT NULL CHECK (actor_kind IN ('customer', 'support', 'operations', 'security', 'audit', 'system')),
  actor_reference_digest CHAR(64) CHECK (actor_reference_digest ~ '^[0-9a-f]{64}$'),
  subject_reference_digest CHAR(64) CHECK (subject_reference_digest ~ '^[0-9a-f]{64}$'),
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  previous_hash CHAR(64) NOT NULL CHECK (previous_hash ~ '^[0-9a-f]{64}$'),
  event_hash CHAR(64) NOT NULL CHECK (event_hash ~ '^[0-9a-f]{64}$'),
  correction_of UUID REFERENCES audit_events(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (stream_id, sequence_number),
  UNIQUE (stream_id, event_hash)
);

CREATE FUNCTION enforce_audit_chain_append() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  head audit_chain_heads%ROWTYPE;
BEGIN
  SELECT * INTO head
  FROM audit_chain_heads
  WHERE stream_id = NEW.stream_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'audit chain head is required before appending';
  END IF;
  IF NEW.sequence_number <> head.last_sequence + 1 THEN
    RAISE EXCEPTION 'audit sequence is not contiguous';
  END IF;
  IF NEW.previous_hash <> head.last_hash THEN
    RAISE EXCEPTION 'audit previous hash does not match chain head';
  END IF;

  UPDATE audit_chain_heads
  SET last_sequence = NEW.sequence_number,
      last_hash = NEW.event_hash,
      version = version + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE stream_id = NEW.stream_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_events_chain_append
  BEFORE INSERT ON audit_events
  FOR EACH ROW EXECUTE FUNCTION enforce_audit_chain_append();

CREATE FUNCTION reject_audit_event_mutation() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is insert-only; append a correction event instead';
END;
$$;

CREATE TRIGGER audit_events_insert_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

CREATE TRIGGER audit_events_reject_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION reject_audit_event_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC;

CREATE TABLE deletion_requests (
  id UUID PRIMARY KEY,
  identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  requested_by_identity_id UUID NOT NULL REFERENCES identities(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'canceled', 'executing', 'completed', 'partially-retained')),
  requested_at TIMESTAMPTZ NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retain_until TIMESTAMPTZ,
  retention_reason TEXT,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (scheduled_for > requested_at),
  CHECK ((retain_until IS NULL) = (retention_reason IS NULL))
);

CREATE INDEX ix_deletion_requests_scheduled
  ON deletion_requests (scheduled_for)
  WHERE status = 'scheduled';
