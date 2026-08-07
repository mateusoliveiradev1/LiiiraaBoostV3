import {
  LbButton,
  LbDataTable,
  LbOperationalNotice,
  LbPanel,
  LbProgress,
  LbRiskReview,
} from '@liiiraa/design-system';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { resolveAdminStateFixture } from './admin-state-fixtures';
import type { AdminStoryLocale, AdminStoryState } from './admin-state-fixtures';

interface AdminFixtureCanvasProps {
  readonly locale: AdminStoryLocale;
  readonly longContent?: boolean;
  readonly state: AdminStoryState;
}

const AdminFixtureCanvas = ({ locale, longContent = false, state }: AdminFixtureCanvasProps) => {
  const fixture = resolveAdminStateFixture(state, locale, longContent);
  const emptyLabel = locale === 'pt-BR' ? 'Nenhum item nesta fila.' : 'No items in this queue.';

  return (
    <main
      aria-label={locale === 'pt-BR' ? 'Fixture administrativa' : 'Admin fixture'}
      className="admin-shell"
      data-fixture-id={fixture.id}
      data-provenance={fixture.provenance}
      style={{ margin: '0 auto', maxWidth: 'var(--lb-admin-workspace-max)', padding: '32px' }}
    >
      <LbPanel label={fixture.title} tone="focal">
        <header>
          <p>{fixture.provenance}</p>
          <h1>{fixture.title}</h1>
          <p>{fixture.detail}</p>
        </header>

        {fixture.noticeState ? (
          <LbOperationalNotice
            action={<LbButton variant="quiet">{fixture.actionLabel}</LbButton>}
            detail={fixture.detail}
            state={fixture.noticeState}
            title={fixture.title}
          />
        ) : null}

        {fixture.progress ? (
          <LbProgress
            label={locale === 'pt-BR' ? 'Progresso da operação' : 'Operation progress'}
            maxValue={fixture.progress.max}
            {...(fixture.progress.value === undefined ? {} : { value: fixture.progress.value })}
          />
        ) : null}

        {state === 'break-glass' || state === 'conflict' ? (
          <LbRiskReview
            action={<LbButton variant="destructive">{fixture.actionLabel}</LbButton>}
            consequences={
              locale === 'pt-BR'
                ? ['Exige autenticação forte.', 'Registra motivo e escopo no audit log.']
                : ['Requires strong authentication.', 'Records reason and scope in the audit log.']
            }
            level="critical"
            title={fixture.title}
          />
        ) : null}

        {fixture.rows.length === 0 ? (
          <p role="status">{emptyLabel}</p>
        ) : (
          <LbDataTable
            caption={locale === 'pt-BR' ? 'Fila administrativa' : 'Administrative queue'}
            columns={[
              { id: 'subject', label: locale === 'pt-BR' ? 'Assunto' : 'Subject' },
              { id: 'owner', label: locale === 'pt-BR' ? 'Responsável' : 'Owner' },
              { id: 'priority', label: locale === 'pt-BR' ? 'Prioridade' : 'Priority' },
            ]}
            rows={fixture.rows.map((row) => ({
              cells: { owner: row.owner, priority: row.priority, subject: row.subject },
              id: row.id,
            }))}
          />
        )}
      </LbPanel>
    </main>
  );
};

const meta = {
  args: {
    locale: 'pt-BR',
    state: 'live',
  },
  component: AdminFixtureCanvas,
  parameters: {
    layout: 'fullscreen',
  },
  title: 'Admin/State matrix',
} satisfies Meta<typeof AdminFixtureCanvas>;

export default meta;
type Story = StoryObj<typeof meta>;

const stateStory = (state: AdminStoryState): Story => ({ args: { state } });

export const FirstUse = stateStory('first-use');
export const Empty = stateStory('empty');
export const Loading = stateStory('loading');
export const Live = stateStory('live');
export const Reconnecting = stateStory('reconnecting');
export const Stale = stateStory('stale');
export const Offline = stateStory('offline');
export const PartialFailure = stateStory('partial-failure');
export const Unauthorized = stateStory('unauthorized');
export const Reauthentication = stateStory('reauthentication');
export const ApprovalPending = stateStory('approval-pending');
export const Conflict = stateStory('conflict');
export const Success = stateStory('success');
export const PartialBatch = stateStory('partial-batch');
export const RateLimit = stateStory('rate-limit');
export const BreakGlass = stateStory('break-glass');

export const English: Story = { args: { locale: 'en', state: 'live' } };
export const LongContent: Story = { args: { longContent: true, state: 'approval-pending' } };
export const ForcedColors: Story = {
  globals: { contrast: 'forced' },
};
export const ReducedMotion: Story = {
  globals: { motion: 'reduced' },
};
export const CompactDensity: Story = {
  globals: { density: 'compact' },
};
export const Tablet: Story = {
  parameters: { viewport: { defaultViewport: 'tablet1024' } },
};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
};
