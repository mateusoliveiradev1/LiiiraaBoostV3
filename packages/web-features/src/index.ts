// @ts-expect-error The web bundlers consume this package-owned CSS side effect.
import './web.css';

export const WEB_FEATURE_CONTRACT_VERSION = 1 as const;
export * from './components.js';
export * from './shells.js';
