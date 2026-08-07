ALTER TABLE admin_membership_capabilities
  DROP CONSTRAINT IF EXISTS admin_membership_capabilities_capability_check;

ALTER TABLE admin_membership_capabilities
  ADD CONSTRAINT admin_membership_capabilities_capability_check
  CHECK (capability IN (
    'support:reply',
    'support:view',
    'device:manage',
    'entitlement:correct',
    'session:revoke',
    'diagnostics:view',
    'audit:reveal-sensitive',
    'audit:export',
    'beta-invitations:manage',
    'beta-invitations:preflight',
    'beta-invitations:issue',
    'beta-invitations:batch',
    'admin-membership:manage',
    'admin-membership:activate',
    'admin-function:simulate',
    'admin-access:review',
    'admin-delegation:manage',
    'admin-permissions:manage',
    'admin-approval:manage'
  ));

ALTER TABLE admin_membership_scopes
  DROP CONSTRAINT IF EXISTS admin_membership_scopes_scope_check;

ALTER TABLE admin_membership_scopes
  ADD CONSTRAINT admin_membership_scopes_scope_check
  CHECK (scope IN (
    'support-cases',
    'devices',
    'entitlements',
    'sessions',
    'diagnostic-metadata',
    'audit-events',
    'team',
    'history',
    'delegations',
    'reviews'
  ));
