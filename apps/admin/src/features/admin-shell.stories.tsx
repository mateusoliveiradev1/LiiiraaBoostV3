import { ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { AdminShellFrame, type AdminShellFreshness } from '../admin-navigation';
import { ProductLockup } from '../admin-product-lockup';
import { ADMIN_DOMAIN_ORDER, projectAdminDomainNavigation } from '../admin-shell';

interface AdminShellStoryProps {
  readonly density: 'comfortable' | 'compact';
  readonly drawerOpen: boolean;
  readonly freshness: AdminShellFreshness;
  readonly locale: WebLocale;
  readonly longContent: boolean;
  readonly sidebarMode: 'expanded' | 'compact';
  readonly textScale: boolean;
}

const storyCopy = Object.freeze({
  en: Object.freeze({
    account: 'Operator menu',
    currentQueue: 'Current view',
    currentTask: 'Current task',
    environment: 'Staging — South America',
    inbox: 'Inbox',
    jobs: 'Activity and jobs',
    navigation: 'Administrative domains',
    priority: 'Three access reviews require a decision before the next release window.',
    role: 'Security',
    search: 'Search permitted records',
    title: 'Operational briefing',
  }),
  'pt-BR': Object.freeze({
    account: 'Menu do operador',
    currentQueue: 'Visão atual',
    currentTask: 'Tarefa atual',
    environment: 'Staging — América do Sul',
    inbox: 'Caixa de entrada',
    jobs: 'Atividade e tarefas',
    navigation: 'Domínios administrativos',
    priority: 'Três revisões de acesso exigem decisão antes da próxima janela de publicação.',
    role: 'Segurança',
    search: 'Buscar registros permitidos',
    title: 'Briefing operacional',
  }),
});

const safeQueueState = Object.freeze({
  owner: 'all' as const,
  priority: 'all' as const,
  query: '',
  savedView: 'assigned' as const,
  selectedId: undefined,
  status: 'all' as const,
});

const AdminShellStory = ({
  density,
  drawerOpen,
  freshness,
  locale,
  longContent,
  sidebarMode,
  textScale,
}: AdminShellStoryProps) => {
  const labels = storyCopy[locale];
  const alternateLocale: WebLocale = locale === 'pt-BR' ? 'en' : 'pt-BR';
  const items = projectAdminDomainNavigation(ADMIN_DOMAIN_ORDER, locale).map((item) =>
    longContent && item.domain === 'support'
      ? {
          ...item,
          label:
            locale === 'pt-BR'
              ? 'Atendimento, diagnósticos consentidos e obrigações de resposta'
              : 'Support, consented diagnostics, and response obligations',
        }
      : item,
  );

  return (
    <div style={textScale ? { fontSize: '200%' } : undefined}>
      <AdminShellFrame
        accountActions={
          <button type="button">
            <ProductIcon name="logout" size={17} />
            {locale === 'pt-BR' ? 'Encerrar sessão' : 'Sign out'}
          </button>
        }
        accountLabel={labels.account}
        accountName="Mateus Oliveira"
        actorId="storybook-operator"
        alertsLabel={labels.inbox}
        alternateLocale={alternateLocale}
        alternatePath={`/${alternateLocale}/admin/operation`}
        currentHref={`/${locale}/admin/operation`}
        currentQueueLabel={labels.currentQueue}
        currentTaskLabel={labels.currentTask}
        environmentId="storybook-staging"
        environmentLabel={labels.environment}
        freshness={freshness}
        header={
          <a className="admin-brand" href={`/${locale}/admin/overview`}>
            <ProductLockup />
            <span className="admin-brand__surface">Admin</span>
          </a>
        }
        inboxCount={3}
        inboxHref={`/${locale}/admin/inbox`}
        inboxLabel={labels.inbox}
        initialDensity={density}
        initialDrawerOpen={drawerOpen}
        initialSidebarMode={sidebarMode}
        isolatedLabel={
          locale === 'pt-BR' ? 'Origem administrativa isolada' : 'Isolated Admin origin'
        }
        items={items}
        jobsHref={`/${locale}/admin/activity`}
        jobsLabel={labels.jobs}
        label={labels.navigation}
        locale={locale}
        persistPreference={false}
        queueState={safeQueueState}
        roleHomeHref={`/${locale}/admin/overview`}
        roleHomeLabel={locale === 'pt-BR' ? 'Visão geral' : 'Overview'}
        roleLabel={labels.role}
        savedViewLabels={{
          assigned: locale === 'pt-BR' ? 'Trabalho atribuído' : 'Assigned work',
          'sla-risk': locale === 'pt-BR' ? 'SLA em risco' : 'SLA at risk',
          unowned: locale === 'pt-BR' ? 'Sem responsável' : 'Unassigned',
          'all-permitted': locale === 'pt-BR' ? 'Todos permitidos' : 'All permitted',
        }}
        searchAction={locale === 'pt-BR' ? 'Buscar' : 'Search'}
        searchHref={`/${locale}/admin/search`}
        searchLabel={labels.search}
        searchPlaceholder={labels.search}
        securityLabel={locale === 'pt-BR' ? 'Sessão protegida' : 'Protected session'}
      >
        <main id="admin-main" tabIndex={-1}>
          <section className="admin-landing" aria-labelledby="admin-shell-story-title">
            <header className="admin-landing__header">
              <p>{labels.environment}</p>
              <h1 id="admin-shell-story-title">{labels.title}</h1>
              <span data-pattern="solid" data-tone="warning">
                <ProductIcon name="warning" size={18} />
                {freshness}
              </span>
            </header>
            <section className="admin-landing__focus">
              <h2>{labels.priority}</h2>
              <p>
                {locale === 'pt-BR'
                  ? 'A interface mantém função, ambiente e atualização visíveis sem transformar a tela em um painel de métricas.'
                  : 'The interface keeps function, environment, and freshness visible without turning the screen into a metric dashboard.'}
              </p>
              <a href={`/${locale}/admin/people/access-reviews`}>
                {locale === 'pt-BR' ? 'Abrir revisões de acesso' : 'Open access reviews'}
              </a>
            </section>
          </section>
        </main>
      </AdminShellFrame>
    </div>
  );
};

const meta = {
  args: {
    density: 'comfortable',
    drawerOpen: false,
    freshness: 'live',
    locale: 'pt-BR',
    longContent: false,
    sidebarMode: 'expanded',
    textScale: false,
  },
  component: AdminShellStory,
  parameters: { layout: 'fullscreen' },
  title: 'Admin/Shell/Seven domains',
} satisfies Meta<typeof AdminShellStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopExpanded: Story = {};
export const DesktopCompact: Story = { args: { density: 'compact', sidebarMode: 'compact' } };
export const English: Story = { args: { locale: 'en' } };
export const LongLabels: Story = { args: { longContent: true } };
export const Reconnecting: Story = { args: { freshness: 'reconnecting' } };
export const Degraded: Story = { args: { freshness: 'degraded' } };
export const ReducedMotion: Story = { globals: { motion: 'reduced' } };
export const ForcedColors: Story = { globals: { contrast: 'forced' } };
export const TextAtTwoHundredPercent: Story = { args: { textScale: true } };
export const Tablet: Story = {
  args: { sidebarMode: 'compact' },
  parameters: { viewport: { defaultViewport: 'tablet1024' } },
};
export const Mobile: Story = {
  parameters: { viewport: { defaultViewport: 'mobile390' } },
};
export const MobileDrawerFocusTrap: Story = {
  args: { drawerOpen: true },
  parameters: { viewport: { defaultViewport: 'mobile390' } },
};
export const MobileAtThreeTwenty: Story = {
  args: { longContent: true },
  parameters: {
    viewport: {
      defaultViewport: 'mobile320',
      options: {
        mobile320: { name: 'Mobile 320 × 720', styles: { height: '720px', width: '320px' } },
      },
    },
  },
};
