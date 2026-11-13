import { NextResponse } from 'next/server';
import { characterCount } from '../../lib/character-count';
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

function optionalText(value: unknown) {
  if (value == null) return '';
  return typeof value === 'string' ? value.trim() : null;
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
  if (typeof payload.website === 'string' && payload.website.trim()) {
    return NextResponse.json({ message: 'Solicitação enviada com sucesso.' });
  }

  const name = optionalText(payload.name);
  const company = optionalText(payload.company);
  const phone = optionalText(payload.phone);
  const email = optionalText(payload.email);
  let description = optionalText(payload.request);

  const nameLength = characterCount(name ?? '');
  if (nameLength < 2 || nameLength > 120) {
    return NextResponse.json({ message: 'Informe um nome de 2 a 120 caracteres.' }, { status: 400 });
  }
  if (company === null || characterCount(company) > 160) {
    return NextResponse.json({ message: 'Informe um nome de empresa de até 160 caracteres.' }, { status: 400 });
  }
  if (!phone || phone.length > 30 || !/^\+?[\d ().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ message: 'Informe um WhatsApp com pelo menos 8 dígitos e até 30 caracteres.' }, { status: 400 });
  }
  if (email === null || email.length > 180 || (email && !/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*$/i.test(email))) {
    return NextResponse.json({ message: 'Informe um e-mail válido de até 180 caracteres.' }, { status: 400 });
  }

  if (payload.triage !== undefined) {
    try {
      if (payload.confirmed !== true) throw new Error('Revise e confirme os dados antes de enviar.');
      description = triageDescription(typeof payload.request === 'string' ? payload.request : '', parseTriage(payload.triage));
    } catch (error) {
      return NextResponse.json({ message: error instanceof Error ? error.message : 'Triagem inválida.' }, { status: 400 });
    }
  }

  const descriptionLength = characterCount(description ?? '');
  if (descriptionLength < 10 || descriptionLength > 3000) {
    return NextResponse.json({ message: 'Descreva sua necessidade em 10 a 3.000 caracteres.' }, { status: 400 });
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
