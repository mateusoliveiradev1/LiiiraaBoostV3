'use client';

import { LocaleSwitcher } from '@liiiraa/web-features';
import { resolveLocalizedCurrentRoute, type WebLocale } from '@liiiraa/web-core';
import { ProductIcon, type ProductIconName } from '@liiiraa/design-system';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type ReactNode } from 'react';

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
  authenticatedAction: AccountNavigationItem;
  authBrand: ReactNode;
  authIntro: ReactNode;
  brand: ReactNode;
  children: ReactNode;
  currentTaskLabel: string;
  authRouteItems: readonly AccountNavigationItem[];
  fallbackLocaleHref: string;
  groups: readonly AccountNavigationGroup[];
  identity: ReactNode;
  inspector: ReactNode;
  inspectorLabel: string;
  label: string;
  locale: WebLocale;
  publicLink: ReactNode;
  supportHref: string;
  supportLabel: string;
  surfaceLabel: string;
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
  authenticatedAction,
  authBrand,
  authIntro,
  brand,
  children,
  currentTaskLabel,
  authRouteItems,
  fallbackLocaleHref,
  groups,
  identity,
  inspector,
  inspectorLabel,
  label,
  locale,
  publicLink,
  supportHref,
  supportLabel,
  surfaceLabel,
}: AccountNavigationProps) {
  const pathname = usePathname();
  const inspectorDisclosureRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const wideShell = window.matchMedia('(min-width: 1180px)');
    const synchronizeInspector = () => {
      if (inspectorDisclosureRef.current !== null) {
        inspectorDisclosureRef.current.open = wideShell.matches;
      }
    };
    synchronizeInspector();
    wideShell.addEventListener('change', synchronizeInspector);
    return () => {
      wideShell.removeEventListener('change', synchronizeInspector);
    };
  }, []);
  const localizedCurrentRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'account-origin',
    targetLocale: locale,
  });
  const currentHref = localizedCurrentRoute.ok ? localizedCurrentRoute.value : undefined;
  const responsibilityItems = groups.flatMap(({ items: groupItems }) => groupItems);
  const allItems = [...authRouteItems, ...responsibilityItems];
  const currentItems = allItems.filter(
    ({ href }) =>
      currentHref !== undefined && normalizePathname(href) === normalizePathname(currentHref),
  );
  const currentItem = currentItems.length === 1 ? currentItems[0] : undefined;
  const currentLabel = currentItem?.label ?? label;
  const accountMenuItems = responsibilityItems.filter(
    ({ icon }) => icon === 'profile' || icon === 'shield',
  );
  const currentAuthRouteItems = authRouteItems.filter(
    ({ href }) =>
      currentHref !== undefined && normalizePathname(href) === normalizePathname(currentHref),
  );
  const isAuthRoute = currentAuthRouteItems.length === 1;
  const localizedAlternateRoute = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'account-origin',
    targetLocale: alternateLocale,
  });
  const localeHref = localizedAlternateRoute.ok
    ? localizedAlternateRoute.value
    : fallbackLocaleHref;

  if (isAuthRoute) {
    return (
      <div className="account-auth-shell">
        <header className="account-auth-shell__header">
          <div className="account-auth-shell__brand">{authBrand}</div>
          <div className="account-auth-shell__tools">
            <span className="account-auth-shell__public">{publicLink}</span>
            <LocaleSwitcher
              href={localeHref}
              sourceLocale={locale}
              targetLocale={alternateLocale}
            />
          </div>
        </header>
        <div className="account-auth-shell__stage">
          <aside className="account-auth-shell__context">{authIntro}</aside>
          <main className="account-auth-shell__main" id="account-main" tabIndex={-1}>
            <div className="account-auth-shell__panel">{children}</div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="account-app-shell">
      <aside className="account-sidebar">
        <div className="account-sidebar__brand">{brand}</div>
        <nav aria-label={label} className="account-nav account-nav__desktop">
          <p className="account-nav__label">{label}</p>
          <NavigationGroups currentHref={currentHref} groups={groups} markCurrent />
        </nav>
        <div className="account-sidebar__footer">
          <div className="account-sidebar__identity">{identity}</div>
          <nav aria-label={surfaceLabel} className="account-sidebar__entry">
            <NavigationGroups
              currentHref={currentHref}
              groups={[{ items: [authenticatedAction] }]}
              markCurrent={false}
            />
          </nav>
        </div>
      </aside>

      <header className="account-header">
        <div className="account-header__bar">
          <div className="account-header__mobile-brand">{brand}</div>
          <nav aria-label={currentTaskLabel} className="account-header__route">
            <span>{surfaceLabel}</span>
            <ProductIcon name="chevronRight" size={14} />
            <strong>{currentLabel}</strong>
          </nav>
          <div className="account-header__tools">
            <a className="account-header__support" href={supportHref}>
              <ProductIcon name="lifebuoy" size={18} />
              <span>{supportLabel}</span>
            </a>
            <LocaleSwitcher
              href={localeHref}
              sourceLocale={locale}
              targetLocale={alternateLocale}
            />
            <details className="account-header__account">
              <summary aria-label={surfaceLabel}>
                {identity}
                <ProductIcon
                  className="account-header__account-chevron"
                  name="chevronRight"
                  size={16}
                />
              </summary>
              <nav aria-label={surfaceLabel}>
                <NavigationGroups
                  currentHref={currentHref}
                  groups={[{ items: [...accountMenuItems, authenticatedAction] }]}
                  markCurrent={false}
                />
              </nav>
            </details>
          </div>
        </div>
      </header>

      <div className="account-workspace">
        <details className="account-nav account-nav__mobile">
          <summary>
            <span>{currentTaskLabel}</span>
            <strong>{currentLabel}</strong>
            <ProductIcon className="account-nav__disclosure-icon" name="chevronRight" size={18} />
          </summary>
          <nav aria-label={label}>
            <NavigationGroups currentHref={currentHref} groups={groups} markCurrent={false} />
          </nav>
        </details>
        <main id="account-main" tabIndex={-1}>
          {children}
        </main>
      </div>

      <aside aria-label={inspectorLabel} className="account-inspector">
        <details className="account-inspector__disclosure" open ref={inspectorDisclosureRef}>
          <summary>
            <span>{inspectorLabel}</span>
            <ProductIcon
              className="account-inspector__disclosure-icon"
              name="chevronRight"
              size={18}
            />
          </summary>
          <div className="account-inspector__body">
            {inspector}
            <div className="account-inspector__public">{publicLink}</div>
          </div>
        </details>
      </aside>
    </div>
  );
}
