import canonicalPolicy from '../../../architecture/module-boundaries.json' with { type: 'json' };
import { evaluateGraph } from '../../architecture-tests/src/policy.ts';

type ExecFileSync = (
  file: string,
  arguments_: readonly string[],
  options: {
    readonly cwd: string;
    readonly encoding: 'utf8';
    readonly windowsHide: true;
  },
) => unknown;

declare const process: {
  readonly execPath: string;
  getBuiltinModule(specifier: 'node:child_process'): unknown;
};

export interface StaticGuardFinding {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface StaticGuardResult {
  readonly ok: boolean;
  readonly findings: readonly StaticGuardFinding[];
}

const hasExecFileSync = (value: unknown): value is Readonly<{ execFileSync: ExecFileSync }> =>
  typeof value === 'object' &&
  value !== null &&
  'execFileSync' in value &&
  typeof value.execFileSync === 'function';

const repositoryRoot = decodeURIComponent(new URL('../../../', import.meta.url).pathname).replace(
  /^\/([A-Za-z]:\/)/,
  '$1',
);

export const inspectStaticProductionGraph = (graph: unknown): StaticGuardResult => {
  const result = evaluateGraph(canonicalPolicy, graph);

  return Object.freeze({
    ok: result.ok,
    findings: Object.freeze(
      result.diagnostics.map((diagnostic) =>
        Object.freeze({
          code: diagnostic.code,
          path: diagnostic.path,
          message: diagnostic.message,
        }),
      ),
    ),
  });
};

export const runLiveStaticProductionGuard = (): Promise<StaticGuardResult> => {
  const childProcess = process.getBuiltinModule('node:child_process');
  if (!hasExecFileSync(childProcess)) {
    throw new Error('Node child_process.execFileSync is unavailable.');
  }

  try {
    childProcess.execFileSync(
      process.execPath,
      ['tooling/architecture-tests/src/check-workspace.ts'],
      {
        cwd: repositoryRoot,
        encoding: 'utf8',
        windowsHide: true,
      },
    );
    return Promise.resolve(
      Object.freeze({
        ok: true,
        findings: Object.freeze([]),
      }),
    );
  } catch {
    return Promise.resolve(
      Object.freeze({
        ok: false,
        findings: Object.freeze([
          Object.freeze({
            code: 'STATIC_WORKSPACE_FAILED',
            path: '$.workspace',
            message:
              'The canonical live workspace architecture check rejected the production graph.',
          }),
        ]),
      }),
    );
  }
};
