import { existsSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join, normalize } from 'node:path';

const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
const requirements = ['WEB-01', 'WEB-02', 'WEB-03', 'WEB-08'];
const requirementIndexes = arguments_
  .map((argument, index) => (argument === '--requirement' ? index : -1))
  .filter((index) => index >= 0);
const requirement =
  requirementIndexes.length === 1 ? arguments_[requirementIndexes[0] + 1] : undefined;

if (requirement === undefined || !requirements.includes(requirement)) {
  console.error('Provide --requirement exactly once with WEB-01, WEB-02, WEB-03, or WEB-08.');
  process.exitCode = 1;
} else {
  const defaults = {
    public: 'apps/web/.next/standalone',
    account: 'apps/account/.next/standalone',
    admin: 'apps/admin/.next/standalone',
  };
  const surfaces = {
    'WEB-01': ['public'],
    'WEB-02': ['public'],
    'WEB-03': ['public'],
    'WEB-08': ['public', 'account', 'admin'],
  };
  const artifacts = {
    'WEB-01': [
      ['MISSING_ROUTE_EVIDENCE', 'quality/evidence/phase-03/web/public-routes.json'],
      ['MISSING_CONTENT_EVIDENCE', 'quality/evidence/phase-03/web/content-publication.json'],
      ['MISSING_VISUAL_EVIDENCE', 'quality/evidence/phase-03/web/visual-report.json'],
    ],
    'WEB-02': [
      ['MISSING_ROUTE_EVIDENCE', 'quality/evidence/phase-03/web/docs-routes.json'],
      ['MISSING_CONTENT_EVIDENCE', 'quality/evidence/phase-03/web/docs-publication.json'],
    ],
    'WEB-03': [
      ['MISSING_RELEASE_EVIDENCE', 'quality/evidence/phase-03/web/release-gate.json'],
      ['MISSING_ARTIFACT_EVIDENCE', 'quality/evidence/phase-03/web/release-artifact.json'],
    ],
    'WEB-08': [
      ['MISSING_SECURITY_EVIDENCE', 'quality/evidence/phase-03/web/security-boundaries.json'],
      ['MISSING_PREVIEW_EVIDENCE', 'quality/evidence/phase-03/web/preview-boundaries.json'],
    ],
  };

  const configuredRoots = {};
  for (const [index, argument] of arguments_.entries()) {
    if (argument !== '--build-root') {
      continue;
    }
    const match = /^(public|account|admin)=(.+)$/u.exec(arguments_[index + 1] ?? '');
    if (match === null) {
      console.error('--build-root must use surface=path.');
      process.exitCode = 1;
      break;
    }
    configuredRoots[match[1]] = match[2];
  }

  if (process.exitCode !== 1) {
    const diagnostics = [];
    for (const surface of surfaces[requirement]) {
      const candidate = configuredRoots[surface] ?? defaults[surface];
      const portable = candidate.replaceAll('\\', '/');
      if (/(?:^|\/)(?:src|app)(?:\/|$)/u.test(portable) && !portable.includes('/.next/')) {
        diagnostics.push(['SOURCE_TREE_EVIDENCE_REJECTED', `$.buildRoots.${surface}`]);
        continue;
      }
      const absolute = normalize(
        isAbsolute(candidate) ? candidate : join(process.cwd(), candidate),
      );
      if (
        !existsSync(absolute) ||
        !statSync(absolute).isDirectory() ||
        readdirSync(absolute).length === 0
      ) {
        diagnostics.push(['MISSING_BUILD_ROOT', `$.buildRoots.${surface}`]);
      }
    }

    for (const [code, artifact] of artifacts[requirement]) {
      if (!existsSync(join(process.cwd(), artifact))) {
        diagnostics.push([code, artifact]);
      }
    }

    if (diagnostics.length > 0) {
      for (const [code, path] of diagnostics) {
        console.error(`${code} ${path}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`Workspace readiness passed for ${requirement}.`);
    }
  }
}
