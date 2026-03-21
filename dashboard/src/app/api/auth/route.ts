import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let action = '';
    let password = '';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      action = body.action;
      password = body.password;
    } else {
      const formData = await request.formData();
      action = formData.get('action') as string || '';
      password = formData.get('password') as string || '';
    }

    if (action === 'logout') {
      const cookieStore = await cookies();
      cookieStore.delete({
        name: 'auth_session',
        path: '/',
      });
      return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
    }

    if (password === process.env.AUTH_PASSWORD) {
      const secret = process.env.AUTH_SECRET;
      if (!secret) {
        console.error("AUTH_SECRET is not set in environment variables");
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }

      const cookieStore = await cookies();
      cookieStore.set('auth_session', secret, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 400 });
  }
}
