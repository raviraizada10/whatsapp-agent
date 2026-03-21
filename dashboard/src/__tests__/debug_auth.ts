import { POST } from '../app/api/auth/route';
import { NextResponse } from 'next/server';

// Mock cookies and NextResponse manually for this script
(global as any).process.env.AUTH_PASSWORD = 'admin';
(global as any).process.env.AUTH_SECRET = 'secret';

async function test() {
  console.log('Testing POST login...');
  try {
    const req = new Request('http://localhost:3000/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'admin' }),
    });
    
    // We expect this to fail if next/headers or next/server is not mocked
    const res = await POST(req);
    console.log('Response:', res);
  } catch (e) {
    console.error('Error during test:', e);
  }
}

test();
