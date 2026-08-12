/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PremiumOperationsSurface } from './features/premium-operations-production.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;
const sourceRoot = dirname(fileURLToPath(import.meta.url));
const desktopRoot = resolve(sourceRoot, '..');

describe('published desktop composition', () => {
  it('boots only through the production entrypoint and excludes visual scenario runtimes', () => {
    const html = readFileSync(resolve(desktopRoot, 'index.html'), 'utf8');
    const playwrightConfig = readFileSync(resolve(desktopRoot, 'playwright.config.ts'), 'utf8');
    const productionIndex = readFileSync(resolve(sourceRoot, 'production-index.tsx'), 'utf8');
    const productionApp = readFileSync(resolve(sourceRoot, 'app.tsx'), 'utf8');
    const viteConfig = readFileSync(resolve(desktopRoot, 'vite.config.ts'), 'utf8');

    expect(html).toContain('/src/production-index.tsx');
    expect(html).not.toContain('/src/index.ts');
    expect(productionIndex).toContain("from './app.js'");
    expect(productionIndex).toContain('<DesktopApp />');
    expect(productionIndex).not.toContain("from './production-app.js'");
    expect(productionApp).not.toMatch(
      /from ['"][^'"]*\/premium-operations(?:\.js)?['"]/u,
    );
    expect(productionApp).not.toMatch(/from ['"][^'"]*\/premium-updater(?:\.js)?['"]/u);
    expect(productionApp).toContain("import.meta.env.PROD");
    expect(playwrightConfig).toContain(
      'pnpm exec vite build --mode browser-test && pnpm exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
    );
    expect(viteConfig).toContain("mode === 'browser-test'");
    expect(viteConfig).toContain("const PRODUCTION_ENTRYPOINT = '/src/production-index.tsx'");
    expect(viteConfig).toContain("const BROWSER_TEST_ENTRYPOINT = '/src/index.ts'");
    expect(viteConfig).toContain(
      "const PRODUCTION_OPERATIONS_MODULE = './features/premium-operations-production.js'",
    );
    expect(viteConfig).toContain("new URL('./src/features/premium-operations.tsx'");
  });

  it('keeps production home behind native inventory and telemetry authorities', () => {
    const productionOperations = readFileSync(
      resolve(sourceRoot, 'features/premium-operations-production.tsx'),
      'utf8',
    );
    const home = renderToStaticMarkup(
      <PremiumOperationsSurface locale="pt-BR" navigate={() => undefined} view="home" />,
    );
    const about = renderToStaticMarkup(
      <PremiumOperationsSurface locale="pt-BR" navigate={() => undefined} view="about" />,
    );

    expect(home).toContain('data-telemetry-authority="unavailable"');
    expect(productionOperations).toContain('NativeLiveTelemetrySurface');
    expect(productionOperations).not.toMatch(/'4%'|'2%'|'9,8 GB'|'1,2 ms'/u);
    expect(productionOperations).not.toContain('Dados locais do cenário demonstrativo');
    expect(about).toContain('Identidade da instalação indisponível');
    expect(`${home}${about}`).not.toMatch(
      /SIMULATED SCENARIO|SIMULAÇÃO SEGURA|Demonstração segura/iu,
    );
  });
});
