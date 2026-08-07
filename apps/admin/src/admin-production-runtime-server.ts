import 'server-only';

const exactHttpsOrigin = (value: string, label: string): string => {
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
    return url.origin;
  } catch {
    throw new Error(`${label} must be an exact credential-free HTTPS origin.`);
  }
};

export const resolveAdminProductionAccountOrigin = (): string =>
  exactHttpsOrigin(process.env['LIIIRAA_ACCOUNT_ORIGIN'] ?? '', 'Account origin');
