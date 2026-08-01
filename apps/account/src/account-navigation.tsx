'use client';

import { LocaleSwitcher } from '@liiiraa/web-features';
import { resolveLocalizedCurrentRoute, type WebLocale } from '@liiiraa/web-core';
import { ProductIcon, type ProductIconName } from '@liiiraa/design-system';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export type AccountNavigationItem = Readonly<{
  href: string;
  icon: ProductIconName;
  label: string;
}>;

export type AccountNavigationGroup = Readonly<{
  items: readonly AccountNavigationItem[];
  label?: string;
}>;

type AccountNavigationProps = Readonly<{
  alternateLocale: WebLocale;
  children: ReactNode;
  currentTaskLabel: string;
  fallbackLocaleHref: string;
  groups: readonly AccountNavigationGroup[];
  header: ReactNode;
  label: string;
  locale: WebLocale;
  preview: ReactNode;
}>;

const normalizePathname = (pathname: string): string => pathname.replace(/\/+$/u, '') || '/';

function ResponsibilityIcon({ name }: Readonly<{ name: ProductIconName }>) {
  return <ProductIcon className="account-nav__icon" name={name} size={18} />;
}

function NavigationGroups({
  currentHref,
  groups,
  markCurrent,
}: Readonly<{
  currentHref: string | undefined;
  groups: readonly AccountNavigationGroup[];
  markCurrent: boolean;
}>) {
  return (
    <ol className="account-nav__list">
      {groups.map((group) => (
        <li key={group.items.map(({ href }) => href).join(':')}>
          {group.label === undefined ? null : (
            <strong className="account-nav__group-label">{group.label}</strong>
          )}
          <ul className="account-nav__group">
            {group.items.map((item) => {
              const isCurrent =
                markCurrent &&
                currentHref !== undefined &&
                normalizePathname(item.href) === normalizePathname(currentHref);
              return (
                <li key={item.href}>
                  <a
                    aria-current={isCurrent ? 'page' : undefined}
                    data-current={isCurrent ? 'page' : undefined}
                    href={item.href}
                  >
                    <ResponsibilityIcon name={item.icon} />
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function AccountNavigation({
  alternateLocale,
  children,
  currentTaskLabel,
  fallbackLocaleHref,
  groups,
  header,
  label,
  locale,
  preview,
}: AccountNavigationProps) {
  const pathname = usePathname();
  const localizedCurrentRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'account-origin',
    targetLocale: locale,
  });
  const currentHref = localizedCurrentRoute.ok ? localizedCurrentRoute.value : undefined;
  const items = groups.flatMap(({ items: groupItems }) => groupItems);
  const currentItems = items.filter(
    ({ href }) =>
      currentHref !== undefined && normalizePathname(href) === normalizePathname(currentHref),
  );
  const currentItem = currentItems.length === 1 ? currentItems[0] : undefined;
  const currentLabel = currentItem?.label ?? label;
  const localizedAlternateRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'account-origin',
    targetLocale: alternateLocale,
  });
  const localeHref = localizedAlternateRoute.ok
    ? localizedAlternateRoute.value
    : fallbackLocaleHref;

  return (
    <>
      <header className="account-header">
        <div className="account-header__bar">
          {header}
          <div className="account-header__task">
            <span>{currentTaskLabel}</span>
            <strong>{currentLabel}</strong>
          </div>
          <LocaleSwitcher href={localeHref} sourceLocale={locale} targetLocale={alternateLocale} />
        </div>
      </header>

      {preview}

      <div className="account-workspace">
        <div className="account-workspace__frame">
          <nav aria-label={label} className="account-nav account-nav__desktop">
            <p className="account-nav__label">{label}</p>
            <NavigationGroups currentHref={currentHref} groups={groups} markCurrent />
          </nav>

          <details className="account-nav account-nav__mobile">
            <summary>
              <span>{currentTaskLabel}</span>
              <strong>{currentLabel}</strong>
            </summary>
            <nav aria-label={label}>
              <NavigationGroups currentHref={currentHref} groups={groups} markCurrent={false} />
            </nav>
          </details>

          <main id="account-main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
