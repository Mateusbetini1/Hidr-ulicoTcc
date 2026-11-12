import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const [workflow] = JSON.parse(await readFile(
  new URL('../infra/n8n/workflows/nova-solicitacao.json', import.meta.url), 'utf8',
));
const node = name => workflow.nodes.find(item => item.name === name);
const reserva = {
  solicitacao_id: 'solicitacao-teste',
  reserva: 'reserva-teste',
  chave_idempotencia: 'chave-teste',
  payload: { from: 'origem@example.invalid', to: ['destino@example.invalid'], text: 'Teste' },
};
const evaluate = (expression, context) => runInNewContext(expression.slice(3, -2), context);

test('workflow envia o payload persistido com a chave de idempotência e uma reserva vigente', () => {
  const send = node('Notificar equipe por e-mail');
  const { body, headerParameters, options } = send.parameters;
  const item = { ...reserva, reservada_ate: new Date(Date.now() + 60000).toISOString() };
  const key = headerParameters.parameters.find(header => header.name === 'Idempotency-Key');
  assert.equal(evaluate(key.value, { $json: item }), reserva.chave_idempotencia);
  assert.equal(evaluate(body, { $json: item }), JSON.stringify(reserva.payload));
  assert.throws(() => evaluate(body, {
    $json: { ...item, reservada_ate: new Date(0).toISOString() },
  }), /Reserva insuficiente/);
  assert.equal(send.onError, 'continueRegularOutput');
  assert.equal(options.response.response.fullResponse, true);
  assert.equal(options.response.response.neverError, true);
});

test('workflow classifica aceite, rejeição, limite e resultado incerto', () => {
  const classify = node('Classificar resultado do envio');
  const classifyResponse = response => runInNewContext(`(function () {
    ${classify.parameters.jsCode}
  })()`, {
    $json: response,
    $: name => {
      assert.equal(name, 'Expandir reservas');
      return { item: { json: reserva } };
    },
  }).json;

  const accepted = classifyResponse({ statusCode: 200, body: { id: 'resend-teste' } });
  assert.equal(accepted.resultado, 'aceito');
  assert.equal(accepted.resend_id, 'resend-teste');
  assert.equal(accepted.reserva, reserva.reserva);
  assert.equal(accepted.solicitacao_id, reserva.solicitacao_id);
  assert.equal(classifyResponse({ statusCode: 422 }).resultado, 'rejeitado');
  assert.equal(classifyResponse({ statusCode: 429 }).resultado, 'repetir');
  for (const response of [{ error: 'timeout' }, { statusCode: 500 }, { statusCode: 409 }, { statusCode: 200 }]) {
    assert.equal(classifyResponse(response).resultado, 'incerto');
  }
  const registrar = node('Registrar resultado no Supabase');
  const args = JSON.parse(evaluate(registrar.parameters.body, {
    $json: accepted, $env: { SUPABASE_DASHBOARD_SECRET: 'chave-de-teste' },
  }));
  assert.equal(args.p_reserva, reserva.reserva);
  assert.equal(args.p_resend_id, 'resend-teste');
  assert.ok(workflow.nodes.every(item => !item.parameters.url?.includes('atualizar_status_painel')));
});
