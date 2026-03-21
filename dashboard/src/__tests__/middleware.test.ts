import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.mock at top level for hoisting
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockImplementation(() => Promise.resolve((global as any).NEXT_MOCKS.cookieStore)),
}));

vi.mock('next/server', () => ({
  NextResponse: (global as any).NEXT_MOCKS.nextResponse,
  NextRequest: class {
    url: string;
    nextUrl: { pathname: string };
    cookies: any;
    headers: Map<string, string>;
    constructor(url: string, init?: any) {
      this.url = url;
      this.nextUrl = { pathname: new URL(url).pathname };
      this.headers = new Map(Object.entries(init?.headers || {}));
      this.cookies = {
        get: (name: string) => (global as any).NEXT_MOCKS.cookieStore.get(name),
      };
    }
    async json() {
      return (this as any)._json || {};
    }
  }
}));

import { cookieStore, nextResponse } from './setup';
import { middleware } from '../middleware';
import { NextRequest } from 'next/server';

describe('Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, AUTH_SECRET: 'test-secret' };
  });

  it('redirects to /login when not authenticated', async () => {
    cookieStore.get.mockReturnValue(undefined);
    const req = new NextRequest('http://localhost:3000/');

    const res = await middleware(req);
    expect(res).toBeDefined();
    const redirectUrl = nextResponse.redirect.mock.calls[0][0].toString();
    expect(redirectUrl).toContain('/login');
  });

  it('allows access to /login when not authenticated', async () => {
    cookieStore.get.mockReturnValue(undefined);
    const req = new NextRequest('http://localhost:3000/login');

    const res = await middleware(req);
    expect(res).toBeDefined();
    expect(nextResponse.next).toHaveBeenCalled();
  });

  it('allows access to protected routes when authenticated', async () => {
    cookieStore.get.mockImplementation((name) => {
      if (name === 'auth_session') return { value: 'test-secret' };
      return undefined;
    });
    const req = new NextRequest('http://localhost:3000/');

    const res = await middleware(req);
    expect(res).toBeDefined();
    expect(nextResponse.next).toHaveBeenCalled();
  });

  it('redirects to / when authenticated and accessing /login', async () => {
    cookieStore.get.mockImplementation((name) => {
      if (name === 'auth_session') return { value: 'test-secret' };
      return undefined;
    });
    const req = new NextRequest('http://localhost:3000/login');

    const res = await middleware(req);
    expect(res).toBeDefined();
    const redirectUrl = nextResponse.redirect.mock.calls[0][0].toString();
    expect(redirectUrl).toBe('http://localhost:3000/');
  });
});
