import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';

import {
  ForbiddenState,
  GoneState,
  opaqueErrorCorrelation,
  ServerFailureState,
} from './features/public-failure';

type FailureElementProps = Readonly<{
  code: string;
  correlationId?: string;
  detail: string;
  destinations: readonly Readonly<{ href: string; label: string }>[];
  reason: string;
  recovery: string;
  routeId: string;
  title: string;
}>;

const failureProps = (element: unknown): FailureElementProps => {
  if (!isValidElement<FailureElementProps>(element)) {
    throw new Error('Expected authored public failure element.');
  }
  return element.props;
};

describe('403 410 500 authored public recovery', () => {
  it('keeps each failure class semantically distinct and locale-preserving', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const forbidden = failureProps(ForbiddenState({ locale }));
      const gone = failureProps(GoneState({ locale }));
      const server = failureProps(ServerFailureState({ locale }));

      expect([forbidden.code, gone.code, server.code]).toEqual(['403', '410', '500']);
      expect([forbidden.routeId, gone.routeId, server.routeId]).toEqual([
        'public-error-403',
        'public-error-410',
        'public-error-500',
      ]);
      expect(new Set([forbidden.title, gone.title, server.title]).size).toBe(3);
      expect(new Set([forbidden.reason, gone.reason, server.reason]).size).toBe(3);
      expect(gone.recovery).toMatch(/can[oô]nic|canônica/iu);
      expect(
        [forbidden, gone, server].every((state) =>
          state.destinations.every(({ href }) => href.includes(`/${locale}`)),
        ),
      ).toBe(true);
    }
  });

  it('redacts unsafe diagnostics and preserves only an opaque bounded digest', () => {
    expect(opaqueErrorCorrelation(undefined)).toBe('LB-WEB-500-REDACTED');
    expect(opaqueErrorCorrelation('C:\\private\\stack.ts:42')).toBe('LB-WEB-500-REDACTED');
    expect(opaqueErrorCorrelation('safeDigest_123')).toBe('LB-WEB-safeDigest_123');

    const markupSource = JSON.stringify(
      failureProps(ServerFailureState({ correlationId: 'LB-WEB-500-REDACTED', locale: 'en' })),
    );
    expect(markupSource).not.toMatch(/C:\\|\/Users\/|\.tsx?:\d+/u);
  });
});
