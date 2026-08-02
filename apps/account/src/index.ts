export const ACCOUNT_WEB_COMPOSITION = {
  runtimeClass: "fixture",
  surface: "account",
  authorityConnected: false,
} as const;

export { createW12AccountCaptureProjection } from "./capture/w12";
