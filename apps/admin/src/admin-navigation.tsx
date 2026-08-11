'use client';

/* eslint @typescript-eslint/no-unnecessary-type-assertion: "off" -- Next.js typed Link requires Route assertions that Linux ESLint misclassifies. */

import { LbButton, LbDialog, ProductIcon, type ProductIconName } from '@liiiraa/design-system';
import { resolveLocalizedCurrentRoute, type WebLocale } from '@liiiraa/web-core';
import { LocaleSwitcher } from '@liiiraa/web-features';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  parseAdminQueueUrlState,
  type AdminQueueSavedView,
  type AdminQueueUrlState,
} from './admin-queue-url-state';
import type { AdminNavigationItem, AdminShellDomain } from './admin-shell';

export type AdminShellFreshness = 'live' | 'reconnecting' | 'offline' | 'degraded';
export type AdminShellDensity = 'comfortable' | 'compact';
export type AdminSidebarMode = 'expanded' | 'compact';

type AdminNavigationProps = Readonly<{
  accountActions?: ReactNode;
  accountLabel: string;
  accountName: string;
  actorId: string;
  alertsLabel: string;
  alternateLocale: WebLocale;
  children: ReactNode;
  currentQueueLabel: string;
  currentTaskLabel: string;
  environmentId: string;
  environmentLabel: string;
  fallbackLocaleHref: string;
  freshness: AdminShellFreshness;
  header: ReactNode;
  inboxCount?: number;
  inboxHref: string;
  inboxLabel: string;
  initialDensity?: AdminShellDensity;
  initialDrawerOpen?: boolean;
  initialSidebarMode?: AdminSidebarMode;
  isolatedLabel: string;
  items: readonly AdminNavigationItem[];
  jobsHref: string;
  jobsLabel: string;
  label: string;
  locale: WebLocale;
  operationalUtilities?: boolean;
  persistPreference?: boolean;
  roleHomeHref: string;
  roleHomeLabel: string;
  roleLabel: string;
  savedViewLabels: Readonly<Record<AdminQueueSavedView, string>>;
  searchAction: string;
  searchHref: string;
  searchLabel: string;
  searchPlaceholder: string;
  securityLabel: string;
}>;

const ADMIN_NAV_ICONS: Readonly<Record<AdminShellDomain, ProductIconName>> = Object.freeze({
  overview: 'app',
  people: 'profile',
  revenue: 'receipt',
  operation: 'rocket',
  support: 'lifebuoy',
  security: 'shield',
  system: 'toolbox',
});

const normalizePathname = (href: string): string =>
  (href.split('?')[0] ?? '/').replace(/\/+$/u, '') || '/';

const appendSafeQueueState = (parameters: URLSearchParams, state: AdminQueueUrlState): void => {
  if (state.query) parameters.set('q', state.query);
  if (state.savedView !== 'assigned') parameters.set('view', state.savedView);
  if (state.priority !== 'all') parameters.set('priority', state.priority);
  if (state.status !== 'all') parameters.set('status', state.status);
  if (state.owner !== 'all') parameters.set('owner', state.owner);
  if (state.selectedId) parameters.set('selected', state.selectedId);
};

export const createAdminShellHref = (
  href: string,
  state: AdminQueueUrlState,
  override: Partial<AdminQueueUrlState> = {},
): string => {
  const pathname = href.split('?')[0] ?? href;
  const parameters = new URLSearchParams();
  appendSafeQueueState(parameters, Object.freeze({ ...state, ...override }));
  const query = parameters.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export const adminShellPreferenceKey = (actorId: string, environmentId: string): string =>
  `liiiraa-admin-shell:${environmentId}:${actorId}`;

const freshnessCopy = Object.freeze({
  en: Object.freeze({
    degraded: 'Degraded',
    live: 'Live',
    offline: 'Offline',
    reconnecting: 'Reconnecting',
  }),
  'pt-BR': Object.freeze({
    degraded: 'Degradado',
    live: 'Ao vivo',
    offline: 'Offline',
    reconnecting: 'Reconectando',
  }),
});

const shellCopy = Object.freeze({
  en: Object.freeze({
    closeNavigation: 'Close navigation',
    compactDensity: 'Use compact density',
    compactSidebar: 'Use compact sidebar',
    comfortableDensity: 'Use comfortable density',
    density: 'Display density',
    environment: 'Environment',
    expandedSidebar: 'Expand sidebar',
    navigation: 'Administrative navigation',
    openNavigation: 'Open navigation',
    roleScope: 'Active function',
    utilities: 'Utilities',
  }),
  'pt-BR': Object.freeze({
    closeNavigation: 'Fechar navegação',
    compactDensity: 'Usar densidade compacta',
    compactSidebar: 'Usar barra lateral compacta',
    comfortableDensity: 'Usar densidade confortável',
    density: 'Densidade da interface',
    environment: 'Ambiente',
    expandedSidebar: 'Expandir barra lateral',
    navigation: 'Navegação administrativa',
    openNavigation: 'Abrir navegação',
    roleScope: 'Função ativa',
    utilities: 'Utilitários',
  }),
});

function NavigationItems({
  currentHref,
  items,
  onNavigate,
  queueState,
}: Readonly<{
  currentHref: string | undefined;
  items: readonly AdminNavigationItem[];
  onNavigate?: () => void;
  queueState: AdminQueueUrlState;
}>) {
  return (
    <ol className="admin-nav__list">
      {items.map((item) => {
        const isCurrent =
          currentHref !== undefined &&
          normalizePathname(item.href) === normalizePathname(currentHref);

        return (
          <li key={item.domain}>
            <Link
              aria-current={isCurrent ? 'page' : undefined}
              aria-label={item.label}
              data-current={isCurrent ? 'page' : undefined}
              href={
                createAdminShellHref(item.href, queueState, {
                  selectedId: undefined,
                }) as Route
              }
              {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
              title={item.label}
            >
              <ProductIcon
                className="admin-nav__icon"
                name={ADMIN_NAV_ICONS[item.domain]}
                size={18}
              />
              <span className="admin-nav__label">{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

type AdminShellFrameProps = Omit<AdminNavigationProps, 'fallbackLocaleHref'> &
  Readonly<{
    alternatePath: string;
    currentHref?: string;
    queueState: AdminQueueUrlState;
  }>;

export function AdminShellFrame({
  accountActions,
  accountLabel,
  accountName,
  actorId,
  alertsLabel,
  alternateLocale,
  alternatePath,
  children,
  currentHref,
  currentQueueLabel,
  currentTaskLabel,
  environmentId,
  environmentLabel,
  freshness,
  header,
  inboxCount = 0,
  inboxHref,
  inboxLabel,
  initialDensity = 'comfortable',
  initialDrawerOpen = false,
  initialSidebarMode = 'expanded',
  isolatedLabel,
  items,
  jobsHref,
  jobsLabel,
  label,
  locale,
  operationalUtilities = true,
  persistPreference = true,
  queueState,
  roleHomeHref,
  roleHomeLabel,
  roleLabel,
  savedViewLabels,
  searchAction,
  searchHref,
  searchLabel,
  searchPlaceholder,
  securityLabel,
}: AdminShellFrameProps) {
  const labels = shellCopy[locale];
  const preferenceKey = adminShellPreferenceKey(actorId, environmentId);
  const [density, setDensity] = useState<AdminShellDensity>(initialDensity);
  const [sidebarMode, setSidebarMode] = useState<AdminSidebarMode>(initialSidebarMode);
  const [drawerOpen, setDrawerOpen] = useState(initialDrawerOpen);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [preferenceKeyLoaded, setPreferenceKeyLoaded] = useState<string | null>(
    persistPreference ? null : preferenceKey,
  );
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const currentItem = items.find(
    ({ href }) =>
      currentHref !== undefined && normalizePathname(href) === normalizePathname(currentHref),
  );
  const currentLabel = currentItem?.label ?? label;
  const localeHref = createAdminShellHref(alternatePath, queueState);

  useEffect(() => {
    if (!persistPreference) return;
    try {
      const stored = window.localStorage.getItem(preferenceKey);
      if (stored === null) return;
      const value = JSON.parse(stored) as Partial<{
        density: AdminShellDensity;
        sidebarMode: AdminSidebarMode;
      }>;
      if (value.density === 'comfortable' || value.density === 'compact') {
        setDensity(value.density);
      }
      if (value.sidebarMode === 'expanded' || value.sidebarMode === 'compact') {
        setSidebarMode(value.sidebarMode);
      }
    } catch {
      // A blocked or corrupted preference store must never block the administrative shell.
    } finally {
      setPreferenceKeyLoaded(preferenceKey);
    }
  }, [persistPreference, preferenceKey]);

  useEffect(() => {
    if (!persistPreference || preferenceKeyLoaded !== preferenceKey) return;
    try {
      window.localStorage.setItem(preferenceKey, JSON.stringify({ density, sidebarMode }));
    } catch {
      // The current safe in-memory preference remains usable for this session.
    }
  }, [density, persistPreference, preferenceKey, preferenceKeyLoaded, sidebarMode]);

  useEffect(() => {
    if (!operationalUtilities) return undefined;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const editing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (
        (!editing && event.key === '/') ||
        ((event.ctrlKey || event.metaKey) && event.key === 'k')
      ) {
        event.preventDefault();
        if (window.matchMedia('(max-width: 959px)').matches) {
          setMobileSearchOpen(true);
          window.queueMicrotask(() => searchRef.current?.focus());
        } else {
          searchRef.current?.focus();
        }
      } else if (event.key === 'Escape' && mobileSearchOpen) {
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => {
      window.removeEventListener('keydown', handleShortcut);
    };
  }, [mobileSearchOpen, operationalUtilities]);

  const updateDrawer = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      window.queueMicrotask(() => drawerTriggerRef.current?.focus());
    }
  }, []);

  const navigation = (
    <>
      <div className="admin-nav__identity">
        <span>{labels.environment}</span>
        <strong>{environmentLabel}</strong>
        <span className="admin-nav__function">{roleLabel}</span>
        <span className="admin-nav__freshness" data-state={freshness} role="status">
          <span aria-hidden="true" />
          {freshnessCopy[locale][freshness]}
        </span>
      </div>
      <NavigationItems
        currentHref={currentHref}
        items={items}
        {...(drawerOpen
          ? {
              onNavigate: () => {
                updateDrawer(false);
              },
            }
          : {})}
        queueState={queueState}
      />
      {operationalUtilities ? (
        <div className="admin-nav__utilities">
          <span>{labels.utilities}</span>
          <Link href={createAdminShellHref(inboxHref, queueState) as Route}>
            <ProductIcon name="bell" size={18} />
            <span className="admin-nav__label">{inboxLabel}</span>
            {inboxCount > 0 ? <strong>{inboxCount}</strong> : null}
          </Link>
          <Link href={createAdminShellHref(jobsHref, queueState) as Route}>
            <ProductIcon name="activity" size={18} />
            <span className="admin-nav__label">{jobsLabel}</span>
          </Link>
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className="admin-shell-frame"
      data-density={density}
      data-freshness={freshness}
      data-sidebar-mode={sidebarMode}
    >
      <header className="admin-header">
        <div className="admin-header__bar">
          <LbDialog
            description={`${environmentLabel} · ${roleLabel}`}
            isOpen={drawerOpen}
            onOpenChange={updateDrawer}
            title={labels.navigation}
            trigger={
              <LbButton
                ariaLabel={labels.openNavigation}
                buttonRef={drawerTriggerRef}
                className="admin-nav__drawer-trigger"
                variant="quiet"
              >
                <ProductIcon name="list" size={20} />
              </LbButton>
            }
          >
            <div className="admin-nav__drawer" data-admin-drawer="true">
              <button
                aria-label={labels.closeNavigation}
                className="admin-nav__drawer-close"
                onClick={() => {
                  updateDrawer(false);
                }}
                type="button"
              >
                <ProductIcon name="close" size={20} />
              </button>
              <nav aria-label={label}>{navigation}</nav>
              <div className="admin-nav__drawer-preferences">
                <span>{labels.density}</span>
                <button
                  onClick={() => {
                    setDensity((current) =>
                      current === 'comfortable' ? 'compact' : 'comfortable',
                    );
                  }}
                  type="button"
                >
                  <ProductIcon name="activity" size={18} />
                  {density === 'comfortable' ? labels.compactDensity : labels.comfortableDensity}
                </button>
              </div>
            </div>
          </LbDialog>
          {header}
          <div className="admin-header__mobile-context" role="status">
            <strong>{roleLabel}</strong>
            <span>{environmentLabel}</span>
          </div>
          {operationalUtilities ? (
            <>
              <form
                action={searchHref}
                className="admin-header__search"
                data-mobile-open={mobileSearchOpen || undefined}
                method="get"
                role="search"
              >
                <ProductIcon name="search" size={17} />
                <label className="lb-visually-hidden" htmlFor="admin-global-search">
                  {searchLabel}
                </label>
                <input
                  defaultValue={queueState.query}
                  id="admin-global-search"
                  maxLength={128}
                  name="q"
                  placeholder={searchPlaceholder}
                  ref={searchRef}
                  type="search"
                />
                <button
                  aria-expanded={mobileSearchOpen}
                  aria-label={searchAction}
                  onClick={(event) => {
                    if (window.matchMedia('(max-width: 959px)').matches && !mobileSearchOpen) {
                      event.preventDefault();
                      setMobileSearchOpen(true);
                      window.queueMicrotask(() => searchRef.current?.focus());
                    }
                  }}
                  type="submit"
                >
                  <ProductIcon name="search" size={16} />
                  <span>{searchAction}</span>
                </button>
              </form>
              <div className="admin-header__task">
                <span aria-label={currentTaskLabel}>{currentQueueLabel}</span>
                <strong>{savedViewLabels[queueState.savedView]}</strong>
              </div>
            </>
          ) : (
            <Link
              className="admin-header__role-context"
              href={createAdminShellHref(roleHomeHref, queueState) as Route}
            >
              <ProductIcon name="shield" size={17} />
              <span>
                <small>{labels.roleScope}</small>
                <strong>{roleLabel}</strong>
              </span>
              <ProductIcon name="chevronRight" size={15} />
            </Link>
          )}
          <div className="admin-header__tools">
            {operationalUtilities ? (
              <Link
                aria-label={`${alertsLabel}: ${String(inboxCount)}`}
                className="admin-header__alerts"
                href={createAdminShellHref(inboxHref, queueState) as Route}
              >
                <ProductIcon name="bell" size={18} />
                <span aria-live="polite">{inboxCount}</span>
              </Link>
            ) : null}
            <button
              aria-label={
                density === 'comfortable' ? labels.compactDensity : labels.comfortableDensity
              }
              className="admin-header__density"
              onClick={() => {
                setDensity((current) => (current === 'comfortable' ? 'compact' : 'comfortable'));
              }}
              type="button"
            >
              <ProductIcon name="activity" size={18} />
            </button>
            <LocaleSwitcher
              href={localeHref}
              sourceLocale={locale}
              targetLocale={alternateLocale}
            />
            <details className="admin-header__account">
              <summary aria-label={accountLabel}>
                <span className="admin-header__avatar">
                  <ProductIcon name="profile" size={20} weight="duotone" />
                </span>
                <span className="admin-header__account-copy">
                  <strong>{accountName}</strong>
                  <small>{roleLabel}</small>
                </span>
                <ProductIcon
                  className="admin-header__account-chevron"
                  name="chevronRight"
                  size={15}
                />
              </summary>
              <div className="admin-header__account-panel">
                <p>
                  <ProductIcon name="lock" size={17} />
                  <span>
                    <strong>{securityLabel}</strong>
                    <small>{isolatedLabel}</small>
                  </span>
                </p>
                <Link href={createAdminShellHref(roleHomeHref, queueState) as Route}>
                  <ProductIcon name="toolbox" size={17} />
                  {roleHomeLabel}
                </Link>
                <LocaleSwitcher
                  href={localeHref}
                  sourceLocale={locale}
                  targetLocale={alternateLocale}
                />
                {accountActions}
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="admin-workspace">
        <nav aria-label={label} className="admin-nav admin-nav__desktop">
          <button
            aria-label={sidebarMode === 'expanded' ? labels.compactSidebar : labels.expandedSidebar}
            className="admin-nav__mode"
            onClick={() => {
              setSidebarMode((current) => (current === 'expanded' ? 'compact' : 'expanded'));
            }}
            type="button"
          >
            <ProductIcon name="chevronRight" size={18} />
            <span>
              {sidebarMode === 'expanded' ? labels.compactSidebar : labels.expandedSidebar}
            </span>
          </button>
          {navigation}
        </nav>

        <div className="admin-main-column" data-current-domain={currentItem?.domain ?? 'none'}>
          <p className="lb-visually-hidden" aria-live="polite">
            {currentLabel}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AdminNavigation({ fallbackLocaleHref, ...props }: AdminNavigationProps) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const queueState = parseAdminQueueUrlState(searchParameters);
  const localizedCurrentRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'admin-origin',
    targetLocale: props.locale,
  });
  const currentHref = localizedCurrentRoute.ok ? localizedCurrentRoute.value : undefined;
  const localizedAlternateRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'admin-origin',
    targetLocale: props.alternateLocale,
  });
  const alternatePath = localizedAlternateRoute.ok
    ? localizedAlternateRoute.value
    : fallbackLocaleHref;

  return (
    <AdminShellFrame
      {...props}
      alternatePath={alternatePath}
      {...(currentHref === undefined ? {} : { currentHref })}
      queueState={queueState}
    />
  );
}
