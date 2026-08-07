import { describe, expect, it } from 'vitest';

import { resolveAdminStoryNavigation } from './story-navigation';

describe('resolveAdminStoryNavigation', () => {
  const storybookOrigin = 'http://127.0.0.1:6007';

  it('captures localized Admin routes before Storybook can resolve them as files', () => {
    expect(
      resolveAdminStoryNavigation(
        '/pt-BR/admin/people/access-reviews?view=pending#review-42',
        storybookOrigin,
      ),
    ).toEqual({
      href: '/pt-BR/admin/people/access-reviews?view=pending#review-42',
      locale: 'pt-BR',
    });

    expect(resolveAdminStoryNavigation('/en/admin/overview', storybookOrigin)).toEqual({
      href: '/en/admin/overview',
      locale: 'en',
    });
  });

  it('does not capture fragments, non-Admin routes, or external origins', () => {
    expect(resolveAdminStoryNavigation('#admin-main', storybookOrigin)).toBeNull();
    expect(resolveAdminStoryNavigation('/pt-BR/account', storybookOrigin)).toBeNull();
    expect(
      resolveAdminStoryNavigation('https://account.example.com/pt-BR/admin', storybookOrigin),
    ).toBeNull();
  });
});
