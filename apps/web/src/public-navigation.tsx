'use client';

import {
  resolveLocalizedCurrentRoute,
  matchWebRoute,
  type WebLocale,
  type WebRouteId,
} from '@liiiraa/web-core';
import { LocaleSwitcher } from '@liiiraa/web-features';
import { usePathname } from 'next/navigation';

import { localizedPublicHref, publicBoundaryHref, publicNavigation } from './public-boundary';
import { ProductLockup } from './public-product-lockup';

export type PublicPillarId = (typeof publicNavigation)[number]['id'];

export type PublicNavigationCopy = Readonly<{
  current: string;
  download: string;
  menu: string;
  navigation: Readonly<Record<PublicPillarId, string>>;
  primaryNavigation: string;
  search: string;
}>;

export type PublicFooterGroupId = 'product' | 'resources' | 'company' | 'legal';

export type PublicFooterLinkId =
  | 'how-it-works'
  | 'your-pc'
  | 'results'
  | 'plans'
  | 'download'
  | 'documentation'
  | 'help'
  | 'releases'
  | 'status'
  | 'about'
  | 'principles'
  | 'contact'
  | 'terms'
  | 'privacy'
  | 'security'
  | 'essential-storage'
  | 'responsible-disclosure';

export type PublicFooterCopy = Readonly<{
  copyright: string;
  cta: string;
  footerNavigation: string;
  groupLabels: Readonly<Record<PublicFooterGroupId, string>>;
  linkLabels: Readonly<Record<PublicFooterLinkId, string>>;
  promise: string;
}>;

type PublicFooterLink = Readonly<{
  href: string;
  id: PublicFooterLinkId;
}>;

type PublicFooterGroup = Readonly<{
  id: PublicFooterGroupId;
  links: readonly PublicFooterLink[];
}>;

export type PublicFooterState = Readonly<{
  ctaHref: string;
  groups: readonly PublicFooterGroup[];
  localeHref: string;
  targetLocale: WebLocale;
}>;

const FOOTER_GROUPS = Object.freeze([
  Object.freeze({
    id: 'product',
    links: Object.freeze([
      Object.freeze({ id: 'how-it-works', routeId: 'public-product' }),
      Object.freeze({ id: 'your-pc', routeId: 'public-compatibility' }),
      Object.freeze({ id: 'results', routeId: 'public-results' }),
      Object.freeze({ id: 'plans', routeId: 'public-plans' }),
      Object.freeze({ id: 'download', routeId: 'public-download' }),
    ]),
  }),
  Object.freeze({
    id: 'resources',
    links: Object.freeze([
      Object.freeze({ id: 'documentation', routeId: 'docs-index' }),
      Object.freeze({ id: 'help', routeId: 'public-support' }),
      Object.freeze({ id: 'releases', routeId: 'releases-index' }),
      Object.freeze({ id: 'status', routeId: 'public-status' }),
    ]),
  }),
  Object.freeze({
    id: 'company',
    links: Object.freeze([
      Object.freeze({ id: 'about', routeId: 'public-about' }),
      Object.freeze({ id: 'principles', routeId: 'public-principles' }),
      Object.freeze({ id: 'contact', routeId: 'public-support' }),
    ]),
  }),
  Object.freeze({
    id: 'legal',
    links: Object.freeze([
      Object.freeze({ id: 'terms', routeId: 'public-terms' }),
      Object.freeze({ id: 'privacy', routeId: 'public-privacy-policy' }),
      Object.freeze({ id: 'security', routeId: 'public-policies' }),
      Object.freeze({ id: 'essential-storage', routeId: 'public-essential-storage' }),
      Object.freeze({
        id: 'responsible-disclosure',
        routeId: 'public-responsible-disclosure',
      }),
    ]),
  }),
] as const satisfies readonly Readonly<{
  id: PublicFooterGroupId;
  links: readonly Readonly<{
    id: PublicFooterLinkId;
    routeId: WebRouteId;
  }>[];
}>[]);

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
  if (TASK_PILLARS.has(routeId)) return routeId;
  if (routeId === 'public-home') return 'public-product';
  if (routeId === 'public-about') return 'public-product';
  if (routeId === 'public-principles') return 'public-product';
  if (routeId === 'public-evidence') return 'public-results';
  if (routeId.startsWith('releases-')) return 'public-download';
  if (
    routeId.startsWith('docs-') ||
    routeId.startsWith('public-error-') ||
    [
      'public-search',
      'public-status',
      'public-policies',
      'public-privacy-policy',
      'public-terms',
      'public-essential-storage',
      'public-responsible-disclosure',
    ].includes(routeId)
  ) {
    return 'public-support';
  }
  return undefined;
};

export const getPublicNavigationState = (
  pathname: string,
  sourceLocale: WebLocale,
): PublicNavigationState => {
  const targetLocale: WebLocale = sourceLocale === 'pt-BR' ? 'en' : 'pt-BR';
  const normalizedPathname = pathname.replace(/\/+$/u, '') || '/';
  const isCurrentDocsIndex = normalizedPathname === `/${sourceLocale}/docs/current`;
  const match = matchWebRoute({ pathname, securityBoundary: 'public-origin' });
  const activeId = match.ok ? projectActivePillar(match.value.route.id) : undefined;
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

export const getPublicFooterState = (pathname: string, locale: WebLocale): PublicFooterState => {
  const navigationState = getPublicNavigationState(pathname, locale);

  return {
    ctaHref: publicBoundaryHref('public-download', locale),
    groups: FOOTER_GROUPS.map((group) => ({
      id: group.id,
      links: group.links.map((link) => ({
        href: publicBoundaryHref(link.routeId, locale),
        id: link.id,
      })),
    })),
    localeHref: navigationState.localeHref,
    targetLocale: navigationState.targetLocale,
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
  const pathname = usePathname();
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
        <a
          aria-label={`${copy.download} · Liiiraa Boost`}
          className="public-action public-action--primary"
          href={publicBoundaryHref('public-download', locale)}
        >
          {copy.download}
        </a>
      </div>

      <div className="public-header__locale">{localeControl}</div>

      <details className="public-mobile-menu">
        <summary>{copy.menu}</summary>
        <div className="public-mobile-menu__surface">
          <nav aria-label={copy.primaryNavigation} className="public-navigation">
            <NavigationLinks copy={copy} items={state.mobileItems} />
          </nav>
          <div className="public-mobile-menu__actions">
            <a href={publicBoundaryHref('public-search', locale)}>{copy.search}</a>
            <a href={publicBoundaryHref('public-download', locale)}>{copy.download}</a>
          </div>
        </div>
      </details>
    </>
  );
};

export const PublicFooter = ({
  copy,
  locale,
}: Readonly<{ copy: PublicFooterCopy; locale: WebLocale }>) => {
  const pathname = usePathname();
  const state = getPublicFooterState(pathname, locale);

  return (
    <footer aria-label={copy.footerNavigation} className="public-footer">
      <div className="public-footer__inner">
        <div className="public-footer__identity">
          <a
            aria-label="Liiiraa Boost"
            className="public-brand"
            href={publicBoundaryHref('public-home', locale)}
          >
            <ProductLockup />
          </a>
          <p>{copy.promise}</p>
        </div>

        <div className="public-footer__groups">
          {state.groups.map((group) => (
            <nav aria-label={copy.groupLabels[group.id]} key={group.id}>
              <h2>{copy.groupLabels[group.id]}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.id}>
                    <a className="public-footer__link" href={link.href}>
                      {copy.linkLabels[link.id]}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="public-footer__closing">
          <p>{copy.copyright}</p>
          <div className="public-footer__actions">
            <LocaleSwitcher
              href={state.localeHref}
              sourceLocale={locale}
              targetLocale={state.targetLocale}
            />
            <a className="public-footer__cta" href={state.ctaHref}>
              {copy.cta}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
