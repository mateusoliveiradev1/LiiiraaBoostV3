import type { ReactNode } from 'react';
import { LbButton, LbLink } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';

export interface ShellNavigationItem {
  readonly href: string;
  readonly id: string;
  readonly label: string;
}

const SkipLink = ({ mainId }: { readonly mainId: string }) => (
  <a className="lb-web-skip-link" href={`#${mainId}`}>
    Skip to main content
  </a>
);

const NavigationList = ({
  activeId,
  items,
}: {
  readonly activeId?: string;
  readonly items: readonly ShellNavigationItem[];
}) => {
  const activeIndex =
    activeId === undefined ? -1 : items.findIndex((item) => item.id === activeId);

  return (
    <ul>
      {items.map((item, index) => {
        const isCurrent = index === activeIndex;
        return (
          <li key={item.id}>
            <a
              aria-current={isCurrent ? 'page' : undefined}
              className="lb-link lb-web-navigation-link"
              data-current={isCurrent ? 'page' : undefined}
              data-destination-kind="internal"
              href={item.href}
            >
              {item.label}
              {isCurrent ? (
                <span className="lb-visually-hidden"> (current page)</span>
              ) : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
};

const LOCALE_PRESENTATION = Object.freeze({
  en: Object.freeze({ flag: '🇺🇸', language: 'English' }),
  'pt-BR': Object.freeze({ flag: '🇧🇷', language: 'Português' }),
} satisfies Readonly<Record<WebLocale, Readonly<{ flag: string; language: string }>>>);

export interface LocaleSwitcherProps {
  readonly href: string;
  readonly sourceLocale: WebLocale;
  readonly targetLocale: WebLocale;
}

export const LocaleSwitcher = ({
  href,
  sourceLocale,
  targetLocale,
}: LocaleSwitcherProps) => {
  const target = LOCALE_PRESENTATION[targetLocale];
  const accessibleName =
    sourceLocale === 'pt-BR'
      ? `Mudar idioma para ${target.language}`
      : `Switch language to ${target.language}`;

  return (
    <a
      aria-label={accessibleName}
      className="lb-link lb-web-locale-switcher"
      data-destination-kind="internal"
      href={href}
      hrefLang={targetLocale}
    >
      <span aria-hidden="true">{target.flag}</span>
      {' '}
      <span lang={targetLocale}>{target.language}</span>
    </a>
  );
};

export interface PublicHeaderProps {
  readonly activeId?: string;
  readonly cta: ReactNode;
  readonly localeControl: ReactNode;
  readonly navigation: readonly ShellNavigationItem[];
  readonly search: ReactNode;
}

export const PublicHeader = ({
  activeId,
  cta,
  localeControl,
  navigation,
  search,
}: PublicHeaderProps) => (
  <header className="lb-web-public-header">
    <LbLink href="/">Liiiraa Boost</LbLink>
    <nav aria-label="Primary navigation">
      <NavigationList {...(activeId === undefined ? {} : { activeId })} items={navigation} />
    </nav>
    <div className="lb-web-public-tools">
      {search}
      {localeControl}
      {cta}
    </div>
  </header>
);

export interface PublicMobileMenuProps {
  readonly cta: ReactNode;
  readonly isOpen: boolean;
  readonly localeControl: ReactNode;
  readonly navigation: readonly ShellNavigationItem[];
  readonly onClose: () => void;
  readonly search: ReactNode;
}

export const PublicMobileMenu = ({
  cta,
  isOpen,
  localeControl,
  navigation,
  onClose,
  search,
}: PublicMobileMenuProps) =>
  isOpen ? (
    <div aria-label="Mobile navigation" className="lb-web-mobile-menu" role="dialog">
      <div className="lb-web-mobile-menu-header">
        <strong>Menu</strong>
        <LbButton onPress={onClose} variant="quiet">
          Close menu
        </LbButton>
      </div>
      {search}
      <nav aria-label="Mobile primary navigation">
        <NavigationList items={navigation} />
      </nav>
      {localeControl}
      {cta}
    </div>
  ) : null;

export const PublicFooter = ({
  legal,
  navigation,
  status,
}: {
  readonly legal: ReactNode;
  readonly navigation: readonly ShellNavigationItem[];
  readonly status: ReactNode;
}) => (
  <footer className="lb-web-public-footer">
    <nav aria-label="Footer navigation">
      <NavigationList items={navigation} />
    </nav>
    {status}
    {legal}
  </footer>
);

export interface PublicShellProps {
  readonly children: ReactNode;
  readonly footer: ReactNode;
  readonly header: ReactNode;
  readonly mainId?: string;
}

export const PublicShell = ({
  children,
  footer,
  header,
  mainId = 'public-main',
}: PublicShellProps) => (
  <div className="lb-web-shell lb-web-public-shell" data-register="brand">
    <SkipLink mainId={mainId} />
    {header}
    <main id={mainId}>{children}</main>
    {footer}
  </div>
);

export const AccountPreviewRail = ({ children }: { readonly children?: ReactNode }) => (
  <aside className="lb-web-preview-rail" role="note">
    <strong>Deterministic preview</strong>
    <span>No remote account authority is connected.</span>
    {children}
  </aside>
);

export interface AccountShellProps {
  readonly activeId?: string;
  readonly children: ReactNode;
  readonly header: ReactNode;
  readonly mainId?: string;
  readonly navigation: readonly ShellNavigationItem[];
  readonly previewRail: ReactNode;
}

export const AccountShell = ({
  activeId,
  children,
  header,
  mainId = 'account-main',
  navigation,
  previewRail,
}: AccountShellProps) => (
  <div className="lb-web-shell lb-web-account-shell" data-register="product">
    <SkipLink mainId={mainId} />
    {header}
    {previewRail}
    <div className="lb-web-product-frame">
      <nav aria-label="Account responsibilities">
        <NavigationList {...(activeId === undefined ? {} : { activeId })} items={navigation} />
      </nav>
      <main id={mainId}>{children}</main>
    </div>
  </div>
);

export const RoleScopeRail = ({
  role,
  scope,
}: {
  readonly role: string;
  readonly scope: readonly string[];
}) => (
  <aside className="lb-web-role-rail" aria-label="Administrative role scope">
    <strong>{role}</strong>
    <span>Published preview · authority disconnected</span>
    <ul>
      {scope.map((entry) => (
        <li key={entry}>{entry}</li>
      ))}
    </ul>
  </aside>
);

export const AdminViewportGate = ({
  children,
  highRiskAction,
}: {
  readonly children: ReactNode;
  readonly highRiskAction: ReactNode;
}) => (
  <section className="lb-web-admin-gate">
    <div className="lb-web-safe-review">{children}</div>
    <div className="lb-web-high-risk">
      <p role="status">
        High-risk administration requires a desktop-class viewport of at least 960px.
      </p>
      {highRiskAction}
    </div>
  </section>
);

export interface AdminShellProps {
  readonly activeId?: string;
  readonly children: ReactNode;
  readonly header: ReactNode;
  readonly mainId?: string;
  readonly navigation: readonly ShellNavigationItem[];
  readonly roleRail: ReactNode;
}

export const AdminShell = ({
  activeId,
  children,
  header,
  mainId = 'admin-main',
  navigation,
  roleRail,
}: AdminShellProps) => (
  <div className="lb-web-shell lb-web-admin-shell" data-register="product">
    <SkipLink mainId={mainId} />
    {header}
    {roleRail}
    <div className="lb-web-product-frame">
      <nav aria-label="Role-specific administration">
        <NavigationList {...(activeId === undefined ? {} : { activeId })} items={navigation} />
      </nav>
      <main id={mainId}>{children}</main>
    </div>
  </div>
);
