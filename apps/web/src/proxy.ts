import publicProxy from '../proxy';

export default publicProxy;

export const config = {
  matcher: ['/((?!api|v1|_next|_vercel|.*\\..*).*)'],
};
