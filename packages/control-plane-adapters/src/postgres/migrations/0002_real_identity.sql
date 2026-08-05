ALTER TABLE identities
  ADD COLUMN IF NOT EXISTS display_name TEXT NOT NULL DEFAULT 'Liiiraa Player',
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'tester'
    CHECK (role IN ('tester', 'support', 'operations', 'security', 'audit'));

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS authentication_method TEXT NOT NULL DEFAULT 'password'
    CHECK (authentication_method IN ('password', 'passkey'));

CREATE TABLE IF NOT EXISTS identity_invitations (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  token_digest CHAR(64) NOT NULL UNIQUE CHECK (token_digest ~ '^[0-9a-f]{64}$'),
  role TEXT NOT NULL DEFAULT 'tester'
    CHECK (role IN ('tester', 'support', 'operations', 'security', 'audit')),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES identities(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > issued_at),
  CHECK ((redeemed_at IS NULL) = (redeemed_by IS NULL))
);

CREATE INDEX IF NOT EXISTS ix_identity_invitations_email_active
  ON identity_invitations (lower(email), expires_at)
  WHERE redeemed_at IS NULL;

CREATE TABLE IF NOT EXISTS desktop_authorization_challenges (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  issuer TEXT NOT NULL,
  state_digest CHAR(64) NOT NULL CHECK (state_digest ~ '^[0-9a-f]{64}$'),
  code_challenge TEXT NOT NULL CHECK (char_length(code_challenge) BETWEEN 43 AND 128),
  code_digest CHAR(64) CHECK (code_digest ~ '^[0-9a-f]{64}$'),
  approved_by UUID REFERENCES identities(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (expires_at > issued_at),
  CHECK ((code_digest IS NULL) = (approved_by IS NULL))
);

CREATE INDEX IF NOT EXISTS ix_desktop_authorization_challenges_expiry
  ON desktop_authorization_challenges (expires_at)
  WHERE consumed_at IS NULL;
