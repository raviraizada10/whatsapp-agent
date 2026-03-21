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

import { cookieStore } from './setup';
import { POST } from '../app/api/auth/route';

describe('Auth API Route', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, AUTH_PASSWORD: 'test-password', AUTH_SECRET: 'test-secret', NODE_ENV: 'test' };
  });

  it('successfully logs in with correct password', async () => {
    const req = new Request('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'test-password' }),
    });
    // For the mock NextRequest/Route handler compatibility
    (req as any).json = async () => ({ password: 'test-password' });

    const res = await POST(req);
    expect(res).toBeDefined();
    expect(cookieStore.set).toHaveBeenCalledWith('auth_session', 'test-secret', expect.any(Object));
    const data = await (res as any).json();
    expect(data.success).toBe(true);
  });

  it('fails to log in with incorrect password', async () => {
    const req = new Request('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    (req as any).json = async () => ({ password: 'wrong-password' });

    const res = await POST(req);
    expect(res).toBeDefined();
    expect(res.status).toBe(401);
  });

  it('successfully logs out', async () => {
    const req = new Request('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    (req as any).json = async () => ({ action: 'logout' });

    const res = await POST(req);
    expect(res).toBeDefined();
    expect(cookieStore.delete).toHaveBeenCalledWith({ name: 'auth_session', path: '/' });
    expect(res.status).toBe(307);
  });
});
