import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../infra/cloudflare/notificacoes/worker.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const env = {
  SUPABASE_URL: 'https://zutnvrnsahmwuvlhhcuy.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SUPABASE_DASHBOARD_SECRET: 'chave-local-ficticia',
  RESEND_API_KEY: 're_fixture',
  WG_NOTIFICACAO_REMETENTE: 'WG Teste <sender@example.invalid>',
  WG_NOTIFICACAO_DESTINATARIO: 'wg-fixture@gmail.com',
};

const id = (indexed) => `00000000-0000-0000-0000-${String(indexed).padStart(12, '0')}`;
const reservation = (index = 1) => ({
  solicitacao_id: id(index), reserva: id(100 + index), chave_idempotencia: id(200 + index),
  reservada_ate: new Date(Date.now() + 60_000).toISOString(),
  payload: { from: env.WG_NOTIFICACAO_REMETENTE, to: [env.WG_NOTIFICACAO_DESTINATARIO], subject: 'Teste', text: 'Mensagem fictícia' },
});

function mockRequests(t, { reserve, send, finalize = () => Response.json(true) }) {
  const requests = { reserved: [], sent: [], finalized: [] };
  t.mock.method(console, 'info', () => {});
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const { origin, pathname } = new URL(url);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.method, 'POST');
    const body = JSON.parse(options.body);
    if (origin === 'https://api.resend.com' && pathname === '/emails') {
      assert.equal(options.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`);
      assert.equal(options.headers.apikey, undefined);
      const key = options.headers['Idempotency-Key'];
      requests.sent.push({ key, body });
      return send(key, body, options.signal);
    }
    assert.equal(origin, env.SUPABASE_URL);
    assert.equal(options.headers.apikey, env.SUPABASE_PUBLISHABLE_KEY);
    assert.equal(body.p_chave, env.SUPABASE_DASHBOARD_SECRET);
    assert.equal(options.headers.Authorization, undefined);
    if (pathname === '/rest/v1/rpc/reservar_notificacoes_solicitacao') {
      requests.reserved.push(body);
      return Response.json({ notificacoes: await reserve() });
    }
    assert.equal(pathname, '/rest/v1/rpc/finalizar_notificacao_solicitacao');
    requests.finalized.push(body);
    return finalize(body);
  });
  return requests;
}

const run = (bindings = env) => worker.scheduled({}, bindings);

test('processa dez notificações com o payload persistido e 21 requisições', async (t) => {
  const batch = Array.from({ length: 10 }, (_, index) => reservation(index + 1));
  const reqs = mockRequests(t, { reserve: () => batch, send: () => Response.json({ id: 'resend-fixture' }) });
  await run();
  assert.deepEqual(Object.keys(worker), ['scheduled']);
  assert.equal(reqs.reserved.length, 1);
  assert.equal(reqs.reserved[0].p_destinatario, env.WG_NOTIFICACAO_DESTINATARIO);
  assert.deepEqual(reqs.sent, batch.map((item) => ({ key: item.chave_idempotencia, body: item.payload })));
  assert.equal(reqs.finalized.length, 10);
  for (const [index, item] of batch.entries()) {
    assert.deepEqual(reqs.finalized[index], {
      p_chave: env.SUPABASE_DASHBOARD_SECRET, p_solicitacao_id: item.solicitacao_id, p_reserva: item.reserva,
      p_resultado: 'aceito', p_resend_id: 'resend-fixture', p_erro: null,
    });
  }
});

test('fila vazia faz só a reserva', async (t) => {
  const reqs = mockRequests(t, { reserve: () => [] });
  await run();
  assert.equal(reqs.reserved.length, 1);
  assert.equal(reqs.sent.length + reqs.finalized.length, 0);
});

test('bloqueia URL de outro projeto, credencial privilegiada e configuração ausente antes de qualquer fetch', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', () => { throw new Error('rede indevida'); });
  await assert.rejects(run({ ...env, SUPABASE_URL: 'https://outro-projeto.example.invalid' }), /fora_da_homologacao/);
  await assert.rejects(run({ ...env, SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fixture' }), /configuracao_notificacoes_invalida/);
  await assert.rejects(run({ ...env, SUPABASE_DASHBOARD_SECRET: undefined }), /configuracao_notificacoes_invalida/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('ignora reserva vencida e duplicata, e rejeita payload com destino diferente ou destinatário extra', async (t) => {
  const expired = { ...reservation(1), reservada_ate: new Date(0).toISOString() };
  const foreign = reservation(2);
  foreign.payload.to = ['outro@example.invalid'];
  const extra = reservation(3);
  extra.payload.cc = ['outro@example.invalid'];
  const valid = reservation(4);
  const reqs = mockRequests(t, { reserve: () => [expired, foreign, extra, valid, valid], send: () => Response.json({ id: 'fixture' }) });
  await run();
  assert.deepEqual(reqs.sent.map((item) => item.key), [valid.chave_idempotencia]);
  assert.deepEqual(reqs.finalized.map(({ p_solicitacao_id, p_resultado, p_erro }) => [p_solicitacao_id, p_resultado, p_erro]), [
    [foreign.solicitacao_id, 'rejeitado', 'payload_fora_da_configuracao'],
    [extra.solicitacao_id, 'rejeitado', 'payload_fora_da_configuracao'],
    [valid.solicitacao_id, 'aceito', null],
  ]);
});

test('timeout de envio registra resultado incerto sem repetir dentro da invocação', async (t) => {
  t.mock.method(AbortSignal, 'timeout', () => AbortSignal.abort(new DOMException('fixture', 'TimeoutError')));
  const reqs = mockRequests(t, {
    reserve: () => [reservation()],
    send: (_, __, signal) => signal.throwIfAborted(),
  });
  await run();
  assert.equal(reqs.sent.length, 1);
  assert.equal(reqs.finalized[0].p_resultado, 'incerto');
  assert.equal(reqs.finalized[0].p_erro, 'resposta_indisponivel');
});

test('classifica falha definitiva, limite temporário, cota esgotada e resposta ambígua do Resend', async (t) => {
  const responses = [
    Response.json({}, { status: 403 }),
    Response.json({ name: 'rate_limit_exceeded' }, { status: 429 }),
    Response.json({ name: 'daily_quota_exceeded' }, { status: 429 }),
    Response.json({}, { status: 503 }),
    Response.json({}),
  ];
  const reqs = mockRequests(t, {
    reserve: () => Array.from({ length: 5 }, (_, index) => reservation(index + 1)),
    send: () => responses.shift(),
  });
  await run();
  assert.deepEqual(reqs.finalized.map(({ p_resultado, p_erro }) => [p_resultado, p_erro]), [
    ['rejeitado', 'HTTP 403'], ['repetir', 'HTTP 429'], ['rejeitado', 'daily_quota_exceeded'],
    ['incerto', 'HTTP 503'], ['incerto', 'aceite_sem_id'],
  ]);
});

test('dois crons concorrentes enviam somente a reserva obtida da fila', async (t) => {
  const item = reservation();
  let claimed = false;
  const reqs = mockRequests(t, {
    reserve: () => {
      if (claimed) return [];
      claimed = true;
      return [item];
    },
    send: () => Response.json({ id: 'fixture' }),
  });
  await Promise.all([run(), run()]);
  assert.equal(reqs.reserved.length, 2);
  assert.equal(reqs.sent.length, 1);
  assert.equal(reqs.finalized.length, 1);
});

test('recuperação após aceite sem conclusão usa a mesma chave, o mesmo payload e uma nova reserva', async (t) => {
  const item = reservation();
  const next = { ...item, reserva: id(999) };
  const leases = [item, next];
  const delivered = new Set();
  const reqs = mockRequests(t, {
    reserve: () => [leases.shift()],
    send: (key) => { delivered.add(key); return Response.json({ id: 'mesmo-resend-id' }); },
    finalize: (body) => Response.json(body.p_reserva === next.reserva),
  });
  await assert.rejects(run(), /notificacoes_conclusao_pendente/);
  await run();
  assert.deepEqual(reqs.sent[0], reqs.sent[1]);
  assert.equal(delivered.size, 1);
  assert.deepEqual(reqs.finalized.map(({ p_reserva }) => p_reserva), [item.reserva, next.reserva]);
});
