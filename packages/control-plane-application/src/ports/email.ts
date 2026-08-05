export const EMAIL_NOTIFICATION_CLASSES = [
  'identity.recovery-hold',
  'identity.recovery-contested',
  'commerce.grace-started',
  'commerce.payment-retry',
  'commerce.pix-renewal-reminder',
  'commerce.price-change',
  'commerce.refund',
  'commerce.dispute',
  'identity.invitation',
  'support.case',
] as const;

export type EmailNotificationClass = (typeof EMAIL_NOTIFICATION_CLASSES)[number];
export type EmailNotificationLocale = 'en' | 'pt-BR';

export interface EmailNotification {
  readonly class: EmailNotificationClass;
  readonly locale: EmailNotificationLocale;
  readonly recipient: string;
  readonly values: Readonly<Record<string, string>>;
}

export interface EmailDelivery {
  readonly idempotencyKey: string;
  readonly recipient: string;
  readonly subject: string;
  readonly text: string;
}

export type EmailDeliveryFailureCode =
  | 'EMAIL_CONTENT_REJECTED'
  | 'EMAIL_PROVIDER_REJECTED'
  | 'EMAIL_PROVIDER_UNAVAILABLE'
  | 'EMAIL_RECIPIENT_NOT_VERIFIED';

export type EmailDeliveryResult =
  | Readonly<{ ok: true; receiptId: string }>
  | Readonly<{ ok: false; code: EmailDeliveryFailureCode; retryable: boolean }>;

export interface EmailPort {
  send(delivery: EmailDelivery): Promise<EmailDeliveryResult>;
}
