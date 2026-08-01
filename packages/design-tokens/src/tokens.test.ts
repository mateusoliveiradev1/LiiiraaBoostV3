/// <reference lib="dom" />

import { describe, expect, it } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

import {
  CTA_STATES,
  COLOR_TOKENS,
  ELEVATION,
  FOCUS_GEOMETRY,
  FONT_FAMILIES,
  GLOW_LIMITS,
  MOTION_LIMITS,
  MOTION_TOKENS,
  PROHIBITED_MOTION,
  RADII,
  SPACING,
  STATUS_PATTERNS,
  TYPOGRAPHY,
  Z_INDEX,
  assertSpacingValue,
  createAppearanceTokens,
} from './index.ts';

const oklchToLinearSrgb = (value: string): readonly [number, number, number] => {
  const match = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/u.exec(value);

  if (!match) {
    throw new TypeError(`Expected a canonical OKLCH value, received ${value}`);
  }

  const [, lightnessValue, chromaValue, hueValue] = match;
  const lightness = Number(lightnessValue);
  const chroma = Number(chromaValue);
  const hue = (Number(hueValue) * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (channel: number): number => Math.min(1, Math.max(0, channel));

  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
};

const contrastRatio = (left: string, right: string): number => {
  const luminance = (value: string): number => {
    const [red, green, blue] = oklchToLinearSrgb(value);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const leftLuminance = luminance(left);
  const rightLuminance = luminance(right);

  return (
    (Math.max(leftLuminance, rightLuminance) + 0.05) /
    (Math.min(leftLuminance, rightLuminance) + 0.05)
  );
};

describe('Cobalt Ignition Bay token contract', () => {
  it('locks layout spacing and rejects off-scale values', () => {
    expect(Object.values(SPACING)).toEqual([4, 8, 16, 24, 32, 48, 64]);
    expect(() => assertSpacingValue(12)).toThrow('12px is outside the locked spacing scale');
    expect(assertSpacingValue(24)).toBe(24);
  });

  it('locks the public, documentation, and product type scales to two weights', () => {
    expect(FONT_FAMILIES).toEqual({
      fontBody: 'manrope',
      fontData: 'jetbrains-mono',
      fontDisplay: 'saira-semi-condensed',
    });
    expect(TYPOGRAPHY).toEqual({
      public: {
        body: { family: 'manrope', lineHeight: 28, size: 17, weights: [400] },
        heroDisplay: {
          family: 'saira-semi-condensed',
          lineHeight: 0.96,
          maxSize: 76,
          minSize: 52,
          weights: [600],
        },
        label: { family: 'manrope', lineHeight: 20, size: 14, weights: [600] },
        sectionDisplay: {
          family: 'saira-semi-condensed',
          lineHeight: 1.02,
          maxSize: 48,
          minSize: 36,
          weights: [600],
        },
      },
      documentation: {
        body: { family: 'manrope', lineHeight: 26, size: 16, weights: [400] },
        label: { family: 'manrope', lineHeight: 20, size: 14, weights: [600] },
        pageHeading: { family: 'manrope', lineHeight: 46, size: 40, weights: [600] },
        sectionHeading: { family: 'manrope', lineHeight: 30, size: 24, weights: [600] },
      },
      product: {
        body: { family: 'manrope', lineHeight: 24, size: 16, weights: [400, 600] },
        label: { family: 'manrope', lineHeight: 20, size: 14, weights: [400, 600] },
        pageHeading: { family: 'manrope', lineHeight: 38, size: 32, weights: [600] },
        taskHeading: { family: 'manrope', lineHeight: 30, size: 24, weights: [600] },
      },
    });

    const serialized = JSON.stringify(TYPOGRAPHY);
    expect(serialized).not.toMatch(/"size":(?:13|15|20|28)(?:,|\})/u);
    expect(serialized).not.toContain('"weights":[700]');
  });

  it('locks every Section 8 OKLCH role without purple preview chrome', () => {
    expect(COLOR_TOKENS).toEqual({
      accentCyan: 'oklch(0.820 0.135 220)',
      accentElectric: 'oklch(0.670 0.210 255)',
      accentElectricHover: 'oklch(0.730 0.190 250)',
      accentElectricPressed: 'oklch(0.610 0.200 255)',
      canvas: 'oklch(0.115 0.018 260)',
      canvasInset: 'oklch(0.145 0.024 260)',
      critical: 'oklch(0.700 0.200 25)',
      destructive: 'oklch(0.580 0.220 25)',
      lineStrong: 'oklch(0.390 0.060 255)',
      lineSubtle: 'oklch(0.285 0.035 255)',
      panel: 'oklch(0.180 0.032 258)',
      panelRaised: 'oklch(0.225 0.045 257)',
      scrim: 'rgba(3, 5, 8, 0.76)',
      success: 'oklch(0.750 0.170 150)',
      textPrimary: 'oklch(0.965 0.012 255)',
      textSecondary: 'oklch(0.760 0.030 255)',
      textTertiary: 'oklch(0.650 0.028 255)',
      warning: 'oklch(0.820 0.160 82)',
    });
    expect(JSON.stringify(COLOR_TOKENS)).not.toMatch(/purple|experimental|\b(?:2[78][0-9]|3[0-2][0-9])\b/iu);
    expect(RADII).toEqual({ radiusControl: 6, radiusPanel: 10, radiusPill: 999, radiusStage: 14 });
  });

  it('computes every authored CTA pair at or above 4.5:1 and locks forced colors', () => {
    for (const state of ['default', 'hover', 'pressed', 'disabled'] as const) {
      expect(contrastRatio(CTA_STATES[state].background, CTA_STATES[state].label)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    expect(CTA_STATES.loading).toEqual(CTA_STATES.default);
    expect(CTA_STATES.forcedColors).toEqual({
      background: 'ButtonFace',
      boundary: 'ButtonText',
      focus: 'Highlight',
      label: 'ButtonText',
    });
  });

  it('locks E0-E3, glow caps, focus geometry, and semantic z-index roles', () => {
    expect(ELEVATION).toEqual({
      e0: { shadow: 'none' },
      e1: { shadow: 'none' },
      e2: { highlightWidth: 1, shadow: 'none' },
      e3: { shadow: '0 24px 64px rgb(0 0 0 / 52%)' },
    });
    expect(GLOW_LIMITS).toEqual({
      action: { opacity: 0.14, shadow: '0 0 24px' },
      hero: { blurPx: 64, heightPx: 360, opacity: 0.2, widthPx: 520 },
      maxVisible: 2,
    });
    expect(FOCUS_GEOMETRY).toEqual({ offsetPx: 2, widthPx: 2 });
    expect(Z_INDEX).toEqual({
      dropdown: 30,
      modal: 80,
      modalBackdrop: 70,
      popover: 60,
      sticky: 40,
      toast: 100,
      tooltip: 110,
    });
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
      '--lb-disabled-text': COLOR_TOKENS.textSecondary,
      '--lb-forced-canvas': 'Canvas',
      '--lb-forced-canvas-text': 'CanvasText',
      '--lb-forced-focus': 'Highlight',
      '--lb-motion-route-duration': '100ms',
      '--lb-motion-translate': '0px',
      '--lb-section-gap': '16px',
      '--lb-text-scale': '2',
    });
  });

  it('closes motion to the six approved durations, easings, limits, and prohibited set', () => {
    expect(Object.values(MOTION_TOKENS).map(({ durationMs }) => durationMs)).toEqual([
      100, 160, 200, 220, 360, 480,
    ]);
    expect(new Set(Object.values(MOTION_TOKENS).map(({ easing }) => easing))).toEqual(
      new Set(['linear', 'cubic-bezier(0.2, 0, 0, 1)', 'cubic-bezier(0.16, 1, 0.3, 1)']),
    );
    expect(MOTION_LIMITS).toEqual({
      entranceScaleMin: 0.985,
      reducedDurationMaxMs: 100,
      stageDelayMaxMs: 80,
      translateMaxPx: 8,
    });
    expect(PROHIBITED_MOTION).toEqual([
      'bounce',
      'elastic-spring',
      'parallax',
      'scan-line',
      'particles',
      'count-up',
      'pulsing-cta',
      'animated-grid',
      'infinite-ambient-loop',
    ]);
    expect(new Set(Object.values(STATUS_PATTERNS)).size).toBeGreaterThan(1);
    expect(STATUS_PATTERNS).toMatchObject({
      critical: 'double',
      fixture: 'dotted',
      unavailable: 'dotted',
      warning: 'dashed',
    });
  });

  it('mirrors canonical CSS properties and keeps legacy aliases bound to the authority', async () => {
    const css = await readFile(new URL('./tokens.css', import.meta.url), 'utf8');

    expect(css).toContain("font-family: 'Saira Semi Condensed Variable';");
    expect(css).toContain("src: url('/fonts/saira-semi-condensed-variable.woff2') format('woff2-variations');");
    expect(css).toContain('font-weight: 600;');
    expect(css).toContain('font-stretch: 87.5%;');
    expect(css).toContain('--lb-font-display:');
    expect(css).toContain('--lb-accent-electric: oklch(0.670 0.210 255);');
    expect(css).toContain('--lb-radius-stage: 14px;');
    expect(css).toContain('--lb-motion-product-stage-duration: 480ms;');
    expect(css).toContain('--lb-motion-stage-delay-max: 80ms;');
    expect(css).toContain('--lb-motion-entrance-scale-min: 0.985;');
    expect(css).toContain('--lb-cobalt-action: var(--lb-accent-electric);');
    expect(css).toContain('--lb-radius-default: var(--lb-radius-control);');
    expect(css).toContain('--lb-text-display-size: var(--lb-product-page-heading-size);');
    expect(css).not.toMatch(/--lb-experimental:\s*#[a-f\d]+/iu);
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*--lb-motion-translate-max:\s*0px;[\s\S]*--lb-motion-entrance-scale-min:\s*1;/u,
    );
    expect(css).toMatch(
      /@media \(forced-colors: active\)[\s\S]*--lb-primary-background:\s*ButtonFace;[\s\S]*--lb-primary-label:\s*ButtonText;/u,
    );
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
