import { NextResponse } from 'next/server';
import { getAdminEmail } from '../../../../../lib/admin-auth';
import {
  HistoricoComercial,
  supabaseDashboardRpc,
} from '../../../../../lib/supabase-dashboard';

const activityTypes = [
  'observacao',
  'contato',
  'medidas_recebidas',
  'proposta_enviada',
] as const;

type ActivityType = (typeof activityTypes)[number];

function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && activityTypes.includes(value as ActivityType);
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
    const historico = await supabaseDashboardRpc<HistoricoComercial[]>(
      'listar_historico_painel',
      { p_solicitacao_id: id },
    );
    return NextResponse.json({ historico });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível carregar o histórico.' },
      { status: 502 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminEmail = getAdminEmail(request.headers);
  if (!adminEmail) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { id } = await params;
  const payload = (await request.json().catch(() => null)) as
    | { tipo?: unknown; descricao?: unknown }
    | null;
  const descricao =
    typeof payload?.descricao === 'string' ? payload.descricao.trim() : '';

  if (!isActivityType(payload?.tipo) || descricao.length < 2 || descricao.length > 2000) {
    return NextResponse.json(
      { message: 'Informe o tipo e uma descrição válida.' },
      { status: 400 },
    );
  }

  try {
    const activityId = await supabaseDashboardRpc<string>(
      'registrar_atividade_painel',
      {
        p_solicitacao_id: id,
        p_tipo: payload.tipo,
        p_descricao: descricao,
        p_responsavel_email: adminEmail,
      },
    );
    return NextResponse.json({ id: activityId, message: 'Atividade registrada.' });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível registrar a atividade.' },
      { status: 502 },
    );
  }
}
