import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

async function source(path) {
  const code = ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}

const auth = await import(await source('../app/lib/admin-auth.ts'));

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

test('proteção aceita somente e-mail autorizado da hospedagem ou da sessão', async () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = 'production';
    process.env.ADMIN_EMAILS = 'admin@empresa.com.br';
    process.env.AUTH_SESSION_SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';
    const session = await auth.createAdminSession('admin@empresa.com.br');
    const headers = values => ({ get: name => values[name.toLowerCase()] ?? null });
    assert.equal(await auth.getAdminEmail(headers({ 'oai-authenticated-user-email': 'admin@empresa.com.br' })), 'admin@empresa.com.br');
    assert.equal(await auth.getAdminEmail(headers({ 'oai-authenticated-user-email': 'outra@empresa.com.br' })), null);
    assert.equal(await auth.getAdminEmail(headers({ cookie: `${auth.ADMIN_SESSION_COOKIE}=${encodeURIComponent(session)}` })), 'admin@empresa.com.br');
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
