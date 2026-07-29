import { describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_GAME_STORAGE_KEY,
  DEFAULT_GAME_PROFILE,
  persistActiveGameProfile,
  readActiveGameProfile,
  resolveGameProfile,
} from './game-profiles.js';

describe('game profiles', () => {
  it('resolves every known profile and safely falls back to Counter-Strike 2', () => {
    expect(resolveGameProfile('pubg').title).toBe('PUBG: BATTLEGROUNDS');
    expect(resolveGameProfile('valorant').cover).toBe('/games/valorant.jpg');
    expect(resolveGameProfile('unknown')).toBe(DEFAULT_GAME_PROFILE);
  });

  it('reads and persists the active game through the benign preference key', () => {
    const storage = {
      getItem: vi.fn(() => 'fortnite'),
      setItem: vi.fn(),
    };

    expect(readActiveGameProfile(storage).id).toBe('fortnite');
    persistActiveGameProfile(storage, resolveGameProfile('pubg'));
    expect(storage.setItem).toHaveBeenCalledWith(ACTIVE_GAME_STORAGE_KEY, 'pubg');
  });

  it('keeps a safe default when storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('storage unavailable');
      }),
    };

    expect(readActiveGameProfile(storage)).toBe(DEFAULT_GAME_PROFILE);
  });
});
