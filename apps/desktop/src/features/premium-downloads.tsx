import { ProductIcon } from '@liiiraa/design-system';
import type { ShellLocale } from '@liiiraa/feature-shell';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DOWNLOADS } from './control-center-data.js';
import { BrandIcon } from './brand-icons.js';

type DownloadState =
  'idle' | 'downloading' | 'paused' | 'ready-to-install' | 'installing' | 'installed' | 'error';

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
              `${title} está pronto para instalar. Nenhum instalador real foi executado ainda.`,
              `${title} is ready to install. No real installer has been executed yet.`,
            ),
            'success',
          );
        }
        return {
          ...current,
          [id]: {
            progress: nextProgress,
            state: nextProgress >= 100 ? 'ready-to-install' : 'downloading',
          },
        };
      });
    }, 140);
  };

  const installDownload = (id: string, title: string): void => {
    stopTimer(id);
    setDownloads((current) => ({
      ...current,
      [id]: { progress: 100, state: 'installing' },
    }));
    timers.current[id] = globalThis.setTimeout(() => {
      setDownloads((current) => ({
        ...current,
        [id]: { progress: 100, state: 'installed' },
      }));
      timers.current[id] = undefined;
      notify(
        text(
          locale,
          `${title} foi instalado no cenário demonstrativo. Nenhuma alteração real foi feita no Windows.`,
          `${title} was installed in the demo scenario. No real Windows changes were made.`,
        ),
        'success',
      );
    }, 720);
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
                      {current.state === 'ready-to-install'
                        ? text(locale, 'Pronto para instalar', 'Ready to install')
                        : current.state === 'installing'
                          ? text(locale, 'Instalando', 'Installing')
                          : current.state === 'installed'
                            ? text(locale, 'Instalado', 'Installed')
                            : current.state === 'error'
                              ? text(locale, 'Falha no download', 'Download failed')
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
                    ) : current.state === 'ready-to-install' ? (
                      <button
                        onClick={() => {
                          installDownload(item.id, item.title);
                        }}
                        type="button"
                      >
                        {text(locale, 'Instalar', 'Install')}
                      </button>
                    ) : current.state === 'error' ? (
                      <button
                        onClick={() => {
                          startDownload(item.id, item.title);
                        }}
                        type="button"
                      >
                        {text(locale, 'Tentar novamente', 'Try again')}
                      </button>
                    ) : (
                      <button disabled type="button">
                        {current.state === 'installing'
                          ? text(locale, 'Instalando…', 'Installing…')
                          : text(locale, 'Instalado', 'Installed')}
                      </button>
                    )}
                    {current.state === 'downloading' || current.state === 'paused' ? (
                      <button
                        onClick={() => {
                          cancelDownload(item.id);
                        }}
                        type="button"
                      >
                        {text(locale, 'Cancelar', 'Cancel')}
                      </button>
                    ) : current.state === 'ready-to-install' ? (
                      <button
                        onClick={() => {
                          cancelDownload(item.id);
                        }}
                        type="button"
                      >
                        {text(locale, 'Descartar', 'Discard')}
                      </button>
                    ) : null}
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
