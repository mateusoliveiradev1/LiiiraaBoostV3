import { describe, expect, it } from 'vitest';

import workflow from '../../../../.github/workflows/phase-4-staging-api.yml?raw';
import rootDockerIgnore from '../../../../.dockerignore?raw';
import dockerIgnore from '../../.dockerignore?raw';
import dockerfile from '../../Dockerfile?raw';
import runtimeEntrypoint from './main.mjs?raw';
import renderManifest from '../../staging.render.yaml?raw';

describe('daemon-free OCI artifact contract', () => {
  it('pins the application toolchains and uses an unprivileged runtime with health checks', () => {
    expect(dockerfile).toContain('FROM node:24.18.0-bookworm-slim');
    expect(dockerfile).toContain('corepack prepare pnpm@11.17.0 --activate');
    expect(dockerfile).toContain('pnpm install --frozen-lockfile --ignore-scripts');
    expect(dockerfile).not.toContain('COPY tooling tooling');
    expect(dockerfile).toContain('USER node');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain("fetch('http://127.0.0.1:3000/health')");
    expect(dockerfile).toContain('apps/api/src/staging/main.mjs');
    expect(dockerfile).not.toContain('/workspace /workspace');
    expect(runtimeEntrypoint).toContain('startRealStagingServer');
    expect(runtimeEntrypoint).not.toContain('createServer');
    expect(runtimeEntrypoint).not.toContain('authorityConnected: false');
    expect(dockerfile).toContain('/workspace/node_modules node_modules');
    expect(dockerfile).toContain('/workspace/apps/api apps/api');
    expect(dockerfile).toContain('/workspace/packages packages');
  });

  it('excludes secrets, generated desktop artifacts, and unrelated build output', () => {
    for (const ignoreFile of [dockerIgnore, rootDockerIgnore]) {
      expect(ignoreFile).toContain('.env');
      expect(ignoreFile).toContain('**/node_modules');
      expect(ignoreFile).toContain('apps/desktop/src-tauri/gen');
    }
  });

  it('keeps Render manual and requires the CI-supplied immutable digest', () => {
    expect(renderManifest).toContain('autoDeploy: false');
    expect(renderManifest).toContain('plan: free');
    expect(renderManifest).toContain(
      'ghcr.io/mateusoliveiradev1/liiiraa-boost-api@${STAGING_IMAGE_DIGEST}',
    );
    expect(renderManifest).toContain('healthCheckPath: /health');
    expect(renderManifest).toContain('STAGING_DATA_CLASSIFICATION');
    expect(renderManifest).toContain('value: synthetic');
    expect(renderManifest).toContain('STAGING_INVITATION_ONLY');
    expect(renderManifest).toContain('STAGING_PUBLIC_SIGNUP');
  });

  it('builds once, attests and scans the digest, then deploys that same digest', () => {
    expect(workflow).toContain('build_only:');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('inputs.build_only != true');
    expect(workflow).toContain(
      'outputs: type=image,name=ghcr.io/${{ github.repository_owner }}/liiiraa-boost-api,push-by-digest=true,name-canonical=true,push=true',
    );
    expect(workflow).toContain('digest: ${{ steps.build.outputs.digest }}');
    expect(workflow).toContain('subject-digest: ${{ steps.build.outputs.digest }}');
    expect(workflow).toContain(
      'ghcr.io/${{ github.repository_owner }}/liiiraa-boost-api@${{ needs.build.outputs.digest }}',
    );
    expect(workflow).toContain('environment: staging-api');
    expect(workflow).toContain('autoDeploy: false');
    expect(workflow).toContain('run: pnpm --filter @liiiraa/api db:migrate');
    expect(workflow).toContain('Install exact Node.js for migration promotion');
    expect(workflow).toContain('Install frozen migration dependencies without lifecycle scripts');
    expect(workflow).toContain('services/$RENDER_SERVICE_ID/env-vars');
    expect(workflow).toContain('STAGING_BUILD_ID: ${{ github.sha }}');
    expect(workflow).toContain('RENDER_OWNER_ID: ${{ secrets.RENDER_OWNER_ID }}');
    expect(workflow).toContain('services/$RENDER_SERVICE_ID/deploys');
    expect(workflow).toContain('for attempt in $(seq 1 30)');
    expect(workflow).toContain('POSTGRES_TEST_STRATEGY: unit');
    expect(workflow).toContain("hashFiles('trivy-results.sarif') != ''");
    expect(workflow).toContain('docker logout ghcr.io');
    expect(workflow).toContain('docker buildx imagetools inspect');
    expect(workflow).not.toContain(
      'Run staging migrations before promotion\n        env:\n          STAGING_DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}\n        run: pnpm --filter @liiiraa/api db:migrate:test',
    );
    expect(workflow).not.toMatch(/liiiraa-boost-api:[a-z0-9._-]+/iu);
  });

  it('pins every GitHub Action reference to a full commit SHA', () => {
    const actions = [...workflow.matchAll(/uses:\s*[^@\s]+@([^\s]+)/gu)].map((match) => match[1]);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((reference) => /^[0-9a-f]{40}$/u.test(reference ?? ''))).toBe(true);
  });
});
