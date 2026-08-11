import type {
  AdminInvitationDeliveryPort,
  InvitationDeliveryHandoff,
} from '@liiiraa/control-plane-application';

const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_TIMEOUT_MS = 8_000;
const DELIVERY_REJECTED = 'INVITATION_DELIVERY_REJECTED';

type DeliveryTransport = typeof fetch;

export interface ResendInvitationDeliveryInput {
  readonly accountOrigin: string;
  readonly apiKey: string;
  readonly from: string;
  readonly timeoutMs?: number;
  readonly transport?: DeliveryTransport;
}

const admittedOrigin = (value: string): string => {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.origin !== value ||
      url.pathname !== '/' ||
      url.username.length > 0 ||
      url.password.length > 0
    ) {
      throw new Error('invalid');
    }
    return value;
  } catch {
    throw new Error('INVITATION_DELIVERY_ACCOUNT_ORIGIN_REJECTED');
  }
};

const admittedConfiguration = (input: ResendInvitationDeliveryInput) => {
  if (!/^re_[A-Za-z0-9_-]{20,256}$/u.test(input.apiKey)) {
    throw new Error('INVITATION_DELIVERY_API_KEY_REJECTED');
  }
  if (
    !/^Liiiraa Boost <[a-z0-9._%+-]+@envios\.liiiraaboost\.com\.br>$/u.test(input.from)
  ) {
    throw new Error('INVITATION_DELIVERY_SENDER_REJECTED');
  }
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 15_000) {
    throw new Error('INVITATION_DELIVERY_TIMEOUT_REJECTED');
  }
  return Object.freeze({
    accountOrigin: admittedOrigin(input.accountOrigin),
    apiKey: input.apiKey,
    from: input.from,
    timeoutMs,
    transport: input.transport ?? fetch,
  });
};

const admittedRecipient = (recipient: string | undefined): string => {
  const value = recipient?.trim().toLowerCase();
  if (
    value === undefined ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
  ) {
    throw new Error('INVITATION_DELIVERY_RECIPIENT_UNAVAILABLE');
  }
  return value;
};

const invitationUrl = (
  accountOrigin: string,
  input: InvitationDeliveryHandoff,
): string => {
  const target = new URL(`/${input.locale}/register`, accountOrigin);
  target.searchParams.set('invitation', input.plaintextSecret);
  return target.toString();
};

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const message = (locale: InvitationDeliveryHandoff['locale'], url: string) => {
  if (locale === 'pt-BR') {
    return {
      html: `<div style="background:#050910;color:#f5f8ff;font-family:Arial,sans-serif;padding:40px"><div style="border:1px solid #244058;max-width:560px;margin:auto;padding:32px"><p style="color:#35d7ff;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Beta privado</p><h1 style="font-size:28px">Seu convite para a Liiiraa Boost</h1><p style="color:#aac0dc;line-height:1.6">Crie sua conta para acessar o aplicativo, seus dispositivos e os recursos liberados para testes.</p><p style="margin:32px 0"><a href="${escapeHtml(url)}" style="background:#2498ff;color:#00101f;padding:14px 22px;text-decoration:none">Criar minha conta</a></p><p style="color:#72849a;font-size:13px">Este link é pessoal. Não encaminhe esta mensagem.</p></div></div>`,
      subject: 'Seu convite para o beta privado da Liiiraa Boost',
      text: `Você recebeu um convite para o beta privado da Liiiraa Boost. Crie sua conta: ${url}\n\nEste link é pessoal. Não encaminhe esta mensagem.`,
    } as const;
  }
  return {
    html: `<div style="background:#050910;color:#f5f8ff;font-family:Arial,sans-serif;padding:40px"><div style="border:1px solid #244058;max-width:560px;margin:auto;padding:32px"><p style="color:#35d7ff;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Private beta</p><h1 style="font-size:28px">Your Liiiraa Boost invitation</h1><p style="color:#aac0dc;line-height:1.6">Create your account to access the app, your devices and the features released for testing.</p><p style="margin:32px 0"><a href="${escapeHtml(url)}" style="background:#2498ff;color:#00101f;padding:14px 22px;text-decoration:none">Create my account</a></p><p style="color:#72849a;font-size:13px">This link is personal. Do not forward this message.</p></div></div>`,
    subject: 'Your invitation to the Liiiraa Boost private beta',
    text: `You were invited to the Liiiraa Boost private beta. Create your account: ${url}\n\nThis link is personal. Do not forward this message.`,
  } as const;
};

const providerReference = async (response: Response): Promise<string> => {
  if (!response.ok) throw new Error(DELIVERY_REJECTED);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(DELIVERY_REJECTED);
  }
  const reference =
    typeof body === 'object' && body !== null && 'id' in body ? (body as { id?: unknown }).id : null;
  if (typeof reference !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/u.test(reference)) {
    throw new Error(DELIVERY_REJECTED);
  }
  return reference;
};

export const createResendInvitationDelivery = (
  input: ResendInvitationDeliveryInput,
): AdminInvitationDeliveryPort => {
  const configuration = admittedConfiguration(input);
  return Object.freeze({
    handoff: async (handoff: InvitationDeliveryHandoff) => {
      const recipient = admittedRecipient(handoff.recipient);
      const url = invitationUrl(configuration.accountOrigin, handoff);
      const content = message(handoff.locale, url);
      try {
        const response = await configuration.transport(RESEND_EMAILS_ENDPOINT, {
          body: JSON.stringify({
            from: configuration.from,
            html: content.html,
            subject: content.subject,
            text: content.text,
            to: [recipient],
          }),
          headers: {
            authorization: `Bearer ${configuration.apiKey}`,
            'content-type': 'application/json',
            'idempotency-key': handoff.idempotencyKey,
          },
          method: 'POST',
          signal: AbortSignal.timeout(configuration.timeoutMs),
        });
        return Object.freeze({ deliveryReference: await providerReference(response) });
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === 'INVITATION_DELIVERY_RECIPIENT_UNAVAILABLE'
        ) {
          throw error;
        }
        throw new Error(DELIVERY_REJECTED);
      }
    },
  });
};
