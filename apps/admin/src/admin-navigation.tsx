'use client';

import { resolveLocalizedCurrentRoute, type WebLocale } from '@liiiraa/web-core';
import { LocaleSwitcher } from '@liiiraa/web-features';
import { ProductIcon, type ProductIconName } from '@liiiraa/design-system';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AdminPreviewRole } from '../proxy';

export type AdminNavigationItem = Readonly<{
  href: string;
  label: string;
  routeId: string;
}>;

type AdminNavigationProps = Readonly<{
  accountLabel: string;
  accountName: string;
  alternateLocale: WebLocale;
  children: ReactNode;
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
}: Readonly<{
  currentHref: string | undefined;
  items: readonly AdminNavigationItem[];
  markCurrent: boolean;
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
            <a
              aria-current={isCurrent ? 'page' : undefined}
              data-current={isCurrent ? 'page' : undefined}
              href={item.href}
            >
              <ProductIcon
                className="admin-nav__icon"
                name={ADMIN_NAV_ICONS[item.routeId] ?? 'app'}
                size={18}
              />
              {item.label}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function AdminNavigation({
  accountLabel,
  accountName,
  alternateLocale,
  children,
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
  securityLabel,
}: AdminNavigationProps) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const roleParameter = searchParameters.get('role');
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
  const localeHref =
    roleParameter === role ? `${alternatePath}?role=${role}` : alternatePath;

  return (
    <>
      <header className="admin-header">
        <div className="admin-header__bar">
          {header}
          <div className="admin-header__task">
            <span>{currentTaskLabel}</span>
            <strong>{currentLabel}</strong>
          </div>
          <div className="admin-header__tools">
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
                <a href={roleHomeHref}>
                  <ProductIcon name="toolbox" size={17} />
                  {roleHomeLabel}
                </a>
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
          <NavigationItems currentHref={currentHref} items={items} markCurrent />
        </nav>

        <details className="admin-nav admin-nav__mobile">
          <summary>
            <ProductIcon name="toolbox" size={18} />
            <span>{roleLabel}</span>
            <strong>{currentLabel}</strong>
            <ProductIcon className="admin-nav__disclosure-icon" name="chevronRight" size={18} />
          </summary>
          <nav aria-label={label}>
            <NavigationItems currentHref={currentHref} items={items} markCurrent={false} />
          </nav>
        </details>

        <div className="admin-main-column">{children}</div>
      </div>
    </>
  );
}
