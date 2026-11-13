import { NextResponse } from 'next/server';
import { getAdminEmail } from '../../../../../lib/admin-auth';
import { characterCount } from '../../../../../lib/character-count';
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

function parseDecimal(value: unknown, scale: number) {
  if (typeof value !== 'number' && typeof value !== 'string') return Number.NaN;
  const decimal = String(value).trim().replace(',', '.');
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:e([+-]?\d+))?$/i.exec(decimal);
  if (!match) return Number.NaN;
  const [, mantissa, exponent = '0'] = match;
  const digits = mantissa.replace(/[+.-]/g, '');
  if (!/[1-9]/.test(digits)) return 0;
  const fraction = mantissa.split('.')[1] ?? '';
  const trailingZeros = digits.length - digits.replace(/0+$/, '').length;
  if (fraction.length - trailingZeros - Number(exponent) > scale) return Number.NaN;
  return Number(decimal);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!await getAdminEmail(request.headers)) {
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
  if (!await getAdminEmail(request.headers)) {
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
  const quantidade = parseDecimal(payload?.quantidade, 3);
  const valorUnitario = parseDecimal(payload?.valorUnitario, 2);

  const descriptionLength = characterCount(descricao);
  if (descriptionLength < 2 || descriptionLength > 500) {
    return NextResponse.json({ message: 'Informe uma descrição do item de 2 a 500 caracteres.' }, { status: 400 });
  }
  if (!(quantidade >= 0.001 && quantidade <= 999999)) {
    return NextResponse.json({ message: 'Informe uma quantidade entre 0,001 e 999.999, com até três casas decimais.' }, { status: 400 });
  }
  if (!(valorUnitario >= 0 && valorUnitario <= 9999999999.99)) {
    return NextResponse.json({ message: 'Informe um valor unitário de R$ 0,00 a R$ 9.999.999.999,99, com até duas casas decimais.' }, { status: 400 });
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
