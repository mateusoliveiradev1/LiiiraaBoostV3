import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { oauthProvider } from '@better-auth/oauth-provider';
import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { jwt, twoFactor } from 'better-auth/plugins';

const packageVersion = (resolvedUrl) => {
  const entry = fileURLToPath(resolvedUrl);
  return JSON.parse(readFileSync(join(dirname(entry), '..', 'package.json'), 'utf8')).version;
};

const twoFactorPlugin = twoFactor();
const passkeyPlugin = passkey({
  rpID: 'identity.test.liiiraa.dev',
  rpName: 'Liiiraa Boost Identity Spike',
  origin: 'https://identity.test.liiiraa.dev',
});
const oauthProviderPlugin = oauthProvider({
  loginPage: '/login',
  consentPage: '/consent',
  silenceWarnings: { oauthAuthServerConfig: true },
});
const jwtPlugin = jwt();

const auth = betterAuth({
  secret: 'spike-only-secret-at-least-32-characters',
  baseURL: 'https://identity.test.liiiraa.dev',
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async () => undefined,
  },
  socialProviders: {
    google: { clientId: 'spike-google', clientSecret: 'spike-google-secret' },
    discord: { clientId: 'spike-discord', clientSecret: 'spike-discord-secret' },
  },
  trustedOrigins: ['http://127.0.0.1:*'],
  plugins: [twoFactorPlugin, passkeyPlugin, jwtPlugin, oauthProviderPlugin],
});

await new Promise((resolve) => setTimeout(resolve, 25));

const publicCodeExchange = auth.api.oauth2Token.options.body.safeParse({
  grant_type: 'authorization_code',
  client_id: 'liiiraa-windows-public-client',
  code: 'synthetic-authorization-code',
  code_verifier: 'v'.repeat(64),
  redirect_uri: 'http://127.0.0.1:49152/oauth/callback',
});

const evidence = {
  packageVersions: {
    betterAuth: packageVersion(import.meta.resolve('better-auth')),
    passkey: packageVersion(import.meta.resolve('@better-auth/passkey')),
    oauthProvider: packageVersion(import.meta.resolve('@better-auth/oauth-provider')),
  },
  requireEmailVerification: auth.options.emailAndPassword.requireEmailVerification,
  socialProviders: Object.keys(auth.options.socialProviders),
  pluginIds: auth.options.plugins.map((plugin) => plugin.id),
  apiNames: Object.keys(auth.api).sort(),
  twoFactorEndpoints: Object.keys(twoFactorPlugin.endpoints ?? {}).sort(),
  passkeyEndpoints: Object.keys(passkeyPlugin.endpoints ?? {}).sort(),
  oauthProviderEndpoints: Object.keys(oauthProviderPlugin.endpoints ?? {}).sort(),
  nativeClient: {
    type: 'native',
    tokenEndpointAuthMethod: 'none',
    requirePkce: true,
    codeChallengeMethod: 'S256',
    backendCodeExchange: Object.hasOwn(auth.api, 'oauth2Token'),
    tokenEndpointPath: auth.api.oauth2Token.path,
    tokenEndpointMethod: auth.api.oauth2Token.options.method,
    acceptsPublicCodeExchangeWithoutSecret:
      publicCodeExchange.success && !Object.hasOwn(publicCodeExchange.data, 'client_secret'),
  },
};

process.stdout.write(`BETTER_AUTH_EVIDENCE=${JSON.stringify(evidence)}\n`);
