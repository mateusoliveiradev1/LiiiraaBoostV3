import { describe, expect, it, vi } from 'vitest';

import { createResendInvitationDelivery } from './resend-invitation-delivery.js';

const configuration = {
  accountOrigin: 'https://conta.liiiraaboost.com.br',
  apiKey: 're_staging_abcdefghijklmnopqrstuvwxyz0123456789',
  from: 'Liiiraa Boost <convites@envios.liiiraaboost.com.br>',
} as const;

const handoff = {
  campaign: 'uat-fase4-convites',
  idempotencyKey: 'invitation-issue-0001',
  invitationId: '00000000-0000-4000-8000-000000000041',
  locale: 'pt-BR' as const,
  plaintextSecret: 'secret-that-must-never-leak',
  recipient: 'owner+uat@example.com',
  recipientKey: 'a'.repeat(64),
};

describe('Resend invitation delivery', () => {
  it('hands one localized invitation to Resend with provider idempotency', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-provider-reference-01' }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );
    const delivery = createResendInvitationDelivery({ ...configuration, transport });

    await expect(delivery.handoff(handoff)).resolves.toEqual({
      deliveryReference: 'email-provider-reference-01',
    });

    expect(transport).toHaveBeenCalledTimes(1);
    const [url, request] = transport.mock.calls[0] ?? [];
    expect(url).toBe('https://api.resend.com/emails');
    expect(request).toMatchObject({ method: 'POST' });
    expect(new Headers(request?.headers).get('authorization')).toBe(
      `Bearer ${configuration.apiKey}`,
    );
    expect(new Headers(request?.headers).get('idempotency-key')).toBe(handoff.idempotencyKey);
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: configuration.from,
      subject: 'Seu convite para o beta privado da Liiiraa Boost',
      to: [handoff.recipient],
    });
    expect(String(body['text'])).toContain(
      `${configuration.accountOrigin}/pt-BR/register?invitation=${handoff.plaintextSecret}`,
    );
    expect(String(body['html'])).toContain('Beta privado');
    expect(String(body['text'])).toContain('Você recebeu um convite');
    expect(String(body['text'])).not.toContain('Ã');
  });

  it('fails closed with a bounded error when Resend rejects the handoff', async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({ message: `provider exposed ${handoff.recipient} ${handoff.plaintextSecret}` }),
        { status: 422 },
      ),
    );
    const delivery = createResendInvitationDelivery({ ...configuration, transport });

    const rejection = await delivery.handoff(handoff).catch((error: unknown) => String(error));

    expect(rejection).toContain('INVITATION_DELIVERY_REJECTED');
    expect(rejection).not.toContain(handoff.recipient);
    expect(rejection).not.toContain(handoff.plaintextSecret);
    expect(rejection).not.toContain(configuration.apiKey);
  });

  it('does not attempt delivery without the transient recipient address', async () => {
    const transport = vi.fn<typeof fetch>();
    const delivery = createResendInvitationDelivery({ ...configuration, transport });

    await expect(delivery.handoff({ ...handoff, recipient: undefined })).rejects.toThrow(
      'INVITATION_DELIVERY_RECIPIENT_UNAVAILABLE',
    );
    expect(transport).not.toHaveBeenCalled();
  });
});
