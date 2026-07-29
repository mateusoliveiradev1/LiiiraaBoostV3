// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { BrandIcon } from './brand-icons.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

describe('brand icons', () => {
  it.each([
    ['NVIDIA GeForce RTX 4070', 'nvidia', 'simple-icons'],
    ['AMD Ryzen 7 7800X3D', 'amd', 'simple-icons'],
    ['Intel Core', 'intel', 'simple-icons'],
    ['Windows 11', 'windows', 'local-official-mark'],
    ['Microsoft Edge WebView2 Runtime', 'webview2', 'local-official-mark'],
    ['ChatGPT', 'chatgpt', 'local-official-mark'],
    ['Discord', 'discord', 'simple-icons'],
  ])('renders the real %s identity instead of a letter fallback', (label, brand, source) => {
    const markup = renderToStaticMarkup(<BrandIcon brand={brand} label={label} />);

    expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).toContain(`data-brand-source="${source}"`);
    expect(markup).not.toContain('premium-brand-icon-fallback');
    expect(markup).toContain('<svg');
  });
});
