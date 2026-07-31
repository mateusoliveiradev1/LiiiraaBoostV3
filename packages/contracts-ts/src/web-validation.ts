import type { ErrorObject, ValidateFunction } from 'ajv';

import { webDocumentValidator } from './generated/standalone-validators.js';
import type { WebDocument } from './generated/index.js';

export const WEB_DOCUMENT_SCHEMA_ID =
  'https://schemas.liiiraa.dev/web/v1/web-document.schema.json' as const;

const MAX_ISSUES = 8;
const MAX_PATH_LENGTH = 256;
const MAX_KEYWORD_LENGTH = 64;

export interface WebDocumentValidationIssue {
  readonly path: string;
  readonly keyword: string;
}

export interface WebDocumentValidationError {
  readonly code: 'PAYLOAD_INVALID';
  readonly schemaId: typeof WEB_DOCUMENT_SCHEMA_ID;
  readonly issues: readonly WebDocumentValidationIssue[];
  readonly truncated: boolean;
}

export type WebDocumentValidationResult =
  | Readonly<{ ok: true; value: WebDocument }>
  | Readonly<{ ok: false; error: WebDocumentValidationError }>;

const validator = webDocumentValidator as ValidateFunction<WebDocument>;

const bounded = (value: string, maximum: number): string =>
  value.length <= maximum ? value : value.slice(0, maximum);

const issuePath = (error: ErrorObject): string =>
  bounded(error.instancePath.length === 0 ? '$' : `$${error.instancePath}`, MAX_PATH_LENGTH);

const structuralIssues = (
  errors: ErrorObject[] | null | undefined,
): WebDocumentValidationIssue[] => {
  const unique = new Map<string, WebDocumentValidationIssue>();

  for (const error of errors ?? []) {
    const issue = {
      path: issuePath(error),
      keyword: bounded(error.keyword, MAX_KEYWORD_LENGTH),
    };
    unique.set(`${issue.path}\u0000${issue.keyword}`, issue);
  }

  return [...unique.values()]
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) || left.keyword.localeCompare(right.keyword),
    )
    .slice(0, MAX_ISSUES);
};

const invalidPayload = (errors: ErrorObject[] | null | undefined): WebDocumentValidationResult => ({
  ok: false,
  error: {
    code: 'PAYLOAD_INVALID',
    schemaId: WEB_DOCUMENT_SCHEMA_ID,
    issues: structuralIssues(errors),
    truncated: (errors?.length ?? 0) > MAX_ISSUES,
  },
});

const isSafeWebUri = (input: string): boolean => {
  if (input.includes('\\') || /\s/u.test(input)) return false;

  try {
    const uri = new URL(input);
    return (
      uri.protocol === 'https:' &&
      uri.hostname.length > 0 &&
      uri.username.length === 0 &&
      uri.password.length === 0
    );
  } catch {
    return false;
  }
};

const unsafeWebDocumentUriPath = (document: WebDocument): string | null => {
  if ('source' in document && !isSafeWebUri(document.source)) return '$/source';

  if ('evidence' in document) {
    const unsafeIndex = document.evidence.findIndex((evidence) => !isSafeWebUri(evidence.source));
    if (unsafeIndex !== -1) return `$/evidence/${String(unsafeIndex)}/source`;
  }

  return null;
};

export const validateWebDocument = (input: unknown): WebDocumentValidationResult => {
  if (!validator(input)) return invalidPayload(validator.errors);

  const unsafeUriPath = unsafeWebDocumentUriPath(input);
  if (unsafeUriPath !== null) {
    return {
      ok: false,
      error: {
        code: 'PAYLOAD_INVALID',
        schemaId: WEB_DOCUMENT_SCHEMA_ID,
        issues: [{ path: unsafeUriPath, keyword: 'safeUri' }],
        truncated: false,
      },
    };
  }

  return { ok: true, value: input };
};
