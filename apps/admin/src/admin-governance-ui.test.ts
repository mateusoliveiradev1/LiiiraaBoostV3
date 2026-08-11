import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('admin governance UI', () => {
  it('makes team governance and private-beta invitations directly discoverable inside People', () => {
    const navigation = readFileSync(
      new URL('./features/admin-people-navigation.tsx', import.meta.url),
      'utf8',
    );
    const governance = readFileSync(
      new URL('./features/admin-access-governance.tsx', import.meta.url),
      'utf8',
    );
    const invitations = readFileSync(
      new URL('./features/admin-invitations.tsx', import.meta.url),
      'utf8',
    );

    expect(navigation).toContain('href={`/${locale}/admin/people/team`}');
    expect(navigation).toContain('href={`/${locale}/admin/people/invitations`}');
    expect(navigation).toContain('Equipe e acessos');
    expect(navigation).toContain('Convites da beta');
    expect(governance).toContain('<AdminPeopleNavigation current="team" locale={props.locale} />');
    expect(invitations).toContain(
      '<AdminPeopleNavigation current="invitations" locale={props.locale} />',
    );
  });

  it('renders invitation authority failures as a bounded recovery panel', () => {
    const source = readFileSync(
      new URL('./features/admin-invitations.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("className={styles['errorState']}");
    expect(source).toContain("className={styles['errorActions']}");
    expect(source).toContain('href={`/${props.locale}/admin/people/team`}');
    expect(source).toContain('window.location.reload();');
  });

  it('offers an explicit way to leave a read-only function simulation', () => {
    const source = readFileSync(
      new URL('./features/admin-access-governance.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("Readonly<{ kind: 'exit-simulation' }>");
    expect(source).toContain("onPress={() => onAction?.({ kind: 'exit-simulation' })}");
    expect(source).toContain("className={styles['simulationMessage']}");
    expect(source).toContain('variant="secondary"');
    expect(source).toContain('<ProductIcon name="close" size={16} />');
    expect(source).toContain("if (action.kind === 'exit-simulation') {");
    expect(source).toContain('setSimulatedFunction(undefined);');
  });
});
