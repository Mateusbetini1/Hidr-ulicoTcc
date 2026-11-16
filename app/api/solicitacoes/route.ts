import { NextResponse } from 'next/server';
import { characterCount } from '../../lib/character-count';
import { parseTriage, triageDescription } from '../../lib/commercial-triage';
import { verifyQuoteChallenge } from '../../lib/verify-quote-challenge';

type QuotePayload = {
  name?: unknown;
  company?: unknown;
  phone?: unknown;
  email?: unknown;
  request?: unknown;
  website?: unknown;
  triage?: unknown;
  confirmed?: unknown;
  turnstileToken?: unknown;
};

const noStore = { 'Cache-Control': 'no-store' };

export function GET() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const configured = siteKey && process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_HOSTNAME && process.env.SUPABASE_QUOTE_SECRET;
  return configured
    ? NextResponse.json({ siteKey }, { headers: noStore })
    : NextResponse.json({ message: 'A verificação de segurança está indisponível.' }, { status: 503, headers: noStore });
}

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
    return NextResponse.json({ message: 'Dados inválidos.' }, { status: 400 });
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
  const quoteSecret = process.env.SUPABASE_QUOTE_SECRET;
  const challengeSecret = process.env.TURNSTILE_SECRET_KEY;
  const challengeHostname = process.env.TURNSTILE_HOSTNAME;

  if (!supabaseUrl || !supabaseKey || !quoteSecret || !challengeSecret || !challengeHostname) {
    return NextResponse.json(
      { message: 'O recebimento de solicitações ainda está sendo configurado.' },
      { status: 503 },
    );
  }

  const token = payload.turnstileToken;
  if (typeof token !== 'string' || !token.trim() || token.length > 2048) {
    return NextResponse.json({ message: 'Conclua a verificação de segurança antes de enviar.' }, { status: 400 });
  }
  const challenge = await verifyQuoteChallenge(token, challengeSecret, challengeHostname);
  if (challenge !== 'verified') {
    return challenge === 'unavailable'
      ? NextResponse.json({ message: 'A verificação de segurança está indisponível. Tente novamente.' }, { status: 503 })
      : NextResponse.json({ message: 'A verificação de segurança falhou ou expirou. Faça uma nova verificação.' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/rest/v1/rpc/criar_solicitacao_worker`, {
    method: 'POST',
      redirect: 'manual',
      cache: 'no-store',
    headers: {
      apikey: supabaseKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_segredo: quoteSecret,
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
    console.error('Supabase quote request failed', response.status);
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
