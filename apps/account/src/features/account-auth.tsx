'use client';

import { LbButton, LbCheckbox, LbTextField, ProductIcon } from '@liiiraa/design-system';
import { routeHref, type WebLocale } from '@liiiraa/web-core';
import type { Route } from 'next';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type SyntheticEvent } from 'react';

import accountEn from '../content/account.en.json';
import accountPtBr from '../content/account.pt-BR.json';
import {
  admitInvitationToken,
  createAccountAuth,
  type AccountAuthActor,
  type AccountAuthResult,
} from '../account-auth';
import { getLiveAccountAuthority } from '../live-account-authority';

export type AccountAuthRoute = 'account-sign-in' | 'account-sign-up';

type AccountAuthPageProps = Readonly<{
  authorityBaseUrl: string;
  locale: WebLocale;
  routeId: AccountAuthRoute;
}>;

type SignInFormProps = Readonly<{
  authorityBaseUrl: string;
  desktopAuthorization?: Readonly<{ challengeId: string; state: string }> | undefined;
  locale: WebLocale;
  signOutRequested?: boolean | undefined;
}>;

type SignUpFormProps = Readonly<{
  authorityBaseUrl: string;
  desktopAuthorization?: Readonly<{ challengeId: string; state: string }> | undefined;
  invitationToken?: string | undefined;
  locale: WebLocale;
}>;

type PasswordRequirement = Readonly<{
  label: string;
  met: boolean;
}>;

const contentByLocale = { en: accountEn, 'pt-BR': accountPtBr } as const;
const DESKTOP_ACCOUNT_DEEP_LINK = 'liiiraa-boost://goal/account';
const messages = Object.freeze({
  en: Object.freeze({
    authenticationFailed: 'We could not confirm those details. Check them and try again.',
    browserApproval: 'Confirming this desktop sign-in in your browser…',
    invitationAccepted: 'Invitation recognized. Create the account using the invited email.',
    invitationMissing: 'This private beta requires an individual invitation.',
    invitationSteps: [
      'Receive an individual invitation at the email selected for the beta.',
      'Open the protected link before it expires.',
      'Create the account using that same invited email.',
    ],
    closedBeta: 'Closed beta',
    closedBetaTitle: 'Account creation is available by invitation',
    closedBetaBody:
      'There is no public or reusable registration link. Each invitation belongs to one person, expires, and can be used once.',
    hidePassword: 'Hide password',
    showPassword: 'Show password',
    adminAccess: 'Open administrative panel',
    adminScope: 'Your account stays here. Administration opens in a separate protected session.',
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
    browserApproval: 'Confirmando este login do desktop no navegador…',
    invitationAccepted: 'Convite reconhecido. Crie a conta com o e-mail convidado.',
    invitationMissing: 'Este beta fechado exige um convite individual.',
    invitationSteps: [
      'Receba um convite individual no e-mail escolhido para o beta.',
      'Abra o link protegido antes que ele expire.',
      'Crie a conta usando o mesmo e-mail convidado.',
    ],
    closedBeta: 'Beta fechado',
    closedBetaTitle: 'A criação de conta funciona por convite',
    closedBetaBody:
      'Não existe um cadastro público ou um link reutilizável. Cada convite pertence a uma pessoa, expira e só pode ser usado uma vez.',
    hidePassword: 'Ocultar senha',
    showPassword: 'Mostrar senha',
    adminAccess: 'Abrir painel administrativo',
    adminScope: 'Sua conta continua aqui. A administração abre em uma sessão protegida separada.',
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

const passwordRequirements = (value: string, locale: WebLocale): readonly PasswordRequirement[] =>
  Object.freeze([
    {
      label: locale === 'pt-BR' ? '10 a 128 caracteres' : '10 to 128 characters',
      met: value.length >= 10 && value.length <= 128,
    },
    {
      label: locale === 'pt-BR' ? 'Uma letra maiúscula' : 'One uppercase letter',
      met: /[A-Z]/u.test(value),
    },
    {
      label: locale === 'pt-BR' ? 'Uma letra minúscula' : 'One lowercase letter',
      met: /[a-z]/u.test(value),
    },
    {
      label: locale === 'pt-BR' ? 'Um número' : 'One number',
      met: /[0-9]/u.test(value),
    },
  ]);

const hrefFor = (routeId: 'account-overview' | AccountAuthRoute, locale: WebLocale): string => {
  const href = routeHref(routeId, { locale });
  if (!href.ok) throw new Error(`ACCOUNT_AUTH_ROUTE_UNAVAILABLE:${routeId}`);
  return href.value;
};

const authHrefWithDesktopAuthorization = (
  routeId: AccountAuthRoute,
  locale: WebLocale,
  desktopAuthorization: SignInFormProps['desktopAuthorization'],
): string => {
  const href = hrefFor(routeId, locale);
  if (desktopAuthorization === undefined) return href;
  const params = new URLSearchParams({
    desktop_challenge: desktopAuthorization.challengeId,
    state: desktopAuthorization.state,
  });
  return `${href}?${params.toString()}`;
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

const AuthSuccess = ({
  destinationUrl,
  desktopHandoff,
  locale,
}: Readonly<{ destinationUrl: string; desktopHandoff: boolean; locale: WebLocale }>) => {
  const portalHref = hrefFor('account-overview', locale);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      globalThis.location.assign(destinationUrl);
    }, 900);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [destinationUrl]);

  return (
    <article className="account-auth-success" data-account-state="authentication-success">
      <span aria-hidden="true" className="account-auth-success__mark">
        <ProductIcon name="check" size={28} />
      </span>
      <div>
        <p className="account-auth-success__status" role="status">
          {locale === 'pt-BR' ? 'Conta confirmada com segurança' : 'Account securely confirmed'}
        </p>
        <h1>
          {desktopHandoff
            ? locale === 'pt-BR'
              ? 'Tudo pronto. Voltando ao aplicativo.'
              : 'Everything is ready. Returning to the app.'
            : locale === 'pt-BR'
              ? 'Sua conta está pronta.'
              : 'Your account is ready.'}
        </h1>
        <p>
          {desktopHandoff
            ? locale === 'pt-BR'
              ? 'O Liiiraa Boost será aberto automaticamente já autenticado. Se nada acontecer, use o botão abaixo.'
              : 'Liiiraa Boost will open automatically already signed in. If nothing happens, use the button below.'
            : locale === 'pt-BR'
              ? 'Você já pode continuar no portal ou abrir o aplicativo instalado neste computador.'
              : 'You can continue to the portal or open the app installed on this computer.'}
        </p>
      </div>
      <div className="account-auth-success__actions">
        <a className="account-auth-success__primary" href={destinationUrl}>
          <ProductIcon name="monitor" size={17} />
          {locale === 'pt-BR' ? 'Abrir aplicativo' : 'Open app'}
        </a>
        <Link className="account-auth-success__secondary" href={portalHref as Route}>
          {locale === 'pt-BR' ? 'Continuar no portal' : 'Continue to portal'}
        </Link>
      </div>
      <p className="account-auth-success__security" role="note">
        <ProductIcon name="lock" size={15} />
        {locale === 'pt-BR'
          ? 'Sua senha nunca é enviada ao aplicativo.'
          : 'Your password is never sent to the app.'}
      </p>
    </article>
  );
};

const SignInForm = ({
  authorityBaseUrl,
  desktopAuthorization,
  locale,
  signOutRequested = false,
}: SignInFormProps) => {
  const content = contentByLocale[locale];
  const labels = messages[locale];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [successDestination, setSuccessDestination] = useState<string | null>(null);
  const [loading, setLoading] = useState(signOutRequested);
  const auth = useMemo(
    () => createAccountAuth({ baseUrl: authorityBaseUrl, correlationId }),
    [authorityBaseUrl],
  );

  const finishAuthentication = useCallback(async () => {
    if (desktopAuthorization === undefined) {
      globalThis.location.assign(hrefFor('account-overview', locale));
      return;
    }
    setNotice(labels.browserApproval);
    const approval = await auth.approveDesktopAuthorization(desktopAuthorization);
    if (approval.status === 'approved') {
      setSuccessDestination(approval.callbackUrl);
      return;
    }
    setLoading(false);
    setNotice(null);
    setError(errorMessage(approval, locale));
  }, [auth, desktopAuthorization, labels.browserApproval, locale]);

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

  useEffect(() => {
    if (desktopAuthorization === undefined || signOutRequested) return;
    let active = true;
    setLoading(true);
    setNotice(labels.browserApproval);
    void auth.session().then((result) => {
      if (!active) return;
      if (result.status === 'authenticated') {
        void finishAuthentication();
        return;
      }
      setLoading(false);
      setNotice(null);
    });
    return () => {
      active = false;
    };
  }, [auth, desktopAuthorization, finishAuthentication, labels.browserApproval, signOutRequested]);

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
      await finishAuthentication();
      return;
    }
    setLoading(false);
    setError(errorMessage(result, locale));
  };

  if (successDestination !== null) {
    return (
      <AuthSuccess
        destinationUrl={successDestination}
        desktopHandoff={desktopAuthorization !== undefined}
        locale={locale}
      />
    );
  }

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
        <div className="account-password-field">
          <LbTextField
            inputType={passwordVisible ? 'text' : 'password'}
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
            onPress={() => {
              setPasswordVisible((visible) => !visible);
            }}
            type="button"
            variant="quiet"
          >
            {passwordVisible ? labels.hidePassword : labels.showPassword}
          </LbButton>
        </div>
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
        <span>{locale === 'pt-BR' ? 'Ainda não tem acesso?' : 'Do not have access yet?'}</span>{' '}
        <Link
          href={
            authHrefWithDesktopAuthorization(
              'account-sign-up',
              locale,
              desktopAuthorization,
            ) as Route
          }
        >
          {locale === 'pt-BR' ? 'Entenda o beta por convite' : 'Learn about invitation access'}
        </Link>
      </p>
      <p className="account-auth-security" role="note">
        <ProductIcon name="lock" size={16} />
        <span>{content.signIn.security}</span>
      </p>
    </article>
  );
};

type SignUpField = 'confirmation' | 'consent' | 'email' | 'invitation' | 'name' | 'password';

const withFieldError = (
  current: Partial<Record<SignUpField, string>>,
  field: SignUpField,
  message: string | undefined,
): Partial<Record<SignUpField, string>> => {
  if (message !== undefined) return { ...current, [field]: message };
  return Object.fromEntries(Object.entries(current).filter(([key]) => key !== field));
};

const SignUpForm = ({
  authorityBaseUrl,
  desktopAuthorization,
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
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<SignUpField, string>>>({});
  const [loading, setLoading] = useState(false);
  const [successDestination, setSuccessDestination] = useState<string | null>(null);
  const auth = useMemo(
    () => createAccountAuth({ baseUrl: authorityBaseUrl, correlationId }),
    [authorityBaseUrl],
  );
  const requirements = passwordRequirements(password, locale);

  if (invitationToken === null) {
    return (
      <article className="account-invitation-required" data-account-state="invitation-required">
        <div className="account-invitation-required__body">
          <span className="account-invitation-required__status">
            <ProductIcon name="lock" size={16} />
            {labels.closedBeta}
          </span>
          <h1>{labels.closedBetaTitle}</h1>
          <p>{labels.closedBetaBody}</p>
          <ol>
            {labels.invitationSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="account-invitation-required__notice" role="note">
            {labels.invitationMissing}
          </p>
        </div>
        <p className="account-auth-switch">
          <span>{content.signUp.signInPrompt}</span>{' '}
          <Link
            href={
              authHrefWithDesktopAuthorization(
                'account-sign-in',
                locale,
                desktopAuthorization,
              ) as Route
            }
          >
            {content.signUp.signInAction}
          </Link>
        </p>
      </article>
    );
  }

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Partial<Record<SignUpField, string>> = {};
    if (displayName.trim().length < 2) nextErrors.name = content.signUp.invalidName;
    if (!validEmail(email)) nextErrors.email = content.signUp.invalidEmail;
    if (!validPassword(password)) nextErrors.password = content.signUp.invalidPassword;
    if (password !== confirmation) nextErrors.confirmation = content.signUp.invalidConfirmation;
    if (!consent) nextErrors.consent = content.signUp.invalidConsent;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setLoading(true);
    const result = await auth.signUp({
      displayName: displayName.trim(),
      email: email.trim().toLowerCase(),
      invitationToken,
      locale,
      password,
    });
    if (result.status === 'authenticated') {
      if (desktopAuthorization !== undefined) {
        const approval = await auth.approveDesktopAuthorization(desktopAuthorization);
        if (approval.status !== 'approved') {
          setLoading(false);
          setErrors({ invitation: errorMessage(approval, locale) });
          return;
        }
        setSuccessDestination(approval.callbackUrl);
        return;
      }
      setSuccessDestination(DESKTOP_ACCOUNT_DEEP_LINK);
      return;
    }
    setLoading(false);
    setErrors({ invitation: errorMessage(result, locale) });
  };

  if (successDestination !== null) {
    return (
      <AuthSuccess
        destinationUrl={successDestination}
        desktopHandoff={desktopAuthorization !== undefined}
        locale={locale}
      />
    );
  }

  const errorMessages = Object.values(errors);
  return (
    <article className="lb-web-sign-up" data-account-state="sign-up-real">
      <AuthHeader locale={locale} routeId="account-sign-up" />
      <form noValidate onSubmit={(event) => void submit(event)}>
        <p className="account-auth-invitation" data-valid="true" role="status">
          {labels.invitationAccepted}
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
          onChange={(value) => {
            setDisplayName(value);
            setErrors((current) =>
              withFieldError(
                current,
                'name',
                value.length > 0 && value.trim().length < 2
                  ? content.signUp.invalidName
                  : undefined,
              ),
            );
          }}
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
          onChange={(value) => {
            setEmail(value);
            setErrors((current) =>
              withFieldError(
                current,
                'email',
                value.length > 0 && !validEmail(value) ? content.signUp.invalidEmail : undefined,
              ),
            );
          }}
          value={email}
        />
        <div className="account-auth-passwords">
          <div className="account-password-field">
            <LbTextField
              description={content.signUp.passwordHint}
              errorMessage={errors.password}
              inputType={passwordVisible ? 'text' : 'password'}
              isDisabled={loading}
              isInvalid={errors.password !== undefined}
              isRequired
              label={content.signUp.passwordLabel}
              maxLength={128}
              name="password"
              onChange={(value) => {
                setPassword(value);
                setErrors((current) =>
                  withFieldError(
                    current,
                    'password',
                    value.length > 0 && !validPassword(value)
                      ? content.signUp.invalidPassword
                      : undefined,
                  ),
                );
              }}
              value={password}
            />
            <LbButton
              isDisabled={loading}
              onPress={() => {
                setPasswordVisible((visible) => !visible);
              }}
              type="button"
              variant="quiet"
            >
              {passwordVisible ? labels.hidePassword : labels.showPassword}
            </LbButton>
          </div>
          <ul className="account-password-requirements" data-password-requirements>
            {requirements.map((requirement) => (
              <li data-met={requirement.met} key={requirement.label}>
                <ProductIcon name={requirement.met ? 'check' : 'info'} size={14} />
                {requirement.label}
              </li>
            ))}
          </ul>
          <LbTextField
            errorMessage={errors.confirmation}
            inputType={passwordVisible ? 'text' : 'password'}
            isDisabled={loading}
            isInvalid={errors.confirmation !== undefined}
            isRequired
            label={content.signUp.confirmLabel}
            maxLength={128}
            name="passwordConfirmation"
            onChange={(value) => {
              setConfirmation(value);
              setErrors((current) =>
                withFieldError(
                  current,
                  'confirmation',
                  value.length > 0 && value !== password
                    ? content.signUp.invalidConfirmation
                    : undefined,
                ),
              );
            }}
            value={confirmation}
          />
        </div>
        <div className="account-auth-consent">
          <LbCheckbox
            isSelected={consent}
            onChange={(selected) => {
              setConsent(selected);
              setErrors((current) =>
                withFieldError(current, 'consent', selected ? undefined : current.consent),
              );
            }}
            value="terms"
          >
            {content.signUp.consentLabel}
          </LbCheckbox>
          {errors.consent === undefined ? null : <p role="status">{errors.consent}</p>}
        </div>
        <LbButton
          isDisabled={loading}
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
        <Link
          href={
            authHrefWithDesktopAuthorization(
              'account-sign-in',
              locale,
              desktopAuthorization,
            ) as Route
          }
        >
          {content.signUp.signInAction}
        </Link>
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
  const desktopChallenge = searchParams.get('desktop_challenge');
  const desktopState = admitInvitationToken(searchParams.get('state') ?? undefined);
  const desktopAuthorization =
    desktopChallenge !== null &&
    desktopChallenge.length <= 128 &&
    /^[A-Za-z0-9-]+$/u.test(desktopChallenge) &&
    desktopState !== null
      ? { challengeId: desktopChallenge, state: desktopState }
      : undefined;
  return props.routeId === 'account-sign-in' ? (
    <SignInForm
      authorityBaseUrl={props.authorityBaseUrl}
      desktopAuthorization={desktopAuthorization}
      locale={props.locale}
      signOutRequested={signOutRequested}
    />
  ) : (
    <SignUpForm
      authorityBaseUrl={props.authorityBaseUrl}
      desktopAuthorization={desktopAuthorization}
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
  const liveAuthority = useMemo(
    () => getLiveAccountAuthority(authorityBaseUrl),
    [authorityBaseUrl],
  );
  const [projectedIdentity, setProjectedIdentity] = useState<
    Readonly<{ displayName: string; locale: 'pt-BR' | 'en' }> | undefined
  >();
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
  useEffect(
    () =>
      liveAuthority.subscribe((result) => {
        if (result !== null && 'projection' in result) {
          setProjectedIdentity({
            displayName: result.projection.account.displayName,
            locale: result.projection.account.locale,
          });
        }
      }),
    [liveAuthority],
  );
  const presentedActor =
    actor === null || projectedIdentity === undefined ? actor : { ...actor, ...projectedIdentity };

  return (
    <>
      <span aria-hidden="true" className="account-identity__avatar">
        {presentedActor === null ? 'LB' : initials(presentedActor)}
      </span>
      <span className="account-identity__copy">
        <strong>
          {presentedActor?.displayName ??
            (settled
              ? locale === 'pt-BR'
                ? 'Sessão necessária'
                : 'Session required'
              : locale === 'pt-BR'
                ? 'Carregando conta'
                : 'Loading account')}
        </strong>
        <span>
          {presentedActor?.email ??
            (locale === 'pt-BR' ? 'Entre para ver sua conta' : 'Sign in to view your account')}
        </span>
      </span>
    </>
  );
};

const ADMIN_ROLES = new Set<AccountAuthActor['role']>([
  'audit',
  'operations',
  'security',
  'support',
]);

export const AccountRoleGateway = ({
  adminOrigin,
  authorityBaseUrl,
  locale,
}: Readonly<{ adminOrigin: string; authorityBaseUrl: string; locale: WebLocale }>) => {
  const [actor, setActor] = useState<AccountAuthActor | null>(null);
  const auth = useMemo(
    () => createAccountAuth({ baseUrl: authorityBaseUrl, correlationId }),
    [authorityBaseUrl],
  );
  useEffect(() => {
    let active = true;
    void auth.session().then((result) => {
      if (active && result.status === 'authenticated') setActor(result.actor);
    });
    return () => {
      active = false;
    };
  }, [auth]);

  if (actor === null || !ADMIN_ROLES.has(actor.role)) return null;
  const labels = messages[locale];
  return (
    <aside className="account-admin-gateway" data-account-role={actor.role}>
      <ProductIcon name="shield" size={18} />
      <span>
        <strong>{labels.adminAccess}</strong>
        <small>{labels.adminScope}</small>
      </span>
      <a href={`${adminOrigin}/${locale}/admin`}>
        {labels.adminAccess} <ProductIcon name="arrowRight" size={16} />
      </a>
    </aside>
  );
};
