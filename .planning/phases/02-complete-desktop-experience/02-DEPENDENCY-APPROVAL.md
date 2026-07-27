# Phase 2 Exact Dependency Approval

**Decision:** APPROVED  
**Decision date:** 2026-07-27  
**Scope:** Phase 2 — Complete Desktop Experience  
**Evidence commit:** `d43fd0e` (`feat(02-01): record Phase 2 dependency evidence`)  
**Evidence report:** `architecture/dependency-review.md`  
**Evidence report blob at approval:** `1dccd8497123814bc522364d455aa6e91a56ec83`

## Human decision

After the generated evidence identified all 31 exact Phase 2 dependency identities, explained that 19 recent official releases required explicit review, and confirmed that no package had been installed, the user replied:

> Aprovo as bibliotecas

This approves the complete exact set below: 19 identities classified `SUS: too-new` for mandatory human review and 12 identities classified registry-verified `OK`. The approval does not authorize different versions, substitutions, additional packages, lifecycle-script exceptions, or dependencies outside Phase 2.

## Approved exact identities

1. `cargo:tauri-plugin-deep-link@2.4.9`
2. `cargo:tauri-plugin-notification@2.3.3`
3. `cargo:tauri-plugin-process@2.3.1`
4. `cargo:tauri-plugin-single-instance@2.4.3`
5. `cargo:tauri-plugin-updater@2.10.1`
6. `cargo:tauri-plugin-window-state@2.4.1`
7. `cargo:tauri@2.11.5`
8. `npm:@axe-core/playwright@4.12.1`
9. `npm:@formatjs/cli@6.16.14`
10. `npm:@playwright/test@1.62.0`
11. `npm:@storybook/react-vite@10.5.4`
12. `npm:@tailwindcss/vite@4.3.3`
13. `npm:@tanstack/react-query@5.101.4`
14. `npm:@tanstack/react-router@1.170.18`
15. `npm:@tanstack/router-plugin@1.168.23`
16. `npm:@tauri-apps/api@2.11.1`
17. `npm:@tauri-apps/cli@2.11.4`
18. `npm:@vitejs/plugin-react@6.0.4`
19. `npm:@xstate/react@6.1.0`
20. `npm:lucide-react@1.27.0`
21. `npm:motion@12.42.2`
22. `npm:react-aria-components@1.19.0`
23. `npm:react-dom@19.2.8`
24. `npm:react-hook-form@7.83.0`
25. `npm:react-intl@10.1.18`
26. `npm:react@19.2.8`
27. `npm:storybook@10.5.4`
28. `npm:tailwindcss@4.3.3`
29. `npm:uplot@1.6.32`
30. `npm:vite@8.1.5`
31. `npm:xstate@5.32.5`

## Explicit exclusions and limits

- `npm:@tauri-apps/plugin-single-instance` remains excluded because the identity does not exist; use the approved Rust crate.
- `npm:msw` remains excluded for Phase 2; use the existing deterministic desktop adapter port.
- Installation must preserve exact version parity with the generated evidence and deny unapproved consumer-install lifecycle hooks.
- This record contains no credentials, keys, tokens, certificate material, or other secrets.

