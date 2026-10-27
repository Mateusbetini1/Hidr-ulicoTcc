import { NextResponse } from 'next/server';
import { parseTriage, triageDescription } from '../../lib/commercial-triage';

type QuotePayload = {
  name?: unknown;
  company?: unknown;
  phone?: unknown;
  email?: unknown;
  request?: unknown;
  website?: unknown;
  triage?: unknown;
  confirmed?: unknown;
};

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function POST(request: Request) {
  let payload: QuotePayload;

  try {
    const body = await request.text();
    if (body.length > 16000) return NextResponse.json({ message: 'Solicitação muito longa.' }, { status: 413 });
    payload = JSON.parse(body) as QuotePayload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error();
  } catch {
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
  }

  // Campo invisível para usuários: robôs costumam preenchê-lo automaticamente.
  if (text(payload.website, 200)) {
    return NextResponse.json({ message: 'Solicitação enviada com sucesso.' });
  }

  const name = text(payload.name, 120);
  const company = text(payload.company, 160);
  const phone = text(payload.phone, 30);
  const email = text(payload.email, 180);
  let description = text(payload.request, 3000);
  if (payload.triage !== undefined) {
    try {
      if (payload.confirmed !== true) throw new Error('Revise e confirme os dados antes de enviar.');
      description = triageDescription(typeof payload.request === 'string' ? payload.request : '', parseTriage(payload.triage));
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : 'Triagem inválida.' }, { status: 400 });
    }
  }

  if (name.length < 2 || phone.length < 8 || description.length < 10) {
    return NextResponse.json(
      { message: 'Preencha nome, WhatsApp e uma descrição mais detalhada.' },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { message: 'O recebimento de solicitações ainda está sendo configurado.' },
      { status: 503 },
    );
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/criar_solicitacao_publica`, {
    method: 'POST',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_nome: name,
      p_empresa: company || null,
      p_whatsapp: phone,
      p_email: email || null,
      p_descricao: description,
      p_origem: payload.triage !== undefined ? 'site_triagem' : 'site',
    }),
  });
  } catch {
    return NextResponse.json({ message: 'Não foi possível conectar ao atendimento. Seus dados foram mantidos; tente novamente.' }, { status: 502 });
  }

  if (!response.ok) {
    console.error('Supabase quote request failed', response.status, await response.text());
    return NextResponse.json(
      { message: 'Não foi possível registrar agora. Tente novamente em instantes.' },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { message: 'Solicitação enviada. Nossa equipe entrará em contato.' },
    { status: 201 },
  );
}
