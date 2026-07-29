import { ProductIcon } from '@liiiraa/design-system';
import type { ProductIconName } from '@liiiraa/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ShellLocale } from '@liiiraa/feature-shell';
import { PreConsentLocaleControl } from '../preferences.js';
import {
  DOWNLOADS,
  INSTALLED_APPS,
  OPERATION_CATALOGS,
  POWER_PLANS,
  SERVICES,
  SHORTCUTS,
  type CatalogRouteId,
  type OperationItem,
  type PremiumRouteId,
} from './control-center-data.js';
import { BrandIcon } from './brand-icons.js';
import { PremiumDownloadsSurface } from './premium-downloads.js';
import { usePremiumLocalization } from './premium-localization.js';
import { PremiumSettingsSurface } from './premium-settings.js';
import { PremiumToast, type PremiumToastMessage, type PremiumToastTone } from './premium-toast.js';

interface PremiumOperationsSurfaceProps {
  readonly locale: ShellLocale;
  readonly navigate: (pathname: string) => void;
  readonly settingsSection?: string;
  readonly view: PremiumRouteId;
}

interface RouteMeta {
  readonly description: string;
  readonly icon: ProductIconName;
  readonly title: string;
}

const ROUTE_META: Readonly<Record<PremiumRouteId, RouteMeta>> = Object.freeze({
  home: {
    description: 'Estado do computador, próxima ação e evidências em um só lugar.',
    icon: 'gauge',
    title: 'Visão geral',
  },
  competitive: {
    description: 'Prepare recursos, processos e serviços para uma sessão competitiva.',
    icon: 'competitive',
    title: 'Modo Competitivo',
  },
  toggles: {
    description: 'Controles rápidos do Windows organizados por objetivo.',
    icon: 'toggles',
    title: 'Controles rápidos',
  },
  shortcuts: {
    description: 'Acesso direto às configurações e ferramentas nativas do Windows.',
    icon: 'toolbox',
    title: 'Atalhos',
  },
  power: {
    description: 'Planos de energia compatíveis, explicados e reversíveis.',
    icon: 'power',
    title: 'Planos de energia',
  },
  network: {
    description: 'Ajustes próprios para latência, estabilidade e conectividade.',
    icon: 'wifi',
    title: 'Rede',
  },
  tweaks: {
    description: 'Ajustes avançados de GPU, CPU, entrada, memória e armazenamento.',
    icon: 'sliders',
    title: 'Tweaks',
  },
  security: {
    description: 'Equilibre compatibilidade e proteção sem recomendações irresponsáveis.',
    icon: 'shield',
    title: 'Segurança',
  },
  services: {
    description: 'Revise inicialização, dependências e impacto dos serviços do Windows.',
    icon: 'services',
    title: 'Serviços',
  },
  restoration: {
    description: 'Desfaça alterações e recupere componentes com rastreabilidade.',
    icon: 'recovery',
    title: 'Restauração',
  },
  uninstaller: {
    description: 'Remova programas com proteção para componentes essenciais.',
    icon: 'trash',
    title: 'Desinstalador',
  },
  downloads: {
    description: 'Ferramentas confiáveis, licenças claras e fontes oficiais.',
    icon: 'download',
    title: 'Downloads',
  },
  settings: {
    description: 'Preferências do aplicativo, privacidade, aparência e atualizações.',
    icon: 'settings',
    title: 'Configurações',
  },
  about: {
    description: 'Versão, integridade, termos, licenças e canais oficiais.',
    icon: 'info',
    title: 'Sobre',
  },
  activity: {
    description: 'Eventos, alterações pendentes e ações recentes do aplicativo.',
    icon: 'activity',
    title: 'Atividade',
  },
});

const INITIAL_OPERATION_STATE = Object.freeze(
  Object.fromEntries(
    Object.values(OPERATION_CATALOGS)
      .flat()
      .map(({ active, id }) => [id, active]),
  ),
) as Readonly<Record<string, boolean>>;

const humanCount = (count: number, singular: string, plural: string): string =>
  `${String(count)} ${count === 1 ? singular : plural}`;

const PremiumButton = ({
  children,
  disabled = false,
  onClick,
  tone = 'secondary',
  type = 'button',
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly tone?: 'danger' | 'primary' | 'quiet' | 'secondary';
  readonly type?: 'button' | 'submit';
}) => (
  <button
    className="premium-button"
    data-tone={tone}
    disabled={disabled}
    onClick={onClick}
    type={type}
  >
    {children}
  </button>
);

const RouteHeader = ({
  action,
  meta,
}: {
  readonly action?: ReactNode;
  readonly meta: RouteMeta;
}) => (
  <header className="premium-route-header">
    <div className="premium-route-heading">
      <span className="premium-route-icon">
        <ProductIcon name={meta.icon} size={24} weight="duotone" />
      </span>
      <div>
        <h1 data-route-heading tabIndex={-1}>
          {meta.title}
        </h1>
        <p>{meta.description}</p>
      </div>
    </div>
    <div className="premium-route-actions">
      <span className="premium-demo-badge">
        <span aria-hidden="true" />
        Demonstração segura
      </span>
      {action}
    </div>
  </header>
);

const HardwareStrip = () => (
  <section aria-label="Hardware detectado no cenário" className="premium-hardware-strip">
    {[
      ['windows', 'Sistema', 'Windows 11 Pro · 24H2', 'windows'],
      ['amd', 'Processador', 'AMD Ryzen 7 7800X3D', 'cpu'],
      ['nvidia', 'Placa de vídeo', 'NVIDIA GeForce RTX 4070', 'graphics'],
      ['', 'Memória', '32 GB DDR5 · 6000 MT/s', 'memory'],
    ].map(([brand, label, value, icon]) => (
      <div key={label}>
        {brand ? (
          <BrandIcon brand={brand} label={value ?? brand} size={21} />
        ) : (
          <ProductIcon name={icon as ProductIconName} size={21} weight="duotone" />
        )}
        <span>
          <small>{label}</small>
          <strong>{value}</strong>
        </span>
      </div>
    ))}
  </section>
);

const SearchAndFilter = ({
  activeFilter,
  categories,
  onFilter,
  onQuery,
  query,
}: {
  readonly activeFilter: string;
  readonly categories: readonly string[];
  readonly onFilter: (value: string) => void;
  readonly onQuery: (value: string) => void;
  readonly query: string;
}) => (
  <div className="premium-filter-bar">
    <label className="premium-search">
      <ProductIcon name="search" size={18} />
      <span className="lb-visually-hidden">Pesquisar nesta rota</span>
      <input
        onChange={(event) => {
          onQuery(event.currentTarget.value);
        }}
        placeholder="Pesquisar ajustes..."
        type="search"
        value={query}
      />
    </label>
    <div aria-label="Filtrar categoria" className="premium-filter-chips" role="group">
      {['Todos', ...categories].map((category) => (
        <button
          aria-pressed={activeFilter === category}
          key={category}
          onClick={() => {
            onFilter(category);
          }}
          type="button"
        >
          {category}
        </button>
      ))}
    </div>
  </div>
);

const OperationRow = ({
  active,
  item,
  onToggle,
}: {
  readonly active: boolean;
  readonly item: OperationItem;
  readonly onToggle: () => void;
}) => (
  <article className="premium-operation-row" data-risk={item.risk}>
    <span className="premium-operation-icon">
      <ProductIcon name={item.icon} size={22} weight="duotone" />
    </span>
    <div className="premium-operation-copy">
      <div>
        <h3>{item.title}</h3>
        {item.recommended ? <span className="premium-recommended">Recomendado</span> : null}
      </div>
      <p>{item.description}</p>
      <ul aria-label="Metadados do ajuste">
        <li>Risco {item.risk}</li>
        {item.restart ? <li>Requer reinicialização</li> : <li>Aplicação sem reiniciar</li>}
        <li>{item.category}</li>
      </ul>
    </div>
    <button
      aria-checked={active}
      aria-label={`${active ? 'Desativar' : 'Ativar'} ${item.title}`}
      className="premium-switch"
      onClick={onToggle}
      role="switch"
      type="button"
    >
      <span />
    </button>
  </article>
);

const PlanBar = ({
  changeCount,
  onDiscard,
  onReview,
}: {
  readonly changeCount: number;
  readonly onDiscard: () => void;
  readonly onReview: () => void;
}) =>
  changeCount > 0 ? (
    <aside aria-label="Plano de alterações" className="premium-plan-bar">
      <span className="premium-plan-bar-icon">
        <ProductIcon name="list" size={22} weight="duotone" />
      </span>
      <div>
        <strong>{humanCount(changeCount, 'alteração preparada', 'alterações preparadas')}</strong>
        <small>Nada foi aplicado ao Windows. Revise compatibilidade e recuperação primeiro.</small>
      </div>
      <PremiumButton onClick={onDiscard} tone="quiet">
        Descartar
      </PremiumButton>
      <PremiumButton onClick={onReview} tone="primary">
        Revisar plano
      </PremiumButton>
    </aside>
  ) : null;

const HomeSurface = ({
  navigate,
  notify,
}: {
  readonly navigate: (pathname: string) => void;
  readonly notify: (message: string) => void;
}) => (
  <>
    <HardwareStrip />
    <section className="premium-home-grid">
      <article className="premium-readiness-card">
        <div className="premium-score" style={{ '--premium-score': '92%' } as React.CSSProperties}>
          <span>
            <strong>92</strong>
            <small>/ 100</small>
          </span>
        </div>
        <div>
          <span className="premium-section-label">Prontidão do sistema</span>
          <h2>Seu PC está pronto para competir</h2>
          <p>O cenário está estável. Há cinco recomendações compatíveis aguardando sua revisão.</p>
          <div className="premium-inline-actions">
            <PremiumButton
              onClick={() => {
                navigate('/competitive');
              }}
              tone="primary"
            >
              Abrir Modo Competitivo
            </PremiumButton>
            <PremiumButton
              onClick={() => {
                notify('Nova análise simulada concluída. Nenhuma alteração foi aplicada.');
              }}
            >
              Analisar novamente
            </PremiumButton>
          </div>
        </div>
      </article>
      <article className="premium-game-card">
        <div className="premium-game-visual">
          <img
            alt="Counter-Strike 2"
            decoding="async"
            loading="eager"
            src="/games/counter-strike-2.jpg"
          />
          <span aria-hidden="true" className="premium-game-brand">
            <BrandIcon brand="counter-strike-2" size={22} />
          </span>
        </div>
        <span className="premium-section-label">Jogo selecionado</span>
        <h2>Counter-Strike 2</h2>
        <p>Perfil competitivo · prioridade alta · restauração automática</p>
        <dl>
          <div>
            <dt>Última sessão</dt>
            <dd>144 Hz estáveis</dd>
          </div>
          <div>
            <dt>Perfil</dt>
            <dd>Competitivo</dd>
          </div>
        </dl>
      </article>
      <article className="premium-metrics-panel">
        <header>
          <div>
            <span className="premium-section-label">Telemetria local</span>
            <h2>Agora</h2>
          </div>
          <span className="premium-live">
            <span aria-hidden="true" />
            Atualizando
          </span>
        </header>
        <div className="premium-metric-grid">
          {[
            ['cpu', 'CPU', '4%', '47 °C'],
            ['graphics', 'GPU', '2%', '42 °C'],
            ['memory', 'Memória', '9,8 GB', '31%'],
            ['network', 'Latência local', '1,2 ms', 'Estável'],
          ].map(([icon, label, value, detail]) => (
            <div key={label}>
              <ProductIcon name={icon as ProductIconName} size={20} weight="duotone" />
              <span>
                <small>{label}</small>
                <strong>{value}</strong>
                <em>{detail}</em>
              </span>
            </div>
          ))}
        </div>
      </article>
      <article className="premium-next-actions">
        <header>
          <span className="premium-section-label">Próximas ações</span>
          <strong>3 recomendações</strong>
        </header>
        {[
          ['Rede', 'Revisar DNS medido e moderação de interrupções', '/network'],
          ['Energia', 'Ativar plano Liiiraa Adaptativo', '/power'],
          ['Segurança', 'Verificar compatibilidade do isolamento de núcleo', '/security'],
        ].map(([label, description, path]) => (
          <button
            key={label}
            onClick={() => {
              navigate(path ?? '/home');
            }}
            type="button"
          >
            <span>
              <small>{label}</small>
              <strong>{description}</strong>
            </span>
            <ProductIcon name="arrowRight" size={18} />
          </button>
        ))}
      </article>
    </section>
  </>
);

const CompetitiveSurface = ({ notify }: { readonly notify: (message: string) => void }) => {
  const [game, setGame] = useState('Counter-Strike 2');
  const [sessionActive, setSessionActive] = useState(false);
  const [settings, setSettings] = useState({
    cpuSets: true,
    focus: true,
    ioPriority: true,
    network: false,
    pauseServices: true,
  });

  return (
    <div className="premium-competitive-layout">
      <section className="premium-competitive-hero">
        <div>
          <span className="premium-section-label">Perfil de sessão</span>
          <h2>{sessionActive ? 'Sessão competitiva ativa' : 'Prepare o ambiente do jogo'}</h2>
          <p>
            A Liiiraa organiza as mudanças num plano temporário e restaura o estado anterior ao
            encerrar.
          </p>
        </div>
        <div className="premium-game-selector">
          <label htmlFor="competitive-game">Jogo</label>
          <select
            id="competitive-game"
            onChange={(event) => {
              setGame(event.currentTarget.value);
            }}
            value={game}
          >
            <option>Counter-Strike 2</option>
            <option>VALORANT</option>
            <option>Fortnite</option>
            <option>Adicionar executável...</option>
          </select>
          <PremiumButton
            onClick={() => {
              notify('Biblioteca reexaminada no cenário demonstrativo.');
            }}
          >
            Reexaminar jogos
          </PremiumButton>
        </div>
      </section>
      <section className="premium-session-status" data-active={String(sessionActive)}>
        <span className="premium-session-orbit">
          <ProductIcon name={sessionActive ? 'rocket' : 'competitive'} size={34} weight="duotone" />
        </span>
        <div>
          <small>{game}</small>
          <strong>{sessionActive ? 'Ambiente priorizado' : 'Pronto para iniciar'}</strong>
          <p>
            {sessionActive
              ? '5 ações simuladas ativas · recuperação preparada'
              : '5 ações selecionadas · nenhum risco crítico detectado'}
          </p>
        </div>
        <PremiumButton
          onClick={() => {
            setSessionActive((current) => !current);
            notify(
              sessionActive
                ? 'Sessão encerrada e estado demonstrativo restaurado.'
                : 'Sessão competitiva simulada iniciada.',
            );
          }}
          tone={sessionActive ? 'danger' : 'primary'}
        >
          {sessionActive ? 'Encerrar e restaurar' : 'Iniciar sessão'}
        </PremiumButton>
      </section>
      <section className="premium-session-options">
        <header>
          <div>
            <span className="premium-section-label">Ações da sessão</span>
            <h2>Prioridade e foco</h2>
          </div>
          <span>Aplicação temporária</span>
        </header>
        {[
          ['focus', 'Foco no jogo', 'Prioriza o processo em primeiro plano.', 'competitive'],
          [
            'ioPriority',
            'Prioridade de processo e I/O',
            'Eleva prioridades dentro de limites seguros.',
            'cpu',
          ],
          [
            'cpuSets',
            'CPU Sets',
            'Reserva afinidade preferencial conforme a topologia.',
            'microchip',
          ],
          [
            'pauseServices',
            'Pausar serviços não essenciais',
            'Interrompe apenas serviços aprovados para a sessão.',
            'services',
          ],
          [
            'network',
            'Perfil de rede competitivo',
            'Aplica somente ajustes compatíveis com o adaptador.',
            'wifi',
          ],
        ].map(([id, title, description, icon]) => {
          const key = id as keyof typeof settings;
          return (
            <article key={id}>
              <ProductIcon name={icon as ProductIconName} size={22} weight="duotone" />
              <span>
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <button
                aria-checked={settings[key]}
                aria-label={`${settings[key] ? 'Desativar' : 'Ativar'} ${String(title)}`}
                className="premium-switch"
                onClick={() => {
                  setSettings((current) => ({ ...current, [key]: !current[key] }));
                }}
                role="switch"
                type="button"
              >
                <span />
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
};

const CatalogSurface = ({
  activeFilter,
  operationState,
  query,
  setActiveFilter,
  setOperationState,
  setQuery,
  view,
}: {
  readonly activeFilter: string;
  readonly operationState: Readonly<Record<string, boolean>>;
  readonly query: string;
  readonly setActiveFilter: (value: string) => void;
  readonly setOperationState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  readonly setQuery: (value: string) => void;
  readonly view: CatalogRouteId;
}) => {
  const items = OPERATION_CATALOGS[view];
  const categories = useMemo(
    () => Array.from(new Set(items.map(({ category }) => category))),
    [items],
  );
  const filtered = items.filter((item) => {
    const matchesCategory = activeFilter === 'Todos' || item.category === activeFilter;
    const searchable = `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase(
      'pt-BR',
    );
    return matchesCategory && searchable.includes(query.toLocaleLowerCase('pt-BR').trim());
  });
  const activeCount = items.filter(({ id }) => operationState[id] ?? false).length;

  return (
    <>
      {view === 'security' ? (
        <section className="premium-security-notice">
          <ProductIcon name="shield" size={24} weight="duotone" />
          <div>
            <strong>Proteções não são “FPS grátis”</strong>
            <p>Alterações críticas exigem confirmação, compatibilidade e caminho de restauração.</p>
          </div>
        </section>
      ) : null}
      <section className="premium-catalog-summary">
        <div>
          <strong>{activeCount}</strong>
          <span>de {items.length} ativos</span>
        </div>
        <div>
          <strong>{items.filter(({ recommended }) => recommended).length}</strong>
          <span>recomendados</span>
        </div>
        <div>
          <strong>{items.filter(({ restart }) => restart).length}</strong>
          <span>exigem reinício</span>
        </div>
      </section>
      <SearchAndFilter
        activeFilter={activeFilter}
        categories={categories}
        onFilter={setActiveFilter}
        onQuery={setQuery}
        query={query}
      />
      <section
        aria-label={`Catálogo de ${ROUTE_META[view].title}`}
        className="premium-operation-list"
      >
        {filtered.length > 0 ? (
          filtered.map((item) => (
            <OperationRow
              active={operationState[item.id] ?? false}
              item={item}
              key={item.id}
              onToggle={() => {
                setOperationState((current) => ({
                  ...current,
                  [item.id]: !(current[item.id] ?? false),
                }));
              }}
            />
          ))
        ) : (
          <div className="premium-empty-state">
            <ProductIcon name="search" size={28} weight="duotone" />
            <h2>Nenhum ajuste encontrado</h2>
            <p>Tente outro termo ou remova o filtro atual.</p>
          </div>
        )}
      </section>
    </>
  );
};

const ShortcutsSurface = ({ notify }: { readonly notify: (message: string) => void }) => {
  const [query, setQuery] = useState('');
  const filtered = SHORTCUTS.filter(({ description, title }) =>
    `${title} ${description}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
  );

  return (
    <>
      <SearchAndFilter
        activeFilter="Todos"
        categories={[]}
        onFilter={() => undefined}
        onQuery={setQuery}
        query={query}
      />
      {Array.from(new Set(filtered.map(({ category }) => category))).map((category) => (
        <section className="premium-shortcut-section" key={category}>
          <h2>{category}</h2>
          <div className="premium-card-grid">
            {filtered
              .filter((item) => item.category === category)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    notify(`${item.title} seria aberto pelo host nativo na versão funcional.`);
                  }}
                  type="button"
                >
                  <ProductIcon name={item.icon} size={23} weight="duotone" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ProductIcon name="arrowRight" size={17} />
                </button>
              ))}
          </div>
        </section>
      ))}
    </>
  );
};

const PowerSurface = ({ notify }: { readonly notify: (message: string) => void }) => {
  const [currentPlan, setCurrentPlan] = useState('liiiraa-adaptive');
  return (
    <>
      <section className="premium-current-plan">
        <span>
          <ProductIcon name="lightning" size={29} weight="duotone" />
        </span>
        <div>
          <small>Plano aplicado no cenário</small>
          <h2>{POWER_PLANS.find(({ id }) => id === currentPlan)?.title}</h2>
          <p>Estado conhecido · restauração disponível · nenhuma alteração real nesta fase</p>
        </div>
        <span className="premium-status-pill">Ativo</span>
      </section>
      <section className="premium-power-grid">
        {POWER_PLANS.map((plan) => (
          <article data-current={String(plan.id === currentPlan)} key={plan.id}>
            <header>
              <ProductIcon name={plan.recommended ? 'crown' : 'power'} size={22} weight="duotone" />
              {plan.recommended ? <span>Recomendado</span> : null}
            </header>
            <h2>{plan.title}</h2>
            <p>{plan.description}</p>
            <small>{plan.impact}</small>
            <PremiumButton
              disabled={plan.id === currentPlan}
              onClick={() => {
                setCurrentPlan(plan.id);
                notify(`${plan.title} selecionado no cenário demonstrativo.`);
              }}
              tone={plan.recommended ? 'primary' : 'secondary'}
            >
              {plan.id === currentPlan ? 'Plano atual' : 'Preparar aplicação'}
            </PremiumButton>
          </article>
        ))}
      </section>
    </>
  );
};

const ServicesSurface = () => {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(SERVICES.map(({ id, recommended }) => [id, recommended])),
  );
  const [query, setQuery] = useState('');
  const filtered = SERVICES.filter(({ category, description, title }) =>
    `${title} ${description} ${category}`
      .toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')),
  );

  return (
    <>
      <SearchAndFilter
        activeFilter="Todos"
        categories={[]}
        onFilter={() => undefined}
        onQuery={setQuery}
        query={query}
      />
      <section className="premium-service-list">
        {filtered.map((service) => (
          <article key={service.id}>
            <ProductIcon name="services" size={22} weight="duotone" />
            <div>
              <span>
                <small>{service.category}</small>
                <strong>{service.title}</strong>
              </span>
              <p>{service.description}</p>
            </div>
            <label>
              <span className="lb-visually-hidden">Inicialização de {service.title}</span>
              <select
                onChange={(event) => {
                  setValues((current) => ({ ...current, [service.id]: event.currentTarget.value }));
                }}
                value={values[service.id]}
              >
                <option>Automático</option>
                <option>Automático (atraso)</option>
                <option>Manual</option>
                <option>Desativado</option>
              </select>
            </label>
          </article>
        ))}
      </section>
    </>
  );
};

const RestorationSurface = ({ notify }: { readonly notify: (message: string) => void }) => (
  <>
    <section className="premium-restore-readiness">
      <div>
        <ProductIcon name="check" size={25} weight="duotone" />
        <span>
          <strong>Recuperação pronta</strong>
          <small>Último ponto de restauração: hoje, 18:42</small>
        </span>
      </div>
      <PremiumButton
        onClick={() => {
          notify('Ponto de restauração demonstrativo criado.');
        }}
        tone="primary"
      >
        Criar ponto de restauração
      </PremiumButton>
    </section>
    <section className="premium-restore-grid">
      <article>
        <span className="premium-section-label">Histórico Liiiraa</span>
        <h2>Alterações reversíveis</h2>
        {[
          ['Perfil de rede competitivo', 'Hoje, 18:32', '3 alterações'],
          ['Plano Liiiraa Adaptativo', 'Ontem, 21:14', '1 alteração'],
          ['Ajustes de entrada', '27 jul., 19:06', '2 alterações'],
        ].map(([title, date, detail]) => (
          <button
            key={title}
            onClick={() => {
              notify(`Detalhes de “${String(title)}” abertos no cenário.`);
            }}
            type="button"
          >
            <ProductIcon name="history" size={20} />
            <span>
              <strong>{title}</strong>
              <small>
                {date} · {detail}
              </small>
            </span>
            <ProductIcon name="chevronRight" size={17} />
          </button>
        ))}
      </article>
      <article>
        <span className="premium-section-label">Componentes do Windows</span>
        <h2>Aplicativos recuperáveis</h2>
        {['Ferramenta de Captura', 'Xbox Game Bar', 'Microsoft Store'].map((app) => (
          <div key={app}>
            <ProductIcon name="store" size={20} />
            <span>
              <strong>{app}</strong>
              <small>Disponível para reinstalação</small>
            </span>
            <PremiumButton
              onClick={() => {
                notify(`${app} preparado para restauração demonstrativa.`);
              }}
              tone="quiet"
            >
              Restaurar
            </PremiumButton>
          </div>
        ))}
      </article>
    </section>
  </>
);

const UninstallerSurface = ({ notify }: { readonly notify: (message: string) => void }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const filtered = INSTALLED_APPS.filter(({ publisher, title }) =>
    `${title} ${publisher}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')),
  );

  const selectedSize = selected.size;
  return (
    <>
      <div className="premium-uninstall-toolbar">
        <label className="premium-search">
          <ProductIcon name="search" size={18} />
          <span className="lb-visually-hidden">Pesquisar aplicativo instalado</span>
          <input
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            placeholder="Pesquisar aplicativo..."
            type="search"
            value={query}
          />
        </label>
        <span>{humanCount(selectedSize, 'selecionado', 'selecionados')}</span>
        <PremiumButton
          disabled={selectedSize === 0}
          onClick={() => {
            notify(
              `${humanCount(selectedSize, 'item preparado', 'itens preparados')} para revisão.`,
            );
          }}
          tone="danger"
        >
          Revisar desinstalação
        </PremiumButton>
      </div>
      <section className="premium-app-list">
        {filtered.map((app) => (
          <label data-protected={String(app.protected ?? false)} key={app.id}>
            <input
              checked={selected.has(app.id)}
              disabled={app.protected}
              onChange={() => {
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(app.id)) {
                    next.delete(app.id);
                  } else {
                    next.add(app.id);
                  }
                  return next;
                });
              }}
              type="checkbox"
            />
            <span className="premium-app-icon">
              <BrandIcon brand={app.id} label={app.title} size={21} />
            </span>
            <span>
              <strong>{app.title}</strong>
              <small>
                {app.publisher} · {app.category}
              </small>
            </span>
            {app.protected ? <em>Protegido</em> : <b>{app.size}</b>}
          </label>
        ))}
      </section>
    </>
  );
};

/** @deprecated Retained for fixture compatibility; the premium download state machine is used. */
export const LegacyDownloadsSurface = ({
  notify,
}: {
  readonly notify: (message: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Record<string, 'concluído' | 'ocioso' | 'preparando'>>({});
  const filtered = DOWNLOADS.filter(({ category, description, title }) =>
    `${title} ${description} ${category}`
      .toLocaleLowerCase('pt-BR')
      .includes(query.toLocaleLowerCase('pt-BR')),
  );

  const startDownload = (id: string, title: string): void => {
    setStatus((current) => ({ ...current, [id]: 'preparando' }));
    globalThis.setTimeout(() => {
      setStatus((current) => ({ ...current, [id]: 'concluído' }));
      notify(`${title}: demonstração concluída. Nenhum arquivo foi baixado.`);
    }, 700);
  };

  return (
    <>
      <SearchAndFilter
        activeFilter="Todos"
        categories={[]}
        onFilter={() => undefined}
        onQuery={setQuery}
        query={query}
      />
      <section className="premium-download-grid">
        {filtered.map((item) => {
          const itemStatus = status[item.id] ?? 'ocioso';
          return (
            <article key={item.id}>
              <span className="premium-download-icon">
                <BrandIcon brand={item.id} label={item.title} size={25} />
              </span>
              <div>
                <small>{item.category}</small>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <span>{item.license} · fonte oficial</span>
              </div>
              <PremiumButton
                disabled={itemStatus === 'preparando'}
                onClick={() => {
                  startDownload(item.id, item.title);
                }}
                tone={itemStatus === 'concluído' ? 'quiet' : 'secondary'}
              >
                {itemStatus === 'preparando'
                  ? 'Preparando...'
                  : itemStatus === 'concluído'
                    ? 'Concluído'
                    : 'Preparar download'}
              </PremiumButton>
            </article>
          );
        })}
      </section>
    </>
  );
};

const SETTINGS_SECTION_BY_STATE: Readonly<Record<string, string>> = Object.freeze({
  advanced: 'Dados e recuperação',
  appearance: 'Aparência',
  general: 'Geral',
  notifications: 'Notificações',
  privacy: 'Privacidade',
});

const SETTINGS_ROUTE_BY_SECTION: Readonly<Record<string, string>> = Object.freeze({
  Aparência: '/settings/appearance',
  'Dados e recuperação': '/settings/advanced',
  Geral: '/settings/general',
  Notificações: '/settings/notifications',
  Privacidade: '/settings/privacy',
});

/** @deprecated Retained only for fixture compatibility while settings migrate to typed preferences. */
export const LegacySettingsSurface = ({
  navigate,
  notify,
  routeState = 'general',
}: {
  readonly navigate: (pathname: string) => void;
  readonly notify: (message: string) => void;
  readonly routeState?: string | undefined;
}) => {
  const [section, setSection] = useState(SETTINGS_SECTION_BY_STATE[routeState] ?? 'Geral');
  const [settings, setSettings] = useState({
    analytics: false,
    autoUpdate: true,
    launch: false,
    notifications: true,
    reducedMotion: false,
    tray: true,
  });
  const options: Readonly<Record<string, readonly [keyof typeof settings, string, string][]>> =
    Object.freeze({
      Geral: [
        ['launch', 'Iniciar com o Windows', 'Abre a Liiiraa ao entrar na sua conta.'],
        ['tray', 'Manter na bandeja', 'Continua disponível sem manter a janela aberta.'],
        [
          'autoUpdate',
          'Atualizações automáticas',
          'Baixa atualizações assinadas quando disponíveis.',
        ],
      ],
      Aparência: [
        ['reducedMotion', 'Reduzir movimento', 'Substitui transições por mudanças instantâneas.'],
      ],
      Notificações: [
        [
          'notifications',
          'Notificações do aplicativo',
          'Mostra alertas de plano, sessão e atualização.',
        ],
      ],
      Privacidade: [
        [
          'analytics',
          'Diagnóstico opcional',
          'Compartilha somente diagnóstico autorizado e redigido.',
        ],
      ],
    });

  useEffect(() => {
    setSection(SETTINGS_SECTION_BY_STATE[routeState] ?? 'Geral');
  }, [routeState]);

  const openSection = (nextSection: string): void => {
    setSection(nextSection);
    const pathname = SETTINGS_ROUTE_BY_SECTION[nextSection];
    if (pathname !== undefined) {
      navigate(pathname);
    }
  };

  return (
    <div className="premium-settings-layout">
      <nav aria-label="Seções de configurações">
        {Object.keys(options).map((item) => (
          <button
            aria-current={section === item ? 'page' : undefined}
            key={item}
            onClick={() => {
              openSection(item);
            }}
            type="button"
          >
            {item}
          </button>
        ))}
        <button
          aria-current={section === 'Dados e recuperação' ? 'page' : undefined}
          onClick={() => {
            openSection('Dados e recuperação');
          }}
          type="button"
        >
          Dados e recuperação
        </button>
      </nav>
      <section>
        <header>
          <span className="premium-section-label">Preferências do aplicativo</span>
          <h2>{section}</h2>
        </header>
        {section === 'Dados e recuperação' ? (
          <div className="premium-settings-actions">
            {[
              ['Exportar perfil', 'Gera um arquivo com preferências e plano atual.', 'download'],
              ['Importar perfil', 'Valida um perfil antes de apresentar as diferenças.', 'package'],
              ['Abrir pasta de logs', 'Logs locais com dados sensíveis redigidos.', 'activity'],
              ['Reexaminar hardware', 'Atualiza o inventário do cenário demonstrativo.', 'radar'],
              ['Redefinir aplicativo', 'Volta as preferências da interface ao padrão.', 'recovery'],
            ].map(([title, description, icon]) => (
              <button
                key={title}
                onClick={() => {
                  notify(`${String(title)}: fluxo demonstrativo concluído.`);
                }}
                type="button"
              >
                <ProductIcon name={icon as ProductIconName} size={21} weight="duotone" />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <ProductIcon name="chevronRight" size={17} />
              </button>
            ))}
          </div>
        ) : (
          <div className="premium-settings-list">
            {section === 'Geral' ? (
              <article>
                <span>
                  <strong>Idioma da interface</strong>
                  <small>Altera menus, mensagens e controles do aplicativo.</small>
                </span>
                <PreConsentLocaleControl />
              </article>
            ) : null}
            {(options[section] ?? []).map(([key, title, description]) => (
              <article key={key}>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <button
                  aria-checked={settings[key]}
                  aria-label={`${settings[key] ? 'Desativar' : 'Ativar'} ${title}`}
                  className="premium-switch"
                  onClick={() => {
                    setSettings((current) => ({ ...current, [key]: !current[key] }));
                  }}
                  role="switch"
                  type="button"
                >
                  <span />
                </button>
              </article>
            ))}
            {section === 'Aparência' ? (
              <article>
                <span>
                  <strong>Tema do aplicativo</strong>
                  <small>Grafite profundo com sinal cobalto.</small>
                </span>
                <select aria-label="Tema do aplicativo" defaultValue="Grafite">
                  <option>Grafite</option>
                  <option>Sistema</option>
                </select>
              </article>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
};

const ActivitySurface = ({ notify }: { readonly notify: (message: string) => void }) => (
  <section className="premium-activity-timeline">
    {[
      ['Agora', 'Plano competitivo preparado', '5 alterações aguardam revisão', 'list'],
      ['18:42', 'Ponto de restauração verificado', 'Recuperação disponível', 'recovery'],
      ['18:31', 'Hardware reexaminado', 'Nenhuma mudança de compatibilidade', 'radar'],
      [
        'Ontem',
        'Atualização 0.0.0 verificada',
        'Canal estável · assinatura de desenvolvimento',
        'check',
      ],
    ].map(([time, title, detail, icon], index) => (
      <article key={`${String(time)}-${String(title)}`}>
        <time>{time}</time>
        <span className="premium-activity-icon">
          <ProductIcon name={icon as ProductIconName} size={20} weight="duotone" />
        </span>
        <div>
          <strong>{title}</strong>
          <p>{detail}</p>
        </div>
        <PremiumButton
          onClick={() => {
            notify(`Detalhes de “${String(title)}” abertos.`);
          }}
          tone={index === 0 ? 'primary' : 'quiet'}
        >
          Ver detalhes
        </PremiumButton>
      </article>
    ))}
  </section>
);

const AboutSurface = ({ notify }: { readonly notify: (message: string) => void }) => (
  <div className="premium-about-layout">
    <section className="premium-about-hero">
      <span className="premium-about-mark" aria-hidden="true">
        <svg viewBox="0 0 36 28">
          <path d="M2 25.5 10.6 2h7.2l-5.7 15.2h9.2l-7.1 8.3H2Z" />
          <path d="m20.7 7.2 10.3 7-10.3 7 3-3.7 4.8-3.3-4.8-3.3-3-3.7Z" />
        </svg>
      </span>
      <div>
        <span className="premium-section-label">Liiiraa Boost</span>
        <h2>Controle preciso. Recuperação sempre disponível.</h2>
        <p>Versão 0.0.0 · canal estável · compilação visual da Fase 2</p>
      </div>
      <PremiumButton
        onClick={() => {
          notify('Você já está na versão mais recente do cenário.');
        }}
        tone="primary"
      >
        Verificar atualizações
      </PremiumButton>
    </section>
    <section className="premium-about-grid">
      {[
        ['Integridade', 'Assinatura de desenvolvimento', 'check'],
        ['Termos de uso', 'Contrato completo do aplicativo', 'list'],
        ['Privacidade', 'Política LGPD e GDPR', 'shield'],
        ['Licenças', 'Bibliotecas, fontes e ícones', 'code'],
        ['Suporte', 'Documentação e diagnóstico', 'info'],
        ['Versão do WebView2', 'Runtime 138.0 · compatível', 'browser'],
      ].map(([title, description, icon]) => (
        <button
          key={title}
          onClick={() => {
            notify(`${String(title)} aberto no cenário demonstrativo.`);
          }}
          type="button"
        >
          <ProductIcon name={icon as ProductIconName} size={22} weight="duotone" />
          <span>
            <strong>{title}</strong>
            <small>{description}</small>
          </span>
          <ProductIcon name="chevronRight" size={17} />
        </button>
      ))}
    </section>
  </div>
);

const ReviewDialog = ({
  changeCount,
  onClose,
  onConfirm,
}: {
  readonly changeCount: number;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="premium-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby="premium-review-title"
        aria-modal="true"
        className="premium-review-dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header>
          <span>
            <ProductIcon name="list" size={24} weight="duotone" />
          </span>
          <div>
            <small>Plano demonstrativo</small>
            <h2 id="premium-review-title">Revise antes de continuar</h2>
          </div>
          <button aria-label="Fechar revisão" onClick={onClose} type="button">
            <ProductIcon name="close" size={20} />
          </button>
        </header>
        <p>
          {humanCount(changeCount, 'alteração foi preparada', 'alterações foram preparadas')}. O
          motor real ainda não está conectado nesta fase.
        </p>
        <ul>
          <li>
            <ProductIcon name="check" size={18} /> Compatibilidade verificada no cenário
          </li>
          <li>
            <ProductIcon name="recovery" size={18} /> Caminho de restauração disponível
          </li>
          <li>
            <ProductIcon name="shield" size={18} /> Nenhuma operação privilegiada será executada
          </li>
        </ul>
        <footer>
          <PremiumButton onClick={onClose}>Voltar aos ajustes</PremiumButton>
          <PremiumButton onClick={onConfirm} tone="primary">
            Confirmar demonstração
          </PremiumButton>
        </footer>
      </div>
    </div>
  );
};

export const PremiumOperationsSurface = ({
  locale,
  navigate,
  settingsSection,
  view,
}: PremiumOperationsSurfaceProps) => {
  const rootRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [operationState, setOperationState] = useState<Record<string, boolean>>({
    ...INITIAL_OPERATION_STATE,
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [toast, setToast] = useState<PremiumToastMessage | null>(null);
  usePremiumLocalization(rootRef, locale);

  useEffect(() => {
    setQuery('');
    setActiveFilter('Todos');
  }, [view]);

  useEffect(() => {
    if (!reviewOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setReviewOpen(false);
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, [reviewOpen]);

  useEffect(() => {
    if (toast === null) {
      return undefined;
    }
    const timer = globalThis.setTimeout(() => {
      setToast(null);
    }, 4200);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [toast]);

  const changeCount = Object.entries(operationState).filter(
    ([id, active]) => INITIAL_OPERATION_STATE[id] !== active,
  ).length;

  const notify = (message: string, tone: PremiumToastTone = 'success'): void => {
    setToast({ id: Date.now(), message, tone });
  };

  let content: ReactNode;
  if (view === 'home') {
    content = <HomeSurface navigate={navigate} notify={notify} />;
  } else if (view === 'competitive') {
    content = <CompetitiveSurface notify={notify} />;
  } else if (view === 'toggles' || view === 'network' || view === 'tweaks' || view === 'security') {
    content = (
      <CatalogSurface
        activeFilter={activeFilter}
        operationState={operationState}
        query={query}
        setActiveFilter={setActiveFilter}
        setOperationState={setOperationState}
        setQuery={setQuery}
        view={view}
      />
    );
  } else if (view === 'shortcuts') {
    content = <ShortcutsSurface notify={notify} />;
  } else if (view === 'power') {
    content = <PowerSurface notify={notify} />;
  } else if (view === 'services') {
    content = <ServicesSurface />;
  } else if (view === 'restoration') {
    content = <RestorationSurface notify={notify} />;
  } else if (view === 'uninstaller') {
    content = <UninstallerSurface notify={notify} />;
  } else if (view === 'downloads') {
    content = <PremiumDownloadsSurface locale={locale} notify={notify} />;
  } else if (view === 'settings') {
    content = (
      <PremiumSettingsSurface
        locale={locale}
        navigate={navigate}
        notify={notify}
        routeState={settingsSection}
      />
    );
  } else if (view === 'activity') {
    content = <ActivitySurface notify={notify} />;
  } else {
    content = <AboutSurface notify={notify} />;
  }

  return (
    <main className="premium-operations" data-premium-route={view} ref={rootRef}>
      <RouteHeader
        action={
          view === 'downloads' ? (
            <PremiumButton
              onClick={() => {
                notify('Pasta de downloads aberta no cenário demonstrativo.');
              }}
            >
              Abrir pasta
            </PremiumButton>
          ) : undefined
        }
        meta={ROUTE_META[view]}
      />
      <div className="premium-route-content">{content}</div>
      <PlanBar
        changeCount={changeCount}
        onDiscard={() => {
          setOperationState({ ...INITIAL_OPERATION_STATE });
          notify('Alterações demonstrativas descartadas.');
        }}
        onReview={() => {
          setReviewOpen(true);
        }}
      />
      {reviewOpen ? (
        <ReviewDialog
          changeCount={changeCount}
          onClose={() => {
            setReviewOpen(false);
          }}
          onConfirm={() => {
            setReviewOpen(false);
            setOperationState({ ...INITIAL_OPERATION_STATE });
            notify('Plano demonstrativo confirmado. Nenhuma mudança real foi aplicada.');
          }}
        />
      ) : null}
      {toast === null ? null : (
        <PremiumToast
          locale={locale}
          onClose={() => {
            setToast(null);
          }}
          toast={toast}
        />
      )}
    </main>
  );
};
