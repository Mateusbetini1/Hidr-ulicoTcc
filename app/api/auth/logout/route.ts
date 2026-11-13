import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '../../../lib/admin-auth';

const noStore = { 'Cache-Control': 'private, no-store', 'Cloudflare-CDN-Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: 'Origem inválida.' }, { status: 403, headers: noStore });
  }

  const response = NextResponse.redirect(new URL('/login', request.url), { status: 303, headers: noStore });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  return response;
}
