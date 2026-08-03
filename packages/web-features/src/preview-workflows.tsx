import { LbButton, LbTextField } from '@liiiraa/design-system';
import { useMachine } from '@xstate/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  PREVIEW_ACTION_POLICIES,
  selectPreviewState,
  type PreviewCancellationReceipt,
  type PreviewStateProjection,
  type PreviewValidationError,
  type PreviewWorkflowContext,
  type PreviewWorkflowInput,
  type PreviewWorkflowOutput,
  type createPreviewWorkflowMachine,
} from './preview-machine.ts';
import { PreviewBoundary } from './components.tsx';

export type PreviewWorkflowLocale = 'en' | 'pt-BR';

const COPY = Object.freeze({
  en: Object.freeze({
    boundary: 'Saving is temporarily unavailable. You can review or cancel without changing your account.',
    cancel: 'Cancel',
    cancelledBody: 'The review was cancelled. Your account remains exactly as it was.',
    cancelledTitle: 'Cancelled — your account is unchanged',
    confirm: 'Confirm this action',
    edit: 'Edit details',
    expired:
      'Your secure session expired. Safe draft fields remain available; sign in again before continuing.',
    failure:
      'Account services are temporarily unavailable. Safe draft fields remain available.',
    finishValidation: 'Check details',
    offline: 'You are offline. Safe draft fields remain available on this device.',
    progress: 'Finishing the review without changing your account.',
    reauthenticate:
      'Sign-in verification is unavailable right now. No credential was verified or stored.',
    receiptBody: 'The review is complete. Your account remains unchanged.',
    receiptTitle: 'Review complete — your account is unchanged',
    refresh: 'Refresh reviewed data',
    resume: 'Sign in again',
    retry: 'Try again',
    review: 'Continue to confirmation',
    stale:
      'The reviewed input is stale. Refresh it before confirmation; no ambiguous action is available.',
    validationTitle: 'Correct the reviewed fields',
  }),
  'pt-BR': Object.freeze({
    boundary: 'O salvamento está temporariamente indisponível. Você pode revisar ou cancelar sem alterar sua conta.',
    cancel: 'Cancelar',
    cancelledBody: 'A revisão foi cancelada. Sua conta permanece exatamente como estava.',
    cancelledTitle: 'Cancelado — sua conta não mudou',
    confirm: 'Confirmar esta ação',
    edit: 'Editar detalhes',
    expired:
      'Sua sessão segura expirou. Os campos seguros permanecem disponíveis; entre novamente antes de continuar.',
    failure:
      'Os serviços da conta estão temporariamente indisponíveis. Os campos seguros permanecem disponíveis.',
    finishValidation: 'Conferir dados',
    offline: 'Você está sem conexão. Os campos seguros permanecem disponíveis neste dispositivo.',
    progress: 'Concluindo a revisão sem alterar sua conta.',
    reauthenticate:
      'A verificação de entrada está indisponível agora. Nenhuma credencial foi verificada ou armazenada.',
    receiptBody: 'A revisão foi concluída. Sua conta permanece sem alterações.',
    receiptTitle: 'Revisão concluída — sua conta não mudou',
    refresh: 'Atualizar dados revisados',
    resume: 'Entrar novamente',
    retry: 'Tentar novamente',
    review: 'Continuar para confirmação',
    stale:
      'A entrada revisada está desatualizada. Atualize-a antes da confirmação; nenhuma ação ambígua está disponível.',
    validationTitle: 'Corrija os campos revisados',
  }),
});

const ADMIN_COPY = Object.freeze({
  en: Object.freeze({
    ...COPY.en,
    boundary:
      'Administrative connectivity remains closed. You can review or cancel without changing the system.',
    cancelledBody: 'The review was cancelled. No administrative operation was performed.',
    cancelledTitle: 'Cancelled — no operation was performed',
    failure:
      'Administrative services are temporarily unavailable. Safe review fields remain available.',
    offline: 'You are offline. Safe review remains available and no operation is queued.',
    progress: 'Recording the review without performing an administrative operation.',
    reauthenticate:
      'Operator verification is unavailable right now. No credential was verified or stored.',
    receiptBody: 'The review is complete. No administrative operation was performed.',
    receiptTitle: 'Review recorded — no operation was performed',
  }),
  'pt-BR': Object.freeze({
    ...COPY['pt-BR'],
    boundary:
      'A conexão administrativa permanece fechada. Você pode revisar ou cancelar sem alterar o sistema.',
    cancelledBody: 'A revisão foi cancelada. Nenhuma operação administrativa foi realizada.',
    cancelledTitle: 'Cancelado — nenhuma operação foi realizada',
    failure:
      'Os serviços administrativos estão temporariamente indisponíveis. Os campos seguros de revisão permanecem disponíveis.',
    offline:
      'Você está sem conexão. A revisão segura permanece disponível e nenhuma operação entrou na fila.',
    progress: 'Registrando a revisão sem realizar uma operação administrativa.',
    reauthenticate:
      'A verificação do operador está indisponível agora. Nenhuma credencial foi verificada ou armazenada.',
    receiptBody: 'A revisão foi concluída. Nenhuma operação administrativa foi realizada.',
    receiptTitle: 'Revisão registrada — nenhuma operação foi realizada',
  }),
});

const workflowCopy = (
  locale: PreviewWorkflowLocale,
  surface: string,
) => (surface === 'admin' ? ADMIN_COPY[locale] : COPY[locale]);

const ERROR_COPY: Readonly<Record<string, Readonly<Record<PreviewWorkflowLocale, string>>>> =
  Object.freeze({
    'preview.validation.consent-required': Object.freeze({
      en: 'Grant explicit, scoped, time-limited consent before review.',
      'pt-BR': 'Conceda consentimento explícito, delimitado e temporário antes da revisão.',
    }),
    'preview.validation.desktop-required': Object.freeze({
      en: 'Use a desktop-class viewport at least 960 pixels wide for this high-risk review.',
      'pt-BR':
        'Use uma janela de classe desktop com pelo menos 960 pixels para esta revisão de alto risco.',
    }),
    'preview.validation.impact-required': Object.freeze({
      en: 'Describe the impact of the reviewed action.',
      'pt-BR': 'Descreva o impacto da ação revisada.',
    }),
    'preview.validation.purpose-required': Object.freeze({
      en: 'Describe the specific purpose for this review.',
      'pt-BR': 'Descreva a finalidade específica desta revisão.',
    }),
    'preview.validation.required': Object.freeze({
      en: 'Enter the required value for this field.',
      'pt-BR': 'Informe o valor obrigatório deste campo.',
    }),
    'preview.validation.role-required': Object.freeze({
      en: 'A permitted role and scope are required.',
      'pt-BR': 'Uma função e um escopo permitidos são obrigatórios.',
    }),
    'preview.validation.stale': Object.freeze({
      en: 'Refresh stale input before review.',
      'pt-BR': 'Atualize a entrada desatualizada antes da revisão.',
    }),
  });

const errorCopy = (error: PreviewValidationError, locale: PreviewWorkflowLocale): string =>
  ERROR_COPY[error.messageId]?.[locale] ??
  (locale === 'pt-BR' ? 'Revise este campo.' : 'Review this field.');

const fieldId = (actionId: string, field: string): string =>
  `preview-${actionId.replaceAll('.', '-')}-${field.replaceAll('.', '-')}`;

const fieldLabel = (context: PreviewWorkflowContext, field: string): string =>
  context.review.find((item) => item.field === field)?.label ?? field;

export interface PreviewReviewProps {
  readonly context: PreviewWorkflowContext;
  readonly locale: PreviewWorkflowLocale;
}

export const PreviewReview = ({ context, locale }: PreviewReviewProps) => (
  <section aria-labelledby="preview-review-title" data-preview-region="review">
    <h2 id="preview-review-title">
      {locale === 'pt-BR' ? 'Revise os detalhes' : 'Review your details'}
    </h2>
    <dl>
      <div>
        <dt>{locale === 'pt-BR' ? 'Finalidade' : 'Purpose'}</dt>
        <dd>{context.purpose}</dd>
      </div>
      <div>
        <dt>{locale === 'pt-BR' ? 'Impacto' : 'Impact'}</dt>
        <dd>{context.impact}</dd>
      </div>
      <div>
        <dt>{locale === 'pt-BR' ? 'Função e escopo' : 'Role and scope'}</dt>
        <dd>{context.role ?? (locale === 'pt-BR' ? 'Não aplicável' : 'Not applicable')}</dd>
      </div>
    </dl>
    <table>
      <caption>{locale === 'pt-BR' ? 'Diferenças revisadas' : 'Reviewed differences'}</caption>
      <thead>
        <tr>
          <th scope="col">{locale === 'pt-BR' ? 'Campo' : 'Field'}</th>
          <th scope="col">{locale === 'pt-BR' ? 'Antes' : 'Before'}</th>
          <th scope="col">{locale === 'pt-BR' ? 'Depois' : 'After'}</th>
        </tr>
      </thead>
      <tbody>
        {context.review.map((item) => (
          <tr key={item.field}>
            <th scope="row">{item.label}</th>
            <td>{item.before}</td>
            <td>{item.after}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {context.consent ? (
      <section aria-labelledby="preview-consent-title">
        <h3 id="preview-consent-title">
          {locale === 'pt-BR' ? 'Consentimento delimitado' : 'Scoped consent'}
        </h3>
        <dl>
          <div>
            <dt>{locale === 'pt-BR' ? 'Finalidade' : 'Purpose'}</dt>
            <dd>{context.consent.purpose}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Campos permitidos' : 'Permitted fields'}</dt>
            <dd>{context.consent.permittedFields.join(', ')}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Expiração' : 'Expiration'}</dt>
            <dd>
              <time dateTime={context.consent.expiresAt}>{context.consent.expiresAt}</time>
            </dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Ator solicitante' : 'Requesting actor'}</dt>
            <dd>{context.consent.requestingActor}</dd>
          </div>
          <div>
            <dt>{locale === 'pt-BR' ? 'Evento resultante' : 'Resulting event'}</dt>
            <dd>
              {locale === 'pt-BR'
                ? 'Prévia de evento imutável sem alteração'
                : 'Immutable no-change event preview'}
            </dd>
          </div>
        </dl>
      </section>
    ) : null}
  </section>
);

export interface PreviewConfirmationProps {
  readonly confirmationValue: string;
  readonly context: PreviewWorkflowContext;
  readonly locale: PreviewWorkflowLocale;
  readonly onCancel: () => void;
  readonly onChangeConfirmation: (value: string) => void;
  readonly onConfirm: (value: string) => void;
}

export const PreviewConfirmation = ({
  confirmationValue,
  context,
  locale,
  onCancel,
  onChangeConfirmation,
  onConfirm,
}: PreviewConfirmationProps) => {
  const copy = workflowCopy(locale, context.action.surface);
  const expected = context.confirmation.value[locale];
  const requiresPhrase = context.confirmation.kind === 'phrase';
  const confirmValue = requiresPhrase ? confirmationValue : expected;

  return (
    <section aria-labelledby="preview-confirmation-title" data-preview-region="confirmation">
      <h2 id="preview-confirmation-title" tabIndex={-1}>
        {locale === 'pt-BR' ? 'Confirme esta ação' : 'Confirm this action'}
      </h2>
      <PreviewBoundary
        description={copy.boundary}
        title={locale === 'pt-BR' ? 'Salvamento indisponível' : 'Saving unavailable'}
      />
      <p>{context.confirmation.label[locale]}</p>
      {requiresPhrase ? (
        <LbTextField
          description={
            locale === 'pt-BR' ? `Digite exatamente: ${expected}` : `Enter exactly: ${expected}`
          }
          label={locale === 'pt-BR' ? 'Frase de confirmação' : 'Confirmation phrase'}
          onChange={onChangeConfirmation}
          value={confirmationValue}
        />
      ) : null}
      <div aria-label={locale === 'pt-BR' ? 'Ações de confirmação' : 'Confirmation actions'} role="group">
        <LbButton onPress={onCancel} variant="quiet">
          {copy.cancel}
        </LbButton>
        <LbButton
          isDisabled={confirmValue !== expected}
          onPress={() => {
            onConfirm(confirmValue);
          }}
          variant="destructive"
        >
          {context.confirmation.label[locale]}
        </LbButton>
      </div>
    </section>
  );
};

export interface PreviewFailureProps {
  readonly context: PreviewWorkflowContext;
  readonly locale: PreviewWorkflowLocale;
  readonly onCancel: () => void;
  readonly onRecover: () => void;
  readonly projection: PreviewStateProjection;
}

export const PreviewFailure = ({
  context,
  locale,
  onCancel,
  onRecover,
  projection,
}: PreviewFailureProps) => {
  const copy = workflowCopy(locale, context.action.surface);
  const detail =
    projection.state === 'offline'
      ? copy.offline
      : projection.state === 'stale'
        ? copy.stale
        : projection.state === 'expired-session'
          ? copy.expired
          : copy.failure;
  const recoveryLabel =
    projection.state === 'stale'
      ? copy.refresh
      : projection.state === 'expired-session'
        ? copy.resume
        : copy.retry;

  return (
    <section
      aria-labelledby="preview-failure-title"
      aria-live="assertive"
      data-preview-region="failure"
      role="alert"
    >
      <h2 id="preview-failure-title" tabIndex={-1}>
        {locale === 'pt-BR'
          ? 'Esta ação está temporariamente indisponível'
          : 'This action is temporarily unavailable'}
      </h2>
      <p>{detail}</p>
      <p>
        {locale === 'pt-BR' ? 'Trabalho local seguro preservado: ' : 'Safe local work preserved: '}
        {Object.keys(context.safeDraft).join(', ') ||
          (locale === 'pt-BR' ? 'nenhum campo' : 'no fields')}
      </p>
      <div role="group" aria-label={locale === 'pt-BR' ? 'Recuperação' : 'Recovery'}>
        <LbButton onPress={onRecover}>{recoveryLabel}</LbButton>
        <LbButton onPress={onCancel} variant="quiet">
          {copy.cancel}
        </LbButton>
      </div>
    </section>
  );
};

export interface PreviewReceiptProps {
  readonly actionLabel: string;
  readonly locale: PreviewWorkflowLocale;
  readonly output: PreviewWorkflowOutput;
}

const correlationFor = (output: PreviewWorkflowOutput): string =>
  output.kind === 'no-change' ? output.receipt.correlationId : output.receipt.correlationId;

export const PreviewReceipt = ({ actionLabel, locale, output }: PreviewReceiptProps) => {
  const cancelled = output.kind === 'cancelled';
  const receipt = output.receipt;
  const correlationId = correlationFor(output);
  const copy = workflowCopy(locale, receipt.authority.surface);
  const changedLabel =
    receipt.authority.surface === 'admin'
      ? locale === 'pt-BR'
        ? 'Operação realizada'
        : 'Operation performed'
      : locale === 'pt-BR'
        ? 'Conta alterada'
        : 'Account changed';

  return (
    <section
      aria-labelledby="preview-receipt-title"
      aria-live="polite"
      data-preview-region="receipt"
      data-remote-state-changed="false"
      tabIndex={-1}
    >
      <h2 id="preview-receipt-title">
        {cancelled ? copy.cancelledTitle : copy.receiptTitle}
      </h2>
      <p>{cancelled ? copy.cancelledBody : copy.receiptBody}</p>
      <dl>
        <div>
          <dt>{locale === 'pt-BR' ? 'Ação revisada' : 'Reviewed action'}</dt>
          <dd>{actionLabel}</dd>
        </div>
        <div>
          <dt>{changedLabel}</dt>
          <dd>{locale === 'pt-BR' ? 'Não' : 'No'}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Referência da confirmação' : 'Confirmation reference'}</dt>
          <dd>
            <code>{correlationId}</code>
          </dd>
        </div>
      </dl>
      <ol
        aria-label={
          locale === 'pt-BR' ? 'Registro da confirmação' : 'Confirmation record'
        }
        data-immutable="true"
      >
        <li>
          <time dateTime={receipt.reviewedAt}>{receipt.reviewedAt}</time>{' '}
          {cancelled
            ? locale === 'pt-BR'
              ? receipt.authority.surface === 'admin'
                ? 'Revisão cancelada; nenhuma operação foi realizada.'
                : 'Revisão cancelada; sua conta não mudou.'
              : receipt.authority.surface === 'admin'
                ? 'Review cancelled; no operation was performed.'
                : 'Review cancelled; your account is unchanged.'
            : locale === 'pt-BR'
              ? receipt.authority.surface === 'admin'
                ? 'Revisão concluída; nenhuma operação foi realizada.'
                : 'Revisão concluída; sua conta não mudou.'
              : receipt.authority.surface === 'admin'
                ? 'Review complete; no operation was performed.'
                : 'Review complete; your account is unchanged.'}
        </li>
      </ol>
    </section>
  );
};

export interface PreviewFieldsProps {
  readonly context: PreviewWorkflowContext;
  readonly locale: PreviewWorkflowLocale;
  readonly onChange: (field: string, value: string) => void;
  readonly onChangeImpact: (value: string) => void;
  readonly onChangePurpose: (value: string) => void;
}

export const PreviewFields = ({
  context,
  locale,
  onChange,
  onChangeImpact,
  onChangePurpose,
}: PreviewFieldsProps) => {
  const actionPolicy = PREVIEW_ACTION_POLICIES[context.action.family];
  const impactError = context.validationErrors.find((error) => error.field === 'impact');
  const purposeError = context.validationErrors.find((error) => error.field === 'purpose');
  const prerequisite = (
    field: 'consent' | 'freshness' | 'role' | 'viewport',
    label: string,
    value: string,
  ) => {
    const error = context.validationErrors.find((candidate) => candidate.field === field);
    return (
      <div id={fieldId(context.action.id, field)}>
        <dt>{label}</dt>
        <dd>
          {value}
          {error ? <p role="alert">{errorCopy(error, locale)}</p> : null}
        </dd>
      </div>
    );
  };

  return (
    <div data-preview-region="fields">
      {actionPolicy.requiresPurpose ? (
        <div id={fieldId(context.action.id, 'purpose')}>
          <LbTextField
            errorMessage={purposeError ? errorCopy(purposeError, locale) : undefined}
            isInvalid={purposeError !== undefined}
            label={locale === 'pt-BR' ? 'Finalidade específica' : 'Specific purpose'}
            onChange={onChangePurpose}
            value={context.purpose}
          />
        </div>
      ) : null}
      {actionPolicy.requiresImpact ? (
        <div id={fieldId(context.action.id, 'impact')}>
          <LbTextField
            errorMessage={impactError ? errorCopy(impactError, locale) : undefined}
            isInvalid={impactError !== undefined}
            label={locale === 'pt-BR' ? 'Impacto revisado' : 'Reviewed impact'}
            onChange={onChangeImpact}
            value={context.impact}
          />
        </div>
      ) : null}
      {context.requiredFields.map((field) => {
        const error = context.validationErrors.find((candidate) => candidate.field === field);
        return (
          <div id={fieldId(context.action.id, field)} key={field}>
            <LbTextField
              errorMessage={error ? errorCopy(error, locale) : undefined}
              isInvalid={error !== undefined}
              label={fieldLabel(context, field)}
              onChange={(value) => {
                onChange(field, value);
              }}
              value={context.fields[field] ?? ''}
            />
          </div>
        );
      })}
      <dl aria-label={locale === 'pt-BR' ? 'Pré-requisitos da revisão' : 'Review prerequisites'}>
        {actionPolicy.requiresRole
          ? prerequisite(
              'role',
              locale === 'pt-BR' ? 'Função permitida' : 'Permitted role',
              context.role ?? (locale === 'pt-BR' ? 'Não informada' : 'Not provided'),
            )
          : null}
        {actionPolicy.requiresConsent
          ? prerequisite(
              'consent',
              locale === 'pt-BR' ? 'Consentimento delimitado' : 'Scoped consent',
              context.consent?.granted === true
                ? locale === 'pt-BR'
                  ? 'Concedido para esta revisão'
                  : 'Granted for this review'
                : locale === 'pt-BR'
                  ? 'Não concedido'
                  : 'Not granted',
            )
          : null}
        {actionPolicy.requiresDesktopViewport
          ? prerequisite(
              'viewport',
              locale === 'pt-BR' ? 'Janela de classe desktop' : 'Desktop-class viewport',
              `${String(context.viewport.width)}px`,
            )
          : null}
        {prerequisite(
          'freshness',
          locale === 'pt-BR' ? 'Atualidade da entrada' : 'Input freshness',
          context.freshness === 'current'
            ? locale === 'pt-BR'
              ? 'Atual'
              : 'Current'
            : locale === 'pt-BR'
              ? 'Desatualizada'
              : 'Stale',
        )}
      </dl>
    </div>
  );
};

export const PreviewErrorSummary = ({
  actionId,
  errors,
  locale,
}: {
  readonly actionId: string;
  readonly errors: readonly PreviewValidationError[];
  readonly locale: PreviewWorkflowLocale;
}) => (
  <section
    aria-labelledby="preview-error-summary-title"
    data-preview-region="error-summary"
    role="alert"
    tabIndex={-1}
  >
    <h2 id="preview-error-summary-title">{COPY[locale].validationTitle}</h2>
    <ul>
      {errors.map((error) => (
        <li key={`${error.field}-${error.messageId}`}>
          <a href={`#${fieldId(actionId, error.field)}`}>{errorCopy(error, locale)}</a>
        </li>
      ))}
    </ul>
  </section>
);

export interface PreviewWorkflowProps {
  readonly footer?: ReactNode;
  readonly input: PreviewWorkflowInput;
  readonly locale: PreviewWorkflowLocale;
  readonly machine: ReturnType<typeof createPreviewWorkflowMachine>;
  readonly title?: string;
}

export const PreviewWorkflow = ({
  footer,
  input,
  locale,
  machine,
  title,
}: PreviewWorkflowProps) => {
  const [snapshot, send] = useMachine(machine, { input });
  const projection = selectPreviewState(snapshot);
  const [confirmationValue, setConfirmationValue] = useState('');
  const focusTarget = useRef<HTMLDivElement | null>(null);
  const actionPolicy = PREVIEW_ACTION_POLICIES[snapshot.context.action.family];
  const copy = workflowCopy(locale, snapshot.context.action.surface);
  const output = snapshot.status === 'done' ? snapshot.output : null;
  const statusCopy = useMemo(
    () => {
      if (projection.state === 'issuing') return copy.progress;
      const labels: Readonly<Record<PreviewStateProjection['state'], Readonly<Record<PreviewWorkflowLocale, string>>>> = {
        cancelled: { en: 'Review cancelled', 'pt-BR': 'Revisão cancelada' },
        complete: { en: 'Review complete', 'pt-BR': 'Revisão concluída' },
        confirming: { en: 'Confirmation required', 'pt-BR': 'Confirmação necessária' },
        editing: { en: 'Check the details below', 'pt-BR': 'Confira os detalhes abaixo' },
        'expired-session': { en: 'Secure session expired', 'pt-BR': 'Sessão segura expirada' },
        issuing: { en: copy.progress, 'pt-BR': copy.progress },
        offline: { en: 'You are offline', 'pt-BR': 'Você está sem conexão' },
        'partial-failure': {
          en: 'Account services are unavailable',
          'pt-BR': 'Os serviços da conta estão indisponíveis',
        },
        'reauth-preview': {
          en: 'Sign-in verification required',
          'pt-BR': 'Verificação de entrada necessária',
        },
        reviewing: { en: 'Ready to review', 'pt-BR': 'Pronto para revisar' },
        stale: { en: 'Details need to be refreshed', 'pt-BR': 'Os dados precisam ser atualizados' },
        validating: { en: 'Checking details', 'pt-BR': 'Conferindo dados' },
        'validation-error': { en: 'Some details need attention', 'pt-BR': 'Alguns dados precisam de atenção' },
      };
      return labels[projection.state][locale];
    },
    [copy.progress, locale, projection.state],
  );

  useEffect(() => {
    if (
      projection.state === 'validation-error' ||
      projection.state === 'confirming' ||
      projection.state === 'offline' ||
      projection.state === 'stale' ||
      projection.state === 'expired-session' ||
      projection.state === 'partial-failure' ||
      projection.state === 'cancelled' ||
      projection.state === 'complete'
    ) {
      focusTarget.current?.focus();
    }
  }, [projection.state]);

  const cancel = () => {
    send({ type: 'CANCEL' });
  };
  const recover = () => {
    if (projection.state === 'stale') {
      send({ type: 'REFRESH' });
    } else if (projection.state === 'expired-session') {
      send({ type: 'RESUME_SESSION' });
    } else {
      send({ type: 'RETRY' });
    }
  };
  const fields = (
    <PreviewFields
      context={snapshot.context}
      locale={locale}
      onChange={(field, value) => {
        send({ field, type: 'EDIT_FIELD', value });
      }}
      onChangeImpact={(value) => {
        send({ type: 'EDIT_IMPACT', value });
      }}
      onChangePurpose={(value) => {
        send({ type: 'EDIT_PURPOSE', value });
      }}
    />
  );

  return (
    <section
      aria-labelledby="preview-workflow-title"
      data-preview-state={projection.state}
      data-remote-authority="unavailable"
    >
      <header>
        <h1 id="preview-workflow-title">
          {title ??
            (locale === 'pt-BR'
              ? `Revisar ${snapshot.context.action.objectLabel}`
              : `Review ${snapshot.context.action.objectLabel}`)}
        </h1>
      </header>
      <PreviewBoundary
        description={copy.boundary}
        title={locale === 'pt-BR' ? 'Salvamento indisponível' : 'Saving unavailable'}
      />
      <p aria-live="polite" role="status">
        {statusCopy}
      </p>

      <div ref={focusTarget} tabIndex={-1}>
        {projection.state === 'editing' ? (
          <>
            {fields}
            <LbButton
              onPress={() => {
                send({ type: 'SUBMIT' });
              }}
            >
              {copy.finishValidation}
            </LbButton>
          </>
        ) : null}

        {projection.state === 'validating' ? (
          <LbButton
            onPress={() => {
              send({ type: 'VALIDATION_PASSED' });
            }}
          >
            {copy.finishValidation}
          </LbButton>
        ) : null}

        {projection.state === 'validation-error' ? (
          <>
            <PreviewErrorSummary
              actionId={snapshot.context.action.id}
              errors={snapshot.context.validationErrors}
              locale={locale}
            />
            {fields}
            <LbButton
              onPress={() => {
                send({ type: 'SUBMIT' });
              }}
            >
              {copy.finishValidation}
            </LbButton>
          </>
        ) : null}

        {projection.state === 'reviewing' ? (
          <>
            <PreviewReview context={snapshot.context} locale={locale} />
            <div role="group" aria-label={locale === 'pt-BR' ? 'Revisão' : 'Review'}>
              <LbButton
                onPress={() => {
                  send({ type: 'EDIT' });
                }}
                variant="quiet"
              >
                {copy.edit}
              </LbButton>
              <LbButton
                onPress={() => {
                  send({ type: 'REVIEW' });
                }}
              >
                {copy.review}
              </LbButton>
            </div>
          </>
        ) : null}

        {projection.state === 'reauth-preview' ? (
          <section aria-labelledby="preview-reauth-title">
            <h2 id="preview-reauth-title" tabIndex={-1}>
              {locale === 'pt-BR' ? 'Confirme seu acesso' : 'Confirm your access'}
            </h2>
            <p>{copy.reauthenticate}</p>
            <PreviewBoundary
              description={copy.boundary}
              title={locale === 'pt-BR' ? 'Verificação indisponível' : 'Verification unavailable'}
            />
            <div
              role="group"
              aria-label={locale === 'pt-BR' ? 'Reautenticação' : 'Reauthentication'}
            >
              <LbButton onPress={cancel} variant="quiet">
                {copy.cancel}
              </LbButton>
              <LbButton
                onPress={() => {
                  send({ type: 'REAUTHENTICATED' });
                }}
              >
                {actionPolicy.requiresReauthentication
                  ? locale === 'pt-BR'
                    ? 'Continuar sem verificar credencial'
                    : 'Continue without verifying a credential'
                  : locale === 'pt-BR'
                    ? 'Continuar revisão'
                    : 'Continue review'}
              </LbButton>
            </div>
          </section>
        ) : null}

        {projection.state === 'confirming' ? (
          <PreviewConfirmation
            confirmationValue={confirmationValue}
            context={snapshot.context}
            locale={locale}
            onCancel={cancel}
            onChangeConfirmation={setConfirmationValue}
            onConfirm={(confirmation) => {
              send({ confirmation, type: 'CONFIRM' });
            }}
          />
        ) : null}

        {projection.state === 'offline' ||
        projection.state === 'stale' ||
        projection.state === 'expired-session' ||
        projection.state === 'partial-failure' ? (
          <PreviewFailure
            context={snapshot.context}
            locale={locale}
            onCancel={cancel}
            onRecover={recover}
            projection={projection}
          />
        ) : null}

        {output !== null ? (
          <PreviewReceipt
            actionLabel={snapshot.context.action.objectLabel}
            locale={locale}
            output={output}
          />
        ) : null}
      </div>
      {footer}
    </section>
  );
};

export type { PreviewCancellationReceipt };
