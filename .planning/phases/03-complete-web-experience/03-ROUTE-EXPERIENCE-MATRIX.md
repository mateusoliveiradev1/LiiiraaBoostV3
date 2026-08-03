# Phase 3 Final Route Experience Matrix

**Contract:** D-87 through D-101  
**Locales:** every identity renders `pt-BR` and `en` with reviewed semantic parity.  
**Widths:** every family is verified at 1440, 960, 390, and 320 CSS px.  
**Authority:** `public/local` means no remote mutation; `disconnected` means the complete review flow ends with `remoteStateChanged: false`; `fail-closed` means no artifact/action bypass exists.

## Public acquisition — Impeccable brand register — Plan 03-68

| Route identity and canonical path | Customer goal and H1 intent | Primary action / secondary route | Authority |
|---|---|---|---|
| `public-home` · `/[locale]` | Understand the product · Prepare the PC, prove the result, restore with control | Download free · Product | public/local |
| `public-product` · `/[locale]/product` | Understand analyze→plan→apply→prove→restore · Performance with control | See compatibility · Results | public/local |
| `public-results` · `/[locale]/results` | Understand credible outcomes and methodology · Results you can verify | See how measurement works · Product | public/local |
| `public-evidence` · `/[locale]/evidence` | Follow the legacy evidence deep link · How proof is built | Open Results · Docs | public/local; legacy canonical |
| `public-compatibility` · `/[locale]/compatibility` | Decide whether this PC/Windows is supported · Check before installing | Analyze in desktop or Download · Support | public/local; custom link has no state |
| `public-plans` · `/[locale]/plans` | Choose Essential or Competitive with all terms · Start free or unlock Competitive Mode | Start Free / Choose Premium · Terms | disconnected checkout |
| `public-download` · `/[locale]/download` | Reach the correct stable acquisition path · Download Liiiraa Boost safely | Check stable availability · Releases | fail-closed artifact |

## Public service, documentation, distribution, and policy — Plan 03-69

| Route identity and canonical path | Customer goal and H1 intent | Primary action / secondary route | Authority |
|---|---|---|---|
| `public-search` · `/[locale]/search` | Find public help/product content · What are you looking for? | Open result · Docs | public/local; noindex |
| `public-support` · `/[locale]/support` | Choose help path and see response times · Get the right help | Open support option · Status | public/local |
| `public-status` · `/[locale]/status` | Check current service impact · Liiiraa Boost service status | View incident · Support | public/local |
| `public-policies` · `/[locale]/policies` | Find legal/trust documents · Policies in plain language | Open policy · Security | public/local |
| `public-privacy-policy` · `/[locale]/policies/privacy` | Understand local-first data use · Your data stays under your control | Review choices · Support | public/local |
| `public-terms` · `/[locale]/policies/terms` | Understand service and purchase terms · Clear terms before you decide | Review plans · Support | public/local |
| `public-responsible-disclosure` · `/[locale]/responsible-disclosure` | Report a security issue safely · Report responsibly | Use secure channel · Security | public/local |
| `docs-index` · `/[locale]/docs` | Find help by task · What do you want to do? | Search/select task · Support | public/local |
| `docs-task` · `/[locale]/docs/tasks/[section]` | Complete a task family · Prepare/measure/optimize/restore/troubleshoot | Open article · Docs index | public/local |
| `docs-article` · `/[locale]/docs/[version]/articles/[article]` | Complete one versioned task · Human task title | Take next step · Related article | public/local |
| `docs-reference` · `/[locale]/docs/[version]/reference/[reference]` | Inspect technical reference · Reference title | Return to task · Related evidence | public/local |
| `docs-troubleshooting` · `/[locale]/docs/[version]/troubleshooting/[code]` | Recover from an observed code/state · Fix this safely | Follow safe step · Escalate | public/local |
| `docs-history` · `/[locale]/docs/history/[version]/[article]` | Read historical guidance · Archived documentation | Open current version · Release notes | public/local; noindex |
| `releases-index` · `/[locale]/releases` | Choose a release channel · Releases and update channels | View Stable · Download | public/local |
| `releases-channel` · `/[locale]/releases/[channel]` | Understand one channel · Stable/Beta/Experimental | View current version · Channel policy | public/local |
| `releases-version` · `/[locale]/releases/[channel]/[version]` | Review changes and compatibility · Version title | Check integrity/download · Install guide | public/local |
| `releases-integrity` · `/[locale]/releases/[channel]/[version]/integrity` | Independently verify artifact facts · Verify before installing | Verify signature/hash · Release | fail-closed |
| `releases-download` · `/[locale]/download/[channel]/[version]` | Receive an approved artifact only · Download safely | Download if approved · Integrity | fail-closed; noindex |
| `releases-install` · `/[locale]/releases/[channel]/[version]/install` | Install and recover safely · Install with confidence | Follow install steps · Support | public/local |

## Identity, onboarding, and customer account — Impeccable product register — Plan 03-70

| Route identity and canonical path | Customer goal and H1 intent | Primary action / secondary route | Authority |
|---|---|---|---|
| `account-sign-in` · `/[locale]/login` | Enter the account · Welcome back | Continue securely · Register/recover | disconnected identity |
| `account-sign-up` · `/[locale]/register` | Create the account · Start with Essential | Create account · Login/terms | disconnected identity |
| `account-onboarding` · `/[locale]/onboarding` | Complete web setup · Get ready to use Liiiraa Boost | Continue current step · Save/exit | disconnected identity/commerce/device |
| `account-overview` · `/[locale]/account` | See current plan/device/next action · Your Liiiraa Boost | Complete next step · Responsibility | disconnected account |
| `account-profile` · `/[locale]/account/profile` | Review personal preferences · Profile | Review changes · Privacy | disconnected mutation |
| `account-security` · `/[locale]/account/security` | Prepare email/passkey/MFA/session safety · Security | Review method/action · Recovery | disconnected mutation |
| `account-subscription` · `/[locale]/account/subscription` | Understand/manage Essential or Competitive · Your plan | Review plan action · Invoices | disconnected commerce |
| `account-invoices` · `/[locale]/account/invoices` | Review billing history/payment expectations · Invoices and payments | Open invoice/action · Subscription | disconnected commerce |
| `account-device` · `/[locale]/account/device` | Manage one protected PC identity/reset rules · Your active PC | Review transfer/reset · Support | disconnected device |
| `account-downloads` · `/[locale]/account/downloads` | Find release/channel for this account · Downloads | Open stable download · Releases | fail-closed artifact |
| `account-privacy` · `/[locale]/account/privacy` | Review consent/export/correction/deletion · Privacy choices | Review request · Policy | disconnected privacy |
| `account-support` · `/[locale]/account/support` | Get plan-aware help · Support | Review request · Docs/status | disconnected support |

## Isolated administration — Impeccable product register — Plan 03-71

| Route identity and canonical path | Customer goal and H1 intent | Primary action / secondary route | Authority |
|---|---|---|---|
| `admin-role` · `/[locale]/admin` | Choose permitted role task · Current operational responsibility | Open assigned work · Audit | disconnected admin |
| `admin-support` · `/[locale]/admin/support/[caseId]` | Review/respond to one case · Support case decision | Review response · Audit | disconnected admin |
| `admin-operations` · `/[locale]/admin/operations/[reviewId]` | Review release/device/commerce operation · Operational review | Review decision · Audit | disconnected admin |
| `admin-security` · `/[locale]/admin/security/[reviewId]` | Review security-sensitive request · Security review | Review decision · Audit | disconnected admin |
| `admin-diagnostics` · `/[locale]/admin/diagnostics/[diagnosticId]` | Access only consented bounded diagnostics · Diagnostic access review | Verify consent/access · Audit | disconnected; consent required |
| `admin-audit` · `/[locale]/admin/audit` | Inspect immutable history · Audit trail | Open event · Filter | read-only disconnected |
| `admin-audit-event` · `/[locale]/admin/audit/[eventId]` | Inspect one correlated event · Audit event | Return to trail · Related object | read-only disconnected |

## Authored failures and degraded state families

| Surface / identities | H1 intent and safe recovery | Owner |
|---|---|---|
| Public `public-error-403/404/410/500` · `/[locale]/errors/[code]` | Access denied / Page not found / No longer available / Service issue; preserve public/docs access and one relevant recovery | 03-69 |
| Account `account-error-403/404/410/500` · `/[locale]/errors/[code]` on account origin | Permission / missing responsibility / retired destination / account capability issue; preserve only validated safe local work and route to login/support | 03-70 |
| Admin `admin-error-403/404/410/500` · `/[locale]/errors/[code]` on admin origin | Role denial / missing workspace / retired operation / operational issue; redact objects and retain validated role only | 03-71 |
| `loading` | Geometry-matched skeleton; no invented data | owning surface plan |
| `empty` | Explain why, then one safe next action | owning surface plan |
| `offline` | Name unavailable capability and preserved local/read-only work | owning surface plan |
| `stale` | Show last trustworthy time/scope and refresh path | owning surface plan |
| `partial-failure` | Keep safe regions available; block ambiguous action | owning surface plan |
| `expired-session` | Clear sensitive state; preserve validated return destination only | 03-70/71 |
| `permission-denied` | Explain required permission/role without leaking hidden data | 03-70/71 |
| `unavailable-authority` | Complete review then concise no-change outcome; structured `remoteStateChanged: false` | 03-70/71 |

## Universal verification fields — Plan 03-72

Every row above is tested in both locales. Acquisition and high-risk families receive all four widths directly; remaining rows receive at least one wide and one mobile record plus matrix-derived reflow assertions. Each record verifies one `main`, one visible H1, one current navigation destination, semantic favicon/lockup, flag plus language text, route preservation, expected CTA, 44px targets, visible focus, reduced motion, forced colors, no page-level horizontal scroll, no serious/critical Axe findings, no forbidden ordinary-UX implementation terms, and the correct public/account/admin origin.
