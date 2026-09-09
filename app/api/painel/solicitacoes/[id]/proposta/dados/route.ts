import { NextResponse } from 'next/server';
import { getAdminEmail } from '../../../../../../lib/admin-auth';
import {
  DadosProposta,
  supabaseDashboardRpc,
} from '../../../../../../lib/supabase-dashboard';

const defaultProposal: DadosProposta = {
  validade_dias: 15,
  prazo_entrega: null,
  condicoes_pagamento: null,
  observacoes: null,
};

type ProposalPayload = {
  validadeDias?: unknown;
  prazoEntrega?: unknown;
  condicoesPagamento?: unknown;
  observacoes?: unknown;
};

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getAdminEmail(request.headers)) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const proposals = await supabaseDashboardRpc<DadosProposta[]>(
      'obter_dados_proposta_painel',
      { p_solicitacao_id: id },
    );
    return NextResponse.json({ proposta: proposals[0] ?? defaultProposal });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível carregar os dados da proposta.' },
      { status: 502 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getAdminEmail(request.headers)) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as ProposalPayload | null;
  const validadeDias = Number(payload?.validadeDias);
  const prazoEntrega = text(payload?.prazoEntrega, 300);
  const condicoesPagamento = text(payload?.condicoesPagamento, 500);
  const observacoes = text(payload?.observacoes, 2000);

  if (!Number.isInteger(validadeDias) || validadeDias < 1 || validadeDias > 365) {
    return NextResponse.json({ message: 'Informe uma validade entre 1 e 365 dias.' }, { status: 400 });
  }

  try {
    await supabaseDashboardRpc<boolean>('salvar_dados_proposta_painel', {
      p_solicitacao_id: id,
      p_validade_dias: validadeDias,
      p_prazo_entrega: prazoEntrega,
      p_condicoes_pagamento: condicoesPagamento,
      p_observacoes: observacoes,
    });
    return NextResponse.json({ message: 'Dados da proposta salvos.' });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível salvar os dados da proposta.' },
      { status: 502 },
    );
  }
}

