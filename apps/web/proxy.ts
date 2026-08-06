import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import { routing } from './src/public-boundary';

const localeProxy = createMiddleware(routing);

export default function publicProxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/') {
    const destination = request.nextUrl.clone();
    destination.pathname = '/pt-BR';
    return NextResponse.redirect(destination, 307);
  }
  return localeProxy(request);
}

export const config = {
  matcher: ['/((?!api|v1|_next|_vercel|.*\\..*).*)'],
};
