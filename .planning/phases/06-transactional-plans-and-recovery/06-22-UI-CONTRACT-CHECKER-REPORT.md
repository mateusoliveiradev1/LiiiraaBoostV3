{
  "schemaVersion": "ui-contract-checker-report-v1",
  "phase": {
    "number": 6,
    "name": "Transactional Plans and Recovery",
    "plan": "06-22"
  },
  "checkerIdentity": {
    "name": "Codex Independent UI Contract Checker",
    "provider": "Codex",
    "runId": "codex-ui-check-06-22-95074756-e591-494c-bb74-94e49771e86d"
  },
  "completedAtUtc": "2026-08-13T06:54:54.967Z",
  "subject": {
    "canonicalization": "ui-spec-review-payload-v1",
    "path": ".planning/phases/06-transactional-plans-and-recovery/06-22-UI-CONTRACT-REVIEW-INPUT.md",
    "digest": {
      "algorithm": "sha256",
      "value": "aafe1e0e1d7666d4603908999d9e4560e53e73846005718c94be773bfdfc01db"
    }
  },
  "dimensions": [
    {
      "id": "copywriting",
      "verdict": "PASS",
      "rationale": "All declared primary, recovery, empty, error, unknown, restart, diagnostic, and consequential-action copy is specific and actionable. No prohibited generic CTA is present, destructive actions declare confirmation context, and every empty or failure state shown includes a safe solution path.",
      "evidence": [
        "The primary actions are noun-specific: 'Generate safe plan', 'Apply verified plan', and 'Open Recovery Center'.",
        "The empty plan state directs the user to refresh PC evidence and choose goals; the recovery empty state explains where verified receipts will appear.",
        "The paused-application error states that no new operation will start and directs the user to review observed state and open guided recovery.",
        "Restore-one, restore-full-plan, conflict resolution, and draft deletion each have distinct labels and declared confirmation content."
      ]
    },
    {
      "id": "visuals",
      "verdict": "PASS",
      "rationale": "The contract declares a clear primary focal region, ordered hierarchy, and accessible icon treatment for the plan, execution, and recovery workspaces, so implementation does not need to guess visual priority.",
      "evidence": [
        "The plan or timeline occupies the flexible focal column while the safety summary is explicitly secondary at a minimum width of 280px.",
        "The current operation or blocking decision may be the single raised focal panel; technical identifiers follow the human conclusion in an inspector or disclosure.",
        "Recovery content has an explicit reading order from safety verdict and next safe action through timeline, dependency group, targets, and history.",
        "Product icons always accompany text, new icons require an accessible text label, and timeline connectors are hidden from assistive technology."
      ]
    },
    {
      "id": "color",
      "verdict": "PASS",
      "rationale": "The 60/30/10 hierarchy is explicit, accent use is narrowly reserved, the two blue signals have distinct semantic roles, and destructive actions have a dedicated token. Status never relies on color alone.",
      "evidence": [
        "Dominant canvas is declared at 60%, secondary surfaces at 30%, and accent at 10%.",
        "Electric blue is reserved for the single primary action, selection/current stage, and focus; cyan is specifically the evidence signal rather than an interchangeable second accent.",
        "The contract expressly forbids applying accent to every interactive control.",
        "A dedicated destructive token is limited to final conflicting-state replacement or local draft deletion, while risk and state also require localized text, icon, and pattern."
      ]
    },
    {
      "id": "typography",
      "verdict": "PASS",
      "rationale": "The type contract is constrained to exactly four product sizes and two weights, with explicit body line height and a legible hierarchy. Monospace usage reuses the same sizes and weights rather than expanding the scale.",
      "evidence": [
        "Declared sizes are 14px label, 16px body, 24px task heading, and 32px page heading.",
        "Declared weights are only 400 and 600.",
        "Body line height is 24px (1.5), with line heights also specified for every other role.",
        "JetBrains Mono is restricted to 14px or 16px technical data, and Saira Semi Condensed is excluded from routine workflow headings."
      ]
    },
    {
      "id": "spacing",
      "verdict": "PASS",
      "rationale": "The spacing scale exactly matches the standard token set and every declared layout or target-size exception remains a multiple of four with a stated purpose. One- and two-pixel values are explicitly limited to borders and timeline connector internals, not spacing tokens.",
      "evidence": [
        "The scale is exactly 4px, 8px, 16px, 24px, 32px, 48px, and 64px.",
        "The 44px control target and 52px/64px row heights are grid-aligned multiples of four and preserve existing accessibility/component contracts.",
        "The contract prohibits arbitrary new spacing values."
      ]
    },
    {
      "id": "registry-safety",
      "verdict": "PASS",
      "rationale": "No third-party visual registry or registry block is admitted. Although shadcn is not initialized, the contract declares the existing bespoke manual design system, and the planning configuration does not disable this safety dimension.",
      "evidence": [
        "The design system is the existing product-owned Liiiraa Boost component and Cobalt token authority.",
        "shadcn official lists no blocks and is explicitly excluded by the project stack decision.",
        "Third-party visual registries list no blocks and are prohibited for the phase.",
        "React Aria is limited to behavior from an existing dependency with component and keyboard/focus tests; it is not used as a visual registry source."
      ]
    }
  ],
  "findings": [],
  "findingsDisposition": {
    "status": "none-raised",
    "detail": "Independent review raised no blocking or non-blocking findings across the six canonical dimensions."
  },
  "overallStatus": "APPROVED"
}
