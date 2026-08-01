'use client';

import { usePathname } from 'next/navigation';

export type AccountNavigationItem = Readonly<{
  href: string;
  label: string;
}>;

export type AccountNavigationGroup = Readonly<{
  items: readonly AccountNavigationItem[];
  label?: string;
}>;

export function AccountNavigation({
  groups,
  label,
}: Readonly<{
  groups: readonly AccountNavigationGroup[];
  label: string;
}>) {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/+$/u, '') || '/';
  const currentCount = groups
    .flatMap(({ items }) => items)
    .filter(({ href }) => (href.replace(/\/+$/u, '') || '/') === normalizedPathname).length;

  return (
    <nav aria-label={label} className="account-nav">
      <p className="account-nav__label">{label}</p>
      <ol className="account-nav__list">
        {groups.map((group) => (
          <li key={group.items.map(({ href }) => href).join(':')}>
            {group.label === undefined ? null : (
              <strong className="account-nav__group-label">{group.label}</strong>
            )}
            <ul className="account-nav__group">
              {group.items.map((item) => {
                const itemPathname = item.href.replace(/\/+$/u, '') || '/';
                const isCurrent = currentCount === 1 && itemPathname === normalizedPathname;
                return (
                  <li key={item.href}>
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
            </ul>
          </li>
        ))}
      </ol>
    </nav>
  );
}
