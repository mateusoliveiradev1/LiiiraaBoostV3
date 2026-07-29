// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ShellInstallerIdentityJson,
  ShellStartupFailureStateJson,
  ShellStartupStateJson,
} from '@liiiraa/contracts-ts';

import { InstallerHandoff } from './installer-handoff.js';
import { PremiumInstallerHandoff } from './premium-installer-handoff.js';
import { STARTUP_PRESENTATION_STEPS, StartupSurface } from './startup.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

const installer: ShellInstallerIdentityJson = {
  publisher: 'Liiiraa Boost Development',
  version: '0.2.0',
  channel: 'development',
  windowsCompatibility: {
    kind: 'supported',
    detectedBuild: 26100,
    minimumBuild: 19045,
  },
};

const startupStates: readonly ShellStartupStateJson[] = [
  { kind: 'splash', step: 'initializing-webview' },
  { kind: 'splash', step: 'loading-local-state' },
  { kind: 'splash', step: 'validating-installation' },
  { kind: 'splash', step: 'opening-shell' },
  { kind: 'updating', step: 'verifying-signature' },
  { kind: 'updating', step: 'installing-update' },
  { kind: 'updating', step: 'preparing-rollback' },
  { kind: 'ready' },
  {
    kind: 'failure',
    reason: 'missing-webview2',
    recoveryAction: 'install-webview2',
  },
  {
    kind: 'failure',
    reason: 'damaged-installation',
    recoveryAction: 'view-offline-instructions',
  },
  {
    kind: 'failure',
    reason: 'incompatible-windows-build',
    recoveryAction: 'view-offline-instructions',
  },
  {
    kind: 'failure',
    reason: 'local-state-migration-failed',
    recoveryAction: 'retry',
  },
  {
    kind: 'failure',
    reason: 'update-signature-failed',
    recoveryAction: 'rollback',
  },
  {
    kind: 'failure',
    reason: 'internal-startup-error',
    recoveryAction: 'open-safe-mode',
  },
];

describe('installer handoff', () => {
  it('shows exact signed-development identity and compatibility before continuation', () => {
    const markup = renderToStaticMarkup(<InstallerHandoff identity={installer} locale="en-US" />);

    expect(markup).toContain('Liiiraa Boost Development');
    expect(markup).toContain('0.2.0');
    expect(markup).toContain('development');
    expect(markup).toContain('26100');
    expect(markup).toContain('19045');
    expect(markup).toContain('self-signed development certificate');
    expect(markup).toContain('Updater disabled');
    expect(markup).toContain('No optimization has run');
  });

  it('renders the complete handoff in PT-BR without leaking internal English copy', () => {
    const markup = renderToStaticMarkup(<InstallerHandoff identity={installer} locale="pt-BR" />);

    expect(markup).toContain('Confira a instalação antes de começar');
    expect(markup).toContain('Canal de desenvolvimento');
    expect(markup).toContain(
      'Atualizações automáticas desativadas nesta versão de desenvolvimento',
    );
    expect(markup).toContain('<details class="desktop-installer-technical">');
    expect(markup).toContain('Ver detalhes técnicos');
    expect(markup).not.toContain('<details class="desktop-installer-technical" open="">');
    for (const englishCopy of [
      'Development channel',
      'Verify this installation',
      'Updater disabled',
      'No optimization has run',
      '>development<',
    ]) {
      expect(markup).not.toContain(englishCopy);
    }
  });

  it('renders the premium first launch as a clear protected entry point', () => {
    const markup = renderToStaticMarkup(
      <PremiumInstallerHandoff
        identity={installer}
        locale="pt-BR"
        windowControls={{
          close: vi.fn(),
          maximizeRestore: vi.fn(),
          minimize: vi.fn(),
        }}
      />,
    );

    expect(markup).toContain('desktop-premium-first-run');
    expect(markup).toContain('desktop-first-run-shell');
    expect(markup).toContain('Minimizar janela');
    expect(markup).toContain('Maximizar ou restaurar janela');
    expect(markup).toContain('Fechar janela');
    expect(markup).toContain('Tudo pronto para sua primeira sessão.');
    expect(markup).toContain('Instalação verificada');
    expect(markup).toContain('Nenhuma otimização foi executada');
    expect(markup).toContain('Entrar no Liiiraa Boost');
    expect(markup).toContain('<details class="desktop-first-run-technical">');
    expect(markup).not.toContain('Everything is ready for your first session.');
  });

  it('blocks unsupported or unverified identities without fabricating trust', () => {
    const markup = renderToStaticMarkup(
      <InstallerHandoff
        identity={{
          ...installer,
          channel: 'stable',
          windowsCompatibility: {
            kind: 'unsupported',
            reason: 'unsupported-build',
            detectedBuild: 18363,
            minimumBuild: 19045,
          },
        }}
        locale="pt-BR"
        signatureState="unknown"
        updateIdentity="unknown"
      />,
    );

    expect(markup).toContain('incompatível');
    expect(markup).toContain('ainda não foi verificada');
    expect(markup).toContain('Nenhuma identidade de atualização assinada');
    expect(markup).not.toContain('confiável');
  });
});

describe('startup', () => {
  it('keeps the visible launch sequence aligned with every typed splash step', () => {
    expect(STARTUP_PRESENTATION_STEPS).toEqual([
      'initializing-webview',
      'loading-local-state',
      'validating-installation',
      'opening-shell',
    ]);

    for (const [index, step] of STARTUP_PRESENTATION_STEPS.entries()) {
      const markup = renderToStaticMarkup(
        <StartupSurface locale="pt-BR" state={{ kind: 'splash', step }} version="0.2.0" />,
      );
      expect(markup).toContain(`aria-valuenow="${String(index + 1)}"`);
      expect(markup).toContain(`${String((index + 1) * 25)}%`);
    }
  });

  it.each(startupStates)('renders complete accessible copy for $kind state', (state) => {
    const markup = renderToStaticMarkup(
      <StartupSurface firstLaunch locale="pt-BR" state={state} version="0.2.0" />,
    );

    expect(markup).toContain('Primeira abertura local');
    expect(markup).toContain('Versão');
    expect(markup).not.toContain('placeholder');
    expect(markup).not.toContain('undefined');
    for (const englishCopy of [
      'Initializing the local Windows interface',
      'Loading protected local preferences',
      'Open Liiiraa Boost',
      'Try again',
      'Open safe mode',
    ]) {
      expect(markup).not.toContain(englishCopy);
    }
    if (state.kind === 'failure') {
      expect(markup).toContain('role="alert"');
      expect(markup).toContain('Abrir suporte');
      expect(markup).toContain('documentação');
    }
  });

  it('exposes all generated recovery actions with localized safe controls', () => {
    const recoveryActions: readonly ShellStartupFailureStateJson['recoveryAction'][] = [
      'install-webview2',
      'view-offline-instructions',
      'retry',
      'rollback',
      'open-safe-mode',
      'exit',
    ];

    for (const recoveryAction of recoveryActions) {
      const markup = renderToStaticMarkup(
        <StartupSurface
          locale="en-US"
          state={{
            kind: 'failure',
            reason: 'internal-startup-error',
            recoveryAction,
          }}
          version="0.2.0"
        />,
      );
      expect(markup).not.toContain('undefined');
      expect(markup).toContain('No optimization or privileged change');
    }
  });
});
