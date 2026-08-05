'use client';

import { LbButton, LbCheckbox, LbTextField, ProductIcon } from '@liiiraa/design-system';
import { routeHref, type WebLocale } from '@liiiraa/web-core';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import accountEn from '../content/account.en.json';
import accountPtBr from '../content/account.pt-BR.json';
import {
  admitInvitationToken,
  createAccountAuth,
  type AccountAuthActor,
  type AccountAuthResult,
} from '../account-auth';

export type AccountAuthRoute = 'account-sign-in' | 'account-sign-up';

type AccountAuthPageProps = Readonly<{
  authorityBaseUrl: string;
  locale: WebLocale;
  routeId: AccountAuthRoute;
}>;

type SignInFormProps = Readonly<{
  authorityBaseUrl: string;
  locale: WebLocale;
  signOutRequested?: boolean | undefined;
}>;

type SignUpFormProps = Readonly<{
  authorityBaseUrl: string;
  invitationToken?: string | undefined;
  locale: WebLocale;
}>;

const contentByLocale = { en: accountEn, 'pt-BR': accountPtBr } as const;
const messages = Object.freeze({
  en: Object.freeze({
    authenticationFailed: 'We could not confirm those details. Check them and try again.',
    invitationAccepted: 'Invitation recognized. Create the account using the invited email.',
    invitationMissing: 'Open the complete invitation link to create this account.',
    password: 'Password',
    signIn: 'Sign in securely',
    signedOut: 'You are signed out. No account data remains on this page.',
    signingIn: 'Signing in',
    signingOut: 'Signing out',
    signingUp: 'Creating account',
    unavailable: 'Authentication is temporarily unavailable. Try again in a moment.',
  }),
  'pt-BR': Object.freeze({
    authenticationFailed: 'Não foi possível confirmar esses dados. Revise e tente novamente.',
    invitationAccepted: 'Convite reconhecido. Crie a conta com o e-mail convidado.',
    invitationMissing: 'Abra o link completo do convite para criar esta conta.',
    password: 'Senha',
    signIn: 'Entrar com segurança',
    signedOut: 'Você saiu da conta. Nenhum dado da conta permanece nesta página.',
    signingIn: 'Entrando',
    signingOut: 'Saindo',
    signingUp: 'Criando conta',
    unavailable: 'A autenticação está temporariamente indisponível. Tente novamente em instantes.',
  }),
});

const correlationId = (): string => `account-auth-${globalThis.crypto.randomUUID()}`;
const validEmail = (value: string): boolean =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
const validPassword = (value: string): boolean =>
  value.length >= 10 &&
  value.length <= 128 &&
  /[A-Z]/u.test(value) &&
  /[a-z]/u.test(value) &&
  /[0-9]/u.test(value);

const hrefFor = (routeId: 'account-overview' | AccountAuthRoute, locale: WebLocale): string => {
  const href = routeHref(routeId, { locale });
  if (!href.ok) throw new Error(`ACCOUNT_AUTH_ROUTE_UNAVAILABLE:${routeId}`);
  return href.value;
};

const errorMessage = (
  result: Extract<AccountAuthResult, { status: 'error' }>,
  locale: WebLocale,
): string =>
  result.code === 'authentication-failed'
    ? messages[locale].authenticationFailed
    : messages[locale].unavailable;

const AuthHeader = ({
  locale,
  routeId,
}: Readonly<{ locale: WebLocale; routeId: AccountAuthRoute }>) => {
  const content = contentByLocale[locale];
  const route = routeId === 'account-sign-in' ? content.signIn : content.signUp;
  return (
    <header className="lb-web-route-header">
      <h1>{route.title}</h1>
      <p>{route.summary}</p>
    </header>
  );
};

const SignInForm = ({ authorityBaseUrl, locale, signOutRequested = false }: SignInFormProps) => {
  const content = contentByLocale[locale];
  const labels = messages[locale];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(signOutRequested);
  const auth = useMemo(
    () => createAccountAuth({ baseUrl: authorityBaseUrl, correlationId }),
    [authorityBaseUrl],
  );

  useEffect(() => {
    if (!signOutRequested) return;
    let active = true;
    void auth.signOut().then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.status === 'signed-out') {
        setNotice(labels.signedOut);
      } else {
        setError(labels.unavailable);
      }
    });
    return () => {
      active = false;
    };
  }, [auth, labels.signedOut, labels.unavailable, signOutRequested]);

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!validEmail(email) || !validPassword(password)) {
      setError(labels.authenticationFailed);
      return;
    }
    setError(null);
    setLoading(true);
    const result = await auth.signIn({ email: email.trim().toLowerCase(), password });
    if (result.status === 'authenticated') {
      globalThis.location.assign(hrefFor('account-overview', locale));
      return;
    }
    setLoading(false);
    setError(errorMessage(result, locale));
  };

  return (
    <article className="lb-web-sign-in" data-account-state="sign-in-real">
      <AuthHeader locale={locale} routeId="account-sign-in" />
      <form noValidate onSubmit={(event) => void submit(event)}>
        {error === null ? null : (
          <div className="account-auth-errors" role="alert" tabIndex={-1}>
            {error}
          </div>
        )}
        {notice === null ? null : <p role="status">{notice}</p>}
        <LbTextField
          description={content.signIn.emailHint}
          inputType="email"
          isDisabled={loading}
          isRequired
          label={content.signIn.emailLabel}
          maxLength={254}
          name="email"
          onChange={setEmail}
          value={email}
        />
        <LbTextField
          inputType="password"
          isDisabled={loading}
          isRequired
          label={labels.password}
          maxLength={128}
          name="password"
          onChange={setPassword}
          value={password}
        />
        <LbButton
          isDisabled={loading}
          isLoading={loading}
          loadingLabel={signOutRequested ? labels.signingOut : labels.signingIn}
          type="submit"
          variant="primary"
        >
          {labels.signIn}
        </LbButton>
      </form>
      <p className="account-auth-switch">
        <span>{content.signUp.entryPrompt}</span>{' '}
        <a href={hrefFor('account-sign-up', locale)}>{content.signUp.entryAction}</a>
      </p>
      <p className="account-auth-security" role="note">
        <ProductIcon name="lock" size={16} />
        <span>{content.signIn.security}</span>
      </p>
    </article>
  );
};

type SignUpField = 'confirmation' | 'consent' | 'email' | 'invitation' | 'name' | 'password';

const SignUpForm = ({
  authorityBaseUrl,
  invitationToken: invitationCandidate,
  locale,
}: SignUpFormProps) => {
  const content = contentByLocale[locale];
  const labels = messages[locale];
  const invitationToken = admitInvitationToken(invitationCandidate);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SignUpField, string>>>({});
  const [loading, setLoading] = useState(false);
  const auth = useMemo(
    () => createAccountAuth({ baseUrl: authorityBaseUrl, correlationId }),
    [authorityBaseUrl],
  );

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Partial<Record<SignUpField, string>> = {};
    if (displayName.trim().length < 2) nextErrors.name = content.signUp.invalidName;
    if (!validEmail(email)) nextErrors.email = content.signUp.invalidEmail;
    if (!validPassword(password)) nextErrors.password = content.signUp.invalidPassword;
    if (password !== confirmation) nextErrors.confirmation = content.signUp.invalidConfirmation;
    if (!consent) nextErrors.consent = content.signUp.invalidConsent;
    if (invitationToken === null) nextErrors.invitation = labels.invitationMissing;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || invitationToken === null) return;
    setLoading(true);
    const result = await auth.signUp({
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      invitationToken,
      locale,
      password,
    });
    if (result.status === 'authenticated') {
      globalThis.location.assign(hrefFor('account-overview', locale));
      return;
    }
    setLoading(false);
    setErrors({ invitation: errorMessage(result, locale) });
  };

  const errorMessages = Object.values(errors);
  return (
    <article className="lb-web-sign-up" data-account-state="sign-up-real">
      <AuthHeader locale={locale} routeId="account-sign-up" />
      <form noValidate onSubmit={(event) => void submit(event)}>
        <p className="account-auth-invitation" data-valid={invitationToken !== null} role="status">
          {invitationToken === null ? labels.invitationMissing : labels.invitationAccepted}
        </p>
        {errorMessages.length === 0 ? null : (
          <div className="account-auth-errors" role="alert" tabIndex={-1}>
            <strong>
              {locale === 'pt-BR'
                ? 'Revise os dados para continuar'
                : 'Review your details to continue'}
            </strong>
            <ul>
              {errorMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        <LbTextField
          description={content.signUp.nameHint}
          errorMessage={errors.name}
          isDisabled={loading}
          isInvalid={errors.name !== undefined}
          isRequired
          label={content.signUp.nameLabel}
          maxLength={80}
          name="displayName"
          onChange={setDisplayName}
          value={displayName}
        />
        <LbTextField
          description={content.signUp.emailHint}
          errorMessage={errors.email}
          inputType="email"
          isDisabled={loading}
          isInvalid={errors.email !== undefined}
          isRequired
          label={content.signUp.emailLabel}
          maxLength={254}
          name="email"
          onChange={setEmail}
          value={email}
        />
        <div className="account-auth-passwords">
          <LbTextField
            description={content.signUp.passwordHint}
            errorMessage={errors.password}
            inputType="password"
            isDisabled={loading}
            isInvalid={errors.password !== undefined}
            isRequired
            label={content.signUp.passwordLabel}
            maxLength={128}
            name="password"
            onChange={setPassword}
            value={password}
          />
          <LbTextField
            errorMessage={errors.confirmation}
            inputType="password"
            isDisabled={loading}
            isInvalid={errors.confirmation !== undefined}
            isRequired
            label={content.signUp.confirmLabel}
            maxLength={128}
            name="passwordConfirmation"
            onChange={setConfirmation}
            value={confirmation}
          />
        </div>
        <div className="account-auth-consent">
          <LbCheckbox isSelected={consent} onChange={setConsent} value="terms">
            {content.signUp.consentLabel}
          </LbCheckbox>
          {errors.consent === undefined ? null : <p role="status">{errors.consent}</p>}
        </div>
        <LbButton
          isDisabled={loading || invitationToken === null}
          isLoading={loading}
          loadingLabel={labels.signingUp}
          type="submit"
          variant="primary"
        >
          {content.signUp.action}
        </LbButton>
      </form>
      <p className="account-auth-switch">
        <span>{content.signUp.signInPrompt}</span>{' '}
        <a href={hrefFor('account-sign-in', locale)}>{content.signUp.signInAction}</a>
      </p>
      <p className="account-auth-security" role="note">
        <ProductIcon name="lock" size={16} />
        <span>{content.signUp.security}</span>
      </p>
    </article>
  );
};

export const AccountAuthPage = (props: AccountAuthPageProps) => {
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get('invite') ?? searchParams.get('invitation') ?? undefined;
  const signOutRequested = searchParams.get('action') === 'sign-out';
  return props.routeId === 'account-sign-in' ? (
    <SignInForm
      authorityBaseUrl={props.authorityBaseUrl}
      locale={props.locale}
      signOutRequested={signOutRequested}
    />
  ) : (
    <SignUpForm
      authorityBaseUrl={props.authorityBaseUrl}
      invitationToken={invitationToken}
      locale={props.locale}
    />
  );
};

const initials = (actor: AccountAuthActor): string =>
  actor.displayName
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase(actor.locale) ?? '')
    .join('') || 'LB';

export const AccountIdentityChrome = ({
  authorityBaseUrl,
  locale,
}: Readonly<{ authorityBaseUrl: string; locale: WebLocale }>) => {
  const [actor, setActor] = useState<AccountAuthActor | null>(null);
  const [settled, setSettled] = useState(false);
  const auth = useMemo(
    () => createAccountAuth({ baseUrl: authorityBaseUrl, correlationId }),
    [authorityBaseUrl],
  );
  useEffect(() => {
    let active = true;
    void auth.session().then((result) => {
      if (!active) return;
      if (result.status === 'authenticated') setActor(result.actor);
      setSettled(true);
    });
    return () => {
      active = false;
    };
  }, [auth]);

  return (
    <>
      <span aria-hidden="true" className="account-identity__avatar">
        {actor === null ? 'LB' : initials(actor)}
      </span>
      <span className="account-identity__copy">
        <strong>
          {actor?.displayName ??
            (settled
              ? locale === 'pt-BR'
                ? 'Sessão necessária'
                : 'Session required'
              : locale === 'pt-BR'
                ? 'Carregando conta'
                : 'Loading account')}
        </strong>
        <span>
          {actor?.email ??
            (locale === 'pt-BR' ? 'Entre para ver sua conta' : 'Sign in to view your account')}
        </span>
      </span>
    </>
  );
};
