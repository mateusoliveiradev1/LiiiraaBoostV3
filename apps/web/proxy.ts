import createMiddleware from 'next-intl/middleware';

import { routing } from './src/public-boundary';

const localeProxy = createMiddleware(routing);

export default localeProxy;

export const config = {
  matcher: ['/((?!api|v1|_next|_vercel|.*\\..*).*)'],
};
