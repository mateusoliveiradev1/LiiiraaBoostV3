import { CALIBRATION_STEP_MESSAGE_IDS } from '@liiiraa/feature-shell';
import { describe, expect, it } from 'vitest';

import {
  CRITICAL_MESSAGE_IDS,
  FEATURE_MESSAGE_IDS,
  MESSAGE_CATALOGS,
  assertCatalogParity,
  detectLocale,
  formatDate,
  formatMessage,
  formatNumber,
  formatStorage,
  type MessageId,
} from './i18n.js';

describe('locale catalog parity', () => {
  it('keeps PT-BR, English, and pseudo locale keys in exact parity', () => {
    expect(assertCatalogParity()).toEqual({
      localeCount: 3,
      messageCount: expect.any(Number),
    });

    const ptBrKeys = Object.keys(MESSAGE_CATALOGS['pt-BR']).toSorted();
    expect(ptBrKeys).toEqual(Object.keys(MESSAGE_CATALOGS['en-US']).toSorted());
    expect(ptBrKeys).toEqual(Object.keys(MESSAGE_CATALOGS.pseudo).toSorted());
    expect(ptBrKeys.length).toBeGreaterThanOrEqual(80);
  });

  it('contains every feature message ID and fails closed for critical copy', () => {
    const expectedCalibrationIds = Object.values(CALIBRATION_STEP_MESSAGE_IDS);

    expect(FEATURE_MESSAGE_IDS).toEqual(
      expect.arrayContaining(expectedCalibrationIds),
    );

    for (const messageId of FEATURE_MESSAGE_IDS) {
      expect(MESSAGE_CATALOGS['pt-BR'][messageId]).toBeTruthy();
      expect(MESSAGE_CATALOGS['en-US'][messageId]).toBeTruthy();
    }

    for (const messageId of CRITICAL_MESSAGE_IDS) {
      expect(formatMessage('pt-BR', messageId)).not.toBe(messageId);
      expect(formatMessage('en-US', messageId)).not.toBe(messageId);
    }

    expect(() =>
      formatMessage('pt-BR', 'dialog.critical.missing' as never),
    ).toThrow(/Missing product-critical message/u);
  });

  it('expands every pseudo message by at least 35 percent', () => {
    for (const messageId of Object.keys(
      MESSAGE_CATALOGS['pt-BR'],
    ) as MessageId[]) {
      const source = MESSAGE_CATALOGS['pt-BR'][messageId]!;
      const pseudo = MESSAGE_CATALOGS.pseudo[messageId]!;

      expect(pseudo.length).toBeGreaterThanOrEqual(Math.ceil(source.length * 1.35));
    }
  });

  it('translates confirmation tokens as whole messages', () => {
    expect(formatMessage('pt-BR', 'confirmation.extreme.token')).toBe(
      'EU ENTENDO E QUERO CONTINUAR',
    );
    expect(formatMessage('en-US', 'confirmation.extreme.token')).toBe(
      'I UNDERSTAND AND WANT TO CONTINUE',
    );
  });
});

describe('locale detection and deterministic formatters', () => {
  it('implements D-17 before any consent decision', () => {
    expect(detectLocale('pt-BR')).toBe('pt-BR');
    expect(detectLocale('PT-br')).toBe('pt-BR');
    expect(detectLocale('pt-PT')).toBe('en-US');
    expect(detectLocale('en-GB')).toBe('en-US');
    expect(detectLocale(undefined)).toBe('en-US');
  });

  it('formats dates, numbers, and units with explicit locale and UTC time zone', () => {
    const instant = new Date('2026-07-28T12:34:56.000Z');

    expect(formatDate(instant, 'pt-BR')).toBe('28/07/2026, 12:34');
    expect(formatDate(instant, 'en-US')).toBe('07/28/2026, 12:34 PM');
    expect(formatNumber(1234.5, 'pt-BR')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
    expect(formatStorage(16, 'pt-BR')).toContain('16');
    expect(formatStorage(16, 'en-US')).toContain('16');
  });
});
