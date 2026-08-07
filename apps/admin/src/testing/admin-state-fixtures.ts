import type { LbOperationalNoticeState } from '@liiiraa/design-system';

export const ADMIN_STORY_CLOCK = '2030-01-15T18:00:00.000Z';
export const ADMIN_STORY_SEED = 4_054;

export const ADMIN_STORY_STATES = Object.freeze([
  'first-use',
  'empty',
  'loading',
  'live',
  'reconnecting',
  'stale',
  'offline',
  'partial-failure',
  'unauthorized',
  'reauthentication',
  'approval-pending',
  'conflict',
  'success',
  'partial-batch',
  'rate-limit',
  'break-glass',
] as const);

export type AdminStoryState = (typeof ADMIN_STORY_STATES)[number];
export type AdminStoryLocale = 'pt-BR' | 'en';

export interface AdminStateFixture {
  readonly actionLabel: string;
  readonly detail: string;
  readonly id: string;
  readonly noticeState?: LbOperationalNoticeState;
  readonly progress?: Readonly<{ max: number; value?: number }>;
  readonly provenance: 'storybook-fixture';
  readonly rows: readonly Readonly<{
    id: string;
    owner: string;
    priority: string;
    subject: string;
  }>[];
  readonly state: AdminStoryState;
  readonly title: string;
}

const localizedCopy = Object.freeze({
  'pt-BR': Object.freeze({
    action: 'Revisar fila',
    detail: 'Dados determinísticos para inspeção visual. Nenhuma autoridade remota está conectada.',
    owners: Object.freeze(['Mateus Oliveira', 'Equipe de segurança', 'Sem responsável']),
    priorities: Object.freeze(['Agora', 'Hoje', 'Acompanhar']),
    subjects: Object.freeze([
      'Revisar acessos administrativos',
      'Validar lote de convites',
      'Confirmar política de recuperação',
    ]),
    title: 'Prioridade operacional',
  }),
  en: Object.freeze({
    action: 'Review queue',
    detail: 'Deterministic data for visual inspection. No remote authority is connected.',
    owners: Object.freeze(['Mateus Oliveira', 'Security team', 'Unassigned']),
    priorities: Object.freeze(['Now', 'Today', 'Follow up']),
    subjects: Object.freeze([
      'Review administrative access',
      'Validate invitation batch',
      'Confirm recovery policy',
    ]),
    title: 'Operational priority',
  }),
});

const NOTICE_BY_STATE: Readonly<Partial<Record<AdminStoryState, LbOperationalNoticeState>>> =
  Object.freeze({
    conflict: 'conflict',
    offline: 'offline',
    'partial-failure': 'degraded',
    'rate-limit': 'rate-limit',
    reauthentication: 'stale',
    reconnecting: 'reconnecting',
    stale: 'stale',
    unauthorized: 'degraded',
  });

const createRows = (locale: AdminStoryLocale, state: AdminStoryState) => {
  if (state === 'empty' || state === 'first-use') return Object.freeze([]);
  const copy = localizedCopy[locale];
  return Object.freeze(
    copy.subjects.map((subject, index) =>
      Object.freeze({
        id: `ADM-${String(index + 1).padStart(4, '0')}`,
        owner: copy.owners[index] ?? copy.owners.at(0) ?? '—',
        priority: copy.priorities[index] ?? copy.priorities.at(0) ?? '—',
        subject,
      }),
    ),
  );
};

export const resolveAdminStateFixture = (
  state: AdminStoryState,
  locale: AdminStoryLocale,
  longContent = false,
): AdminStateFixture => {
  const copy = localizedCopy[locale];
  const longSuffix =
    locale === 'pt-BR'
      ? ' O conteúdo deliberadamente longo verifica quebra de linha, escala de texto e preservação das ações em viewports estreitos sem truncar decisões críticas.'
      : ' Deliberately long content verifies wrapping, text scaling, and action preservation in narrow viewports without truncating critical decisions.';
  const noticeState = NOTICE_BY_STATE[state];

  return Object.freeze({
    actionLabel: copy.action,
    detail: `${copy.detail}${longContent ? longSuffix : ''}`,
    id: `admin-${state}-${locale}`,
    ...(noticeState === undefined ? {} : { noticeState }),
    ...(state === 'loading'
      ? { progress: Object.freeze({ max: 100 }) }
      : state === 'partial-batch'
        ? { progress: Object.freeze({ max: 10, value: 6 }) }
        : {}),
    provenance: 'storybook-fixture',
    rows: createRows(locale, state),
    state,
    title: `${copy.title} · ${state}`,
  });
};

export const ADMIN_STATE_FIXTURES = Object.freeze(
  Object.fromEntries(
    ADMIN_STORY_STATES.flatMap((state) =>
      (['pt-BR', 'en'] as const).map((locale) => [
        `${state}:${locale}`,
        resolveAdminStateFixture(state, locale),
      ]),
    ),
  ) as Readonly<Record<`${AdminStoryState}:${AdminStoryLocale}`, AdminStateFixture>>,
);
