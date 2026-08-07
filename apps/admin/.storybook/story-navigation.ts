export interface AdminStoryNavigation {
  readonly href: string;
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

  if (href.trimStart().startsWith('?')) {
    return { href: `${destination.search}${destination.hash}` };
  }

  const route = ADMIN_STORY_ROUTE.exec(destination.pathname);
  if (route === null) return null;

  return {
    href: `${destination.pathname}${destination.search}${destination.hash}`,
  };
};
