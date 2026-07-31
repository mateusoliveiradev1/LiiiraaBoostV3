# Deferred Items

## 03-02

- The full `pnpm test:architecture` gate retains two pre-existing Phase 2 manifest failures: `apps/desktop` now declares `@liiiraa/contracts-ts` beyond the frozen `phase2Packages` expectation, and `@types/node@24.13.3` is absent from the Phase 2 dependency approval map. Both failures were present during the Task 1 RED run before the Phase 3 module records were added. They are outside Plan 03-02's reservation and isolation scope.
