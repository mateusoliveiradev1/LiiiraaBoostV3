'use client';

import { resolveLocalizedCurrentRoute, type WebLocale } from '@liiiraa/web-core';
import { LocaleSwitcher } from '@liiiraa/web-features';
import { ProductIcon, type ProductIconName } from '@liiiraa/design-system';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AdminPreviewRole } from '../proxy';
import {
  createAdminQueueHref,
  parseAdminQueueUrlState,
  projectAdminQueue,
  type AdminQueueSavedView,
  type AdminQueueUrlState,
} from './admin-preview-model';

export type AdminNavigationItem = Readonly<{
  href: string;
  label: string;
  routeId: string;
}>;

type AdminNavigationProps = Readonly<{
  accountLabel: string;
  accountName: string;
  alertsLabel: string;
  alternateLocale: WebLocale;
  children: ReactNode;
  currentQueueLabel: string;
  currentTaskLabel: string;
  fallbackLocaleHref: string;
  header: ReactNode;
  isolatedLabel: string;
  items: readonly AdminNavigationItem[];
  label: string;
  locale: WebLocale;
  roleHomeHref: string;
  roleHomeLabel: string;
  role: AdminPreviewRole;
  roleLabel: string;
  savedViewLabels: Readonly<Record<AdminQueueSavedView, string>>;
  searchAction: string;
  searchLabel: string;
  searchPlaceholder: string;
  securityLabel: string;
}>;

const ADMIN_NAV_ICONS: Readonly<Record<string, ProductIconName>> = Object.freeze({
  'admin-role': 'toolbox',
  'admin-support': 'lifebuoy',
  'admin-operations': 'rocket',
  'admin-security': 'shield',
  'admin-diagnostics': 'activity',
  'admin-audit': 'receipt',
  'admin-audit-event': 'search',
});

const normalizePathname = (href: string): string =>
  (href.split('?')[0] ?? '/').replace(/\/+$/u, '') || '/';

function NavigationItems({
  currentHref,
  items,
  markCurrent,
  queueState,
  role,
}: Readonly<{
  currentHref: string | undefined;
  items: readonly AdminNavigationItem[];
  markCurrent: boolean;
  queueState: AdminQueueUrlState;
  role: AdminPreviewRole;
}>) {
  return (
    <ol className="admin-nav__list">
      {items.map((item) => {
        const isCurrent =
          markCurrent &&
          currentHref !== undefined &&
          normalizePathname(item.href) === normalizePathname(currentHref);

        return (
          <li key={item.routeId}>
            <Link
              aria-current={isCurrent ? 'page' : undefined}
              data-current={isCurrent ? 'page' : undefined}
              href={
                createAdminQueueHref(item.href, role, queueState, {
                  selectedId: undefined,
                }) as Route
              }
            >
              <ProductIcon
                className="admin-nav__icon"
                name={ADMIN_NAV_ICONS[item.routeId] ?? 'app'}
                size={18}
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function AdminNavigation({
  accountLabel,
  accountName,
  alertsLabel,
  alternateLocale,
  children,
  currentQueueLabel,
  currentTaskLabel,
  fallbackLocaleHref,
  header,
  isolatedLabel,
  items,
  label,
  locale,
  roleHomeHref,
  roleHomeLabel,
  role,
  roleLabel,
  savedViewLabels,
  searchAction,
  searchLabel,
  searchPlaceholder,
  securityLabel,
}: AdminNavigationProps) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const queueState = parseAdminQueueUrlState(searchParameters);
  const localizedCurrentRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'admin-origin',
    targetLocale: locale,
  });
  const currentHref = localizedCurrentRoute.ok ? localizedCurrentRoute.value : undefined;
  const currentItems = items.filter(
    ({ href }) =>
      currentHref !== undefined && normalizePathname(href) === normalizePathname(currentHref),
  );
  const currentItem = currentItems.length === 1 ? currentItems[0] : undefined;
  const currentLabel = currentItem?.label ?? label;
  const localizedAlternateRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'admin-origin',
    targetLocale: alternateLocale,
  });
  const alternatePath = localizedAlternateRoute.ok
    ? localizedAlternateRoute.value
    : fallbackLocaleHref;
  const localeHref = createAdminQueueHref(alternatePath, role, queueState);
  const alertCount = projectAdminQueue({ locale, role, savedView: 'sla-risk' }).length;
  const searchActionHref = roleHomeHref.split('?')[0] ?? roleHomeHref;

  return (
    <>
      <header className="admin-header">
        <div className="admin-header__bar">
          {header}
          <form
            action={searchActionHref}
            className="admin-header__search"
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
              maxLength={64}
              name="q"
              placeholder={searchPlaceholder}
              type="search"
            />
            {role !== 'support' ? <input name="role" type="hidden" value={role} /> : null}
            {queueState.savedView !== 'assigned' ? (
              <input name="view" type="hidden" value={queueState.savedView} />
            ) : null}
            {queueState.priority !== 'all' ? (
              <input name="priority" type="hidden" value={queueState.priority} />
            ) : null}
            {queueState.status !== 'all' ? (
              <input name="status" type="hidden" value={queueState.status} />
            ) : null}
            {queueState.owner !== 'all' ? (
              <input name="owner" type="hidden" value={queueState.owner} />
            ) : null}
            <button aria-label={searchAction} type="submit">
              <ProductIcon name="search" size={16} />
              <span>{searchAction}</span>
            </button>
          </form>
          <div className="admin-header__task">
            <span aria-label={currentTaskLabel}>{currentQueueLabel}</span>
            <strong>{savedViewLabels[queueState.savedView]}</strong>
          </div>
          <div className="admin-header__tools">
            <Link
              aria-label={`${alertsLabel}: ${alertCount}`}
              className="admin-header__alerts"
              href={
                createAdminQueueHref(roleHomeHref, role, queueState, {
                  savedView: 'sla-risk',
                  selectedId: undefined,
                }) as Route
              }
            >
              <ProductIcon name="bell" size={18} />
              <span aria-live="polite">{alertCount}</span>
            </Link>
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
                <Link href={createAdminQueueHref(roleHomeHref, role, queueState) as Route}>
                  <ProductIcon name="toolbox" size={17} />
                  {roleHomeLabel}
                </Link>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="admin-workspace">
        <nav aria-label={label} className="admin-nav admin-nav__desktop">
          <div className="admin-nav__identity">
            <span>{label}</span>
            <strong>{roleLabel}</strong>
          </div>
          <NavigationItems
            currentHref={currentHref}
            items={items}
            markCurrent
            queueState={queueState}
            role={role}
          />
        </nav>

        <details className="admin-nav admin-nav__mobile">
          <summary>
            <ProductIcon name="toolbox" size={18} />
            <span>{roleLabel}</span>
            <strong>{currentLabel}</strong>
            <ProductIcon className="admin-nav__disclosure-icon" name="chevronRight" size={18} />
          </summary>
          <nav aria-label={label}>
            <NavigationItems
              currentHref={currentHref}
              items={items}
              markCurrent={false}
              queueState={queueState}
              role={role}
            />
          </nav>
        </details>

        <div className="admin-main-column">{children}</div>
      </div>
    </>
  );
}
