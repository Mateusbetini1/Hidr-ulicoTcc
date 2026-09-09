import { NextResponse } from 'next/server';
import { getAdminEmail } from '../../../../../../lib/admin-auth';
import { supabaseDashboardRpc } from '../../../../../../lib/supabase-dashboard';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!getAdminEmail(request.headers)) {
    return NextResponse.json({ message: 'Acesso não autorizado.' }, { status: 401 });
  }

  const { id, itemId } = await params;

  try {
    await supabaseDashboardRpc<boolean>('remover_item_orcamento_painel', {
      p_solicitacao_id: id,
      p_item_id: itemId,
    });
    return NextResponse.json({ message: 'Item removido.' });
  } catch {
    return NextResponse.json(
      { message: 'Não foi possível remover o item do orçamento.' },
      { status: 502 },
    );
  }
}
