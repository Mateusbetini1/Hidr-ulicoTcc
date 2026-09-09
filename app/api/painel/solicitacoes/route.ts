import { NextResponse } from 'next/server';
import { getAdminEmail } from '../../../lib/admin-auth';
import { Solicitacao, supabaseDashboardRpc } from '../../../lib/supabase-dashboard';

export async function GET(request: Request) {
  if (!getAdminEmail(request.headers)) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  try {
    const solicitacoes = await supabaseDashboardRpc<Solicitacao[]>(
      'listar_solicitacoes_painel',
    );
    return NextResponse.json({ solicitacoes });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível carregar as solicitações.' },
      { status: 502 },
    );
  }
}
