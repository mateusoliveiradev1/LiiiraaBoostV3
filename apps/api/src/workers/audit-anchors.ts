import {
  anchorDueAuditHeads,
  verifyAuditAnchors,
  type AuditAnchorDependencies,
  type AuditAnchorRunResult,
  type AuditAnchorVerificationMode,
  type AuditAnchorVerificationRunResult,
} from '@liiiraa/control-plane-application';

export const AUDIT_ANCHOR_CLAIM_SQL = `
WITH claimed AS (
  SELECT id
  FROM outbox_jobs
  WHERE topic = 'audit.anchor-due'
    AND completed_at IS NULL
    AND available_at <= CURRENT_TIMESTAMP
    AND (
      COALESCE((payload ->> 'eventsSinceAnchor')::BIGINT, 0) >= 1000
      OR created_at <= CURRENT_TIMESTAMP - INTERVAL '15 minutes'
    )
    AND (locked_at IS NULL OR locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
  ORDER BY available_at, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT $1
)
UPDATE outbox_jobs AS jobs
SET locked_at = CURRENT_TIMESTAMP,
    locked_by = $2,
    attempt_count = attempt_count + 1
FROM claimed
WHERE jobs.id = claimed.id
RETURNING jobs.id, jobs.attempt_count, jobs.payload
`.trim();

export const AUDIT_ANCHOR_DAILY_VERIFICATION_MS = 24 * 60 * 60 * 1_000;
export const AUDIT_ANCHOR_MONTHLY_DRILL_MONTHS = 1;

export type AuditAnchorWorkerDependencies = AuditAnchorDependencies;

export interface AuditAnchorWorkerInput {
  readonly batchSize?: number;
  readonly maxAttempts?: number;
  readonly now: string;
  readonly workerId: string;
}

export interface AuditAnchorVerificationWorkerInput extends AuditAnchorWorkerInput {
  readonly mode: AuditAnchorVerificationMode;
}

export interface AuditAnchorCustody {
  readonly apiRole: string;
  readonly signingRole: string;
  readonly storageRole: string;
}

export const assertSeparatedAuditAnchorCustody = (
  custody: AuditAnchorCustody,
): AuditAnchorCustody => {
  const roles = [custody.apiRole, custody.signingRole, custody.storageRole];
  if (roles.some((role) => role.length === 0) || new Set(roles).size !== roles.length) {
    throw new Error('audit API, signing, and storage roles must be separate');
  }
  return Object.freeze({ ...custody });
};

export const runAuditAnchorWorkerOnce = (
  dependencies: AuditAnchorWorkerDependencies,
  input: AuditAnchorWorkerInput,
): Promise<AuditAnchorRunResult> =>
  anchorDueAuditHeads(dependencies, {
    limit: input.batchSize ?? 10,
    maxAttempts: input.maxAttempts ?? 5,
    now: input.now,
    workerId: input.workerId,
  });

export const runAuditAnchorVerificationOnce = (
  dependencies: AuditAnchorWorkerDependencies,
  input: AuditAnchorVerificationWorkerInput,
): Promise<AuditAnchorVerificationRunResult> =>
  verifyAuditAnchors(dependencies, {
    limit: input.batchSize ?? 10,
    maxAttempts: input.maxAttempts ?? 5,
    mode: input.mode,
    now: input.now,
    workerId: input.workerId,
  });
