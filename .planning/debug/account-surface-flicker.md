---
status: resolved
trigger: "aqui ainda fica dando umas piscada mudando a tela e tals"
created: 2026-08-08T21:45:00Z
updated: 2026-08-08T21:51:00Z
---

# Debug: account surface flicker

## Symptoms

- expected: The authenticated desktop account surface remains visually stable while background account/session refreshes occur.
- actual: The account surface periodically flashes and appears to switch between screen states while the user is viewing it.
- error: No explicit error message is visible; the authenticated Premium projection eventually remains present.
- timeline: Still present after the email-reset/remount regression was fixed and the corrected internal visual build was installed.
- reproduction: Open the installed authenticated desktop app, navigate to `Sua conta`, and leave the profile view visible through one or more authority refresh intervals.
- screenshot: `C:\Users\Liiiraa\AppData\Local\Temp\codex-clipboard-a29b1d46-c625-4751-9361-2b49d3a05d52.png`

## Current Focus

- hypothesis: The periodic native account refresh still publishes an intermediate loading/pending authority that replaces or remounts the authenticated account surface, causing a visible flash even though the last verified projection is still valid.
- test: Sample the live installed WebView across multiple refresh intervals and trace account-authority publication/render conditions against the previous email preservation fix.
- expecting: Route or authority phase temporarily changes at the five-second refresh boundary while the authenticated contact itself remains valid.
- next_action: Complete. The corrected internal installer is installed and the live account surface stayed stable across multiple refresh intervals.
- reasoning_checkpoint: The screenshot contains a valid authenticated account and no terminal error, which points to transient presentation state rather than failed OAuth.
- tdd_checkpoint: RED reproduced `online → pending`; GREEN with the focused authority and account suites passing 20/20.

## Evidence

- Before the fix, live WebView sampling recorded `online → pending → online` every five seconds, with each pending interval lasting roughly 150–200 ms.
- `DesktopAccountAuthority.synchronize()` published `pendingSnapshot()` before every lifecycle refresh even when a valid confirmed projection was already available.
- The account UI interpreted `pending` as “showing the last confirmed version”, changing status icon/text during every background refresh and producing the visible flash.
- After installation of the corrected NSIS build, a 16-second live WebView sample crossed three refresh intervals and recorded one stable state only: `online`; remount count remained zero.

## Eliminated

## Resolution

- root_cause: Background lifecycle synchronization exposed an internal loading state to React despite already holding a valid confirmed account projection.
- fix: Publish `pending` during synchronization only when no usable projection exists. Explicit profile mutations retain their existing pending/local-draft behavior.
- verification: Regression test failed before the fix and passed afterward; 20 account authority/experience tests passed; TypeScript check passed; internal Vite/Tauri/NSIS build passed; installed authenticated WebView remained online without remounts across multiple refresh cycles.
- files_changed: `apps/desktop/src/account-authority.ts`, `apps/desktop/src/account-authority.test.ts`.
