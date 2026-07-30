export const ACCOUNT_PROFILE_STORAGE_KEY = 'liiiraa.desktop.account-profile.v1' as const;
export const ACCOUNT_PROFILE_UPDATED_EVENT = 'liiiraa:account-profile-updated' as const;
export const LOCAL_ACCOUNT_ID = 'LB-7F2A-91C8' as const;

export const PROFILE_AVATAR_ACCENTS = Object.freeze([
  'cyan',
  'violet',
  'emerald',
  'amber',
] as const);

export type ProfileAvatarAccent = (typeof PROFILE_AVATAR_ACCENTS)[number];

export interface LocalAccountProfile {
  readonly avatarAccent: ProfileAvatarAccent;
  readonly avatarImage: string | null;
  readonly bio: string;
  readonly displayName: string;
  readonly playerTag: string;
  readonly preferences: Readonly<{
    readonly showPlayerTag: boolean;
    readonly showRecentActivity: boolean;
  }>;
  readonly updatedAt: string;
  readonly version: 1;
}

export interface AccountProfileValidation {
  readonly bio?: string;
  readonly displayName?: string;
  readonly playerTag?: string;
}

export const DEFAULT_ACCOUNT_PROFILE: LocalAccountProfile = Object.freeze({
  avatarAccent: 'cyan',
  avatarImage: null,
  bio: 'Jogador competitivo focado em consistência, baixa latência e decisões reversíveis.',
  displayName: 'Liiiraa Player',
  playerTag: 'liiiraa',
  preferences: Object.freeze({
    showPlayerTag: true,
    showRecentActivity: true,
  }),
  updatedAt: '2026-07-30T00:00:00.000Z',
  version: 1,
});

const isAvatarAccent = (value: unknown): value is ProfileAvatarAccent =>
  typeof value === 'string' && (PROFILE_AVATAR_ACCENTS as readonly string[]).includes(value);

const validAvatarImage = (value: unknown): string | null => {
  if (value === null) {
    return null;
  }

  if (
    typeof value === 'string' &&
    value.length <= 1_500_000 &&
    /^data:image\/(?:jpeg|png|webp);base64,/u.test(value)
  ) {
    return value;
  }

  return null;
};

export const validateAccountProfile = (
  profile: Pick<LocalAccountProfile, 'bio' | 'displayName' | 'playerTag'>,
): AccountProfileValidation => {
  const displayName = profile.displayName.trim();
  const playerTag = profile.playerTag.trim();
  const bio = profile.bio.trim();

  return {
    ...(displayName.length < 2 || displayName.length > 40
      ? { displayName: 'O nome deve ter entre 2 e 40 caracteres.' }
      : {}),
    ...(!/^[a-z0-9][a-z0-9._-]{2,19}$/iu.test(playerTag)
      ? {
          playerTag: 'Use de 3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado.',
        }
      : {}),
    ...(bio.length > 120 ? { bio: 'A apresentação deve ter no máximo 120 caracteres.' } : {}),
  };
};

export const normalizeAccountProfile = (candidate: unknown): LocalAccountProfile => {
  if (typeof candidate !== 'object' || candidate === null) {
    return DEFAULT_ACCOUNT_PROFILE;
  }

  const record = candidate as Record<string, unknown>;
  if (record['version'] !== 1) {
    return DEFAULT_ACCOUNT_PROFILE;
  }

  const preferences =
    typeof record['preferences'] === 'object' && record['preferences'] !== null
      ? (record['preferences'] as Record<string, unknown>)
      : {};

  const normalized: LocalAccountProfile = {
    avatarAccent: isAvatarAccent(record['avatarAccent'])
      ? record['avatarAccent']
      : DEFAULT_ACCOUNT_PROFILE.avatarAccent,
    avatarImage: validAvatarImage(record['avatarImage']),
    bio:
      typeof record['bio'] === 'string' ? record['bio'].slice(0, 120) : DEFAULT_ACCOUNT_PROFILE.bio,
    displayName:
      typeof record['displayName'] === 'string'
        ? record['displayName'].slice(0, 40)
        : DEFAULT_ACCOUNT_PROFILE.displayName,
    playerTag:
      typeof record['playerTag'] === 'string'
        ? record['playerTag'].slice(0, 20)
        : DEFAULT_ACCOUNT_PROFILE.playerTag,
    preferences: {
      showPlayerTag:
        typeof preferences['showPlayerTag'] === 'boolean'
          ? preferences['showPlayerTag']
          : DEFAULT_ACCOUNT_PROFILE.preferences.showPlayerTag,
      showRecentActivity:
        typeof preferences['showRecentActivity'] === 'boolean'
          ? preferences['showRecentActivity']
          : DEFAULT_ACCOUNT_PROFILE.preferences.showRecentActivity,
    },
    updatedAt:
      typeof record['updatedAt'] === 'string'
        ? record['updatedAt']
        : DEFAULT_ACCOUNT_PROFILE.updatedAt,
    version: 1,
  };

  return Object.keys(validateAccountProfile(normalized)).length === 0
    ? normalized
    : DEFAULT_ACCOUNT_PROFILE;
};

export const readAccountProfile = (storage: Pick<Storage, 'getItem'>): LocalAccountProfile => {
  try {
    const stored = storage.getItem(ACCOUNT_PROFILE_STORAGE_KEY);
    return stored === null ? DEFAULT_ACCOUNT_PROFILE : normalizeAccountProfile(JSON.parse(stored));
  } catch {
    return DEFAULT_ACCOUNT_PROFILE;
  }
};

export const persistAccountProfile = (
  storage: Pick<Storage, 'setItem'>,
  profile: LocalAccountProfile,
): boolean => {
  try {
    storage.setItem(ACCOUNT_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
};

export const clearAccountProfile = (storage: Pick<Storage, 'removeItem'>): boolean => {
  try {
    storage.removeItem(ACCOUNT_PROFILE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

export const accountProfileInitials = (displayName: string): string => {
  const words = displayName.trim().split(/\s+/u).filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase('pt-BR') ?? '')
    .join('');
  return initials || 'LB';
};

export const createAccountProfileExport = (
  profile: LocalAccountProfile,
  exportedAt: string,
): Readonly<Record<string, unknown>> =>
  Object.freeze({
    accountId: LOCAL_ACCOUNT_ID,
    exportedAt,
    profile,
    schema: 'liiiraa-boost/local-account-profile',
    version: 1,
  });
