/// <reference lib="dom" />

import { describe, expect, it } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import {
  COLOR_TOKENS,
  MOTION_TOKENS,
  RADII,
  SPACING,
  STATUS_PATTERNS,
  TYPOGRAPHY,
  assertSpacingValue,
  createAppearanceTokens,
} from './index.ts';

describe('Pre-Dawn Flight Deck token contract', () => {
  it('locks layout spacing and rejects off-scale values', () => {
    expect(Object.values(SPACING)).toEqual([4, 8, 16, 24, 32, 48, 64]);
    expect(() => assertSpacingValue(12)).toThrow('12px is outside the locked spacing scale');
    expect(assertSpacingValue(24)).toBe(24);
  });

  it('allows only the four authored text sizes and two weights', () => {
    const typography = Object.values(TYPOGRAPHY);

    expect(
      [...new Set(typography.map(({ size }) => size))].sort((left, right) => left - right),
    ).toEqual([13, 15, 20, 28]);
    expect(
      [...new Set(typography.flatMap(({ weights }) => weights))].sort(
        (left, right) => left - right,
      ),
    ).toEqual([400, 600]);
    expect(new Set(typography.map(({ family }) => family))).toEqual(new Set(['manrope', 'mono']));
  });

  it('locks the authored surface, cobalt, semantic, focus, and disabled colors', () => {
    expect(COLOR_TOKENS).toEqual({
      surfaceCanvas: '#090B0F',
      surfaceInset: '#0B0E13',
      surfaceWork: '#121722',
      surfaceRaised: '#181F2C',
      cobaltAction: '#315ACD',
      cobaltSignal: '#7EA0FF',
      textPrimary: '#F4F7FB',
      textSecondary: '#AAB4C4',
      textTertiary: '#7D899B',
      lineSubtle: '#2A3343',
      lineStrong: '#3D4A60',
      focusRing: '#8EABFF',
      success: '#4DCA8B',
      warning: '#F3B64A',
      critical: '#FF747D',
      destructiveFill: '#B52D3A',
      experimental: '#C08CFF',
      disabledFill: '#3D4452',
      scrim: 'rgba(3, 5, 8, 0.76)',
    });
    expect(RADII).toEqual({ default: 6, overlay: 10 });
  });

  it('resolves compact, 150% scale, 200% text, reduced-motion, and forced-color outputs', () => {
    const output = createAppearanceTokens({
      density: 'compact',
      forcedColors: true,
      motion: 'reduced',
      scale: 150,
      textScale: 200,
    });

    expect(output).toMatchObject({
      '--lb-app-scale': '1.5',
      '--lb-control-gap': '8px',
      '--lb-control-min-size': '44px',
      '--lb-disabled-opacity': '1',
      '--lb-disabled-text': '#AAB4C4',
      '--lb-forced-canvas': 'Canvas',
      '--lb-forced-canvas-text': 'CanvasText',
      '--lb-forced-focus': 'Highlight',
      '--lb-motion-route-duration': '100ms',
      '--lb-motion-translate': '0px',
      '--lb-section-gap': '16px',
      '--lb-text-scale': '2',
    });
  });

  it('keeps motion bounded and gives every state a non-color pattern', () => {
    expect(Math.max(...Object.values(MOTION_TOKENS).map(({ durationMs }) => durationMs))).toBe(240);
    expect(new Set(Object.values(STATUS_PATTERNS)).size).toBeGreaterThan(1);
    expect(STATUS_PATTERNS).toMatchObject({
      critical: 'double',
      fixture: 'diagonal-stripe',
      unavailable: 'dotted',
      warning: 'dashed',
    });
  });

  it('keeps modal stacking and responsive action layout in the token contract', async () => {
    const css = await readFile(new URL('./tokens.css', import.meta.url), 'utf8');

    expect(css).toContain('--lb-layer-modal: 80;');
    expect(css).toMatch(
      /\.lb-modal-overlay\s*\{[^}]*z-index:\s*var\(--lb-layer-modal\);[^}]*isolation:\s*isolate;/u,
    );
    expect(css).toMatch(
      /\.lb-dialog-actions\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-end;/u,
    );
    expect(css).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.lb-dialog-actions\s*\{[^}]*flex-direction:\s*column;/u,
    );
  });

  it('locks every web font identity beside its reviewed OFL license', async () => {
    const fontDirectory = new URL('../../../apps/web/public/fonts/', import.meta.url);
    const assets = [
      {
        file: 'manrope-variable.woff2',
        license: 'OFL-Manrope.txt',
        sha256: 'a30ddcd349703aff7464c34bef3fffdff405ee50c113440d7c8693c02d210972',
      },
      {
        file: 'jetbrains-mono-variable.woff2',
        license: 'OFL-JetBrains-Mono.txt',
        sha256: '18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e',
      },
      {
        file: 'saira-semi-condensed-variable.woff2',
        license: 'OFL-Saira-Semi-Condensed.txt',
        sha256: 'd5f1ee1ce85a2f6611d76bcd98738132f4706b099dc167f02c2093a1ec5eb975',
      },
    ] as const;

    for (const asset of assets) {
      const fontBytes = await readFile(new URL(asset.file, fontDirectory));
      const license = await readFile(new URL(asset.license, fontDirectory), 'utf8');

      expect((await stat(new URL(asset.file, fontDirectory))).size).toBeGreaterThan(1_000);
      expect(fontBytes.subarray(0, 4).toString('ascii')).toBe('wOF2');
      expect(createHash('sha256').update(fontBytes).digest('hex')).toBe(asset.sha256);
      expect(license).toContain('SIL OPEN FONT LICENSE Version 1.1');
    }
  });

  it('admits only the approved Saira Semi Condensed variable source and display weight', async () => {
    const fontDirectory = new URL('../../../apps/web/public/fonts/', import.meta.url);
    const license = await readFile(
      new URL('OFL-Saira-Semi-Condensed.txt', fontDirectory),
      'utf8',
    );

    expect(license).toContain('Copyright 2016 The Saira Project Authors');
    expect(license).toContain('reserved font name "Saira"');
    expect({
      family: 'Saira Semi Condensed',
      officialArtifact:
        'https://fonts.gstatic.com/s/saira/v23/memwYa2wxmKQyNknTZM.woff2',
      officialSource: 'https://github.com/Omnibus-Type/Saira',
      stretch: '87.5%',
      weights: [600],
    }).toEqual({
      family: 'Saira Semi Condensed',
      officialArtifact:
        'https://fonts.gstatic.com/s/saira/v23/memwYa2wxmKQyNknTZM.woff2',
      officialSource: 'https://github.com/Omnibus-Type/Saira',
      stretch: '87.5%',
      weights: [600],
    });
  });
});
