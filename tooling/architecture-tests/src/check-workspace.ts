import type { PolicyResult } from './policy.ts';
import type { CargoCheckResult } from './check-cargo.ts';

export interface DependencyCruiserRestriction {
  name: string;
  severity: 'error';
  comment: string;
  from: {
    path?: string;
    pathNot?: string;
  };
  to: {
    path?: string;
    pathNot?: string;
    circular?: boolean;
  };
}

export interface WorkspaceCheckResult {
  adapter: 'workspace';
  graph: unknown;
  policy: PolicyResult;
}

export interface ArchitectureCheckResult {
  ok: boolean;
  executionCounts: {
    workspace: number;
    cargo: number;
  };
  workspace: WorkspaceCheckResult;
  cargo: CargoCheckResult;
}

export const normalizeDependencyCruiserResult = (
  _policyInput: unknown,
  _cruiseResultInput: unknown,
): unknown => {
  throw new Error('Dependency-cruiser normalization is not implemented.');
};

export const createDependencyCruiserRestrictions = (
  _policyInput: unknown,
): DependencyCruiserRestriction[] => {
  throw new Error('Dependency-cruiser policy derivation is not implemented.');
};

export const runLiveWorkspaceCheck = async (
  _policyInput: unknown,
): Promise<WorkspaceCheckResult> => {
  throw new Error('Live workspace architecture checking is not implemented.');
};

export const runArchitectureAdapters = async (
  _workspaceAdapter: () => Promise<WorkspaceCheckResult>,
  _cargoAdapter: () => Promise<CargoCheckResult>,
): Promise<ArchitectureCheckResult> => {
  throw new Error('Architecture adapter orchestration is not implemented.');
};
