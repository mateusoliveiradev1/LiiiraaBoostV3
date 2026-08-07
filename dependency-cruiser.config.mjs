import canonicalPolicy from './architecture/module-boundaries.json' with { type: 'json' };
import {
  createDependencyCruiserRestrictions,
  createWorkspaceRootPattern,
} from './tooling/architecture-tests/src/check-workspace.ts';

export default {
  forbidden: createDependencyCruiserRestrictions(canonicalPolicy),
  options: {
    exclude: '(^|/)(?:node_modules|dist|\\.next|storybook-static|coverage|\\.turbo)(?:/|$)',
    includeOnly: createWorkspaceRootPattern(process.cwd()),
    tsConfig: {
      fileName: 'tsconfig.base.json',
    },
  },
};
