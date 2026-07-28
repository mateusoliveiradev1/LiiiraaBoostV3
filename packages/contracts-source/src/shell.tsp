using TypeSpec.JsonSchema;

namespace Liiiraa.Contracts.Desktop.V1;

@minLength(1)
@maxLength(128)
scalar ShellPublisher extends string;

@minLength(1)
@maxLength(64)
scalar ShellVersion extends string;

@minLength(1)
@maxLength(128)
scalar ShellDocumentId extends string;

@minLength(1)
@maxLength(128)
scalar ShellMonitorId extends string;

@minLength(1)
@maxLength(128)
scalar ShellNotificationTitle extends string;

@minLength(1)
@maxLength(512)
scalar ShellNotificationBody extends string;

union ShellReleaseChannel {
  stable: "stable",
  beta: "beta",
  experimental: "experimental",
}

union ShellLocale {
  portugueseBrazil: "pt-BR",
  english: "en",
}

model ShellSupportedWindowsCompatibility {
  kind: "supported";
  detectedBuild: int32;
  minimumBuild: int32;
}

model ShellUnsupportedWindowsCompatibility {
  kind: "unsupported";
  reason: "unsupported-build" | "unsupported-lifecycle";
  detectedBuild: int32;
  minimumBuild: int32;
}

@jsonSchema
@oneOf
union ShellWindowsCompatibility {
  supported: ShellSupportedWindowsCompatibility,
  unsupported: ShellUnsupportedWindowsCompatibility,
}

@jsonSchema
model ShellInstallerIdentity {
  publisher: ShellPublisher;
  version: ShellVersion;
  channel: ShellReleaseChannel;
  windowsCompatibility: ShellWindowsCompatibility;
}

model ShellGoalNavigationIntent {
  kind: "goal";
  destination:
    | "home"
    | "prepare"
    | "improve"
    | "measure"
    | "recover"
    | "assistant"
    | "activity"
    | "account";
}

model ShellSettingsNavigationIntent {
  kind: "settings";
  destination:
    | "general"
    | "background"
    | "appearance"
    | "accessibility"
    | "privacy"
    | "notifications"
    | "updates"
    | "advanced";
}

model ShellCalibrationNavigationIntent {
  kind: "calibration";
  destination:
    | "welcome"
    | "trust"
    | "inventory"
    | "diagnosis"
    | "recovery"
    | "goals"
    | "games"
    | "summary";
}

model ShellDocumentationNavigationIntent {
  kind: "documentation";
  documentId: ShellDocumentId;
}

@jsonSchema
@oneOf
union ShellNavigationIntent {
  goal: ShellGoalNavigationIntent,
  settings: ShellSettingsNavigationIntent,
  calibration: ShellCalibrationNavigationIntent,
  documentation: ShellDocumentationNavigationIntent,
}

model ShellStartupSplashState {
  kind: "splash";
  step:
    | "initializing-webview"
    | "loading-local-state"
    | "validating-installation"
    | "opening-shell";
}

model ShellStartupUpdatingState {
  kind: "updating";
  step: "verifying-signature" | "installing-update" | "preparing-rollback";
}

model ShellStartupReadyState {
  kind: "ready";
}

model ShellStartupFailureState {
  kind: "failure";
  reason:
    | "missing-webview2"
    | "damaged-installation"
    | "incompatible-windows-build"
    | "local-state-migration-failed"
    | "update-signature-failed"
    | "internal-startup-error";
  recoveryAction:
    | "install-webview2"
    | "view-offline-instructions"
    | "retry"
    | "rollback"
    | "open-safe-mode"
    | "exit";
}

@jsonSchema
@oneOf
union ShellStartupState {
  splash: ShellStartupSplashState,
  updating: ShellStartupUpdatingState,
  ready: ShellStartupReadyState,
  failure: ShellStartupFailureState,
}

@jsonSchema
union ShellTrayPreference {
  closeWindow: "close-window",
  keepGameDetectionInTray: "keep-game-detection-in-tray",
}

model ShellOrdinaryCloseContext {
  kind: "ordinary";
}

model ShellRecoveryCloseContext {
  kind: "recovery-in-progress";
}

@jsonSchema
@oneOf
union ShellCloseContext {
  ordinary: ShellOrdinaryCloseContext,
  recoveryInProgress: ShellRecoveryCloseContext,
}

union ShellCloseDecision {
  closeInterface: "close-interface",
  keepRunningInTray: "keep-running-in-tray",
  stayHere: "stay-here",
}

@jsonSchema
union ShellNotificationCategory {
  recoveryRequired: "recovery-required",
  restartDeadline: "restart-deadline",
  gameProfileRestoreFailed: "game-profile-restore-failed",
  signedUpdateActionRequired: "signed-update-action-required",
  accountSecurity: "account-security",
}

@jsonSchema
model ShellNotificationPreference {
  enabled: boolean;
  focusAssist: "respect";
  @minItems(0)
  @maxItems(5)
  categories: ShellNotificationCategory[];
}

model ShellNormalWindowState {
  kind: "normal";
  monitorId: ShellMonitorId;
  x: int32;
  y: int32;
  @minValue(760)
  @maxValue(16384)
  width: int32;
  @minValue(600)
  @maxValue(8640)
  height: int32;
}

model ShellMaximizedWindowState {
  kind: "maximized";
  monitorId: ShellMonitorId;
  x: int32;
  y: int32;
  @minValue(760)
  @maxValue(16384)
  restoreWidth: int32;
  @minValue(600)
  @maxValue(8640)
  restoreHeight: int32;
}

model ShellMinimizedWindowState {
  kind: "minimized";
  restoreState: ShellNormalWindowState | ShellMaximizedWindowState;
}

@jsonSchema
@oneOf
union ShellWindowState {
  normal: ShellNormalWindowState,
  maximized: ShellMaximizedWindowState,
  minimized: ShellMinimizedWindowState,
}

model ShellInstallerIdentityEventPayload {
  installer: ShellInstallerIdentity;
}

model ShellStartupStateChangedEventPayload {
  state: ShellStartupState;
}

model ShellNavigationRequestedEventPayload {
  source: "second-launch" | "deep-link" | "tray" | "notification";
  intent: ShellNavigationIntent;
}

model ShellLocaleChangedEventPayload {
  locale: ShellLocale;
}

model ShellTrayPreferenceChangedEventPayload {
  preference: ShellTrayPreference;
}

model ShellCloseRequestedEventPayload {
  context: ShellCloseContext;
}

model ShellNotificationPreferenceChangedEventPayload {
  preference: ShellNotificationPreference;
}

model ShellWindowStateChangedEventPayload {
  state: ShellWindowState;
}

model ShellInstallerIdentityEvent
  is MessageEnvelope<
    "desktop.shell.installer-identity.event",
    ShellInstallerIdentityEventPayload
  >;

model ShellStartupStateChangedEvent
  is MessageEnvelope<
    "desktop.shell.startup-state-changed.event",
    ShellStartupStateChangedEventPayload
  >;

model ShellNavigationRequestedEvent
  is MessageEnvelope<
    "desktop.shell.navigation-requested.event",
    ShellNavigationRequestedEventPayload
  >;

model ShellLocaleChangedEvent
  is MessageEnvelope<"desktop.shell.locale-changed.event", ShellLocaleChangedEventPayload>;

model ShellTrayPreferenceChangedEvent
  is MessageEnvelope<
    "desktop.shell.tray-preference-changed.event",
    ShellTrayPreferenceChangedEventPayload
  >;

model ShellCloseRequestedEvent
  is MessageEnvelope<"desktop.shell.close-requested.event", ShellCloseRequestedEventPayload>;

model ShellNotificationPreferenceChangedEvent
  is MessageEnvelope<
    "desktop.shell.notification-preference-changed.event",
    ShellNotificationPreferenceChangedEventPayload
  >;

model ShellWindowStateChangedEvent
  is MessageEnvelope<
    "desktop.shell.window-state-changed.event",
    ShellWindowStateChangedEventPayload
  >;

@jsonSchema
@oneOf
union HostToRendererShellEvent {
  installerIdentity: ShellInstallerIdentityEvent,
  startupStateChanged: ShellStartupStateChangedEvent,
  navigationRequested: ShellNavigationRequestedEvent,
  localeChanged: ShellLocaleChangedEvent,
  trayPreferenceChanged: ShellTrayPreferenceChangedEvent,
  closeRequested: ShellCloseRequestedEvent,
  notificationPreferenceChanged: ShellNotificationPreferenceChangedEvent,
  windowStateChanged: ShellWindowStateChangedEvent,
}

model ShellNavigateCommandPayload {
  intent: ShellNavigationIntent;
}

model ShellSetLocaleCommandPayload {
  locale: ShellLocale;
}

model ShellSetTrayPreferenceCommandPayload {
  preference: ShellTrayPreference;
}

model ShellResolveCloseCommandPayload {
  context: ShellCloseContext;
  decision: ShellCloseDecision;
}

model ShellSetNotificationPreferenceCommandPayload {
  preference: ShellNotificationPreference;
}

model ShellShowNotificationCommandPayload {
  category: ShellNotificationCategory;
  title: ShellNotificationTitle;
  body: ShellNotificationBody;
  action: ShellNavigationIntent;
}

model ShellSaveWindowStateCommandPayload {
  state: ShellWindowState;
}

model ShellNavigateCommand
  is MessageEnvelope<"desktop.shell.navigate.command", ShellNavigateCommandPayload>;

model ShellSetLocaleCommand
  is MessageEnvelope<"desktop.shell.set-locale.command", ShellSetLocaleCommandPayload>;

model ShellSetTrayPreferenceCommand
  is MessageEnvelope<
    "desktop.shell.set-tray-preference.command",
    ShellSetTrayPreferenceCommandPayload
  >;

model ShellResolveCloseCommand
  is MessageEnvelope<"desktop.shell.resolve-close.command", ShellResolveCloseCommandPayload>;

model ShellSetNotificationPreferenceCommand
  is MessageEnvelope<
    "desktop.shell.set-notification-preference.command",
    ShellSetNotificationPreferenceCommandPayload
  >;

model ShellShowNotificationCommand
  is MessageEnvelope<
    "desktop.shell.show-notification.command",
    ShellShowNotificationCommandPayload
  >;

model ShellSaveWindowStateCommand
  is MessageEnvelope<
    "desktop.shell.save-window-state.command",
    ShellSaveWindowStateCommandPayload
  >;

@jsonSchema
@oneOf
union RendererToHostShellCommand {
  navigate: ShellNavigateCommand,
  setLocale: ShellSetLocaleCommand,
  setTrayPreference: ShellSetTrayPreferenceCommand,
  resolveClose: ShellResolveCloseCommand,
  setNotificationPreference: ShellSetNotificationPreferenceCommand,
  showNotification: ShellShowNotificationCommand,
  saveWindowState: ShellSaveWindowStateCommand,
}
