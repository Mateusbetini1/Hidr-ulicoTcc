const projectUrl = 'https://zutnvrnsahmwuvlhhcuy.supabase.co';
const resendUrl = 'https://api.resend.com/emails';
const timeoutMs = 5_000;
const minimumLeaseMs = 2 * timeoutMs + 2_000;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

interface Env {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_DASHBOARD_SECRET: string;
  RESEND_API_KEY: string;
  WG_NOTIFICACAO_REMETENTE: string;
  WG_NOTIFICACAO_DESTINATARIO: string;
}

type Reservation = {
  solicitacao_id: string;
  reserva: string;
  chave_idempotencia: string;
  reservada_ate: string;
  payload: unknown;
};

type DeliveryResult =
  | { result: 'aceito'; id: string }
  | { result: 'rejeitado' | 'repetir' | 'incerto'; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReservation(value: unknown): value is Reservation {
  return isObject(value) && ['solicitacao_id', 'reserva', 'chave_idempotencia'].every((key) => (
    typeof value[key] === 'string' && uuidPattern.test(value[key])
  )) && typeof value.reservada_ate === 'string';
}

function validateConfig(env: Env) {
  if (env.SUPABASE_URL !== projectUrl) throw new Error('supabase_fora_da_homologacao');
  if (!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_') || !env.SUPABASE_DASHBOARD_SECRET ||
      !env.RESEND_API_KEY?.startsWith('re_') || !env.WG_NOTIFICACAO_REMETENTE ||
      env.WG_NOTIFICACAO_REMETENTE.length > 320 || /[\r\n]/.test(env.WG_NOTIFICACAO_REMETENTE) ||
      !env.WG_NOTIFICACAO_DESTINATARIO || env.WG_NOTIFICACAO_DESTINATARIO.length > 254 ||
      !/^[^\s@,;<>]+@gmail\.com$/i.test(env.WG_NOTIFICACAO_DESTINATARIO)) {
    throw new Error('configuracao_notificacoes_invalida');
  }
}

async function rpc(env: Env, name: 'reservar_notificacoes_solicitacao' | 'finalizar_notificacao_solicitacao', args: Record<string, unknown>) {
  try {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...args, p_chave: env.SUPABASE_DASHBOARD_SECRET }),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      console.error('notificacoes_rpc_http', name, response.status);
      throw new Error();
    }
    const result: unknown = await response.json();
    return result;
  } catch {
    throw new Error(name === 'reservar_notificacoes_solicitacao' ? 'reserva_indisponivel' : 'conclusao_indisponivel');
  }
}

async function send(env: Env, reservation: Reservation): Promise<DeliveryResult> {
  const { payload } = reservation;
  // A RPC persiste exatamente estes quatro campos. Campos extras poderiam mudar os destinatários.
  if (!isObject(payload) || Object.keys(payload).length !== 4 || payload.from !== env.WG_NOTIFICACAO_REMETENTE.trim() ||
      !Array.isArray(payload.to) || payload.to.length !== 1 || payload.to[0] !== env.WG_NOTIFICACAO_DESTINATARIO ||
      typeof payload.subject !== 'string' || typeof payload.text !== 'string') {
    return { result: 'rejeitado', error: 'payload_fora_da_configuracao' };
  }

  try {
    const response = await fetch(resendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': reservation.chave_idempotencia,
      },
      body: JSON.stringify(payload),
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (isObject(body) && typeof body.id === 'string' && body.id.trim() && body.id.length <= 128) {
        return { result: 'aceito', id: body.id };
      }
      return { result: 'incerto', error: 'aceite_sem_id' };
    }
    if (response.status === 429) {
      const body: unknown = await response.json().catch(() => null);
      const code = isObject(body) ? body.name : null;
      if (code === 'daily_quota_exceeded' || code === 'monthly_quota_exceeded') {
        return { result: 'rejeitado', error: code };
      }
      return { result: 'repetir', error: 'HTTP 429' };
    }
    const permanent = [400, 401, 403, 404, 405, 413, 422].includes(response.status);
    return { result: permanent ? 'rejeitado' : 'incerto', error: `HTTP ${response.status}` };
  } catch {
    return { result: 'incerto', error: 'resposta_indisponivel' };
  }
}

async function scheduled(_controller: ScheduledController, env: Env) {
  validateConfig(env);
  const batch = await rpc(env, 'reservar_notificacoes_solicitacao', {
    p_remetente: env.WG_NOTIFICACAO_REMETENTE,
    p_destinatario: env.WG_NOTIFICACAO_DESTINATARIO,
  });
  if (!isObject(batch) || !Array.isArray(batch.notificacoes) || batch.notificacoes.length > 10) {
    throw new Error('reserva_resposta_invalida');
  }

  const counts = { aceito: 0, rejeitado: 0, repetir: 0, incerto: 0, ignorado: 0, conclusao_pendente: 0 };
  const processed = new Set<string>();
  for (const reservation of batch.notificacoes) {
    if (!isReservation(reservation) || !(Date.parse(reservation.reservada_ate) - Date.now() >= minimumLeaseMs) ||
        processed.has(reservation.chave_idempotencia)) {
      counts.ignorado++;
      continue;
    }
    processed.add(reservation.chave_idempotencia);
    const delivery = await send(env, reservation);
    try {
      const confirmed = await rpc(env, 'finalizar_notificacao_solicitacao', {
        p_solicitacao_id: reservation.solicitacao_id,
        p_reserva: reservation.reserva,
        p_resultado: delivery.result,
        p_resend_id: delivery.result === 'aceito' ? delivery.id : null,
        p_erro: delivery.result === 'aceito' ? null : delivery.error,
      });
      if (confirmed !== true) throw new Error();
      counts[delivery.result]++;
    } catch {
      // A expiração da reserva mantém o payload e a chave de idempotência para o próximo ciclo.
      counts.conclusao_pendente++;
    }
  }
  console.info('notificacoes_execucao', counts);
  if (counts.conclusao_pendente > 0) throw new Error('notificacoes_conclusao_pendente');
}

export default { scheduled } satisfies ExportedHandler<Env>;
