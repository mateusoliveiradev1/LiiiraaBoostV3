import adminProxy from '../proxy';

export default adminProxy;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
