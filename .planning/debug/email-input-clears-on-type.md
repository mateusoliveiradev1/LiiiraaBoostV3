---
status: resolved
trigger: "ta bugado essa merda ainda estou digitando o email buga e apaga"
created: 2026-08-08T21:20:00Z
updated: 2026-08-08T21:20:00Z
---

# Debug: email input clears while typing

## Symptoms

- expected: The account email remains in the login field while the user types.
- actual: The field clears during typing, preventing completion of the email.
- error: No visible error was reported.
- timeline: Reproduced by the owner immediately after restoring and reinstalling the complete packaged desktop app.
- reproduction: Open the installed desktop auth screen and type into `E-mail da conta`.

## Current Focus

- hypothesis: A render/effect loop remounts `AccountExperience` or synchronizes its controlled email state back to an empty value after each input event.
- test: Type a deterministic address one character at a time in the installed WebView and record DOM node identity, value, render/remount signals, and page errors after every key.
- expecting: If remounting, the input node or auth subtree identity changes; if controlled-state synchronization, node identity remains but value returns to empty after a render.
- next_action: Reproduce against the installed executable over WebView2 CDP, then trace the responsible state/effect in `account-experience.tsx` and its parents.
- reasoning_checkpoint: The restored app uses React StrictMode and the full native shell; either repeated native startup events or a controlled form reset can erase local input state.
- tdd_checkpoint: RED confirmed `['revoked', 'pending', 'revoked']`; minimal fix skips transient pending publication only when the session is already confirmed revoked.

## Evidence

- timestamp: 2026-08-08T21:25:00Z
  checked: Installed production UI after it had stabilized.
  found: `teste@example.com` remained intact through every input event; the same DOM node stayed connected and focused.
  implication: The controlled `LbTextField` and ordinary React input handling are not the cause.

- timestamp: 2026-08-08T21:27:00Z
  checked: Fresh page load, typing immediately, then observing for nine seconds.
  found: The full email remained until approximately 6.0 seconds, then the input value became empty, focus was lost, and the expando marker on the original DOM node disappeared.
  implication: The login subtree is being unmounted and recreated on a timed background transition.

- timestamp: 2026-08-08T21:29:00Z
  checked: `DesktopAccountAuthority.start()` and `synchronize()`.
  found: A 5,000 ms refresh always publishes `pending` before the native response. For a confirmed `revoked` snapshot this changes the login presentation to session restoration and back to sign-in, remounting `LoginSurface`.
  implication: A confirmed signed-out state must remain visually stable while a background refresh executes; the transport call can still proceed and publish its final result.

## Eliminated

- hypothesis: `LbTextField` loses controlled state on each keystroke.
  evidence: All characters persisted and the node identity stayed stable before the five-second authority refresh.

## Resolution

- root_cause: `DesktopAccountAuthority` refreshes every 5,000 ms and always published a transient `pending` snapshot. When the session was already confirmed `revoked`, that transient state replaced `LoginSurface` with `SessionRestorationSurface` and then mounted a fresh empty login form after the native response.
- fix: Continue executing the background synchronization, but do not publish transient `pending` while the current state is already confirmed `revoked`. Final native responses are still validated and published normally.
- verification: Regression test failed RED with `['revoked', 'pending', 'revoked']` and passes GREEN with `['revoked', 'revoked']`. Related desktop tests pass 33/33, TypeScript passes, production truth passes 13/13, and the reinstalled packaged executable preserved `usuario@exemplo.com`, DOM node identity, and focus for 11.5 seconds across two automatic refresh cycles with no page errors.
- files_changed: `apps/desktop/src/account-authority.ts`, `apps/desktop/src/account-authority.test.ts`, `.planning/debug/email-input-clears-on-type.md`
