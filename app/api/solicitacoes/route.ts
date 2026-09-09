import { NextResponse } from 'next/server';

type QuotePayload = {
  name?: unknown;
  company?: unknown;
  phone?: unknown;
  email?: unknown;
  request?: unknown;
  website?: unknown;
};

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function POST(request: Request) {
  let payload: QuotePayload;

  try {
    payload = (await request.json()) as QuotePayload;
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
  const description = text(payload.request, 3000);

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

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/criar_solicitacao_publica`, {
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
      p_origem: 'site',
    }),
  });

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
