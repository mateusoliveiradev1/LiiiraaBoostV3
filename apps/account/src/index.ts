export const accountWebComposition = (kind: 'preview' | 'production') =>
  Object.freeze({
    runtimeClass: kind === 'production' ? 'server-authority' : 'fixture',
    surface: 'account',
    authorityConnected: kind === 'production',
  } as const);

export const ACCOUNT_WEB_COMPOSITION = accountWebComposition('production');

export { createW12AccountCaptureProjection } from './capture/w12';
