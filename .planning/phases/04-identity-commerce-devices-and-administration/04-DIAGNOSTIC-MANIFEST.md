# Diagnostic Manifest `diagnostic.v1`

`diagnostic.v1` is the complete admission policy for support diagnostic fields. The API mediates every operator read; private object storage never grants an operator a presigned URL, download, export, clipboard, service-worker, cache, or durable object authority.

## Allowed fields and media

| Field class                 | Allowed MIME                             | Purpose                                                 |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `hardware-summary`          | UTF-8 `application/json` or `text/plain` | Bounded, redacted hardware facts needed for the case    |
| `application-log-redacted`  | UTF-8 `application/json` or `text/plain` | Product log records after token and secret redaction    |
| `optimization-plan-receipt` | UTF-8 `application/json` or `text/plain` | Applied-plan receipt without arbitrary command content  |
| `recovery-journal-excerpt`  | UTF-8 `application/json` or `text/plain` | Minimum recovery evidence scoped to the support purpose |
| `crash-metadata`            | UTF-8 `application/json` or `text/plain` | Crash metadata only; memory dumps are forbidden         |

Canonical wire MIME values are `application/json; charset=utf-8` and `text/plain; charset=utf-8`. JSON must parse as one valid UTF-8 JSON value. Unknown field classes or media types fail closed.

## Bounds and object identity

- One field is at most 5 MiB (`5,242,880` bytes).
- All fields admitted for one case upload total at most 25 MiB (`26,214,400` bytes).
- The storage adapter creates opaque keys under `diagnostics/<case-id>/<field-id>` from already admitted server identifiers. Client filenames never become object keys.
- Archives and archive members are not admitted, so extraction depth, member count, expanded size, symlinks, and path traversal all have a zero allowance.
- Executables, memory dumps, registry exports, environment dumps, browser data, credentials, and unknown content are denied.

## Inspection and redaction

Every source chunk must decode as fatal UTF-8. Before release, the configured content-inspection port performs malware/content scanning and token/secret redaction. An unavailable scan, rejected verdict, malformed JSON, invalid UTF-8, size mismatch, or post-redaction invalid document closes the stream without releasing that chunk.

## Consent and disposal evidence

Consent is bound to one consent identifier, case, purpose, exact admitted field class, aggregate version, grant time, and expiry no more than 72 hours after grant. The adapter re-reads that authority before storage access, at every chunk boundary, after inspection, and on consent notifications.

Revocation, expiry, or consent-version change aborts the storage read signal, zeroes every server-owned source/inspection buffer, zeroes delivered `Uint8Array` views still held by the stream, invokes the client clear-data signal, disposes the storage reader, and releases the subscription. Normal completion also zeroes retained temporary buffers and disposes the reader.

Opening an admitted field first appends one immutable minimized receipt containing only operator, case, consent, consent version, purpose, field class, field identifier, and access-window start. It contains no diagnostic content or object URL. Revocation never deletes that receipt.

Responses expose only `Cache-Control: private, no-store`, `Pragma: no-cache`, and `Expires: 0` alongside the API stream body.

## Retention

Source attachment objects are removed no later than 30 days after case closure. This manifest authorizes neither longer retention nor reactivation of expired or revoked consent.
