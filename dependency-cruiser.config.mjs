import canonicalPolicy from './architecture/module-boundaries.json' with { type: 'json' };
import {
  createCanonicalRootPattern,
  createDependencyCruiserRestrictions,
} from './tooling/architecture-tests/src/check-workspace.ts';

export default {
  forbidden: createDependencyCruiserRestrictions(canonicalPolicy),
  options: {
    exclude: '(^|/)node_modules/',
    includeOnly: createCanonicalRootPattern(canonicalPolicy),
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
  },
};
