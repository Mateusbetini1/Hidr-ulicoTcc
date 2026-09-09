import { NextResponse } from 'next/server';
import { getAdminEmail } from '../../../../../lib/admin-auth';
import {
  ItemOrcamento,
  supabaseDashboardRpc,
} from '../../../../../lib/supabase-dashboard';

type ItemPayload = {
  itemId?: unknown;
  descricao?: unknown;
  quantidade?: unknown;
  valorUnitario?: unknown;
};

function parseNumber(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  return Number(value.replace(',', '.'));
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
    const itens = await supabaseDashboardRpc<ItemOrcamento[]>(
      'listar_itens_orcamento_painel',
      { p_solicitacao_id: id },
    );
    return NextResponse.json({ itens });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível carregar os itens do orçamento.' },
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
  const payload = (await request.json().catch(() => null)) as ItemPayload | null;
  // Um item novo ainda não possui UUID; texto vazio precisa chegar ao banco como null.
  const itemId =
    typeof payload?.itemId === 'string' && payload.itemId.trim()
      ? payload.itemId.trim()
      : null;
  const descricao = typeof payload?.descricao === 'string' ? payload.descricao.trim() : '';
  const quantidade = parseNumber(payload?.quantidade);
  const valorUnitario = parseNumber(payload?.valorUnitario);

  if (
    descricao.length < 2 ||
    descricao.length > 500 ||
    !Number.isFinite(quantidade) ||
    quantidade <= 0 ||
    quantidade > 999999 ||
    !Number.isFinite(valorUnitario) ||
    valorUnitario < 0 ||
    valorUnitario > 9999999999.99
  ) {
    return NextResponse.json({ message: 'Preencha o item com valores válidos.' }, { status: 400 });
  }

  try {
    const savedItemId = await supabaseDashboardRpc<string>('salvar_item_orcamento_painel', {
      p_solicitacao_id: id,
      p_item_id: itemId,
      p_descricao: descricao,
      p_quantidade: quantidade,
      p_valor_unitario: valorUnitario,
    });
    return NextResponse.json({ id: savedItemId, message: 'Item salvo com sucesso.' });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível salvar o item do orçamento.' },
      { status: 502 },
    );
  }
}
