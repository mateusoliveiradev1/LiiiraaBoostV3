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
    const productionApp = readFileSync(resolve(sourceRoot, 'production-app.tsx'), 'utf8');
    const viteConfig = readFileSync(resolve(desktopRoot, 'vite.config.ts'), 'utf8');

    expect(html).toContain('/src/production-index.tsx');
    expect(html).not.toContain('/src/index.ts');
    expect(productionIndex).toContain("from './production-app.js'");
    expect(productionApp).not.toMatch(/from ['"]\.\/app(?:\.js)?['"]/u);
    expect(productionApp).not.toMatch(/premium-operations(?:\.js)?['"]/u);
    expect(productionApp).not.toMatch(/premium-updater(?:\.js)?['"]/u);
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

  it('renders disconnected native capabilities as unavailable without optimistic success', () => {
    const home = renderToStaticMarkup(
      <PremiumOperationsSurface locale="pt-BR" navigate={() => undefined} view="home" />,
    );
    const about = renderToStaticMarkup(
      <PremiumOperationsSurface locale="pt-BR" navigate={() => undefined} view="about" />,
    );

    expect(home).toContain('data-phase="unavailable"');
    expect(home).toContain('Nenhuma alteração foi aplicada ao computador');
    expect(about).toContain('Identidade da instalação indisponível');
    expect(`${home}${about}`).not.toMatch(
      /SIMULATED SCENARIO|SIMULAÇÃO SEGURA|Demonstração segura/iu,
    );
  });
});
