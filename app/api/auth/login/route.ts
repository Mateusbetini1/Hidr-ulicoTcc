import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  isAllowedAdmin,
} from '../../../lib/admin-auth';

function loginRedirect(request: Request, error?: string) {
  const url = new URL('/login', request.url);
  if (error) url.searchParams.set('erro', error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: 'Origem inválida.' }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const email = typeof form?.get('email') === 'string'
    ? String(form.get('email')).trim().toLowerCase().slice(0, 254)
    : '';
  const password = typeof form?.get('password') === 'string'
    ? String(form.get('password')).slice(0, 200)
    : '';

  if (!email || password.length < 6) return loginRedirect(request, 'credenciais');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) return loginRedirect(request, 'configuracao');

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    });
    if (!authResponse.ok) return loginRedirect(request, 'credenciais');

    const auth = await authResponse.json() as { user?: { email?: string } };
    const authenticatedEmail = auth.user?.email?.trim().toLowerCase() ?? '';
    if (!authenticatedEmail || !isAllowedAdmin(authenticatedEmail)) {
      return loginRedirect(request, 'nao-autorizado');
    }

    const session = await createAdminSession(authenticatedEmail);
    if (!session) return loginRedirect(request, 'configuracao');

    const response = NextResponse.redirect(new URL('/sistema', request.url), 303);
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: session,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE,
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return loginRedirect(request, 'indisponivel');
  }
}
