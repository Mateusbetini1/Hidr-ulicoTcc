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
const domainUrl = await source('../app/lib/commercial-triage.ts');
const domain = await import(domainUrl);
const replacements = { '../../lib/commercial-triage': domainUrl, 'next/server': import.meta.resolve('next/server.js') };
const submit = await import(await source('../app/api/solicitacoes/route.ts', replacements));
const ai = await import(await source('../app/api/triagem/route.ts', replacements));
const chatbot = await import(await source('../app/api/chatbot/route.ts', replacements));
const request = body => new Request('http://localhost/api/solicitacoes', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' }, body: JSON.stringify(body) });

test('dados incompletos viram pendências, sem bloquear a solicitação', () => {
  assert.ok(domain.pendingFields(domain.emptyTriage).includes('Quantidade'));
  assert.match(domain.triageDescription('Preciso de um cilindro', domain.emptyTriage), /A confirmar/);
});
test('rejeita serviço inválido e campos excessivos', () => {
  assert.throws(() => domain.parseTriage({ ...domain.emptyTriage, servico: 'toString' }));
  assert.throws(() => domain.parseTriage({ ...domain.emptyTriage, medidas: 'x'.repeat(251) }));
});
test('valida a resposta estruturada do chatbot', () => {
  const result = domain.parseChatbotResult({
    reply: 'Em qual equipamento o cilindro é utilizado?',
    triage: domain.emptyTriage,
    readyForReview: false,
    handoffRequested: false,
  });
  assert.equal(result.triage.servico, 'nao_sei');
  assert.throws(() => domain.parseChatbotResult({ reply: '', triage: domain.emptyTriage, readyForReview: false, handoffRequested: false }));
});
test('resumo máximo cabe no limite existente do banco', () => {
  const full = { servico: 'manutencao', aplicacao: 'x'.repeat(250), quantidade: 'x'.repeat(80), medidas: 'x'.repeat(250), problema: 'x'.repeat(250), prazoDesejado: 'x'.repeat(250) };
  assert.ok(domain.triageDescription('x'.repeat(1000), full).length <= 3000);
});
test('contratos HTTP sem chamadas externas', async () => {
  const originalFetch = globalThis.fetch;
  const saved = { ...process.env };
  let calls = [];
  try {
    globalThis.fetch = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return Response.json('test-id'); };
    process.env.SUPABASE_URL = 'https://example.invalid';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test';
    const valid = { name: 'Cliente Teste', phone: '00000000000', request: 'Dois cilindros com vazamento', triage: domain.emptyTriage, confirmed: true };
    assert.equal((await submit.POST(request({ ...valid, confirmed: false }))).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await submit.POST(request(valid))).status, 201);
    assert.equal(calls[0].body.p_origem, 'site_triagem');
    assert.match(calls[0].body.p_descricao, /Pendências para análise/);
    assert.equal((await submit.POST(request({ name: 'Cliente Teste', phone: '00000000000', request: 'Formulário direto preservado' }))).status, 201);
    assert.equal(calls[1].body.p_origem, 'site');
    assert.equal((await submit.POST(request(null))).status, 400);
    assert.equal((await submit.POST(request({ ...valid, request: 'x'.repeat(17000) }))).status, 413);
    globalThis.fetch = async () => { throw new Error('offline'); };
    assert.equal((await submit.POST(request(valid))).status, 502);
    process.env.TRIAGE_AI_ENABLED = 'false';
    assert.deepEqual(await (await ai.GET()).json(), { available: false });
    assert.equal((await ai.POST(request({ request: valid.request }))).status, 503);
    process.env.CHATBOT_AI_ENABLED = 'false';
    assert.deepEqual(await (await chatbot.GET()).json(), { available: false });
    assert.equal((await chatbot.POST(request({ messages: [{ role: 'user', content: valid.request }] }))).status, 503);
    process.env.TRIAGE_AI_ENABLED = 'true'; process.env.OPENAI_API_KEY = 'test'; process.env.OPENAI_TRIAGE_MODEL = 'test';
    calls = [];
    globalThis.fetch = async (url, init) => { calls.push(JSON.parse(init.body)); return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ ...domain.emptyTriage, servico: 'manutencao', quantidade: '2' }) }] }] }); };
    assert.equal((await ai.POST(request({ request: valid.request }))).status, 200);
    assert.equal(calls[0].store, false);
    assert.equal(calls[0].input, valid.request);
    globalThis.fetch = async () => Response.json({ status: 'completed', output: [] });
    assert.equal((await ai.POST(request({ request: valid.request }))).status, 502);
    process.env.CHATBOT_AI_ENABLED = 'true'; process.env.GEMINI_API_KEY = 'test';
    process.env.GEMINI_CHATBOT_MODEL = 'gemini-3.5-flash-lite';
    process.env.CHATBOT_N8N_WEBHOOK_URL = 'http://localhost:5678/webhook/wg-hidraulica-chatbot';
    globalThis.fetch = async (url, init) => {
      const body = JSON.parse(init.body);
      calls.push({ url, body });
      return Response.json({
        reply: 'Qual é a aplicação do cilindro?', triage: domain.emptyTriage,
        readyForReview: false, handoffRequested: false,
      });
    };
    const chatResponse = await chatbot.POST(request({ messages: [{ role: 'user', content: valid.request }], triage: domain.emptyTriage }));
    assert.equal(chatResponse.status, 200);
    assert.equal((await chatResponse.json()).reply, 'Qual é a aplicação do cilindro?');
    assert.equal(calls.at(-1).url, 'http://localhost:5678/webhook/wg-hidraulica-chatbot');
    assert.equal(calls.at(-1).body.messages[0].content, valid.request);
    const foreign = new Request('http://localhost/api/triagem', { method: 'POST', headers: { Origin: 'https://foreign.invalid' }, body: JSON.stringify({ request: valid.request }) });
    assert.equal((await ai.POST(foreign)).status, 403);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});
