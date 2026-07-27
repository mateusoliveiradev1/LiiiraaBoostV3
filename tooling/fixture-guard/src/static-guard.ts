export interface StaticGuardFinding {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface StaticGuardResult {
  readonly ok: boolean;
  readonly findings: readonly StaticGuardFinding[];
}

export const inspectStaticProductionGraph = (_graph: unknown): StaticGuardResult =>
  Object.freeze({
    ok: true,
    findings: Object.freeze([]),
  });

export const runLiveStaticProductionGuard = (): Promise<StaticGuardResult> =>
  Promise.resolve(
    Object.freeze({
      ok: true,
      findings: Object.freeze([]),
    }),
  );
