import { LbButton, ScenarioMarker, StatusSignal } from '@liiiraa/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

import {
  getCommandNoResultMessage,
  searchCommands,
  selectCommand,
  type ActionablePhaseBoundary,
  type CommandSearchContext,
  type CommandSearchEntry,
  type CommandSearchKind,
  type CommandSearchResult,
  type CommandSelection,
} from '../model/interaction-policy.js';
import type { ShellLocale } from './calibration.js';

export interface GlobalCommandCenterProps {
  readonly boundaries?: Readonly<Partial<Record<string, ActionablePhaseBoundary>>>;
  readonly context: CommandSearchContext;
  readonly entries: readonly CommandSearchEntry[];
  readonly initialQuery?: string;
  readonly initiallyOpen?: boolean;
  readonly locale: ShellLocale;
  readonly onNavigate: (selection: CommandSelection) => void;
  readonly onOpenScenario: (scenarioId: ActionablePhaseBoundary['availableScenarioId']) => void;
  readonly scenarioId: string;
}

const GROUP_LABELS: Readonly<Record<ShellLocale, Readonly<Record<CommandSearchKind, string>>>> = {
  en: {
    route: 'Modules and routes',
    game: 'Games',
    launcher: 'Launchers',
    component: 'Components',
    operation: 'Operations',
    setting: 'Settings',
    history: 'History and reports',
    documentation: 'Documentation',
    'safe-action': 'Safe actions',
  },
  'pt-BR': {
    route: 'Módulos e rotas',
    game: 'Jogos',
    launcher: 'Inicializadores',
    component: 'Componentes',
    operation: 'Operações',
    setting: 'Configurações',
    history: 'Histórico e relatórios',
    documentation: 'Documentação',
    'safe-action': 'Ações seguras',
  },
};

const GROUP_ORDER: readonly CommandSearchKind[] = [
  'route',
  'game',
  'launcher',
  'component',
  'operation',
  'setting',
  'history',
  'documentation',
  'safe-action',
];

const clampActiveIndex = (index: number, resultCount: number) => {
  if (resultCount === 0) return -1;
  return Math.max(0, Math.min(index, resultCount - 1));
};

export const GlobalCommandCenter = ({
  boundaries = {},
  context,
  entries,
  initialQuery = '',
  initiallyOpen = false,
  locale,
  onNavigate,
  onOpenScenario,
  scenarioId,
}: GlobalCommandCenterProps) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [query, setQuery] = useState(initialQuery);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isPtBr = locale === 'pt-BR';
  const policyLocale = isPtBr ? 'pt-BR' : 'en-US';
  const results = useMemo(() => searchCommands(entries, query, context), [context, entries, query]);

  const close = () => {
    setIsOpen(false);
    setPreviewIndex(null);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  const open = () => {
    setIsOpen(true);
    queueMicrotask(() => inputRef.current?.focus());
  };

  useEffect(() => {
    const onGlobalShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        open();
      }
    };

    document.addEventListener('keydown', onGlobalShortcut);
    return () => {
      document.removeEventListener('keydown', onGlobalShortcut);
    };
  }, []);

  useEffect(() => {
    setActiveIndex((current) => clampActiveIndex(current, results.length));
    setPreviewIndex((current) => (current === null || current >= results.length ? null : current));
  }, [results.length]);

  const activate = (result: CommandSearchResult) => {
    onNavigate(selectCommand(result.entry));
    close();
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length === 0 ? -1 : current >= results.length - 1 ? 0 : current + 1,
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length === 0 ? -1 : current <= 0 ? results.length - 1 : current - 1,
      );
      return;
    }
    if (event.key === 'ArrowRight' && activeIndex >= 0) {
      event.preventDefault();
      setPreviewIndex(activeIndex);
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      const result = results[activeIndex];
      if (result) activate(result);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (previewIndex !== null) {
        setPreviewIndex(null);
      } else {
        close();
      }
    }
  };

  const groupedResults = GROUP_ORDER.map((kind) => ({
    kind,
    results: results.filter((result) => result.entry.kind === kind),
  })).filter((group) => group.results.length > 0);
  const preview = previewIndex === null ? undefined : results[previewIndex];
  const previewBoundary = preview ? boundaries[preview.entry.id] : undefined;

  return (
    <>
      <button
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K"
        className="lb-button"
        data-lb-control
        onClick={open}
        ref={triggerRef}
        type="button"
      >
        {isPtBr ? 'Abrir central de comandos' : 'Open command center'}
        <kbd>Ctrl+K</kbd>
      </button>

      {isOpen ? (
        <section
          aria-labelledby="global-command-center-title"
          aria-modal="true"
          className="lb-command-center"
          data-scenario-id={scenarioId}
          role="dialog"
        >
          <ScenarioMarker scenarioId={scenarioId} />
          <header>
            <h1 id="global-command-center-title">
              {isPtBr ? 'Central de comandos' : 'Command center'}
            </h1>
            <LbButton onPress={close} variant="quiet">
              {isPtBr ? 'Fechar' : 'Close'}
            </LbButton>
          </header>

          <label htmlFor="global-command-search">
            {isPtBr ? 'Pesquisar comandos' : 'Search commands'}
          </label>
          <input
            aria-activedescendant={
              activeIndex >= 0
                ? `command-result-${results[activeIndex]?.entry.id ?? ''}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={results.length > 0 ? 'global-command-results' : undefined}
            aria-expanded="true"
            autoComplete="off"
            id="global-command-search"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setActiveIndex(0);
            }}
            onKeyDown={onSearchKeyDown}
            placeholder={
              isPtBr
                ? 'Jogo, componente, configuração ou documento'
                : 'Game, component, setting, or document'
            }
            ref={inputRef}
            role="combobox"
            type="search"
            value={query}
          />

          {query.length === 0 ? (
            <StatusSignal
              detail={
                isPtBr
                  ? 'Digite para pesquisar rotas locais e ações seguras.'
                  : 'Type to search local routes and safe actions.'
              }
              locale={locale}
              state="empty"
            />
          ) : results.length === 0 ? (
            <p role="status">{getCommandNoResultMessage(policyLocale, query)}</p>
          ) : (
            <ul
              aria-label={isPtBr ? 'Resultados de comandos' : 'Command results'}
              id="global-command-results"
              role="listbox"
            >
              {groupedResults.map((group) => (
                <li aria-label={GROUP_LABELS[locale][group.kind]} key={group.kind} role="group">
                  <span>{GROUP_LABELS[locale][group.kind]}</span>
                  <ul role="presentation">
                    {group.results.map((result) => {
                      const resultIndex = results.indexOf(result);
                      return (
                        <li
                          aria-selected={resultIndex === activeIndex}
                          data-risk={result.entry.risk}
                          id={`command-result-${result.entry.id}`}
                          key={result.entry.id}
                          onClick={() => {
                            activate(result);
                          }}
                          onMouseMove={() => {
                            setActiveIndex(resultIndex);
                          }}
                          role="option"
                        >
                          <strong>{result.entry.label}</strong>
                          <span>{result.entry.scope}</span>
                          <span>{result.entry.consequence}</span>
                          {result.entry.risk === 'review-required' ? (
                            <span>{isPtBr ? 'Abre revisão segura' : 'Opens safe review'}</span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}

          {preview ? (
            <aside aria-labelledby="command-preview-title">
              <h2 id="command-preview-title">{preview.entry.label}</h2>
              <p>{preview.entry.scope}</p>
              <p>{preview.entry.consequence}</p>
              {previewBoundary ? (
                <>
                  <StatusSignal
                    detail={previewBoundary.explanation}
                    locale={locale}
                    state="unsupported"
                  />
                  <LbButton
                    onPress={() => {
                      onOpenScenario(previewBoundary.action.scenarioId);
                    }}
                    variant="secondary"
                  >
                    {previewBoundary.action.label}
                  </LbButton>
                </>
              ) : null}
              <LbButton
                onPress={() => {
                  setPreviewIndex(null);
                }}
                variant="quiet"
              >
                {isPtBr ? 'Fechar prévia' : 'Close preview'}
              </LbButton>
            </aside>
          ) : null}

          <p>
            {isPtBr
              ? 'Enter abre o resultado. Ações de risco sempre abrem uma revisão completa.'
              : 'Enter opens the result. Risky actions always open a complete review.'}
          </p>
        </section>
      ) : null}
    </>
  );
};
