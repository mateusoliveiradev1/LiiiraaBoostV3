export const SPACING = Object.freeze({
  space1: 4,
  space2: 8,
  space3: 16,
  space4: 24,
  space5: 32,
  space6: 48,
  space7: 64,
} as const);

export type SpacingValue = (typeof SPACING)[keyof typeof SPACING];

const SPACING_VALUES = Object.freeze(Object.values(SPACING));

export const assertSpacingValue = (value: number): SpacingValue => {
  if (!(SPACING_VALUES as readonly number[]).includes(value)) {
    throw new RangeError(`${String(value)}px is outside the locked spacing scale`);
  }

  return value as SpacingValue;
};

export const FONT_FAMILIES = Object.freeze({
  fontBody: 'manrope',
  fontData: 'jetbrains-mono',
  fontDisplay: 'saira-semi-condensed',
} as const);

export const TYPOGRAPHY = Object.freeze({
  public: Object.freeze({
    body: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 28,
      size: 17,
      weights: Object.freeze([400] as const),
    }),
    heroDisplay: Object.freeze({
      family: FONT_FAMILIES.fontDisplay,
      lineHeight: 0.96,
      maxSize: 76,
      minSize: 52,
      weights: Object.freeze([600] as const),
    }),
    label: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 20,
      size: 14,
      weights: Object.freeze([600] as const),
    }),
    sectionDisplay: Object.freeze({
      family: FONT_FAMILIES.fontDisplay,
      lineHeight: 1.02,
      maxSize: 48,
      minSize: 36,
      weights: Object.freeze([600] as const),
    }),
  }),
  documentation: Object.freeze({
    body: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 26,
      size: 16,
      weights: Object.freeze([400] as const),
    }),
    label: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 20,
      size: 14,
      weights: Object.freeze([600] as const),
    }),
    pageHeading: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 46,
      size: 40,
      weights: Object.freeze([600] as const),
    }),
    sectionHeading: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 30,
      size: 24,
      weights: Object.freeze([600] as const),
    }),
  }),
  product: Object.freeze({
    body: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 24,
      size: 16,
      weights: Object.freeze([400, 600] as const),
    }),
    label: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 20,
      size: 14,
      weights: Object.freeze([400, 600] as const),
    }),
    pageHeading: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 38,
      size: 32,
      weights: Object.freeze([600] as const),
    }),
    taskHeading: Object.freeze({
      family: FONT_FAMILIES.fontBody,
      lineHeight: 30,
      size: 24,
      weights: Object.freeze([600] as const),
    }),
  }),
} as const);

export const COLOR_TOKENS = Object.freeze({
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
} as const);

export const RADII = Object.freeze({
  radiusControl: 6,
  radiusPanel: 10,
  radiusPill: 999,
  radiusStage: 14,
} as const);

const primaryDefault = Object.freeze({
  background: COLOR_TOKENS.accentElectric,
  label: COLOR_TOKENS.canvas,
});

export const CTA_STATES = Object.freeze({
  default: primaryDefault,
  disabled: Object.freeze({
    background: COLOR_TOKENS.canvasInset,
    boundary: COLOR_TOKENS.lineStrong,
    label: COLOR_TOKENS.textSecondary,
  }),
  forcedColors: Object.freeze({
    background: 'ButtonFace',
    boundary: 'ButtonText',
    focus: 'Highlight',
    label: 'ButtonText',
  }),
  hover: Object.freeze({
    background: COLOR_TOKENS.accentElectricHover,
    label: COLOR_TOKENS.canvas,
  }),
  loading: primaryDefault,
  pressed: Object.freeze({
    background: COLOR_TOKENS.accentElectricPressed,
    label: COLOR_TOKENS.canvas,
  }),
} as const);

export const ELEVATION = Object.freeze({
  e0: Object.freeze({ shadow: 'none' }),
  e1: Object.freeze({ shadow: 'none' }),
  e2: Object.freeze({ highlightWidth: 1, shadow: 'none' }),
  e3: Object.freeze({ shadow: '0 24px 64px rgb(0 0 0 / 52%)' }),
} as const);

export const GLOW_LIMITS = Object.freeze({
  action: Object.freeze({ opacity: 0.14, shadow: '0 0 24px' }),
  hero: Object.freeze({ blurPx: 64, heightPx: 360, opacity: 0.2, widthPx: 520 }),
  maxVisible: 2,
} as const);

export const FOCUS_GEOMETRY = Object.freeze({ offsetPx: 2, widthPx: 2 } as const);

export const Z_INDEX = Object.freeze({
  dropdown: 30,
  modal: 80,
  modalBackdrop: 70,
  popover: 60,
  sticky: 40,
  toast: 100,
  tooltip: 110,
} as const);

export const MOTION_TOKENS = Object.freeze({
  hoverFocus: Object.freeze({ durationMs: 100, easing: 'linear' }),
  control: Object.freeze({ durationMs: 160, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
  panel: Object.freeze({ durationMs: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
  route: Object.freeze({ durationMs: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
  headline: Object.freeze({ durationMs: 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }),
  productStage: Object.freeze({
    delayMs: 80,
    durationMs: 480,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
  }),
} as const);

export const MOTION_LIMITS = Object.freeze({
  entranceScaleMin: 0.985,
  reducedDurationMaxMs: 100,
  stageDelayMaxMs: 80,
  translateMaxPx: 8,
} as const);

export const PROHIBITED_MOTION = Object.freeze([
  'bounce',
  'elastic-spring',
  'parallax',
  'scan-line',
  'particles',
  'count-up',
  'pulsing-cta',
  'animated-grid',
  'infinite-ambient-loop',
] as const);

export const STATUS_PATTERNS = Object.freeze({
  success: 'solid',
  warning: 'dashed',
  critical: 'double',
  experimental: 'dotted',
  restricted: 'dot-dash',
  pendingRestart: 'long-dash',
  recovery: 'double',
  unavailable: 'dotted',
  fixture: 'dotted',
} as const);

export type ScaleMode = 100 | 125 | 150;
export type TextScaleMode = 100 | 200;
export type DensityMode = 'comfortable' | 'compact';
export type MotionMode = 'responsive' | 'reduced';

export interface AppearanceModes {
  readonly density: DensityMode;
  readonly forcedColors: boolean;
  readonly motion: MotionMode;
  readonly scale: ScaleMode;
  readonly textScale: TextScaleMode;
}

export type AppearanceTokenName =
  | '--lb-app-scale'
  | '--lb-control-gap'
  | '--lb-control-min-size'
  | '--lb-disabled-opacity'
  | '--lb-disabled-text'
  | '--lb-forced-canvas'
  | '--lb-forced-canvas-text'
  | '--lb-forced-focus'
  | '--lb-motion-control-duration'
  | '--lb-motion-hover-duration'
  | '--lb-motion-inspector-duration'
  | '--lb-motion-progress-duration'
  | '--lb-motion-route-duration'
  | '--lb-motion-translate'
  | '--lb-section-gap'
  | '--lb-text-scale';

export type AppearanceTokens = Readonly<Record<AppearanceTokenName, string>>;

const milliseconds = (value: number): string => `${String(value)}ms`;

export const createAppearanceTokens = (modes: AppearanceModes): AppearanceTokens => {
  const reducedDuration = MOTION_TOKENS.hoverFocus.durationMs;
  const isReduced = modes.motion === 'reduced';

  return Object.freeze({
    '--lb-app-scale': String(modes.scale / 100),
    '--lb-control-gap': `${String(
      modes.density === 'compact' ? SPACING.space2 : SPACING.space3,
    )}px`,
    '--lb-control-min-size': '44px',
    '--lb-disabled-opacity': '1',
    '--lb-disabled-text': COLOR_TOKENS.textSecondary,
    '--lb-forced-canvas': modes.forcedColors ? 'Canvas' : COLOR_TOKENS.canvas,
    '--lb-forced-canvas-text': modes.forcedColors ? 'CanvasText' : COLOR_TOKENS.textPrimary,
    '--lb-forced-focus': modes.forcedColors ? 'Highlight' : COLOR_TOKENS.accentCyan,
    '--lb-motion-control-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.control.durationMs,
    ),
    '--lb-motion-hover-duration': milliseconds(MOTION_TOKENS.hoverFocus.durationMs),
    '--lb-motion-inspector-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.panel.durationMs,
    ),
    '--lb-motion-progress-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.control.durationMs,
    ),
    '--lb-motion-route-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.route.durationMs,
    ),
    '--lb-motion-translate': isReduced ? '0px' : `${String(MOTION_LIMITS.translateMaxPx)}px`,
    '--lb-section-gap': `${String(
      modes.density === 'compact' ? SPACING.space3 : SPACING.space4,
    )}px`,
    '--lb-text-scale': String(modes.textScale / 100),
  });
};
