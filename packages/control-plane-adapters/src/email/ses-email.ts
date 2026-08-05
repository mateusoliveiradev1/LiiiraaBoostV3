import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import type {
  EmailDelivery,
  EmailDeliveryResult,
  EmailPort,
} from '@liiiraa/control-plane-application';
import { isAdmissibleEmailText } from '@liiiraa/control-plane-application';

export interface SesV2Transport {
  send(command: SendEmailCommand): Promise<Readonly<{ MessageId?: string }>>;
}

export interface SesSandboxEmailAdapterOptions {
  readonly sourceAddress: string;
  readonly transport: SesV2Transport;
  readonly verifiedInvitedRecipients: readonly string[];
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const idempotencyPattern = /^[A-Za-z0-9_-]{1,256}$/u;

const normalizeAddress = (address: string): string => address.trim().toLowerCase();

const rejected = (
  code: 'EMAIL_CONTENT_REJECTED' | 'EMAIL_RECIPIENT_NOT_VERIFIED',
): EmailDeliveryResult => ({ ok: false, code, retryable: false });

const providerFailure = (error: unknown): EmailDeliveryResult => {
  const name =
    typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
      ? error.name
      : '';
  if (name === 'BadRequestException' || name === 'MessageRejected') {
    return { ok: false, code: 'EMAIL_PROVIDER_REJECTED', retryable: false };
  }
  return { ok: false, code: 'EMAIL_PROVIDER_UNAVAILABLE', retryable: true };
};

const validDelivery = (delivery: EmailDelivery): boolean =>
  idempotencyPattern.test(delivery.idempotencyKey) &&
  emailPattern.test(delivery.recipient) &&
  isAdmissibleEmailText(delivery.subject, 120) &&
  isAdmissibleEmailText(delivery.text, 2_000);

export const createSesSandboxEmailAdapter = (options: SesSandboxEmailAdapterOptions): EmailPort => {
  const sourceAddress = normalizeAddress(options.sourceAddress);
  if (!emailPattern.test(sourceAddress)) throw new Error('ses-source-address-invalid');
  const admittedRecipients = new Set(options.verifiedInvitedRecipients.map(normalizeAddress));

  return {
    async send(delivery): Promise<EmailDeliveryResult> {
      if (!validDelivery(delivery)) return rejected('EMAIL_CONTENT_REJECTED');
      const recipient = normalizeAddress(delivery.recipient);
      if (!admittedRecipients.has(recipient)) return rejected('EMAIL_RECIPIENT_NOT_VERIFIED');

      try {
        const response = await options.transport.send(
          new SendEmailCommand({
            Content: {
              Simple: {
                Body: { Text: { Charset: 'UTF-8', Data: delivery.text } },
                Subject: { Charset: 'UTF-8', Data: delivery.subject },
              },
            },
            Destination: { ToAddresses: [recipient] },
            EmailTags: [{ Name: 'outbox-job-id', Value: delivery.idempotencyKey }],
            FromEmailAddress: sourceAddress,
          }),
        );
        if (response.MessageId === undefined || response.MessageId.length === 0) {
          return { ok: false, code: 'EMAIL_PROVIDER_UNAVAILABLE', retryable: true };
        }
        return { ok: true, receiptId: response.MessageId.slice(0, 256) };
      } catch (error) {
        return providerFailure(error);
      }
    },
  };
};
