'use client';

import { resolveLocalizedCurrentRoute, type WebLocale } from '@liiiraa/web-core';
import { LocaleSwitcher } from '@liiiraa/web-features';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

import type { AdminPreviewRole } from '../proxy';

export type AdminNavigationItem = Readonly<{
  href: string;
  label: string;
  routeId: string;
}>;

type AdminNavigationProps = Readonly<{
  alternateLocale: WebLocale;
  children: ReactNode;
  currentTaskLabel: string;
  fallbackLocaleHref: string;
  header: ReactNode;
  items: readonly AdminNavigationItem[];
  label: string;
  locale: WebLocale;
  preview: ReactNode;
  role: AdminPreviewRole;
  roleLabel: string;
}>;

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
              {item.label}
            </a>
          </li>
        );
      })}
    </ol>
  );
}

export function AdminNavigation({
  alternateLocale,
  children,
  currentTaskLabel,
  fallbackLocaleHref,
  header,
  items,
  label,
  locale,
  preview,
  role,
  roleLabel,
}: AdminNavigationProps) {
  const pathname = usePathname();
  const searchParameters = useSearchParams();
  const roleParameter = searchParameters.get('role');
  const validatedRole = roleParameter === role ? role : role === 'support' ? role : undefined;
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
    validatedRole === undefined || validatedRole === 'support'
      ? alternatePath
      : `${alternatePath}?role=${validatedRole}`;

  return (
    <>
      <header className="admin-header">
        <div className="admin-header__bar">
          {header}
          <div className="admin-header__task">
            <span>{currentTaskLabel}</span>
            <strong>{currentLabel}</strong>
          </div>
          <LocaleSwitcher href={localeHref} sourceLocale={locale} targetLocale={alternateLocale} />
        </div>
      </header>

      {preview}

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
            <span>{roleLabel}</span>
            <strong>{currentLabel}</strong>
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
