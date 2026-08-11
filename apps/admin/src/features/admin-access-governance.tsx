'use client';

import type {
  AdminFunctionJson,
  AdminGovernanceProjectionJson,
  AdminPermissionImpactProjectionJson,
  AdminRiskLevelJson,
  AdminTeamMemberProjectionJson,
} from '@liiiraa/contracts-ts';
import {
  LbButton,
  LbOperationalNotice,
  LbSkeletonRegion,
  LbTextArea,
  LbTextField,
  ProductIcon,
} from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';

import type { AdminMutationResult, AdminQueryResult } from '../admin-authority';
import { useAdminAuthority } from './admin-authority';
import { AdminPeopleNavigation } from './admin-people-navigation';
import {
  deriveAccessAuthorityState,
  maskGovernanceHistory,
  projectAccessReview,
  projectFunctionSimulation,
  projectPermissionImpact,
  type AccessAuthorityState,
  type PermissionAssignment,
} from './admin-access-model';
import styles from './admin-access-governance.module.css';

const FUNCTIONS = [
  'owner',
  'support',
  'finance',
  'operations',
  'security',
  'audit',
  'product-configuration',
] as const;
const CAPABILITIES = [
  'support:reply',
  'support:view',
  'device:manage',
  'entitlement:correct',
  'session:revoke',
  'diagnostics:view',
  'audit:reveal-sensitive',
  'audit:export',
] as const;
const SCOPES = [
  'support-cases',
  'devices',
  'entitlements',
  'sessions',
  'diagnostic-metadata',
  'audit-events',
] as const;

const copy = Object.freeze({
  en: Object.freeze({
    access: 'Access',
    activeFunction: 'Active function',
    adminInvitations: 'Administrative team invitations',
    adminInvitationsDetail:
      'These invitations grant administrative onboarding and are separate from private-beta access.',
    approvals: 'Approvals',
    approvalExpiry: 'Approval expiry',
    actor: 'Request author',
    affectedData: 'Affected data',
    assignedApprover: 'Assigned approver',
    beneficiary: 'Beneficiary',
    authorityDenied: 'Governance authority unavailable',
    authorityDeniedDetail:
      'The server did not admit People or approval records for this active function.',
    freshnessUnavailableDetail:
      'Current records are loaded, but live updates are unavailable. Changes stay locked until the connection is restored.',
    breakGlass: 'Request emergency access',
    breakGlassDetail:
      'Only solo-owner critical work is eligible. Mass and irreversible actions still require two people.',
    capabilities: 'Capabilities',
    close: 'Close member detail',
    conflicts: 'Conflicts',
    createDelegation: 'Create delegation',
    delegation: 'Delegation',
    delegationExpiry: 'Delegation expiry',
    empty: 'No administrative members are available for this function.',
    error: 'People workspace unavailable',
    functions: 'Functions',
    gainedFunctions: 'Functions gained',
    history: 'Masked access history',
    impact: 'Permission impact',
    impactDetail: 'Review all gains, losses, affected data, and sessions before submission.',
    inactivity: 'Inactivity',
    invite: 'Invite administrator',
    inviteEmail: 'Administrator email',
    inviteReason: 'Invitation reason',
    lastActive: 'Last active',
    loading: 'Loading server-authorized people and governance records',
    lostFunctions: 'Functions removed',
    memberDetail: 'Member authority',
    members: 'Administrative team',
    membersDetail: 'Authorized members, active functions, and current access state.',
    noActionsSimulation: 'Simulation — no actions can run',
    noApprovals: 'No governed approval requests match this view.',
    noHistory: 'No masked governance history is available.',
    offboard: 'Offboard administrator',
    offboardDetail:
      'Sessions and delegations are revoked, future approvals removed, work reassigned, and immutable history preserved.',
    pending: 'Pending',
    previewImpact: 'Preview permission impact',
    reason: 'Operational reason',
    recertification: 'Recertification',
    refresh: 'Refresh authority',
    reviewAccess: 'Record access review',
    reviewDue: 'Review due',
    risk: 'Risk',
    saveAccess: 'Submit governed access change',
    scopes: 'Data scopes',
    sessions: 'Sessions to revoke',
    simulate: 'Simulate function',
    simulationExit: 'Exit simulation',
    state: 'State',
    title: 'People and access governance',
    subtitle:
      'Manage administrative membership, bounded authority, independent approvals, recertification, and emergency access.',
    twoPerson: 'Two-person authority remains required',
  }),
  'pt-BR': Object.freeze({
    access: 'Acesso',
    activeFunction: 'Função ativa',
    adminInvitations: 'Convites da equipe administrativa',
    adminInvitationsDetail:
      'Estes convites concedem entrada administrativa e são separados do acesso ao beta privado.',
    approvals: 'Aprovações',
    approvalExpiry: 'Expiração da aprovação',
    actor: 'Autor da solicitação',
    affectedData: 'Dados afetados',
    assignedApprover: 'Aprovador designado',
    beneficiary: 'Beneficiário',
    authorityDenied: 'Autoridade de governança indisponível',
    authorityDeniedDetail:
      'O servidor não admitiu registros de Pessoas ou aprovações para a função ativa.',
    freshnessUnavailableDetail:
      'Os registros atuais foram carregados, mas as atualizações ao vivo estão indisponíveis. As alterações ficam bloqueadas até a conexão voltar.',
    breakGlass: 'Solicitar acesso emergencial',
    breakGlassDetail:
      'Somente trabalho crítico do único proprietário é elegível. Ações em massa e irreversíveis continuam exigindo duas pessoas.',
    capabilities: 'Capacidades',
    close: 'Fechar detalhe do membro',
    conflicts: 'Conflitos',
    createDelegation: 'Criar delegação',
    delegation: 'Delegação',
    delegationExpiry: 'Expiração da delegação',
    empty: 'Nenhum membro administrativo está disponível para esta função.',
    error: 'Área de Pessoas indisponível',
    functions: 'Funções',
    gainedFunctions: 'Funções adicionadas',
    history: 'Histórico de acesso mascarado',
    impact: 'Impacto da permissão',
    impactDetail: 'Revise ganhos, perdas, dados afetados e sessões antes de enviar.',
    inactivity: 'Inatividade',
    invite: 'Convidar administrador',
    inviteEmail: 'E-mail do administrador',
    inviteReason: 'Motivo do convite',
    lastActive: 'Última atividade',
    loading: 'Carregando pessoas e governança autorizadas pelo servidor',
    lostFunctions: 'Funções removidas',
    memberDetail: 'Autoridade do membro',
    members: 'Equipe administrativa',
    membersDetail: 'Membros autorizados, funções ativas e estado atual do acesso.',
    noActionsSimulation: 'Simulação — nenhuma ação pode ser executada',
    noApprovals: 'Nenhuma solicitação de aprovação corresponde a esta visão.',
    noHistory: 'Nenhum histórico mascarado de governança está disponível.',
    offboard: 'Remover administrador',
    offboardDetail:
      'Sessões e delegações são revogadas, aprovações futuras removidas, trabalho redistribuído e o histórico imutável preservado.',
    pending: 'Pendente',
    previewImpact: 'Pré-visualizar impacto da permissão',
    reason: 'Motivo operacional',
    recertification: 'Recertificação',
    refresh: 'Atualizar autoridade',
    reviewAccess: 'Registrar revisão de acesso',
    reviewDue: 'Revisão pendente',
    risk: 'Risco',
    saveAccess: 'Enviar alteração de acesso governada',
    scopes: 'Escopos de dados',
    sessions: 'Sessões que serão revogadas',
    simulate: 'Simular função',
    simulationExit: 'Sair da simulação',
    state: 'Estado',
    title: 'Pessoas e governança de acesso',
    subtitle:
      'Gerencie membros administrativos, autoridade limitada, aprovações independentes, recertificação e acesso emergencial.',
    twoPerson: 'A autoridade de duas pessoas continua obrigatória',
  }),
});

const formatDate = (value: string | undefined, locale: WebLocale): string => {
  if (value === undefined || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
};

const adminFunctionLabel = (value: AdminFunctionJson, locale: WebLocale): string => {
  const labels = {
    en: {
      audit: 'Audit',
      finance: 'Finance',
      operations: 'Operations',
      owner: 'Owner',
      'product-configuration': 'Product configuration',
      security: 'Security',
      support: 'Support',
    },
    'pt-BR': {
      audit: 'Auditoria',
      finance: 'Financeiro',
      operations: 'Operações',
      owner: 'Proprietário',
      'product-configuration': 'Configuração do produto',
      security: 'Segurança',
      support: 'Suporte',
    },
  } as const;
  return labels[locale][value];
};

const memberStateLabel = (
  value: AdminTeamMemberProjectionJson['state'],
  locale: WebLocale,
): string => {
  const labels = {
    en: { active: 'Active', offboarded: 'Removed', suspended: 'Suspended' },
    'pt-BR': { active: 'Ativo', offboarded: 'Removido', suspended: 'Suspenso' },
  } as const;
  return labels[locale][value];
};

const authorityStateLabel = (value: AccessAuthorityState['state'], locale: WebLocale): string => {
  const labels = {
    en: {
      degraded: 'Read-only',
      live: 'Live',
      offline: 'Offline',
      reconnecting: 'Reconnecting',
      stale: 'Update required',
      unavailable: 'Unavailable',
    },
    'pt-BR': {
      degraded: 'Somente leitura',
      live: 'Ao vivo',
      offline: 'Offline',
      reconnecting: 'Reconectando',
      stale: 'Atualização necessária',
      unavailable: 'Indisponível',
    },
  } as const;
  return labels[locale][value];
};

const riskTone = (risk: AdminRiskLevelJson): 'information' | 'warning' | 'critical' =>
  risk === 'critical' || risk === 'irreversible'
    ? 'critical'
    : risk === 'high' || risk === 'medium'
      ? 'warning'
      : 'information';

const riskLabel = (risk: AdminRiskLevelJson, locale: WebLocale): string => {
  const labels = {
    en: {
      critical: 'critical',
      high: 'sensitive',
      irreversible: 'irreversible',
      low: 'routine',
      medium: 'sensitive',
    },
    'pt-BR': {
      critical: 'crítico',
      high: 'sensível',
      irreversible: 'irreversível',
      low: 'rotineiro',
      medium: 'sensível',
    },
  } as const;
  return labels[locale][risk];
};

const addMinutes = (value: string, minutes: number): string =>
  new Date(Date.parse(value) + minutes * 60 * 1_000).toISOString();

const formValue = (data: FormData, name: string): string => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};

const isMember = (record: unknown): record is AdminTeamMemberProjectionJson =>
  typeof record === 'object' &&
  record !== null &&
  (record as { kind?: unknown }).kind === 'admin-team-member-projection';

const isGovernance = (record: unknown): record is AdminGovernanceProjectionJson =>
  typeof record === 'object' &&
  record !== null &&
  (record as { kind?: unknown }).kind === 'admin-governance-projection';

const assignmentFor = (member: AdminTeamMemberProjectionJson): PermissionAssignment =>
  Object.freeze({
    functions: Object.freeze([...member.functions]),
    capabilities: Object.freeze([...member.capabilities]),
    scopes: Object.freeze([...member.scopes]),
  });

export type GovernanceWorkspaceModel = Readonly<{
  approvals: readonly AdminGovernanceProjectionJson[];
  authority: AccessAuthorityState;
  conflict: boolean;
  impact?: AdminPermissionImpactProjectionJson;
  members: readonly AdminTeamMemberProjectionJson[];
  observedAt?: string;
  selectedId?: string;
  simulatedFunction?: AdminFunctionJson;
}>;

type GovernanceAction =
  | Readonly<{ kind: 'invite'; email: string; functions: readonly string[]; reason: string }>
  | Readonly<{
      kind: 'preview';
      member: AdminTeamMemberProjectionJson;
      after: PermissionAssignment;
      reason: string;
    }>
  | Readonly<{
      kind: 'change';
      member: AdminTeamMemberProjectionJson;
      after: PermissionAssignment;
      reason: string;
      risk: AdminRiskLevelJson;
    }>
  | Readonly<{
      kind: 'approval';
      action: 'approve' | 'cancel' | 'reassign';
      approval: AdminGovernanceProjectionJson;
      approver?: string;
      reason: string;
    }>
  | Readonly<{
      kind: 'delegate';
      member: AdminTeamMemberProjectionJson;
      expiresAt: string;
      reason: string;
    }>
  | Readonly<{ kind: 'review'; member: AdminTeamMemberProjectionJson; reason: string }>
  | Readonly<{ kind: 'offboard'; member: AdminTeamMemberProjectionJson; reason: string }>
  | Readonly<{ kind: 'break-glass'; expiresAt: string; reason: string; targetReference: string }>
  | Readonly<{
      kind: 'simulate';
      member: AdminTeamMemberProjectionJson;
      targetFunction: AdminFunctionJson;
    }>
  | Readonly<{ kind: 'exit-simulation' }>
  | Readonly<{
      kind: 'switch';
      member: AdminTeamMemberProjectionJson;
      targetFunction: AdminFunctionJson;
      reason: string;
    }>;

type ViewProps =
  | Readonly<{ locale: WebLocale; state: 'loading' }>
  | Readonly<{ code?: string; locale: WebLocale; state: 'error' }>
  | Readonly<{
      locale: WebLocale;
      model: GovernanceWorkspaceModel;
      mutation?: AdminMutationResult | null;
      onAction?: (action: GovernanceAction) => void;
      onRefresh?: () => void;
      onSelect?: (identityReference?: string) => void;
      state: 'ready';
    }>;

const Status = ({
  children,
  tone = 'information',
}: Readonly<{ children: ReactNode; tone?: 'information' | 'warning' | 'critical' }>) => (
  <span className={styles['status']} data-tone={tone}>
    {children}
  </span>
);

const ChoiceGroup = ({
  label,
  options,
  selected,
  onChange,
}: Readonly<{
  label: string;
  onChange: (value: readonly string[]) => void;
  options: readonly string[];
  selected: readonly string[];
}>) => (
  <fieldset className={styles['choiceGroup']}>
    <legend>{label}</legend>
    <div>
      {options.map((option) => (
        <label key={option}>
          <input
            checked={selected.includes(option)}
            onChange={(event) => {
              onChange(
                event.currentTarget.checked
                  ? [...selected, option]
                  : selected.filter((value) => value !== option),
              );
            }}
            type="checkbox"
          />
          <span>{option}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

const PermissionEditor = ({
  locale,
  member,
  model,
  onAction,
}: Readonly<{
  locale: WebLocale;
  member: AdminTeamMemberProjectionJson;
  model: GovernanceWorkspaceModel;
  onAction?: (action: GovernanceAction) => void;
}>) => {
  const labels = copy[locale];
  const [assignment, setAssignment] = useState<PermissionAssignment>(() => assignmentFor(member));
  const [reason, setReason] = useState('');
  const [risk, setRisk] = useState<AdminRiskLevelJson>('high');
  useEffect(() => {
    setAssignment(assignmentFor(member));
  }, [member]);
  const localImpact = projectPermissionImpact({
    before: assignmentFor(member),
    after: assignment,
    conflicts: model.impact?.conflicts ?? [],
    sessionReferences: model.impact?.sessionReferences ?? member.sessionReferences,
  });
  const submit = (event: SyntheticEvent<HTMLFormElement>, kind: 'preview' | 'change') => {
    event.preventDefault();
    onAction?.(
      kind === 'preview'
        ? { kind, member, after: assignment, reason }
        : { kind, member, after: assignment, reason, risk },
    );
  };
  return (
    <section className={styles['editor']} aria-labelledby="permission-editor-title">
      <header>
        <h3 id="permission-editor-title">{labels.access}</h3>
        <p>{labels.impactDetail}</p>
      </header>
      <form
        onSubmit={(event) => {
          submit(event, model.impact === undefined ? 'preview' : 'change');
        }}
      >
        <ChoiceGroup
          label={labels.functions}
          options={FUNCTIONS}
          selected={assignment.functions}
          onChange={(functions) => {
            setAssignment({ ...assignment, functions });
          }}
        />
        <ChoiceGroup
          label={labels.capabilities}
          options={CAPABILITIES}
          selected={assignment.capabilities}
          onChange={(capabilities) => {
            setAssignment({ ...assignment, capabilities });
          }}
        />
        <ChoiceGroup
          label={labels.scopes}
          options={SCOPES}
          selected={assignment.scopes}
          onChange={(scopes) => {
            setAssignment({ ...assignment, scopes });
          }}
        />
        <LbTextArea label={labels.reason} maxLength={256} onChange={setReason} value={reason} />
        <label className={styles['nativeField']}>
          <span>{labels.risk}</span>
          <select
            value={risk}
            onChange={(event) => {
              setRisk(event.currentTarget.value as AdminRiskLevelJson);
            }}
          >
            <option value="low">{riskLabel('low', locale)}</option>
            <option value="high">{riskLabel('high', locale)}</option>
            <option value="critical">{riskLabel('critical', locale)}</option>
            <option value="irreversible">{riskLabel('irreversible', locale)}</option>
          </select>
        </label>
        <LbButton
          isDisabled={!model.authority.canMutate || reason.trim().length < 8}
          type="submit"
          variant="primary"
        >
          {model.impact === undefined ? labels.previewImpact : labels.saveAccess}
        </LbButton>
      </form>
      <section className={styles['impact']} aria-labelledby="permission-impact-title">
        <header>
          <h3 id="permission-impact-title">{labels.impact}</h3>
          <Status tone={localImpact.conflicts.length > 0 ? 'critical' : 'information'}>
            {riskLabel(risk, locale)}
          </Status>
        </header>
        <div className={styles['diff']}>
          <Diff label="+ capabilities" values={localImpact.gainedCapabilities} />
          <Diff label="− capabilities" values={localImpact.lostCapabilities} />
          <Diff label="+ scopes" values={localImpact.gainedScopes} />
          <Diff label="− scopes" values={localImpact.lostScopes} />
          <Diff label={labels.gainedFunctions} values={localImpact.gainedFunctions} />
          <Diff label={labels.lostFunctions} values={localImpact.lostFunctions} />
          <Diff label={labels.affectedData} values={localImpact.affectedData} />
          <Diff label={labels.conflicts} values={localImpact.conflicts} />
          <Diff label={labels.sessions} values={localImpact.sessionsToRevoke} />
        </div>
      </section>
    </section>
  );
};

const Diff = ({ label, values }: Readonly<{ label: string; values: readonly string[] }>) => (
  <div>
    <strong>{label}</strong>
    {values.length === 0 ? (
      <span>—</span>
    ) : (
      <ul>
        {values.map((value) => (
          <li key={value}>
            <code>{value}</code>
          </li>
        ))}
      </ul>
    )}
  </div>
);

const ApprovalCard = ({
  approval,
  authority,
  locale,
  onAction,
}: Readonly<{
  approval: AdminGovernanceProjectionJson;
  authority: AccessAuthorityState;
  locale: WebLocale;
  onAction?: (action: GovernanceAction) => void;
}>) => {
  const labels = copy[locale];
  const [reason, setReason] = useState('');
  const [approver, setApprover] = useState(approval.eligibleApproverReferences[0] ?? '');
  const actionable = authority.canMutate && reason.trim().length >= 8;
  const dispatch = (action: 'approve' | 'cancel' | 'reassign') => {
    onAction?.({
      kind: 'approval',
      action,
      approval,
      ...(action === 'reassign' && approver.length > 0 ? { approver } : {}),
      reason,
    });
  };
  return (
    <li data-tone={riskTone(approval.risk)}>
      <header>
        <code>{approval.governanceRecordId}</code>
        <Status tone={riskTone(approval.risk)}>{approval.state}</Status>
      </header>
      <dl>
        <div>
          <dt>{labels.risk}</dt>
          <dd>{riskLabel(approval.risk, locale)}</dd>
        </div>
        <div>
          <dt>{labels.actor}</dt>
          <dd>{approval.authorReference}</dd>
        </div>
        <div>
          <dt>{labels.beneficiary}</dt>
          <dd>{approval.beneficiaryReference}</dd>
        </div>
        <div>
          <dt>{labels.assignedApprover}</dt>
          <dd>{approver || '—'}</dd>
        </div>
        <div>
          <dt>{labels.approvalExpiry}</dt>
          <dd>{formatDate(approval.expiresAt, locale)}</dd>
        </div>
      </dl>
      <p>
        <code>{approval.impactedReferences.join(' · ')}</code>
      </p>
      {approval.state === 'pending' ? (
        <div className={styles['approvalReview']}>
          <LbTextField label={labels.reason} maxLength={256} onChange={setReason} value={reason} />
          {approval.eligibleApproverReferences.length === 0 ? null : (
            <label className={styles['nativeField']}>
              <span>{labels.assignedApprover}</span>
              <select
                value={approver}
                onChange={(event) => {
                  setApprover(event.currentTarget.value);
                }}
              >
                {approval.eligibleApproverReferences.map((candidate) => (
                  <option key={candidate} value={candidate}>
                    {candidate}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className={styles['approvalActions']}>
            <LbButton
              isDisabled={!actionable}
              onPress={() => {
                dispatch('approve');
              }}
              variant="primary"
            >
              {localeText(locale, 'Aprovar acesso', 'Approve access')}
            </LbButton>
            <LbButton
              isDisabled={!actionable || approver.length === 0}
              onPress={() => {
                dispatch('reassign');
              }}
              variant="secondary"
            >
              {localeText(locale, 'Reatribuir', 'Reassign')}
            </LbButton>
            <LbButton
              isDisabled={!actionable}
              onPress={() => {
                dispatch('cancel');
              }}
              variant="quiet"
            >
              {localeText(locale, 'Cancelar solicitação', 'Cancel request')}
            </LbButton>
          </div>
        </div>
      ) : null}
    </li>
  );
};

const MemberInspector = ({
  locale,
  member,
  model,
  onAction,
  onClose,
}: Readonly<{
  locale: WebLocale;
  member: AdminTeamMemberProjectionJson;
  model: GovernanceWorkspaceModel;
  onAction?: (action: GovernanceAction) => void;
  onClose: () => void;
}>) => {
  const labels = copy[locale];
  const [simulation, setSimulation] = useState<AdminFunctionJson>(
    member.activeFunction ?? member.functions[0],
  );
  const [actionReason, setActionReason] = useState('');
  const actionReady = model.authority.canMutate && actionReason.trim().length >= 8;
  const review = projectAccessReview({
    accessClass: member.capabilities.includes('audit:reveal-sensitive') ? 'critical' : 'other',
    deviationDetected: false,
    lastActiveAt: member.lastActiveAt ?? member.freshness.observedAt,
    lastReviewedAt: member.freshness.observedAt,
    now: member.freshness.observedAt,
  });
  const history = maskGovernanceHistory(
    model.approvals
      .filter((approval) => approval.beneficiaryReference === member.identityReference)
      .map((approval) => ({
        at: approval.freshness.observedAt,
        kind: approval.governanceKind,
        outcome: approval.state,
      })),
  );
  return (
    <aside className={styles['inspector']} aria-labelledby="member-inspector-title">
      <header>
        <div>
          <span>{labels.memberDetail}</span>
          <h2 id="member-inspector-title">{member.displayName}</h2>
          <code>{member.maskedEmail}</code>
        </div>
        <LbButton ariaLabel={labels.close} onPress={onClose} variant="quiet">
          <ProductIcon name="close" size={18} />
        </LbButton>
      </header>
      {model.simulatedFunction === undefined ? null : (
        <div className={styles['simulationBanner']} role="status">
          <div className={styles['simulationMessage']}>
            <ProductIcon name="search" size={18} />
            <strong>{labels.noActionsSimulation}</strong>
            <span>{adminFunctionLabel(model.simulatedFunction, locale)}</span>
          </div>
          <LbButton onPress={() => onAction?.({ kind: 'exit-simulation' })} variant="secondary">
            <ProductIcon name="close" size={16} />
            {labels.simulationExit}
          </LbButton>
        </div>
      )}
      <dl className={styles['memberFacts']}>
        <div>
          <dt>{labels.state}</dt>
          <dd>
            <Status tone={member.state === 'active' ? 'information' : 'warning'}>
              {memberStateLabel(member.state, locale)}
            </Status>
          </dd>
        </div>
        <div>
          <dt>{labels.activeFunction}</dt>
          <dd>
            {member.activeFunction === undefined
              ? '—'
              : adminFunctionLabel(member.activeFunction, locale)}
          </dd>
        </div>
        <div>
          <dt>{labels.lastActive}</dt>
          <dd>{formatDate(member.lastActiveAt, locale)}</dd>
        </div>
        <div>
          <dt>{labels.recertification}</dt>
          <dd>{formatDate(member.nextReviewAt, locale)}</dd>
        </div>
        <div>
          <dt>{labels.inactivity}</dt>
          <dd>{review.inactivityAction}</dd>
        </div>
        <div>
          <dt>{labels.delegation}</dt>
          <dd>{member.activeDelegationReferences.length}</dd>
        </div>
      </dl>
      <div className={styles['functionTools']}>
        <label className={styles['nativeField']}>
          <span>{labels.activeFunction}</span>
          <select
            value={simulation}
            onChange={(event) => {
              setSimulation(event.currentTarget.value as AdminFunctionJson);
            }}
          >
            {member.functions.map((fn) => (
              <option key={fn} value={fn}>
                {adminFunctionLabel(fn, locale)}
              </option>
            ))}
          </select>
        </label>
        <LbTextField
          label={labels.reason}
          maxLength={256}
          onChange={setActionReason}
          value={actionReason}
        />
        <div>
          <LbButton
            onPress={() => {
              onAction?.({ kind: 'simulate', member, targetFunction: simulation });
            }}
            variant="secondary"
          >
            {labels.simulate}
          </LbButton>
          <LbButton
            isDisabled={!actionReady || member.activeFunction === simulation}
            onPress={() => {
              onAction?.({
                kind: 'switch',
                member,
                targetFunction: simulation,
                reason: actionReason,
              });
            }}
            variant="secondary"
          >
            {locale === 'pt-BR' ? 'Ativar função' : 'Activate function'}
          </LbButton>
        </div>
      </div>
      <PermissionEditor
        locale={locale}
        member={member}
        model={model}
        {...(onAction === undefined ? {} : { onAction })}
      />
      <section className={styles['secondaryActions']}>
        <h3>{locale === 'pt-BR' ? 'Ciclo de acesso' : 'Access lifecycle'}</h3>
        <div>
          <LbButton
            isDisabled={!actionReady}
            onPress={() => {
              onAction?.({ kind: 'review', member, reason: actionReason });
            }}
            variant="secondary"
          >
            {labels.reviewAccess}
          </LbButton>
          <LbButton
            isDisabled={!actionReady}
            onPress={() => {
              onAction?.({
                kind: 'delegate',
                member,
                expiresAt: addMinutes(member.freshness.observedAt, 60),
                reason: actionReason,
              });
            }}
            variant="secondary"
          >
            {labels.createDelegation}
          </LbButton>
          <LbButton
            isDisabled={!actionReady}
            onPress={() => {
              onAction?.({ kind: 'offboard', member, reason: actionReason });
            }}
            variant="destructive"
          >
            {labels.offboard}
          </LbButton>
        </div>
        <p>{labels.offboardDetail}</p>
      </section>
      <section className={styles['history']}>
        <h3>{labels.history}</h3>
        {history.length === 0 ? (
          <p>{labels.noHistory}</p>
        ) : (
          <ol>
            {history.map((event, index) => (
              <li key={`${event.at}:${event.kind}:${String(index)}`}>
                <time>{formatDate(event.at, locale)}</time>
                <strong>{event.kind}</strong>
                <span>{event.outcome ?? '—'}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </aside>
  );
};

export const AdminAccessGovernanceView = (props: ViewProps) => {
  const selectionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [breakGlassReason, setBreakGlassReason] = useState('');
  const labels = copy[props.locale];
  if (props.state === 'loading')
    return (
      <article className={styles['route']} data-state="loading">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.subtitle}</p>
          </div>
        </header>
        <AdminPeopleNavigation current="team" locale={props.locale} />
        <LbSkeletonRegion label={labels.loading} rows={8} />
      </article>
    );
  if (props.state === 'error')
    return (
      <article className={styles['route']} data-state="error">
        <header className={styles['routeHeader']}>
          <div>
            <h1>{labels.title}</h1>
            <p>{labels.subtitle}</p>
          </div>
        </header>
        <AdminPeopleNavigation current="team" locale={props.locale} />
        <LbOperationalNotice
          detail={`${labels.authorityDeniedDetail}${props.code ? ` · ${props.code}` : ''}`}
          state="degraded"
          title={labels.authorityDenied}
        />
      </article>
    );
  const { model } = props;
  const selected = model.members.find((member) => member.identityReference === model.selectedId);
  const notice =
    model.authority.state === 'live'
      ? null
      : model.authority.state === 'stale'
        ? {
            state: 'stale' as const,
            title: localeText(props.locale, 'Dados de acesso antigos', 'Access data is stale'),
          }
        : model.authority.state === 'reconnecting'
          ? {
              state: 'reconnecting' as const,
              title: localeText(
                props.locale,
                'Reconectando à governança',
                'Reconnecting to governance',
              ),
            }
          : {
              state: 'degraded' as const,
              title: localeText(
                props.locale,
                'Governança em modo somente leitura',
                'Governance is read-only',
              ),
            };
  return (
    <article className={styles['route']} data-state={model.authority.state}>
      <header className={styles['routeHeader']}>
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <div className={styles['headerStatus']}>
          <Status tone={model.authority.canMutate ? 'information' : 'warning'}>
            {authorityStateLabel(model.authority.state, props.locale)}
          </Status>
          <span>{formatDate(model.observedAt, props.locale)}</span>
        </div>
      </header>
      <AdminPeopleNavigation current="team" locale={props.locale} />
      {notice === null ? null : (
        <LbOperationalNotice
          action={
            <LbButton
              onPress={() => {
                props.onRefresh?.();
              }}
              variant="secondary"
            >
              {labels.refresh}
            </LbButton>
          }
          detail={labels.freshnessUnavailableDetail}
          state={notice.state}
          title={notice.title}
        />
      )}
      {model.conflict || props.mutation?.status === 'conflict' ? (
        <LbOperationalNotice
          action={
            <LbButton
              onPress={() => {
                props.onRefresh?.();
              }}
              variant="secondary"
            >
              {labels.refresh}
            </LbButton>
          }
          detail={localeText(
            props.locale,
            'O rascunho foi preservado. Compare a versão remota antes de enviar novamente.',
            'Your draft is preserved. Compare the remote version before submitting again.',
          )}
          state="conflict"
          title={localeText(props.locale, 'Conflito de versão', 'Version conflict')}
        />
      ) : null}
      <section className={styles['invitationStrip']}>
        <div>
          <ProductIcon name="userAdd" size={22} />
          <span>
            <strong>{labels.adminInvitations}</strong>
            <small>{labels.adminInvitationsDetail}</small>
          </span>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            props.onAction?.({
              kind: 'invite',
              email: formValue(data, 'admin-email'),
              functions: [formValue(data, 'admin-function') || 'operations'],
              reason: formValue(data, 'admin-invite-reason'),
            });
          }}
        >
          <LbTextField inputType="email" isRequired label={labels.inviteEmail} name="admin-email" />
          <label className={styles['nativeField']}>
            <span>{labels.functions}</span>
            <select name="admin-function">
              {FUNCTIONS.map((fn) => (
                <option key={fn} value={fn}>
                  {adminFunctionLabel(fn, props.locale)}
                </option>
              ))}
            </select>
          </label>
          <LbTextField
            isRequired
            label={labels.inviteReason}
            maxLength={256}
            name="admin-invite-reason"
          />
          <LbButton isDisabled={!model.authority.canMutate} type="submit" variant="primary">
            {labels.invite}
          </LbButton>
        </form>
      </section>
      <div
        className={styles['workspace']}
        data-inspector-open={selected !== undefined || undefined}
      >
        <section className={styles['team']} aria-labelledby="team-title">
          <header>
            <div>
              <h2 id="team-title">{labels.members}</h2>
              <span>{model.members.length}</span>
            </div>
            <p>{labels.membersDetail}</p>
          </header>
          {model.members.length === 0 ? (
            <div className={styles['empty']} role="status">
              <ProductIcon name="profile" size={28} />
              <p>{labels.empty}</p>
            </div>
          ) : (
            <ul>
              {model.members.map((member) => (
                <li
                  key={member.identityReference}
                  data-selected={member.identityReference === model.selectedId || undefined}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      selectionTriggerRef.current = event.currentTarget;
                      props.onSelect?.(member.identityReference);
                    }}
                  >
                    <span className={styles['avatar']} aria-hidden="true">
                      {member.displayName.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{member.displayName}</strong>
                      <code>{member.maskedEmail}</code>
                    </span>
                    <span className={styles['memberMeta']}>
                      <Status tone={member.state === 'active' ? 'information' : 'warning'}>
                        {memberStateLabel(member.state, props.locale)}
                      </Status>
                      <small>
                        {member.functions
                          .map((fn) => adminFunctionLabel(fn, props.locale))
                          .join(' · ')}
                      </small>
                    </span>
                    <ProductIcon name="arrowRight" size={18} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles['approvals']} aria-labelledby="approvals-title">
          <header>
            <div>
              <h2 id="approvals-title">{labels.approvals}</h2>
              <span>
                {model.approvals.filter((item) => item.state === 'pending').length}{' '}
                {labels.pending.toLowerCase()}
              </span>
            </div>
          </header>
          {model.approvals.length === 0 ? (
            <div className={styles['empty']} role="status">
              <ProductIcon name="scales" size={28} />
              <p>{labels.noApprovals}</p>
            </div>
          ) : (
            <ol>
              {model.approvals.map((approval) => (
                <ApprovalCard
                  approval={approval}
                  authority={model.authority}
                  key={approval.governanceRecordId}
                  locale={props.locale}
                  {...(props.onAction === undefined ? {} : { onAction: props.onAction })}
                />
              ))}
            </ol>
          )}
        </section>
        {selected === undefined ? null : (
          <MemberInspector
            locale={props.locale}
            member={selected}
            model={model}
            {...(props.onAction === undefined ? {} : { onAction: props.onAction })}
            onClose={() => {
              props.onSelect?.(undefined);
              globalThis.setTimeout(() => {
                selectionTriggerRef.current?.focus();
              }, 0);
            }}
          />
        )}
      </div>
      <section className={styles['breakGlass']} aria-labelledby="break-glass-title">
        <div>
          <ProductIcon name="warning" size={22} />
          <span>
            <h2 id="break-glass-title">{labels.breakGlass}</h2>
            <p>{labels.breakGlassDetail}</p>
          </span>
        </div>
        <strong>{labels.twoPerson}</strong>
        <div className={styles['breakGlassAction']}>
          <LbTextField
            label={labels.reason}
            maxLength={256}
            onChange={setBreakGlassReason}
            value={breakGlassReason}
          />
          <LbButton
            isDisabled={
              !model.authority.canMutate ||
              model.observedAt === undefined ||
              breakGlassReason.trim().length < 8
            }
            onPress={() => {
              if (model.observedAt === undefined) return;
              props.onAction?.({
                kind: 'break-glass',
                targetReference: selected?.identityReference ?? 'governance-control-plane',
                expiresAt: addMinutes(model.observedAt, 15),
                reason: breakGlassReason,
              });
            }}
            variant="destructive"
          >
            {labels.breakGlass}
          </LbButton>
        </div>
      </section>
    </article>
  );
};

const localeText = (locale: WebLocale, pt: string, en: string): string =>
  locale === 'pt-BR' ? pt : en;

const onlineMembers = (result: AdminQueryResult): readonly AdminTeamMemberProjectionJson[] =>
  result.status === 'online' ? result.records.filter(isMember) : [];

const onlineApprovals = (result: AdminQueryResult): readonly AdminGovernanceProjectionJson[] =>
  result.status === 'online' ? result.records.filter(isGovernance) : [];

export const AdminAccessGovernance = ({
  initialSelectedId,
  locale,
}: Readonly<{ initialSelectedId?: string; locale: WebLocale }>) => {
  const { authority, authorizeMutation, freshness, revision, session } = useAdminAuthority();
  const [results, setResults] = useState<Readonly<{
    approvals: AdminQueryResult;
    team: AdminQueryResult;
  }> | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialSelectedId);
  const [impact, setImpact] = useState<AdminPermissionImpactProjectionJson>();
  const [simulatedFunction, setSimulatedFunction] = useState<AdminFunctionJson>();
  const [mutation, setMutation] = useState<AdminMutationResult | null>(null);
  const [invalidated, setInvalidated] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (freshness !== 'live') setInvalidated(true);
  }, [freshness]);
  useEffect(() => {
    if (session === null || session === undefined) return undefined;
    const controller = new AbortController();
    void Promise.all([
      authority.query('team', { environment: 'staging', limit: 100, signal: controller.signal }),
      authority.query('approvals', {
        environment: 'staging',
        limit: 100,
        signal: controller.signal,
      }),
    ]).then(([team, approvals]) => {
      if (controller.signal.aborted) return;
      setResults({ team, approvals });
      if (team.status === 'online' || approvals.status === 'online') setInvalidated(false);
    });
    return () => {
      controller.abort();
    };
  }, [authority, refresh, revision, session]);
  const model = useMemo<GovernanceWorkspaceModel | null>(() => {
    if (results === null) return null;
    const members = onlineMembers(results.team);
    const approvals = onlineApprovals(results.approvals);
    const authorityState = deriveAccessAuthorityState({ freshness, invalidated });
    return Object.freeze({
      members: Object.freeze(members),
      approvals: Object.freeze(approvals),
      authority:
        results.team.status === 'online' && results.approvals.status === 'online'
          ? authorityState
          : Object.freeze({ canMutate: false, requiresRefetch: true, state: 'degraded' as const }),
      conflict: mutation?.status === 'conflict',
      ...(impact === undefined ? {} : { impact }),
      ...(results.team.status === 'online' && results.team.freshness?.observedAt
        ? { observedAt: results.team.freshness.observedAt }
        : {}),
      ...(selectedId === undefined ? {} : { selectedId }),
      ...(simulatedFunction === undefined ? {} : { simulatedFunction }),
    });
  }, [freshness, impact, invalidated, mutation?.status, results, selectedId, simulatedFunction]);
  if (
    results !== null &&
    results.team.status !== 'online' &&
    results.approvals.status !== 'online'
  ) {
    return <AdminAccessGovernanceView code={results.team.code} locale={locale} state="error" />;
  }
  if (model === null) return <AdminAccessGovernanceView locale={locale} state="loading" />;
  const run = (
    input: Parameters<typeof authority.mutate>[0],
    after?: (result: AdminMutationResult) => void,
  ) => {
    const requiresStrongAuth = !['preview-permission-impact', 'review-access'].includes(
      input.family,
    );
    void (requiresStrongAuth ? authorizeMutation(input) : Promise.resolve(input)).then(
      async (admitted) => {
        if (admitted === null) return;
        const result = await authority.mutate(admitted);
        setMutation(result);
        after?.(result);
        if (result.status === 'complete' || result.status === 'partial')
          setRefresh((value) => value + 1);
      },
    );
  };
  const onAction = (action: GovernanceAction) => {
    if (action.kind === 'exit-simulation') {
      setSimulatedFunction(undefined);
      return;
    }
    if (action.kind === 'simulate') {
      const simulation = projectFunctionSimulation({
        assignedFunctions: action.member.functions,
        targetFunction: action.targetFunction,
      });
      if (simulation.admitted) setSimulatedFunction(simulation.activeFunction);
      return;
    }
    if (!model.authority.canMutate) return;
    const id = crypto.randomUUID();
    if (action.kind === 'invite')
      run({
        family: 'invite-team-member',
        idempotencyKey: id,
        reason: action.reason,
        payload: {
          invitationId: id,
          invitationKind: 'administrative-team',
          recipient: action.email,
          functions: action.functions,
        },
        targetId: id,
      });
    else if (action.kind === 'preview')
      run(
        {
          family: 'preview-permission-impact',
          idempotencyKey: id,
          reason: action.reason,
          expectedVersion: action.member.aggregateVersion,
          expectedEtag: action.member.etag,
          payload: { identityId: action.member.identityReference, proposed: action.after },
          targetId: action.member.identityReference,
        },
        (result) => {
          if (
            (result.status === 'complete' || result.status === 'partial') &&
            'document' in result &&
            result.document.kind === 'admin-permission-impact-projection'
          )
            setImpact(result.document);
        },
      );
    else if (action.kind === 'change')
      run({
        family: 'request-approval',
        idempotencyKey: id,
        reason: action.reason,
        expectedVersion: action.member.aggregateVersion,
        expectedEtag: action.member.etag,
        payload: {
          requestId: id,
          beneficiaryId: action.member.identityReference,
          capability: action.after.capabilities[0] ?? 'session:revoke',
          scope: action.after.scopes[0] ?? 'sessions',
          risk:
            action.risk === 'medium' || action.risk === 'high'
              ? 'sensitive'
              : action.risk === 'low'
                ? 'routine'
                : action.risk,
          expiresAt: addMinutes(action.member.freshness.observedAt, 15),
        },
        targetId: id,
      });
    else if (action.kind === 'approval')
      run({
        family:
          action.action === 'approve'
            ? 'approve-request'
            : action.action === 'cancel'
              ? 'cancel-request'
              : 'reassign-request',
        idempotencyKey: id,
        reason: action.reason,
        expectedVersion: action.approval.aggregateVersion,
        expectedEtag: action.approval.etag,
        payload: {
          authorizationContextId: id,
          capability: action.approval.impactedReferences[0],
          scopes: action.approval.impactedReferences.slice(1),
          ...(action.approver ? { newApproverId: action.approver } : {}),
        },
        targetId: action.approval.governanceRecordId,
      });
    else if (action.kind === 'delegate')
      run({
        family: 'create-delegation',
        idempotencyKey: id,
        reason: action.reason,
        payload: {
          delegationId: id,
          delegateId: action.member.identityReference,
          capabilities: action.member.capabilities,
          scopes: action.member.scopes,
          risk: 'sensitive',
          expiresAt: action.expiresAt,
          authorizationContextId: id,
        },
        targetId: id,
      });
    else if (action.kind === 'review')
      run({
        family: 'review-access',
        idempotencyKey: id,
        reason: action.reason,
        expectedVersion: action.member.aggregateVersion,
        payload: {
          identityId: action.member.identityReference,
          accessClass: action.member.capabilities.includes('audit:reveal-sensitive')
            ? 'critical'
            : 'other',
          lastReviewedAt: action.member.nextReviewAt ?? action.member.freshness.observedAt,
          lastActiveAt: action.member.lastActiveAt ?? action.member.freshness.observedAt,
          deviationDetected: false,
          retainAccess: true,
        },
        targetId: action.member.identityReference,
      });
    else if (action.kind === 'offboard')
      run({
        family: 'offboard-member',
        idempotencyKey: id,
        reason: action.reason,
        expectedVersion: action.member.aggregateVersion,
        expectedEtag: action.member.etag,
        payload: { authorizationContextId: id, compromise: false },
        targetId: action.member.identityReference,
      });
    else if (action.kind === 'switch')
      run({
        family: 'switch-function',
        idempotencyKey: id,
        reason: action.reason,
        expectedVersion: action.member.aggregateVersion,
        payload: { authorizationContextId: id, targetFunction: action.targetFunction },
        targetId: session?.actorId ?? action.member.identityReference,
      });
    else
      run({
        family: 'governance-break-glass',
        idempotencyKey: id,
        reason: action.reason,
        payload: {
          authorizationContextId: id,
          executeAt: addMinutes(action.expiresAt, -14),
          expiresAt: action.expiresAt,
          targetReference: action.targetReference,
        },
        targetId: action.targetReference,
      });
  };
  return (
    <AdminAccessGovernanceView
      locale={locale}
      model={model}
      mutation={mutation}
      onAction={onAction}
      onRefresh={() => {
        setRefresh((value) => value + 1);
      }}
      onSelect={setSelectedId}
      state="ready"
    />
  );
};
