import { ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';

import styles from './admin-people-navigation.module.css';

type PeopleWorkspace = 'team' | 'invitations';

const copy = Object.freeze({
  en: Object.freeze({
    label: 'People workspaces',
    team: 'Team and access',
    teamDetail: 'Members, functions, approvals, and emergency access.',
    invitations: 'Private-beta invitations',
    invitationsDetail: 'Issue, resend, revoke, and audit tester invitations.',
  }),
  'pt-BR': Object.freeze({
    label: 'Áreas de Pessoas',
    team: 'Equipe e acessos',
    teamDetail: 'Membros, funções, aprovações e acesso emergencial.',
    invitations: 'Convites da beta',
    invitationsDetail: 'Crie, reenvie, revogue e audite convites de teste.',
  }),
});

export const AdminPeopleNavigation = ({
  current,
  locale,
}: Readonly<{ current: PeopleWorkspace; locale: WebLocale }>) => {
  const labels = copy[locale];
  return (
    <nav className={styles['navigation']} aria-label={labels.label}>
      <a
        aria-current={current === 'team' ? 'page' : undefined}
        data-current={current === 'team' || undefined}
        href={`/${locale}/admin/people/team`}
      >
        <ProductIcon name="profile" size={19} />
        <span>
          <strong>{labels.team}</strong>
          <small>{labels.teamDetail}</small>
        </span>
      </a>
      <a
        aria-current={current === 'invitations' ? 'page' : undefined}
        data-current={current === 'invitations' || undefined}
        href={`/${locale}/admin/people/invitations`}
      >
        <ProductIcon name="userAdd" size={19} />
        <span>
          <strong>{labels.invitations}</strong>
          <small>{labels.invitationsDetail}</small>
        </span>
      </a>
    </nav>
  );
};
