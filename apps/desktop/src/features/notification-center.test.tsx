/// <reference types="node" />

import type { ReactNode } from 'react';
// @ts-expect-error The approved runtime includes react-dom, but @types/react-dom is not an approved identity.
import { renderToStaticMarkup as reactRenderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NotificationCenter } from './notification-center.js';

const renderToStaticMarkup = reactRenderToStaticMarkup as (node: ReactNode) => string;

describe('notification center production projection', () => {
  it('renders the authoritative activity item without synthetic replacement copy', () => {
    const markup = renderToStaticMarkup(
      <NotificationCenter
        items={[
          {
            detail: 'A credencial foi revogada pelo servidor.',
            id: 'authority-revoked-0001',
            state: 'warning',
            title: 'Sessão encerrada',
          },
        ]}
        locale="pt-BR"
        onClose={() => undefined}
        onOpenActivity={() => undefined}
      />,
    );

    expect(markup).toContain('Sessão encerrada');
    expect(markup).toContain('A credencial foi revogada pelo servidor.');
    expect(markup).not.toMatch(/cenário simulado|simulated scenario/iu);
  });
});
