import { NextResponse } from 'next/server';
import { getAdminEmail } from '../../../../../lib/admin-auth';
import { createProposalPdf } from '../../../../../lib/proposal-pdf';
import {
  DadosProposta,
  ItemOrcamento,
  Solicitacao,
  supabaseDashboardRpc,
} from '../../../../../lib/supabase-dashboard';

const defaultProposal: DadosProposta = {
  validade_dias: 15,
  prazo_entrega: null,
  condicoes_pagamento: null,
  observacoes: null,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!getAdminEmail(request.headers)) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [requests, items, proposals] = await Promise.all([
      supabaseDashboardRpc<Solicitacao[]>('listar_solicitacoes_painel'),
      supabaseDashboardRpc<ItemOrcamento[]>('listar_itens_orcamento_painel', {
        p_solicitacao_id: id,
      }),
      supabaseDashboardRpc<DadosProposta[]>('obter_dados_proposta_painel', {
        p_solicitacao_id: id,
      }),
    ]);
    const selectedRequest = requests.find((item) => item.id === id);

    if (!selectedRequest) {
      return NextResponse.json({ message: 'Solicitação não encontrada.' }, { status: 404 });
    }
    if (items.length === 0) {
      return NextResponse.json(
        { message: 'Adicione ao menos um item antes de gerar a proposta.' },
        { status: 400 },
      );
    }

    const pdf = await createProposalPdf(selectedRequest, items, proposals[0] ?? defaultProposal);
    const filename = `proposta-wg-${id.slice(0, 8)}.pdf`;
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength);

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível gerar a proposta em PDF.' },
      { status: 502 },
    );
  }
}

