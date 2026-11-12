import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function source(path, replacements = {}) {
  let code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) code = code.replaceAll(from, to);
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}

const authUrl = await source('../app/lib/admin-auth.ts');
const auth = await import(authUrl);
const login = await import(await source('../app/api/auth/login/route.ts', {
  '../../../lib/admin-auth': authUrl,
  'next/server': import.meta.resolve('next/server.js'),
}));

test('sessão administrativa válida é aceita e adulteração é rejeitada', async () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAILS = 'admin@empresa.com.br';
    process.env.AUTH_SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
    const session = await auth.createAdminSession('ADMIN@EMPRESA.COM.BR', 1_000);
    assert.ok(session);
    assert.equal(await auth.verifyAdminSession(session, 2_000), 'admin@empresa.com.br');
    assert.equal(await auth.verifyAdminSession(`${session}x`, 2_000), null);
    assert.equal(await auth.verifyAdminSession(session, 1_000 + auth.ADMIN_SESSION_MAX_AGE * 1000 + 1), null);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('proteção rejeita cabeçalho da hospedagem sem uma sessão válida em produção', async () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_DEV_BYPASS = 'true';
    process.env.ADMIN_EMAILS = 'admin@empresa.com.br';
    process.env.AUTH_SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
    const headers = new Headers({ 'oai-authenticated-user-email': 'admin@empresa.com.br' });
    assert.equal(await auth.getAdminEmail(headers), null);
    for (const value of ['invalid.session', '%ZZ', '']) {
      headers.set('cookie', `${auth.ADMIN_SESSION_COOKIE}=${value}`);
      assert.equal(await auth.getAdminEmail(headers), null);
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test('login por Supabase Auth continua emitindo sessão válida em HTTPS', async () => {
  const saved = { ...process.env };
  const originalFetch = globalThis.fetch;
  try {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAILS = 'admin@empresa.com.br,outra@empresa.com.br';
    process.env.AUTH_SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
    process.env.SUPABASE_URL = 'https://supabase.example.invalid';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'chave-de-teste';
    const host = 'https://wg.example.invalid';
    globalThis.fetch = async () => Response.json({ user: { email: 'admin@empresa.com.br' } });

    const response = await login.POST(new Request(`${host}/api/auth/login`, {
      method: 'POST',
      headers: { origin: host },
      body: new URLSearchParams({ email: 'admin@empresa.com.br', password: 'senha-de-teste' }),
    }));

    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), `${host}/sistema`);
    const setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /;\s*Secure\b/i);
    assert.match(setCookie, /;\s*HttpOnly\b/i);
    const headers = new Headers({
      cookie: setCookie.split(';', 1)[0],
      'oai-authenticated-user-email': 'outra@empresa.com.br',
    });
    assert.equal(await auth.getAdminEmail(headers), 'admin@empresa.com.br');
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
