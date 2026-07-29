import { ProductIcon } from '@liiiraa/design-system';
import type { ShellLocale } from '@liiiraa/feature-shell';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DOWNLOADS } from './control-center-data.js';
import { BrandIcon } from './brand-icons.js';

type DownloadState = 'idle' | 'downloading' | 'paused' | 'complete';

interface DownloadProgress {
  readonly progress: number;
  readonly state: DownloadState;
}

interface PremiumDownloadsSurfaceProps {
  readonly locale: ShellLocale;
  readonly notify: (message: string, tone?: 'info' | 'success' | 'warning') => void;
}

const text = (locale: ShellLocale, ptBr: string, english: string): string =>
  locale === 'pt-BR' ? ptBr : english;

export const PremiumDownloadsSurface = ({
  locale,
  notify,
}: PremiumDownloadsSurfaceProps): ReactNode => {
  const [query, setQuery] = useState('');
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({});
  const timers = useRef<Partial<Record<string, number>>>({});

  useEffect(
    () => () => {
      for (const timer of Object.values(timers.current)) {
        if (timer !== undefined) globalThis.clearInterval(timer);
      }
    },
    [],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale === 'pt-BR' ? 'pt-BR' : 'en-US');
    return DOWNLOADS.filter(({ category, description, title }) =>
      `${title} ${description} ${category}`
        .toLocaleLowerCase(locale === 'pt-BR' ? 'pt-BR' : 'en-US')
        .includes(normalized),
    );
  }, [locale, query]);

  const stopTimer = (id: string): void => {
    const timer = timers.current[id];
    if (timer !== undefined) {
      globalThis.clearInterval(timer);
      timers.current[id] = undefined;
    }
  };

  const startDownload = (id: string, title: string): void => {
    stopTimer(id);
    setDownloads((current) => ({
      ...current,
      [id]: {
        progress: Math.max(4, current[id]?.progress ?? 0),
        state: 'downloading',
      },
    }));
    timers.current[id] = globalThis.setInterval(() => {
      setDownloads((current) => {
        const previous = current[id]?.progress ?? 4;
        const nextProgress = Math.min(100, previous + 8);
        if (nextProgress >= 100) {
          stopTimer(id);
          notify(
            text(
              locale,
              `${title} foi preparado no cenário. Nenhum instalador real foi executado.`,
              `${title} was prepared in this scenario. No real installer was executed.`,
            ),
            'success',
          );
        }
        return {
          ...current,
          [id]: {
            progress: nextProgress,
            state: nextProgress >= 100 ? 'complete' : 'downloading',
          },
        };
      });
    }, 140);
  };

  const pauseDownload = (id: string): void => {
    stopTimer(id);
    setDownloads((current) => ({
      ...current,
      [id]: {
        progress: current[id]?.progress ?? 0,
        state: 'paused',
      },
    }));
  };

  const cancelDownload = (id: string): void => {
    stopTimer(id);
    setDownloads((current) => ({ ...current, [id]: { progress: 0, state: 'idle' } }));
  };

  return (
    <>
      <label className="premium-download-search">
        <span>{text(locale, 'Pesquisar ferramentas', 'Search tools')}</span>
        <span>
          <ProductIcon name="search" size={17} />
          <input
            onChange={(event) => {
              setQuery(event.currentTarget.value);
            }}
            placeholder={text(
              locale,
              'Nome, categoria ou finalidade',
              'Name, category, or purpose',
            )}
            type="search"
            value={query}
          />
        </span>
      </label>

      <section className="premium-download-grid">
        {filtered.map((item) => {
          const current = downloads[item.id] ?? { progress: 0, state: 'idle' as const };
          return (
            <article data-download-state={current.state} key={item.id}>
              <span className="premium-download-icon">
                <BrandIcon brand={item.id} label={item.title} size={25} />
              </span>
              <div>
                <small>{item.category}</small>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <span>
                  {item.license} · {text(locale, 'fonte oficial', 'official source')}
                </span>
              </div>

              {current.state === 'idle' ? (
                <button
                  className="premium-button"
                  onClick={() => {
                    startDownload(item.id, item.title);
                  }}
                  type="button"
                >
                  <ProductIcon name="download" size={16} />
                  {text(locale, 'Preparar download', 'Prepare download')}
                </button>
              ) : (
                <div
                  aria-label={text(locale, `Progresso de ${item.title}`, `${item.title} progress`)}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={current.progress}
                  className="premium-download-progress"
                  role="progressbar"
                >
                  <span>
                    <strong>
                      {current.state === 'complete'
                        ? text(locale, 'Pronto', 'Ready')
                        : current.state === 'paused'
                          ? text(locale, 'Pausado', 'Paused')
                          : text(locale, 'Preparando', 'Preparing')}
                    </strong>
                    <b>{current.progress}%</b>
                  </span>
                  <i>
                    <span style={{ inlineSize: `${String(current.progress)}%` }} />
                  </i>
                  <div>
                    {current.state === 'downloading' ? (
                      <button
                        onClick={() => {
                          pauseDownload(item.id);
                        }}
                        type="button"
                      >
                        {text(locale, 'Pausar', 'Pause')}
                      </button>
                    ) : current.state === 'paused' ? (
                      <button
                        onClick={() => {
                          startDownload(item.id, item.title);
                        }}
                        type="button"
                      >
                        {text(locale, 'Continuar', 'Resume')}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          startDownload(item.id, item.title);
                        }}
                        type="button"
                      >
                        {text(locale, 'Preparar novamente', 'Prepare again')}
                      </button>
                    )}
                    {current.state === 'complete' ? null : (
                      <button
                        onClick={() => {
                          cancelDownload(item.id);
                        }}
                        type="button"
                      >
                        {text(locale, 'Cancelar', 'Cancel')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
};
