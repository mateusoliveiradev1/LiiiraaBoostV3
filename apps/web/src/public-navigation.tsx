'use client';

import { resolveLocalizedCurrentRoute, matchWebRoute, type WebLocale } from '@liiiraa/web-core';
import { LocaleSwitcher } from '@liiiraa/web-features';
import { usePathname } from 'next/navigation';

import { localizedPublicHref, publicBoundaryHref, publicNavigation } from './public-boundary';

export type PublicPillarId = (typeof publicNavigation)[number]['id'];

export type PublicNavigationCopy = Readonly<{
  compatibility: string;
  current: string;
  menu: string;
  navigation: Readonly<Record<PublicPillarId, string>>;
  primaryNavigation: string;
  search: string;
}>;

type PublicNavigationItem = Readonly<{
  current: boolean;
  href: string;
  id: PublicPillarId;
}>;

export type PublicNavigationState = Readonly<{
  activeId?: PublicPillarId;
  items: readonly PublicNavigationItem[];
  localeAccessibleName: string;
  localeFlag: '🇧🇷' | '🇺🇸';
  localeHref: string;
  localeLabel: 'English' | 'Português';
  mobileItems: readonly PublicNavigationItem[];
  targetLocale: WebLocale;
}>;

const TASK_PILLARS = new Set<string>(publicNavigation.map(({ id }) => id));

const projectActivePillar = (routeId: string): PublicPillarId | undefined => {
  if (routeId.startsWith('docs-')) {
    return 'docs-index';
  }
  if (routeId.startsWith('releases-')) {
    return 'releases-index';
  }
  return TASK_PILLARS.has(routeId) ? (routeId as PublicPillarId) : undefined;
};

export const getPublicNavigationState = (
  pathname: string,
  sourceLocale: WebLocale,
): PublicNavigationState => {
  const targetLocale: WebLocale = sourceLocale === 'pt-BR' ? 'en' : 'pt-BR';
  const normalizedPathname = pathname.replace(/\/+$/u, '') || '/';
  const isCurrentDocsIndex = normalizedPathname === `/${sourceLocale}/docs/current`;
  const match = matchWebRoute({ pathname, securityBoundary: 'public-origin' });
  const activeId = isCurrentDocsIndex
    ? 'docs-index'
    : match.ok
      ? projectActivePillar(match.value.route.id)
      : undefined;
  const localized = resolveLocalizedCurrentRoute({
    pathname,
    securityBoundary: 'public-origin',
    targetLocale,
  });
  const localeLabel = targetLocale === 'pt-BR' ? 'Português' : 'English';
  const localeFlag = targetLocale === 'pt-BR' ? '🇧🇷' : '🇺🇸';
  const items = publicNavigation.map((route) => ({
    current: route.id === activeId,
    href: localizedPublicHref(route, sourceLocale),
    id: route.id,
  }));

  return {
    ...(activeId === undefined ? {} : { activeId }),
    items,
    localeAccessibleName:
      sourceLocale === 'pt-BR'
        ? `Mudar idioma para ${localeLabel}`
        : `Switch language to ${localeLabel}`,
    localeFlag,
    localeHref: localized.ok
      ? localized.value
      : isCurrentDocsIndex
        ? `/${targetLocale}/docs/current`
        : publicBoundaryHref('public-home', targetLocale),
    localeLabel,
    mobileItems: items.map((item) => ({ ...item })),
    targetLocale,
  };
};

const NavigationLinks = ({
  copy,
  items,
}: Readonly<{
  copy: PublicNavigationCopy;
  items: readonly PublicNavigationItem[];
}>) => (
  <ul>
    {items.map((item) => (
      <li key={item.id}>
        <a
          aria-current={item.current ? 'page' : undefined}
          data-current={item.current ? 'page' : undefined}
          href={item.href}
        >
          {copy.navigation[item.id]}
          {item.current ? <span className="public-visually-hidden"> ({copy.current})</span> : null}
        </a>
      </li>
    ))}
  </ul>
);

export const PublicNavigation = ({
  copy,
  locale,
}: Readonly<{ copy: PublicNavigationCopy; locale: WebLocale }>) => {
  const pathname = usePathname() ?? publicBoundaryHref('public-home', locale);
  const state = getPublicNavigationState(pathname, locale);
  const localeControl = (
    <LocaleSwitcher
      href={state.localeHref}
      sourceLocale={locale}
      targetLocale={state.targetLocale}
    />
  );

  return (
    <>
      <nav
        aria-label={copy.primaryNavigation}
        className="public-navigation public-navigation--desktop"
      >
        <NavigationLinks copy={copy} items={state.items} />
      </nav>

      <div className="public-header__actions">
        <a
          aria-label={`${copy.search} · Liiiraa Boost`}
          className="public-action public-action--quiet"
          href={publicBoundaryHref('public-search', locale)}
        >
          {copy.search}
        </a>
        {localeControl}
        <a
          className="public-action public-action--primary"
          href={publicBoundaryHref('public-compatibility', locale)}
        >
          {copy.compatibility}
        </a>
      </div>

      <div className="public-mobile-locale">{localeControl}</div>

      <details className="public-mobile-menu">
        <summary>{copy.menu}</summary>
        <div className="public-mobile-menu__surface">
          <nav aria-label={copy.primaryNavigation} className="public-navigation">
            <NavigationLinks copy={copy} items={state.mobileItems} />
          </nav>
          <div className="public-mobile-menu__actions">
            <a href={publicBoundaryHref('public-search', locale)}>{copy.search}</a>
            {localeControl}
            <a href={publicBoundaryHref('public-compatibility', locale)}>{copy.compatibility}</a>
          </div>
        </div>
      </details>
    </>
  );
};
