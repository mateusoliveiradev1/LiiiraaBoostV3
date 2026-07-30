import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_PROFILE_STORAGE_KEY,
  DEFAULT_ACCOUNT_PROFILE,
  accountProfileInitials,
  clearAccountProfile,
  createAccountProfileExport,
  normalizeAccountProfile,
  persistAccountProfile,
  readAccountProfile,
  validateAccountProfile,
} from './account-profile.js';

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
};

describe('account profile adapter', () => {
  it('persists, restores and clears a valid local profile', () => {
    const storage = createStorage();
    const profile = {
      ...DEFAULT_ACCOUNT_PROFILE,
      displayName: 'Lira Competitivo',
      playerTag: 'lira.gg',
    };

    expect(persistAccountProfile(storage, profile)).toBe(true);
    expect(readAccountProfile(storage)).toMatchObject({
      displayName: 'Lira Competitivo',
      playerTag: 'lira.gg',
    });
    expect(storage.values.has(ACCOUNT_PROFILE_STORAGE_KEY)).toBe(true);
    expect(clearAccountProfile(storage)).toBe(true);
    expect(readAccountProfile(storage)).toBe(DEFAULT_ACCOUNT_PROFILE);
  });

  it('rejects invalid persisted content and validates editable fields', () => {
    expect(normalizeAccountProfile({ displayName: 'X', version: 1 })).toBe(DEFAULT_ACCOUNT_PROFILE);
    expect(
      validateAccountProfile({
        bio: 'a'.repeat(121),
        displayName: 'X',
        playerTag: 'tag com espaço',
      }),
    ).toEqual({
      bio: 'A apresentação deve ter no máximo 120 caracteres.',
      displayName: 'O nome deve ter entre 2 e 40 caracteres.',
      playerTag: 'Use de 3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado.',
    });
  });

  it('derives stable initials and creates an explicit local export envelope', () => {
    expect(accountProfileInitials('Liiiraa Player')).toBe('LP');
    expect(accountProfileInitials('Liiiraa')).toBe('L');
    expect(accountProfileInitials('  ')).toBe('LB');
    expect(
      createAccountProfileExport(DEFAULT_ACCOUNT_PROFILE, '2030-01-15T18:00:00.000Z'),
    ).toMatchObject({
      accountId: 'LB-7F2A-91C8',
      exportedAt: '2030-01-15T18:00:00.000Z',
      schema: 'liiiraa-boost/local-account-profile',
      version: 1,
    });
  });
});
