import { NextResponse } from "next/server";
import { getAdminEmail } from "../../../../../../lib/admin-auth";
import { characterCount } from "../../../../../../lib/character-count";
import {
  DadosProposta,
  supabaseDashboardRpc,
} from "../../../../../../lib/supabase-dashboard";

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

function optionalText(value: unknown) {
  if (value == null) return "";
  return typeof value === "string" ? value.trim() : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminEmail(request.headers))) {
    return NextResponse.json(
      { message: "Acesso não autorizado." },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const proposals = await supabaseDashboardRpc<DadosProposta[]>(
      "obter_dados_proposta_painel",
      { p_solicitacao_id: id },
    );
    return NextResponse.json({
      proposta: proposals[0] ?? defaultProposal,
      // A linha só existe em `orcamentos` depois que as condições são salvas.
      salva: proposals.length > 0,
    });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível carregar os dados da proposta." },
      { status: 502 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminEmail(request.headers))) {
    return NextResponse.json(
      { message: "Acesso não autorizado." },
      { status: 401 },
    );
  }

  const { id } = await params;
  const payload = (await request
    .json()
    .catch(() => null)) as ProposalPayload | null;
  const validity = payload?.validadeDias;
  const validadeDias = typeof validity === "number" || (typeof validity === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(validity.trim()))
    ? Number(validity)
    : Number.NaN;
  const prazoEntrega = optionalText(payload?.prazoEntrega);
  const condicoesPagamento = optionalText(payload?.condicoesPagamento);
  const observacoes = optionalText(payload?.observacoes);

  if (
    !Number.isInteger(validadeDias) ||
    validadeDias < 1 ||
    validadeDias > 365
  ) {
    return NextResponse.json(
      { message: "Informe uma validade entre 1 e 365 dias." },
      { status: 400 },
    );
  }

  if (prazoEntrega === null || characterCount(prazoEntrega) > 300) {
    return NextResponse.json({ message: "Informe um prazo de entrega de até 300 caracteres." }, { status: 400 });
  }
  if (condicoesPagamento === null || characterCount(condicoesPagamento) > 500) {
    return NextResponse.json({ message: "Informe condições de pagamento de até 500 caracteres." }, { status: 400 });
  }
  if (observacoes === null || characterCount(observacoes) > 2000) {
    return NextResponse.json({ message: "Informe observações de até 2.000 caracteres." }, { status: 400 });
  }

  try {
    await supabaseDashboardRpc<boolean>("salvar_dados_proposta_painel", {
      p_solicitacao_id: id,
      p_validade_dias: validadeDias,
      p_prazo_entrega: prazoEntrega,
      p_condicoes_pagamento: condicoesPagamento,
      p_observacoes: observacoes,
    });
    return NextResponse.json({ message: "Dados da proposta salvos." });
  } catch {
    return NextResponse.json(
      { message: "Não foi possível salvar os dados da proposta." },
      { status: 502 },
    );
  }
}
