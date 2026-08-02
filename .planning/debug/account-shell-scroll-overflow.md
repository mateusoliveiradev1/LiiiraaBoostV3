---
status: resolved
trigger: 'ALGUNS ERROS ESPAÇOS VAZIOS E TALS MT SCROLLS'
created: 2026-08-02T19:29:45.4268034-03:00
updated: 2026-08-02T19:51:40-03:00
---

## Current Focus

hypothesis: Confirmed. The Direction 3 shell created competing scroll contexts because the document contained a full-viewport app shell plus a separate footer, while both the sidebar navigation and inspector independently used vertical overflow. Root horizontal clipping was applied only to `body`, leaving the root scroller insufficiently guarded.
test: Inspect the 1920px user capture, shell DOM ownership, computed layout rules, wide-viewport scroll geometry, and Playwright account coverage.
expecting: The page should have no horizontal overflow, no nested vertical scrollbar in the inspector or sidebar, no standalone empty footer band, and at most one document scrollbar when content exceeds the viewport.
next_action: Present the refreshed W11/G03/G05 account captures for the blocking human visual checkpoint. Keep human approval and publication false until the user explicitly approves.

## Symptoms

expected: The logged-in account should behave like one cohesive web app: one predictable page scroll only when necessary, no horizontal scrollbar, no empty footer band, and no independently scrolling inspector.
actual: The supplied 1920px capture shows a document scrollbar, a second scrollbar inside the inspector, a horizontal scrollbar, and a largely empty footer band below the main workspace.
errors: Visual and navigation defects; no JavaScript exception was reported.
reproduction: Open the PT-BR account Overview at a wide desktop viewport and inspect the bottom and right edges after the Direction 3 implementation.
started: Reported during the blocking Plan 03-45 human review immediately after the Direction 3 candidate presentation.

## Eliminated

## Evidence

- timestamp: 2026-08-02T19:29:45.4268034-03:00
  checked: User-supplied 1920px account Overview capture
  found: A nested scrollbar is visible inside the 320px inspector, the document has its own vertical scrollbar, a horizontal scrollbar appears at the bottom, and the public-surface footer consumes a separate full-width band.
  implication: The rejection is reproducible and concerns shell topology, not subjective spacing preference alone.

## Resolution

root_cause: `.account-app-shell` occupied a full `100vh` while a separate public-surface footer was rendered after it. The sidebar navigation and the 320px inspector both declared independent `overflow-y: auto`, producing nested vertical scrollers, while horizontal clipping on `body` alone did not guard the root element. At narrower widths the always-open inspector also duplicated a long contextual region below the primary task.
fix: Removed the standalone footer and moved its public-surface link into the inspector; removed sidebar and inspector overflow ownership; clipped horizontal overflow at both `html` and `body`; compacted workspace, readiness, and inspector spacing; and converted the inspector to a native disclosure that is open at widths of at least 1180px and collapsed by default below that breakpoint.
verification: The exact 1920x900 shell contract proves no horizontal overflow, no nested vertical scrollers, no empty footer, and a visible public link. Account unit tests passed 55/55; TypeScript and production build passed; the Impeccable layout detector reported zero findings; the account browser matrix passed across 1440/1280/960/390/320; and the refreshed eight-candidate replay passed 9 tests with 19 intentional skips and no pixel changes. W18 shrank from 2411px to 1504px, G03 from 2644px to 1721px, and G05 from 2314px to 1407px while preserving required content.
files_changed: `apps/account/src/account-navigation.tsx`, `apps/account/src/app/[locale]/layout.tsx`, `apps/account/src/app/account-shell.css`, `apps/account/src/account-shell.test.ts`, `tooling/web-evidence/tests/account.spec.ts`, eight account candidate PNGs, `03-64-account.json`, and `03-66-aggregate.json`.
