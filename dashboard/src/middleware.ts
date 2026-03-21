import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public paths that bypass authentication
  const isPublicPath = path === '/login' || path.startsWith('/api/auth');

  const sessionToken = request.cookies.get('auth_session')?.value;
  const isAuthenticated = sessionToken && sessionToken === process.env.AUTH_SECRET;

  if (!isPublicPath && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (path === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect all paths except static assets, images, and next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|logo.*|sw.js|workbox-.*).*)'],
};
