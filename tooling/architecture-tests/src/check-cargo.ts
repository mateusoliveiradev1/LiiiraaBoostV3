import type { PolicyResult } from './policy.ts';

export interface CargoCheckResult {
  adapter: 'cargo';
  graph: unknown;
  policy: PolicyResult;
}

export const normalizeCargoMetadata = (
  _policyInput: unknown,
  _metadataInput: unknown,
  _repositoryRoot: string,
): unknown => {
  throw new Error('Cargo metadata normalization is not implemented.');
};

export const runLiveCargoCheck = async (_policyInput: unknown): Promise<CargoCheckResult> => {
  throw new Error('Live Cargo architecture checking is not implemented.');
};
