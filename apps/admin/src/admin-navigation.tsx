'use client';

import { usePathname } from 'next/navigation';

export type AdminNavigationItem = Readonly<{
  href: string;
  label: string;
  routeId: string;
}>;

export function AdminNavigation({
  items,
  label,
}: Readonly<{ items: readonly AdminNavigationItem[]; label: string }>) {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/+$/u, '') || '/';
  const currentCount = items.filter(({ href }) => {
    const itemPathname = href.split('?')[0]?.replace(/\/+$/u, '') || '/';
    return itemPathname === normalizedPathname;
  }).length;

  return (
    <nav aria-label={label} className="admin-nav">
      <p className="admin-nav__label">{label}</p>
      <ol className="admin-nav__list">
        {items.map((item) => {
          const itemPathname = item.href.split('?')[0]?.replace(/\/+$/u, '') || '/';
          const isCurrent = currentCount === 1 && itemPathname === normalizedPathname;
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
    </nav>
  );
}
