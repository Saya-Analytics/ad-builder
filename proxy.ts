import { NextResponse, type NextRequest } from 'next/server';

// Password-protects every page and API route with HTTP Basic auth.
// Username is free text (it is recorded as "by" on commands); the password is APP_PASSWORD.

export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production') return new NextResponse('APP_PASSWORD is not set.', { status: 503 });
    return NextResponse.next();
  }
  const header = req.headers.get('authorization') ?? '';
  if (header.startsWith('Basic ')) {
    const [user, ...rest] = atob(header.slice(6)).split(':');
    if (user && rest.join(':') === password) return NextResponse.next();
  }
  return new NextResponse('Sign in to Ad Builder.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Ad Builder", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
