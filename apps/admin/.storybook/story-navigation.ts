export interface AdminStoryNavigation {
  readonly href: string;
  readonly locale: 'en' | 'pt-BR';
}

const ADMIN_STORY_ROUTE = /^\/(en|pt-BR)\/admin(?:\/|$)/;

export const resolveAdminStoryNavigation = (
  href: string,
  storybookOrigin: string,
): AdminStoryNavigation | null => {
  let destination: URL;

  try {
    destination = new URL(href, storybookOrigin);
  } catch {
    return null;
  }

  if (destination.origin !== storybookOrigin) return null;

  const route = ADMIN_STORY_ROUTE.exec(destination.pathname);
  if (route === null) return null;

  return {
    href: `${destination.pathname}${destination.search}${destination.hash}`,
    locale: route[1] as AdminStoryNavigation['locale'],
  };
};
