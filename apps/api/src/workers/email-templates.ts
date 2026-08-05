import {
  EMAIL_NOTIFICATION_CLASSES,
  type EmailNotification,
  type EmailNotificationClass,
  type EmailNotificationLocale,
} from '@liiiraa/control-plane-application';

export type RenderedEmailMessage = Readonly<{ subject: string; text: string }>;

export type EmailTemplateResult =
  | Readonly<{ ok: true; message: RenderedEmailMessage }>
  | Readonly<{ ok: false; code: 'EMAIL_CONTENT_REJECTED' }>;

interface TemplateDefinition {
  readonly keys: readonly string[];
  readonly subject: Readonly<Record<EmailNotificationLocale, string>>;
  readonly text: (
    locale: EmailNotificationLocale,
    values: Readonly<Record<string, string>>,
  ) => string;
}

const authorityNotice = (locale: EmailNotificationLocale): string =>
  locale === 'pt-BR'
    ? 'Consulte sua conta para ver o registro oficial e as ações disponíveis.'
    : 'Open your account to view the official record and available actions.';

const lines = (
  locale: EmailNotificationLocale,
  values: Readonly<Record<string, string>>,
  labels: Readonly<Record<string, readonly [string, string]>>,
): string =>
  Object.entries(labels)
    .map(([key, label]) => `${label[locale === 'pt-BR' ? 0 : 1]}: ${values[key] ?? ''}`)
    .join('\n');

const define = (
  keys: readonly string[],
  subjectPtBr: string,
  subjectEn: string,
  labels: Readonly<Record<string, readonly [string, string]>>,
): TemplateDefinition => ({
  keys,
  subject: { en: subjectEn, 'pt-BR': subjectPtBr },
  text: (locale, values) => `${lines(locale, values, labels)}\n\n${authorityNotice(locale)}`,
});

const TEMPLATES = {
  'identity.recovery-hold': define(
    ['holdUntil', 'recoveryReference'],
    'Recuperação de conta em período de proteção',
    'Account recovery protection period',
    {
      holdUntil: ['Proteção até', 'Protected until'],
      recoveryReference: ['Referência da recuperação', 'Recovery reference'],
    },
  ),
  'identity.recovery-contested': define(
    ['recoveryReference'],
    'Recuperação de conta contestada',
    'Account recovery contested',
    { recoveryReference: ['Referência da recuperação', 'Recovery reference'] },
  ),
  'commerce.grace-started': define(
    ['graceEndsAt', 'subscriptionReference'],
    'Período de tolerância iniciado',
    'Grace period started',
    {
      graceEndsAt: ['Tolerância até', 'Grace period ends'],
      subscriptionReference: ['Referência da assinatura', 'Subscription reference'],
    },
  ),
  'commerce.payment-retry': define(
    ['nextAttemptAt', 'subscriptionReference'],
    'Nova tentativa de pagamento programada',
    'Payment retry scheduled',
    {
      nextAttemptAt: ['Próxima tentativa', 'Next attempt'],
      subscriptionReference: ['Referência da assinatura', 'Subscription reference'],
    },
  ),
  'commerce.pix-renewal-reminder': define(
    ['renewalAt', 'subscriptionReference'],
    'Renovação anual via Pix requer uma nova autorização',
    'Annual Pix renewal requires a new authorization',
    {
      renewalAt: ['Data de renovação', 'Renewal date'],
      subscriptionReference: ['Referência da assinatura', 'Subscription reference'],
    },
  ),
  'commerce.price-change': define(
    ['currentPrice', 'effectiveAt', 'newPrice', 'subscriptionReference'],
    'Aviso de alteração de preço na próxima renovação',
    'Price change notice for your next renewal',
    {
      currentPrice: ['Preço atual', 'Current price'],
      effectiveAt: ['Válido a partir de', 'Effective at'],
      newPrice: ['Novo preço', 'New price'],
      subscriptionReference: ['Referência da assinatura', 'Subscription reference'],
    },
  ),
  'commerce.refund': define(
    ['commerceReference', 'status'],
    'Atualização sobre seu reembolso',
    'Refund update',
    {
      commerceReference: ['Referência comercial', 'Commerce reference'],
      status: ['Estado', 'Status'],
    },
  ),
  'commerce.dispute': define(
    ['commerceReference', 'status'],
    'Atualização sobre contestação de pagamento',
    'Payment dispute update',
    {
      commerceReference: ['Referência comercial', 'Commerce reference'],
      status: ['Estado', 'Status'],
    },
  ),
  'identity.invitation': define(
    ['expiresAt', 'invitationReference'],
    'Seu convite para o Liiiraa Boost',
    'Your Liiiraa Boost invitation',
    {
      expiresAt: ['Expira em', 'Expires at'],
      invitationReference: ['Referência do convite', 'Invitation reference'],
    },
  ),
  'support.case': define(
    ['caseReference', 'responseTarget', 'status'],
    'Atualização do seu caso de suporte',
    'Support case update',
    {
      caseReference: ['Referência do caso', 'Case reference'],
      responseTarget: ['Previsão de resposta', 'Response target'],
      status: ['Estado', 'Status'],
    },
  ),
} as const satisfies Readonly<Record<EmailNotificationClass, TemplateDefinition>>;

const classes = new Set<string>(EMAIL_NOTIFICATION_CLASSES);
const locales = new Set<string>(['en', 'pt-BR']);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const sensitivePattern =
  /(?:bearer\s+|secret|access[_ -]?token|refresh[_ -]?token|password|private[_ -]?key|diagnostic[_ -]?(?:data|content)|provider[_ -]?payload|eyJ[A-Za-z0-9_-]{10,}\.)/iu;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNotification = (value: unknown): value is EmailNotification => {
  if (!isRecord(value)) return false;
  if (typeof value['class'] !== 'string' || !classes.has(value['class'])) return false;
  if (typeof value['locale'] !== 'string' || !locales.has(value['locale'])) return false;
  if (
    typeof value['recipient'] !== 'string' ||
    value['recipient'].length > 254 ||
    !emailPattern.test(value['recipient'])
  ) {
    return false;
  }
  if (!isRecord(value['values'])) return false;
  const definition = TEMPLATES[value['class'] as EmailNotificationClass];
  const entries = Object.entries(value['values']);
  if (
    entries.length !== definition.keys.length ||
    entries.some(([key]) => !definition.keys.includes(key))
  ) {
    return false;
  }
  return entries.every(
    ([, entry]) =>
      typeof entry === 'string' &&
      entry.length > 0 &&
      entry.length <= 160 &&
      !sensitivePattern.test(entry),
  );
};

export const renderEmailNotification = (notification: unknown): EmailTemplateResult => {
  if (!isNotification(notification)) return { ok: false, code: 'EMAIL_CONTENT_REJECTED' };
  const definition = TEMPLATES[notification.class];
  const message = {
    subject: definition.subject[notification.locale],
    text: definition.text(notification.locale, notification.values),
  };
  if (
    message.subject.length === 0 ||
    message.subject.length > 120 ||
    message.text.length === 0 ||
    message.text.length > 2_000 ||
    sensitivePattern.test(message.subject) ||
    sensitivePattern.test(message.text)
  ) {
    return { ok: false, code: 'EMAIL_CONTENT_REJECTED' };
  }
  return { ok: true, message };
};
