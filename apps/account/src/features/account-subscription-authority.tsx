'use client';

import { LbButton, ProductIcon } from '@liiiraa/design-system';
import type { WebLocale } from '@liiiraa/web-core';
import { useEffect, useMemo, useState } from 'react';

import {
  ACCOUNT_COMMERCE_PRICES,
  createAccountCommerce,
  subscriptionBillingKind,
  type CheckoutCadence,
  type CheckoutCurrency,
} from '../account-commerce';
import type { AccountAuthorityProjection } from '../account-authority';
import type { LiveAccountAuthority } from '../live-account-authority';

type CheckoutReturnState = 'cancelled' | 'none' | 'success';
type CommercePhase = 'checkout' | 'error' | 'idle' | 'portal';

const copy = Object.freeze({
  en: Object.freeze({
    annual: 'Annual',
    annualSaving: 'Save 28%',
    administrativePermanentActive: 'Permanent administrative Premium',
    billing: 'Billing cycle',
    brand: 'Liiiraa Boost Premium',
    cancelAtEnd: 'Cancellation scheduled for the end of the paid cycle.',
    cancelled: 'Checkout canceled. Nothing was charged and your current plan remains unchanged.',
    checkout: 'Continue to secure checkout',
    checkoutError: 'Checkout could not be opened. Your plan was not changed. Try again.',
    checkoutLoading: 'Opening secure checkout',
    connected: 'Managed securely by Stripe',
    currency: 'Currency',
    current: 'Current plan',
    currentPeriod: 'Access available through',
    essential: 'Essential',
    essentialBody: 'Your free plan remains active until Stripe confirms the Premium subscription.',
    manage: 'Manage billing in Stripe',
    monthly: 'Monthly',
    perMonth: '/month',
    perYear: '/year',
    permanentActive: 'Permanent Premium',
    permanentBody: 'Permanent access granted by Liiiraa Boost. No charge, renewal, or invoice.',
    permanentConnected: 'Granted by Liiiraa Boost · no billing',
    permanentStatus: 'permanent',
    portalError: 'The billing portal could not be opened. Try again in a moment.',
    portalLoading: 'Opening billing portal',
    premiumActive: 'Premium active',
    premiumBody: 'Your subscription is confirmed by Stripe and synchronized with this account.',
    secure: 'Encrypted payment · Cancel anytime · No Premium access before webhook confirmation',
    success: 'Payment completed. We are confirming the subscription with Stripe.',
    successActive: 'Payment confirmed. Liiiraa Boost Premium is active on your account.',
    title: 'Choose the pace that works for you',
  }),
  'pt-BR': Object.freeze({
    annual: 'Anual',
    annualSaving: 'Economize 30%',
    administrativePermanentActive: 'Premium administrativo permanente',
    billing: 'Ciclo de cobrança',
    brand: 'Liiiraa Boost Premium',
    cancelAtEnd: 'Cancelamento agendado para o fim do ciclo já pago.',
    cancelled: 'Checkout cancelado. Nada foi cobrado e seu plano atual continua igual.',
    checkout: 'Continuar para o checkout seguro',
    checkoutError: 'Não foi possível abrir o checkout. Seu plano não mudou. Tente novamente.',
    checkoutLoading: 'Abrindo checkout seguro',
    connected: 'Pagamento protegido pelo Stripe',
    currency: 'Moeda',
    current: 'Plano atual',
    currentPeriod: 'Acesso disponível até',
    essential: 'Essential',
    essentialBody: 'Seu plano gratuito continua ativo até o Stripe confirmar a assinatura Premium.',
    manage: 'Gerenciar cobrança no Stripe',
    monthly: 'Mensal',
    perMonth: '/mês',
    perYear: '/ano',
    permanentActive: 'Premium permanente',
    permanentBody:
      'Acesso permanente concedido pela Liiiraa Boost. Sem cobrança, renovação ou fatura.',
    permanentConnected: 'Concedido pela Liiiraa Boost · sem cobrança',
    permanentStatus: 'permanente',
    portalError: 'Não foi possível abrir o portal de cobrança. Tente novamente em instantes.',
    portalLoading: 'Abrindo portal de cobrança',
    premiumActive: 'Premium ativo',
    premiumBody: 'Sua assinatura foi confirmada pelo Stripe e sincronizada com esta conta.',
    secure: 'Pagamento criptografado · Cancele quando quiser · Premium somente após o webhook',
    success: 'Pagamento concluído. Estamos confirmando a assinatura com o Stripe.',
    successActive: 'Pagamento confirmado. O Liiiraa Boost Premium está ativo na sua conta.',
    title: 'Escolha o ritmo ideal para você',
  }),
});

const capabilities = Object.freeze({
  en: [
    'Hardware calibration and advanced optimizations',
    'Unlimited profiles with automatic game activation',
    'Advanced comparisons and personalized assistance',
    'Priority support with restoration always available',
  ],
  'pt-BR': [
    'Calibração por hardware e otimizações avançadas',
    'Perfis ilimitados com ativação automática por jogo',
    'Comparativos avançados e assistência personalizada',
    'Suporte prioritário com restauração sempre disponível',
  ],
} as const);

const formattedPrice = (
  currency: CheckoutCurrency,
  cadence: CheckoutCadence,
  locale: WebLocale,
): string =>
  new Intl.NumberFormat(locale, {
    currency,
    style: 'currency',
  }).format(ACCOUNT_COMMERCE_PRICES[currency][cadence] / 100);

const formattedDate = (value: string, locale: WebLocale): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(value));

export const AccountSubscriptionAuthority = ({
  authority,
  authorityBaseUrl,
  checkoutReturn: checkoutReturnOverride,
  locale,
  projection,
}: Readonly<{
  authority: LiveAccountAuthority;
  authorityBaseUrl: string;
  checkoutReturn?: CheckoutReturnState;
  locale: WebLocale;
  projection: AccountAuthorityProjection;
}>) => {
  const labels = copy[locale];
  const [cadence, setCadence] = useState<CheckoutCadence>('annual');
  const [currency, setCurrency] = useState<CheckoutCurrency>(locale === 'pt-BR' ? 'BRL' : 'USD');
  const [phase, setPhase] = useState<CommercePhase>('idle');
  const [checkoutReturn, setCheckoutReturn] = useState<CheckoutReturnState>(
    checkoutReturnOverride ?? 'none',
  );
  const commerce = useMemo(
    () => createAccountCommerce({ baseUrl: authorityBaseUrl }),
    [authorityBaseUrl],
  );
  const subscription = projection.subscription;
  const billingKind = subscriptionBillingKind(subscription);
  const premium = billingKind !== 'free';
  const administrativePremium =
    billingKind === 'permanent' && projection.account.administrativeRole !== undefined;

  useEffect(() => {
    if (checkoutReturnOverride !== undefined) {
      setCheckoutReturn(checkoutReturnOverride);
      return;
    }
    const value = new URLSearchParams(globalThis.location.search).get('checkout');
    setCheckoutReturn(value === 'success' || value === 'cancelled' ? value : 'none');
  }, [checkoutReturnOverride]);

  useEffect(() => {
    if (checkoutReturn === 'success') void authority.refresh();
  }, [authority, checkoutReturn]);

  const startCheckout = async () => {
    setPhase('checkout');
    const result = await commerce.startCheckout({
      cadence,
      currency,
      locale,
      subscription,
    });
    if (result.status === 'redirect') {
      globalThis.location.assign(result.url);
      return;
    }
    setPhase('error');
  };

  const openPortal = async () => {
    setPhase('portal');
    const result = await commerce.openPortal(locale);
    if (result.status === 'redirect') {
      globalThis.location.assign(result.url);
      return;
    }
    setPhase('error');
  };

  return (
    <section className="account-commerce" data-account-commerce="stripe-live">
      {checkoutReturn !== 'none' ? (
        <section
          className="account-commerce__return"
          data-return-state={checkoutReturn}
          role="status"
        >
          <ProductIcon name={checkoutReturn === 'success' ? 'check' : 'info'} size={22} />
          <div>
            <strong>
              {checkoutReturn === 'success'
                ? premium
                  ? labels.successActive
                  : labels.success
                : labels.cancelled}
            </strong>
            {checkoutReturn === 'success' && !premium ? <span>{labels.essentialBody}</span> : null}
          </div>
        </section>
      ) : null}

      <div className="account-commerce__current">
        <div>
          <span className="account-commerce__eyebrow">{labels.current}</span>
          <strong>
            {administrativePremium
              ? labels.administrativePermanentActive
              : billingKind === 'permanent'
                ? labels.permanentActive
                : billingKind === 'stripe'
                  ? labels.premiumActive
                  : labels.essential}
          </strong>
          <p>
            {billingKind === 'permanent'
              ? labels.permanentBody
              : billingKind === 'stripe'
                ? labels.premiumBody
                : labels.essentialBody}
          </p>
        </div>
        <span className="account-commerce__status" data-premium={premium || undefined}>
          <ProductIcon name={premium ? 'crown' : 'check'} size={18} />
          {billingKind === 'permanent' ? labels.permanentStatus : subscription.state}
        </span>
      </div>

      {billingKind === 'stripe' ? (
        <div className="account-commerce__manage">
          <dl>
            <div>
              <dt>{labels.brand}</dt>
              <dd>{labels.connected}</dd>
            </div>
            {subscription.currentPeriodEndsAt === undefined ? null : (
              <div>
                <dt>{labels.currentPeriod}</dt>
                <dd>{formattedDate(subscription.currentPeriodEndsAt, locale)}</dd>
              </div>
            )}
          </dl>
          {subscription.cancelAtPeriodEnd ? (
            <p className="account-commerce__notice">{labels.cancelAtEnd}</p>
          ) : null}
          <LbButton
            isLoading={phase === 'portal'}
            loadingLabel={labels.portalLoading}
            onPress={() => void openPortal()}
          >
            {labels.manage} <ProductIcon name="arrowRight" size={16} />
          </LbButton>
        </div>
      ) : billingKind === 'permanent' ? (
        <div className="account-commerce__manage account-commerce__manage--permanent">
          <dl>
            <div>
              <dt>
                {administrativePremium
                  ? labels.administrativePermanentActive
                  : labels.permanentActive}
              </dt>
              <dd>{labels.permanentConnected}</dd>
            </div>
          </dl>
          <p className="account-commerce__notice">{labels.permanentBody}</p>
        </div>
      ) : (
        <div className="account-commerce__offer">
          <div className="account-commerce__offer-copy">
            <span className="account-commerce__eyebrow">{labels.brand}</span>
            <h2>{labels.title}</h2>
            <ul>
              {capabilities[locale].map((capability) => (
                <li key={capability}>
                  <ProductIcon name="check" size={17} />
                  <span>{capability}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="account-commerce__purchase">
            <fieldset className="account-commerce__selector">
              <legend>{labels.billing}</legend>
              <div>
                <button
                  aria-pressed={cadence === 'monthly'}
                  onClick={() => {
                    setCadence('monthly');
                  }}
                  type="button"
                >
                  {labels.monthly}
                </button>
                <button
                  aria-pressed={cadence === 'annual'}
                  onClick={() => {
                    setCadence('annual');
                  }}
                  type="button"
                >
                  <span>{labels.annual}</span>
                  <small>{labels.annualSaving}</small>
                </button>
              </div>
            </fieldset>

            <fieldset className="account-commerce__selector account-commerce__selector--currency">
              <legend>{labels.currency}</legend>
              <div>
                {(['BRL', 'USD'] as const).map((value) => (
                  <button
                    aria-pressed={currency === value}
                    key={value}
                    onClick={() => {
                      setCurrency(value);
                    }}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="account-commerce__price" aria-live="polite">
              <strong>{formattedPrice(currency, cadence, locale)}</strong>
              <span>{cadence === 'annual' ? labels.perYear : labels.perMonth}</span>
            </div>

            <LbButton
              isLoading={phase === 'checkout'}
              loadingLabel={labels.checkoutLoading}
              onPress={() => void startCheckout()}
              variant="primary"
            >
              {labels.checkout} <ProductIcon name="arrowRight" size={16} />
            </LbButton>
            <p className="account-commerce__trust">
              <ProductIcon name="lock" size={16} />
              {labels.secure}
            </p>
          </div>
        </div>
      )}

      {phase === 'error' ? (
        <p className="account-commerce__error" role="alert">
          {billingKind === 'stripe' ? labels.portalError : labels.checkoutError}
        </p>
      ) : null}
    </section>
  );
};
