export const ACTIVE_GAME_STORAGE_KEY = 'liiiraa.desktop.active-game.v1';

export type GameProfileId = 'counter-strike-2' | 'fortnite' | 'pubg' | 'valorant';

export interface GameProfile {
  readonly brand: string;
  readonly cover: string;
  readonly id: GameProfileId;
  readonly profileLabel: string;
  readonly sessionSummary: string;
  readonly title: string;
}

export const DEFAULT_GAME_PROFILE: GameProfile = Object.freeze({
  brand: 'counter-strike-2',
  cover: '/games/counter-strike-2.jpg',
  id: 'counter-strike-2',
  profileLabel: 'Competitivo',
  sessionSummary: 'Aguardando medição',
  title: 'Counter-Strike 2',
});

export const GAME_PROFILES: readonly GameProfile[] = Object.freeze([
  DEFAULT_GAME_PROFILE,
  {
    brand: 'valorant',
    cover: '/games/valorant.jpg',
    id: 'valorant',
    profileLabel: 'Baixa latência',
    sessionSummary: 'Aguardando medição',
    title: 'VALORANT',
  },
  {
    brand: 'fortnite',
    cover: '/games/fortnite.jpg',
    id: 'fortnite',
    profileLabel: 'Competitivo',
    sessionSummary: 'Aguardando medição',
    title: 'Fortnite',
  },
  {
    brand: 'pubg',
    cover: '/games/pubg.jpg',
    id: 'pubg',
    profileLabel: 'Battle royale',
    sessionSummary: 'Aguardando medição',
    title: 'PUBG: BATTLEGROUNDS',
  },
]);

export const resolveGameProfile = (candidate: string | null | undefined): GameProfile =>
  GAME_PROFILES.find(({ id }) => id === candidate) ?? DEFAULT_GAME_PROFILE;

export const readActiveGameProfile = (storage: Pick<Storage, 'getItem'>): GameProfile => {
  try {
    return resolveGameProfile(storage.getItem(ACTIVE_GAME_STORAGE_KEY));
  } catch {
    return DEFAULT_GAME_PROFILE;
  }
};

export const persistActiveGameProfile = (
  storage: Pick<Storage, 'setItem'>,
  profile: GameProfile,
): void => {
  try {
    storage.setItem(ACTIVE_GAME_STORAGE_KEY, profile.id);
  } catch {
    // Preference persistence is best-effort; the in-memory selection remains valid.
  }
};
