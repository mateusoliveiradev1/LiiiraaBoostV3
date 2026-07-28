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
    throw new RangeError(`${value}px is outside the locked spacing scale`);
  }

  return value as SpacingValue;
};

export const TYPOGRAPHY = Object.freeze({
  label: Object.freeze({
    family: 'manrope',
    lineHeight: 18,
    size: 13,
    weights: Object.freeze([600] as const),
  }),
  body: Object.freeze({
    family: 'manrope',
    lineHeight: 24,
    size: 15,
    weights: Object.freeze([400] as const),
  }),
  heading: Object.freeze({
    family: 'manrope',
    lineHeight: 26,
    size: 20,
    weights: Object.freeze([600] as const),
  }),
  display: Object.freeze({
    family: 'manrope',
    lineHeight: 34,
    size: 28,
    weights: Object.freeze([600] as const),
  }),
  dataCompact: Object.freeze({
    family: 'mono',
    lineHeight: 20,
    size: 13,
    weights: Object.freeze([400, 600] as const),
  }),
  dataBody: Object.freeze({
    family: 'mono',
    lineHeight: 24,
    size: 15,
    weights: Object.freeze([400, 600] as const),
  }),
} as const);

export const COLOR_TOKENS = Object.freeze({
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
} as const);

export const RADII = Object.freeze({
  default: 6,
  overlay: 10,
} as const);

export const MOTION_TOKENS = Object.freeze({
  hoverFocus: Object.freeze({ durationMs: 100, easing: 'linear' }),
  control: Object.freeze({ durationMs: 140, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
  inspector: Object.freeze({ durationMs: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
  route: Object.freeze({ durationMs: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
  progress: Object.freeze({ durationMs: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' }),
} as const);

export const STATUS_PATTERNS = Object.freeze({
  success: 'solid',
  warning: 'dashed',
  critical: 'double',
  experimental: 'dotted',
  restricted: 'dot-dash',
  pendingRestart: 'long-dash',
  recovery: 'double',
  unavailable: 'dotted',
  fixture: 'diagonal-stripe',
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

const milliseconds = (value: number): string => `${value}ms`;

export const createAppearanceTokens = (modes: AppearanceModes): AppearanceTokens => {
  const reducedDuration = MOTION_TOKENS.hoverFocus.durationMs;
  const isReduced = modes.motion === 'reduced';

  return Object.freeze({
    '--lb-app-scale': String(modes.scale / 100),
    '--lb-control-gap': `${modes.density === 'compact' ? SPACING.space2 : SPACING.space3}px`,
    '--lb-control-min-size': '44px',
    '--lb-disabled-opacity': '1',
    '--lb-disabled-text': COLOR_TOKENS.textSecondary,
    '--lb-forced-canvas': modes.forcedColors ? 'Canvas' : COLOR_TOKENS.surfaceCanvas,
    '--lb-forced-canvas-text': modes.forcedColors ? 'CanvasText' : COLOR_TOKENS.textPrimary,
    '--lb-forced-focus': modes.forcedColors ? 'Highlight' : COLOR_TOKENS.focusRing,
    '--lb-motion-control-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.control.durationMs,
    ),
    '--lb-motion-hover-duration': milliseconds(MOTION_TOKENS.hoverFocus.durationMs),
    '--lb-motion-inspector-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.inspector.durationMs,
    ),
    '--lb-motion-progress-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.progress.durationMs,
    ),
    '--lb-motion-route-duration': milliseconds(
      isReduced ? reducedDuration : MOTION_TOKENS.route.durationMs,
    ),
    '--lb-motion-translate': isReduced ? '0px' : '8px',
    '--lb-section-gap': `${modes.density === 'compact' ? SPACING.space3 : SPACING.space4}px`,
    '--lb-text-scale': String(modes.textScale / 100),
  });
};
