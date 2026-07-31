# Phase 3 Web Dependency Legitimacy Review

## Review gate

No package was installed or resolved while producing this review. The workspace
manifests and `pnpm-lock.yaml` remain outside this task's mutation scope.

The evidence below was reproduced on `2026-07-31T01:24:31.740Z` from the exact
npm registry version documents, npm's public last-week downloads endpoint, and
the official GitHub tag references. Download counts are a moving registry
metric; package identity, version, repository, license, lifecycle metadata,
distribution integrity, and source tag are the approval-bearing evidence.

The research verdict remains authoritative:

- `next@16.2.12`, `@next/mdx@16.2.12`, and `next-intl@4.13.4` are
  **SUS (`too-new`)** on recency alone and are not approved for installation.
- `minisearch@7.2.0` is **OK** and was already approved by the Phase 3 research
  audit.

## Exact identity evidence

| Identity | Published (UTC) | Downloads, last week | npm evidence | Official repository evidence | License | Lifecycle scripts | Research verdict |
| --- | --- | ---: | --- | --- | --- | --- | --- |
| `next@16.2.12` | `2026-07-25T20:45:53.940Z` | 54,833,206 | [version page](https://www.npmjs.com/package/next/v/16.2.12) · [registry JSON](https://registry.npmjs.org/next/16.2.12) · [downloads](https://api.npmjs.org/downloads/point/last-week/next) | [`vercel/next.js`](https://github.com/vercel/next.js) · [`v16.2.12` source tag](https://github.com/vercel/next.js/tree/v16.2.12) · [tag API](https://api.github.com/repos/vercel/next.js/git/ref/tags/v16.2.12) → commit `2234717e74ff24cd179d8128fa8af6c46cc4f24e` | `MIT` | None declared; no `preinstall`, `install`, or `postinstall` hook | **SUS (`too-new`)** — blocking human verification required |
| `@next/mdx@16.2.12` | `2026-07-25T20:44:34.328Z` | 1,015,441 | [version page](https://www.npmjs.com/package/@next/mdx/v/16.2.12) · [registry JSON](https://registry.npmjs.org/%40next%2Fmdx/16.2.12) · [downloads](https://api.npmjs.org/downloads/point/last-week/%40next%2Fmdx) | [`vercel/next.js/packages/next-mdx`](https://github.com/vercel/next.js/tree/v16.2.12/packages/next-mdx) · [`v16.2.12` source tag](https://github.com/vercel/next.js/tree/v16.2.12) · [tag API](https://api.github.com/repos/vercel/next.js/git/ref/tags/v16.2.12) → commit `2234717e74ff24cd179d8128fa8af6c46cc4f24e` | `MIT` | None declared; no `preinstall`, `install`, or `postinstall` hook | **SUS (`too-new`)** — blocking human verification required |
| `next-intl@4.13.4` | `2026-07-23T13:35:52.835Z` | 4,831,733 | [version page](https://www.npmjs.com/package/next-intl/v/4.13.4) · [registry JSON](https://registry.npmjs.org/next-intl/4.13.4) · [downloads](https://api.npmjs.org/downloads/point/last-week/next-intl) | [`amannn/next-intl`](https://github.com/amannn/next-intl) · [`v4.13.4` source tag](https://github.com/amannn/next-intl/tree/v4.13.4) · [tag API](https://api.github.com/repos/amannn/next-intl/git/ref/tags/v4.13.4) → commit `7fa175d0303804fea48aad0c8b5de89077948e9c`, matching registry `gitHead` | `MIT` | `prepublishOnly`: `turbo build && cp ../../README.md .`; publication-only, with no consumer-install hook | **SUS (`too-new`)** — blocking human verification required |
| `minisearch@7.2.0` | `2025-09-16T12:42:12.453Z` | 1,939,753 | [version page](https://www.npmjs.com/package/minisearch/v/7.2.0) · [registry JSON](https://registry.npmjs.org/minisearch/7.2.0) · [downloads](https://api.npmjs.org/downloads/point/last-week/minisearch) | [`lucaong/minisearch`](https://github.com/lucaong/minisearch) · [`v7.2.0` source tag](https://github.com/lucaong/minisearch/tree/v7.2.0) · [tag API](https://api.github.com/repos/lucaong/minisearch/git/ref/tags/v7.2.0) → commit `3d239d1c3ae7aef1bf5d8945dd7b5f0709f646f5` | `MIT` | `prepublishOnly`: `yarn test && yarn build`; publication-only, with no consumer-install hook | **OK** — already approved by the Phase 3 research audit |

## Distribution identity

| Identity | Registry tarball | SHA-512 integrity |
| --- | --- | --- |
| `next@16.2.12` | `https://registry.npmjs.org/next/-/next-16.2.12.tgz` | `sha512-iD59eYQWmbFcEbX7v/acG5DRym9iw1DdaPoD0WTA920naWsE25wShzJW4+UvAs8MK9EC2kBfIH6vtto1H1PHGw==` |
| `@next/mdx@16.2.12` | `https://registry.npmjs.org/@next/mdx/-/mdx-16.2.12.tgz` | `sha512-bbKvq/7SIJZgQFRYL3wwnzLwCBviQfWi5UR61RDWwaMX3fV6iSqKfVr5SErRNA/PhMer/ylvErX4SVaGNrwKcw==` |
| `next-intl@4.13.4` | `https://registry.npmjs.org/next-intl/-/next-intl-4.13.4.tgz` | `sha512-jhPAT0u0lahIK6E4gVdZAehugWCosBhLG8sV7xMzgSVoJpxHObP+Fiu+z2FfkEW0XPPtr7uEXoUlLEfhxhNMTg==` |
| `minisearch@7.2.0` | `https://registry.npmjs.org/minisearch/-/minisearch-7.2.0.tgz` | `sha512-dqT2XBYUOZOiC5t2HRnwADjhNS2cecp9u+TJRiJ1Qp/f5qjkeT5APcGPjHw+bz89Ms8Jp+cG4AlE+QZ/QnDglg==` |

## Approval boundary

This document is evidence, not installation authority. The three SUS identities
must receive one explicit human approval covering these exact names, exact
versions, official repositories, and recorded evidence. Substitutions,
additional packages, or version changes require a new legitimacy audit and
approval. No approval may be inferred from package familiarity, auto-advance,
or the already-approved `minisearch@7.2.0` identity.
