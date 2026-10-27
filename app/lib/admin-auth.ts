type HeaderReader = {
  get(name: string): string | null;
};

export const ADMIN_SESSION_COOKIE = 'wg_admin_session';
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

type AdminSession = {
  email: string;
  expiresAt: number;
};

const encoder = new TextEncoder();

function allowedEmails() {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdmin(email: string) {
  return allowedEmails().includes(email.trim().toLowerCase());
}

function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.SUPABASE_DASHBOARD_SECRET || '';
  return secret.length >= 24 ? secret : null;
}

function base64UrlEncode(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? encoder.encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function sign(payload: string, secret: string) {
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

export async function createAdminSession(email: string, now = Date.now()) {
  const secret = sessionSecret();
  const normalizedEmail = email.trim().toLowerCase();
  if (!secret || !isAllowedAdmin(normalizedEmail)) return null;

  const payload = base64UrlEncode(JSON.stringify({
    email: normalizedEmail,
    expiresAt: now + ADMIN_SESSION_MAX_AGE * 1000,
  } satisfies AdminSession));
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifyAdminSession(value: string, now = Date.now()) {
  const secret = sessionSecret();
  const [payload, signature, extra] = value.split('.');
  if (!secret || !payload || !signature || extra) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      base64UrlDecode(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;

    const session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as AdminSession;
    if (
      typeof session.email !== 'string' ||
      typeof session.expiresAt !== 'number' ||
      session.expiresAt <= now ||
      !isAllowedAdmin(session.email)
    ) return null;
    return session.email;
  } catch {
    return null;
  }
}

function cookieValue(headers: HeaderReader, name: string) {
  const cookie = headers.get('cookie') ?? '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }
  return '';
}

export async function getAdminEmail(headers: HeaderReader) {
  const hostedEmail = headers.get('oai-authenticated-user-email')?.trim().toLowerCase() ?? '';
  if (hostedEmail && isAllowedAdmin(hostedEmail)) return hostedEmail;

  const session = cookieValue(headers, ADMIN_SESSION_COOKIE);
  if (session) return verifyAdminSession(session);

  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DEV_BYPASS === 'true') {
    return 'desenvolvimento@local';
  }
  return null;
}
