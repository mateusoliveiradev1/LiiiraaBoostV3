import { describe, it } from 'vitest';

const ADMIN_AUTHORIZATION_RED_OWNER = '04-16-01';

const authorizationWitnesses = [
  {
    id: 'WEB-06 singular assumed role',
    behavior: 'an admin session must assume exactly one least-privilege role',
  },
  {
    id: 'WEB-06 resource-action authorization',
    behavior: 'the assumed role must authorize the exact resource and action pair or fail closed',
  },
  {
    id: 'IDEN-03 scoped step-up',
    behavior:
      'a critical action must require recent scoped reauthentication, reason, review, confirmation, and immutable audit evidence',
  },
  {
    id: 'IDEN-03 stale or mismatched step-up',
    behavior:
      'a stale step-up or one scoped to another resource and action must not authorize the critical action',
  },
] as const;

const expectedAdminAuthorizationRed = (id: string, behavior: string): never => {
  throw new Error(`EXPECTED_RED[${ADMIN_AUTHORIZATION_RED_OWNER}][${id}]: ${behavior}`);
};

describe('admin-authorization pre-implementation API witnesses', () => {
  it.each(authorizationWitnesses)('$id', ({ id, behavior }) => {
    expectedAdminAuthorizationRed(id, behavior);
  });
});
