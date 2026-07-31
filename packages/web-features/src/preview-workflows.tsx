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
import { PreviewBoundary, ProvenanceLabel } from './components.tsx';

export type PreviewWorkflowLocale = 'en' | 'pt-BR';

const COPY = Object.freeze({
  en: Object.freeze({
    boundary: 'Deterministic preview — no remote authority is connected.',
    cancel: 'Cancel preview',
    cancelledBody:
      'The review was cancelled. Phase 4 authority was not contacted and no remote state changed.',
    cancelledTitle: 'Preview cancelled — no change was made',
    confirm: 'Confirm reviewed action',
    edit: 'Edit reviewed fields',
    expired:
      'The session preview expired. Explicitly safe draft fields remain available; review sign-in before continuing.',
    failure:
      'The Phase 4 authority boundary is unavailable. Explicitly safe draft fields remain available.',
    finishValidation: 'Validate reviewed fields',
    offline:
      'The authority boundary is offline. Explicitly safe draft fields remain available locally.',
    phase4: 'Required authority arrives in Phase 4.',
    progress: 'Preparing a deterministic no-change receipt.',
    reauthenticate:
      'Review simulated reauthentication. This preview does not verify a real credential.',
    receiptBody:
      'The review is complete. Required authority arrives in Phase 4; no remote state changed.',
    receiptTitle: 'Preview complete — no change was made',
    refresh: 'Refresh reviewed data',
    resume: 'Review sign-in preview',
    retry: 'Retry preview review',
    review: 'Review action boundary',
    stale:
      'The reviewed input is stale. Refresh it before confirmation; no ambiguous action is available.',
    validationTitle: 'Correct the reviewed fields',
  }),
  'pt-BR': Object.freeze({
    boundary: 'Prévia determinística — nenhuma autoridade remota está conectada.',
    cancel: 'Cancelar prévia',
    cancelledBody:
      'A revisão foi cancelada. A autoridade da Fase 4 não foi acionada e nenhum estado remoto foi alterado.',
    cancelledTitle: 'Prévia cancelada — nenhuma alteração foi feita',
    confirm: 'Confirmar ação revisada',
    edit: 'Editar campos revisados',
    expired:
      'A prévia da sessão expirou. Os campos explicitamente seguros permanecem disponíveis; revise a entrada antes de continuar.',
    failure:
      'O limite da autoridade da Fase 4 está indisponível. Os campos explicitamente seguros permanecem disponíveis.',
    finishValidation: 'Validar campos revisados',
    offline:
      'O limite da autoridade está offline. Os campos explicitamente seguros permanecem disponíveis localmente.',
    phase4: 'A autoridade necessária chega na Fase 4.',
    progress: 'Preparando um recibo determinístico sem alteração.',
    reauthenticate:
      'Revise a reautenticação simulada. Esta prévia não verifica uma credencial real.',
    receiptBody:
      'A revisão foi concluída. A autoridade necessária chega na Fase 4; nenhum estado remoto foi alterado.',
    receiptTitle: 'Prévia concluída — nenhuma alteração foi feita',
    refresh: 'Atualizar dados revisados',
    resume: 'Revisar prévia de entrada',
    retry: 'Tentar revisão da prévia novamente',
    review: 'Revisar limite da ação',
    stale:
      'A entrada revisada está desatualizada. Atualize-a antes da confirmação; nenhuma ação ambígua está disponível.',
    validationTitle: 'Corrija os campos revisados',
  }),
});

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
      {locale === 'pt-BR' ? 'Revisão antes da autoridade' : 'Review before authority'}
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
  const expected = context.confirmation.value[locale];
  const requiresPhrase = context.confirmation.kind === 'phrase';
  const confirmValue = requiresPhrase ? confirmationValue : expected;

  return (
    <section aria-labelledby="preview-confirmation-title" data-preview-region="confirmation">
      <h2 id="preview-confirmation-title" tabIndex={-1}>
        {locale === 'pt-BR' ? 'Confirmação proporcional' : 'Proportional confirmation'}
      </h2>
      <PreviewBoundary description={COPY[locale].boundary}>
        <p>{COPY[locale].phase4}</p>
      </PreviewBoundary>
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
      <div aria-label={locale === 'pt-BR' ? 'Ações da prévia' : 'Preview actions'} role="group">
        <LbButton onPress={onCancel} variant="quiet">
          {COPY[locale].cancel}
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
  const detail =
    projection.state === 'offline'
      ? COPY[locale].offline
      : projection.state === 'stale'
        ? COPY[locale].stale
        : projection.state === 'expired-session'
          ? COPY[locale].expired
          : COPY[locale].failure;
  const recoveryLabel =
    projection.state === 'stale'
      ? COPY[locale].refresh
      : projection.state === 'expired-session'
        ? COPY[locale].resume
        : COPY[locale].retry;

  return (
    <section
      aria-labelledby="preview-failure-title"
      aria-live="assertive"
      data-preview-region="failure"
      role="alert"
    >
      <h2 id="preview-failure-title" tabIndex={-1}>
        {locale === 'pt-BR' ? 'A prévia foi bloqueada com segurança' : 'Preview safely blocked'}
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
          {COPY[locale].cancel}
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

  return (
    <section
      aria-labelledby="preview-receipt-title"
      aria-live="polite"
      data-preview-region="receipt"
      data-remote-state-changed="false"
      tabIndex={-1}
    >
      <ProvenanceLabel kind="simulated" locale={locale} />
      <h2 id="preview-receipt-title">
        {cancelled ? COPY[locale].cancelledTitle : COPY[locale].receiptTitle}
      </h2>
      <p>{cancelled ? COPY[locale].cancelledBody : COPY[locale].receiptBody}</p>
      <dl>
        <div>
          <dt>{locale === 'pt-BR' ? 'Ação revisada' : 'Reviewed action'}</dt>
          <dd>{actionLabel}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Autoridade futura' : 'Future authority'}</dt>
          <dd>Phase 4</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Estado remoto alterado' : 'Remote state changed'}</dt>
          <dd>{locale === 'pt-BR' ? 'Não' : 'No'}</dd>
        </div>
        <div>
          <dt>{locale === 'pt-BR' ? 'Correlação' : 'Correlation'}</dt>
          <dd>
            <code>{correlationId}</code>
          </dd>
        </div>
      </dl>
      <ol
        aria-label={
          locale === 'pt-BR' ? 'Registro imutável sem alteração' : 'Immutable no-change ledger'
        }
        data-immutable="true"
      >
        <li>
          <time dateTime={receipt.reviewedAt}>{receipt.reviewedAt}</time>{' '}
          {cancelled
            ? locale === 'pt-BR'
              ? 'Prévia cancelada; nenhuma alteração remota.'
              : 'Preview cancelled; no remote change.'
            : locale === 'pt-BR'
              ? 'Revisão concluída; nenhuma alteração remota.'
              : 'Review complete; no remote change.'}
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
  const output = snapshot.status === 'done' ? snapshot.output : null;
  const statusCopy = useMemo(
    () =>
      projection.state === 'issuing'
        ? COPY[locale].progress
        : locale === 'pt-BR'
          ? `Estado da prévia: ${projection.state}`
          : `Preview state: ${projection.state}`,
    [locale, projection.state],
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
              ? `Prévia de ${snapshot.context.action.objectLabel}`
              : `${snapshot.context.action.objectLabel} preview`)}
        </h1>
        <ProvenanceLabel kind="simulated" locale={locale} />
      </header>
      <PreviewBoundary description={COPY[locale].boundary} />
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
              {COPY[locale].finishValidation}
            </LbButton>
          </>
        ) : null}

        {projection.state === 'validating' ? (
          <LbButton
            onPress={() => {
              send({ type: 'VALIDATION_PASSED' });
            }}
          >
            {COPY[locale].finishValidation}
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
              {COPY[locale].finishValidation}
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
                {COPY[locale].edit}
              </LbButton>
              <LbButton
                onPress={() => {
                  send({ type: 'REVIEW' });
                }}
              >
                {COPY[locale].review}
              </LbButton>
            </div>
          </>
        ) : null}

        {projection.state === 'reauth-preview' ? (
          <section aria-labelledby="preview-reauth-title">
            <h2 id="preview-reauth-title" tabIndex={-1}>
              {locale === 'pt-BR' ? 'Reautenticação simulada' : 'Simulated reauthentication'}
            </h2>
            <p>{COPY[locale].reauthenticate}</p>
            <PreviewBoundary description={COPY[locale].boundary} />
            <div
              role="group"
              aria-label={locale === 'pt-BR' ? 'Reautenticação' : 'Reauthentication'}
            >
              <LbButton onPress={cancel} variant="quiet">
                {COPY[locale].cancel}
              </LbButton>
              <LbButton
                onPress={() => {
                  send({ type: 'REAUTHENTICATED' });
                }}
              >
                {actionPolicy.requiresReauthentication
                  ? locale === 'pt-BR'
                    ? 'Concluir simulação de reautenticação'
                    : 'Complete reauthentication simulation'
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
