'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

export function AdminFocusHandoff() {
  const pathname = usePathname();

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>(
      '#admin-main > h1, #admin-main [data-route-heading]',
    );

    heading?.focus();
  }, [pathname]);

  return null;
}
