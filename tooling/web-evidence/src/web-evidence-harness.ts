export type WebRequirement = 'WEB-01' | 'WEB-02' | 'WEB-03' | 'WEB-08';
export type WebSurface = 'public' | 'account' | 'admin';

export interface EvidenceDiagnostic {
  readonly code: string;
  readonly path: string;
}

export interface EvidenceResult {
  readonly diagnostics: readonly EvidenceDiagnostic[];
  readonly ok: boolean;
}

export interface RouteEvidence {
  readonly routes: readonly Readonly<{
    id: string;
    owner: string;
    safeContextKeys: readonly string[];
    surface: WebSurface;
  }>[];
  readonly expectedRouteIds: readonly string[];
  readonly navigationRouteIds: readonly string[];
  readonly expectedNavigationRouteIds: readonly string[];
  readonly sitemapRouteIds: readonly string[];
  readonly expectedSitemapRouteIds: readonly string[];
  readonly redirectRouteIds: readonly string[];
  readonly expectedRedirectRouteIds: readonly string[];
  readonly desktopLinkRouteIds: readonly string[];
  readonly expectedDesktopLinkRouteIds: readonly string[];
}

export interface ContentPublicationEvidence {
  readonly asOf: string;
  readonly documents: readonly Readonly<{
    evidenceIds: readonly string[];
    id: string;
    locales: readonly string[];
    reviewBy: string;
    screenshotIds: readonly string[];
    searchIndexed: boolean;
  }>[];
  readonly release: Readonly<{
    channel: string;
    contentVersion: string;
    manifestVersion: string;
  }>;
}

export interface SecurityBoundaryEvidence {
  readonly surfaces: readonly Readonly<{
    cookieScope: string;
    fixtureReferences: readonly string[];
    headers: Readonly<Record<string, string | undefined>>;
    indexing: 'index' | 'noindex';
    origin: string;
    surface: WebSurface;
  }>[];
}

export interface ReleaseEvidence {
  readonly artifact: Readonly<{
    channel: string;
    classification: 'public-signed' | 'development';
    digest: string;
    version: string;
  }>;
  readonly bypassAllowed: boolean;
  readonly integrityStatus: 'verified' | 'mismatch';
  readonly manifest: Readonly<{
    channel: string;
    evidenceIds: readonly string[];
    version: string;
  }>;
}

export interface WorkspaceReadinessInput {
  readonly buildRoots?: Readonly<Partial<Record<WebSurface, string>>>;
  readonly requirement: WebRequirement;
  readonly repositoryRoot: string;
}

interface NodeFileSystem {
  readonly existsSync: (path: string) => boolean;
  readonly readdirSync: (path: string) => readonly string[];
  readonly statSync: (path: string) => Readonly<{ isDirectory: () => boolean }>;
}

interface NodePath {
  readonly isAbsolute: (path: string) => boolean;
  readonly join: (...paths: readonly string[]) => string;
  readonly normalize: (path: string) => string;
}

declare const process: {
  readonly getBuiltinModule: (specifier: 'node:fs' | 'node:path') => unknown;
};

const result = (diagnostics: readonly EvidenceDiagnostic[]): EvidenceResult =>
  Object.freeze({
    diagnostics: Object.freeze([...diagnostics]),
    ok: diagnostics.length === 0,
  });

const diagnostic = (code: string, path: string): EvidenceDiagnostic =>
  Object.freeze({ code, path });

const firstMissing = (expected: readonly string[], actual: readonly string[]): string | undefined =>
  expected.find((value) => !actual.includes(value));

export const inspectRouteEvidence = (evidence: RouteEvidence): EvidenceResult => {
  const diagnostics: EvidenceDiagnostic[] = [];
  const routeIds = evidence.routes.map(({ id }) => id);
  const missingRoute = firstMissing(evidence.expectedRouteIds, routeIds);
  if (missingRoute !== undefined) {
    diagnostics.push(diagnostic('MISSING_ROUTE', `$.routes.${missingRoute}`));
  }

  const projections = [
    [
      evidence.expectedNavigationRouteIds,
      evidence.navigationRouteIds,
      'MISSING_NAVIGATION_ROUTE',
      '$.navigation',
    ],
    [
      evidence.expectedSitemapRouteIds,
      evidence.sitemapRouteIds,
      'MISSING_SITEMAP_ROUTE',
      '$.sitemap',
    ],
    [
      evidence.expectedRedirectRouteIds,
      evidence.redirectRouteIds,
      'MISSING_REDIRECT_ROUTE',
      '$.redirects',
    ],
    [
      evidence.expectedDesktopLinkRouteIds,
      evidence.desktopLinkRouteIds,
      'MISSING_DESKTOP_LINK_ROUTE',
      '$.desktopLinks',
    ],
  ] as const;

  for (const [expected, actual, code, path] of projections) {
    const missing = firstMissing(expected, actual);
    if (missing !== undefined) {
      diagnostics.push(diagnostic(code, `${path}.${missing}`));
    }
  }

  for (const route of evidence.routes) {
    const unsafeKey = route.safeContextKeys.find(
      (key) =>
        !['locale', 'version', 'channel', 'section', 'destination', 'return-path'].includes(key),
    );
    if (unsafeKey !== undefined) {
      diagnostics.push(diagnostic('UNSAFE_CONTEXT_KEY', `$.routes.${route.id}.${unsafeKey}`));
    }
    if (route.owner.length === 0) {
      diagnostics.push(diagnostic('MISSING_ROUTE_OWNER', `$.routes.${route.id}.owner`));
    }
  }

  return result(diagnostics);
};

export const inspectContentPublicationEvidence = (
  evidence: ContentPublicationEvidence,
): EvidenceResult => {
  const diagnostics: EvidenceDiagnostic[] = [];
  for (const document of evidence.documents) {
    for (const locale of ['pt-BR', 'en']) {
      if (!document.locales.includes(locale)) {
        diagnostics.push(
          diagnostic('MISSING_CONTENT_LOCALE', `$.documents.${document.id}.locales.${locale}`),
        );
      }
    }
    if (
      Date.parse(`${document.reviewBy}T00:00:00.000Z`) <=
      Date.parse(`${evidence.asOf}T00:00:00.000Z`)
    ) {
      diagnostics.push(diagnostic('STALE_CONTENT', `$.documents.${document.id}.reviewBy`));
    }
    if (document.evidenceIds.length === 0) {
      diagnostics.push(
        diagnostic('MISSING_CONTENT_EVIDENCE', `$.documents.${document.id}.evidenceIds`),
      );
    }
    if (document.screenshotIds.length === 0) {
      diagnostics.push(
        diagnostic('MISSING_VISUAL_EVIDENCE', `$.documents.${document.id}.screenshotIds`),
      );
    }
    if (!document.searchIndexed) {
      diagnostics.push(
        diagnostic('MISSING_SEARCH_INDEX_ENTRY', `$.documents.${document.id}.searchIndexed`),
      );
    }
  }
  if (evidence.release.contentVersion !== evidence.release.manifestVersion) {
    diagnostics.push(diagnostic('RELEASE_CONTENT_MISMATCH', '$.release.contentVersion'));
  }
  return result(diagnostics);
};

const REQUIRED_HEADERS = [
  'content-security-policy',
  'referrer-policy',
  'x-content-type-options',
] as const;

export const inspectSecurityBoundaryEvidence = (
  evidence: SecurityBoundaryEvidence,
): EvidenceResult => {
  const diagnostics: EvidenceDiagnostic[] = [];
  for (const surface of evidence.surfaces) {
    for (const header of REQUIRED_HEADERS) {
      if (surface.headers[header] === undefined) {
        diagnostics.push(
          diagnostic('MISSING_SECURITY_HEADER', `$.surfaces.${surface.surface}.headers.${header}`),
        );
      }
    }
    if (!surface.headers['content-security-policy']?.includes("frame-ancestors 'none'")) {
      diagnostics.push(
        diagnostic('MISSING_CSP_DIRECTIVE', `$.surfaces.${surface.surface}.headers.csp`),
      );
    }
    if (surface.surface !== 'public' && surface.indexing !== 'noindex') {
      diagnostics.push(diagnostic('PRIVATE_INDEXING', `$.surfaces.${surface.surface}.indexing`));
    }
    const hostname = new URL(surface.origin).hostname;
    if (surface.cookieScope !== hostname) {
      diagnostics.push(
        diagnostic('COOKIE_SCOPE_VIOLATION', `$.surfaces.${surface.surface}.cookieScope`),
      );
    }
  }

  const origins = evidence.surfaces.map(({ origin }) => origin);
  if (new Set(origins).size !== origins.length) {
    diagnostics.push(diagnostic('ORIGIN_BOUNDARY_VIOLATION', '$.surfaces.origin'));
  }
  const publicSurface = evidence.surfaces.find(({ surface }) => surface === 'public');
  if (publicSurface !== undefined && publicSurface.fixtureReferences.length > 0) {
    diagnostics.push(diagnostic('FIXTURE_LEAKAGE', '$.surfaces.public.fixtureReferences'));
  }

  return result(diagnostics);
};

export const inspectReleaseEvidence = (evidence: ReleaseEvidence): EvidenceResult => {
  const diagnostics: EvidenceDiagnostic[] = [];
  if (evidence.manifest.evidenceIds.length === 0) {
    diagnostics.push(diagnostic('MISSING_RELEASE_EVIDENCE', '$.manifest.evidenceIds'));
  }
  if (
    evidence.artifact.classification !== 'public-signed' ||
    !/^[a-f0-9]{64}$/u.test(evidence.artifact.digest)
  ) {
    diagnostics.push(diagnostic('DEVELOPMENT_ARTIFACT_REJECTED', '$.artifact'));
  }
  if (
    evidence.artifact.version !== evidence.manifest.version ||
    evidence.artifact.channel !== evidence.manifest.channel
  ) {
    diagnostics.push(diagnostic('RELEASE_MISMATCH', '$.artifact'));
  }
  if (evidence.integrityStatus !== 'verified') {
    diagnostics.push(diagnostic('INTEGRITY_MISMATCH', '$.integrityStatus'));
  }
  if (evidence.bypassAllowed) {
    diagnostics.push(diagnostic('RELEASE_BYPASS_REJECTED', '$.bypassAllowed'));
  }
  return result(diagnostics);
};

const BUILD_ROOTS: Readonly<Record<WebSurface, string>> = Object.freeze({
  public: 'apps/web/.next/standalone',
  account: 'apps/account/.next/standalone',
  admin: 'apps/admin/.next/standalone',
});

const REQUIREMENT_SURFACES: Readonly<Record<WebRequirement, readonly WebSurface[]>> = Object.freeze(
  {
    'WEB-01': ['public'],
    'WEB-02': ['public'],
    'WEB-03': ['public'],
    'WEB-08': ['public', 'account', 'admin'],
  },
);

const REQUIREMENT_ARTIFACTS: Readonly<
  Record<WebRequirement, readonly Readonly<{ code: string; path: string }>[]>
> = Object.freeze({
  'WEB-01': [
    { code: 'MISSING_ROUTE_EVIDENCE', path: 'quality/evidence/phase-03/web/public-routes.json' },
    {
      code: 'MISSING_CONTENT_EVIDENCE',
      path: 'quality/evidence/phase-03/web/content-publication.json',
    },
    { code: 'MISSING_VISUAL_EVIDENCE', path: 'quality/evidence/phase-03/web/visual-report.json' },
  ],
  'WEB-02': [
    { code: 'MISSING_ROUTE_EVIDENCE', path: 'quality/evidence/phase-03/web/docs-routes.json' },
    {
      code: 'MISSING_CONTENT_EVIDENCE',
      path: 'quality/evidence/phase-03/web/docs-publication.json',
    },
  ],
  'WEB-03': [
    { code: 'MISSING_RELEASE_EVIDENCE', path: 'quality/evidence/phase-03/web/release-gate.json' },
    {
      code: 'MISSING_ARTIFACT_EVIDENCE',
      path: 'quality/evidence/phase-03/web/release-artifact.json',
    },
  ],
  'WEB-08': [
    {
      code: 'MISSING_SECURITY_EVIDENCE',
      path: 'quality/evidence/phase-03/web/security-boundaries.json',
    },
    {
      code: 'MISSING_PREVIEW_EVIDENCE',
      path: 'quality/evidence/phase-03/web/preview-boundaries.json',
    },
  ],
});

const isSourceTree = (path: string): boolean =>
  /(?:^|\/)(?:src|app)(?:\/|$)/u.test(path.replaceAll('\\', '/')) &&
  !path.replaceAll('\\', '/').includes('/.next/');

const resolvePath = (path: NodePath, repositoryRoot: string, candidate: string): string =>
  path.normalize(path.isAbsolute(candidate) ? candidate : path.join(repositoryRoot, candidate));

export const inspectWorkspaceReadiness = (input: WorkspaceReadinessInput): EvidenceResult => {
  const fs = process.getBuiltinModule('node:fs') as NodeFileSystem;
  const path = process.getBuiltinModule('node:path') as NodePath;
  const diagnostics: EvidenceDiagnostic[] = [];
  const surfaces = REQUIREMENT_SURFACES[input.requirement];

  for (const surface of surfaces) {
    const configuredRoot = input.buildRoots?.[surface] ?? BUILD_ROOTS[surface];
    if (isSourceTree(configuredRoot)) {
      diagnostics.push(diagnostic('SOURCE_TREE_EVIDENCE_REJECTED', `$.buildRoots.${surface}`));
      continue;
    }
    const absoluteRoot = resolvePath(path, input.repositoryRoot, configuredRoot);
    if (
      !fs.existsSync(absoluteRoot) ||
      !fs.statSync(absoluteRoot).isDirectory() ||
      fs.readdirSync(absoluteRoot).length === 0
    ) {
      diagnostics.push(diagnostic('MISSING_BUILD_ROOT', `$.buildRoots.${surface}`));
    }
  }

  for (const artifact of REQUIREMENT_ARTIFACTS[input.requirement]) {
    const absoluteArtifact = resolvePath(path, input.repositoryRoot, artifact.path);
    if (!fs.existsSync(absoluteArtifact)) {
      diagnostics.push(diagnostic(artifact.code, artifact.path));
    }
  }

  return result(diagnostics);
};
