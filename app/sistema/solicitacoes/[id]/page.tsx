import { headers } from 'next/headers';
import Link from 'next/link';
import { RequestDetail } from '../../../components/request-detail';
import { getAdminEmail } from '../../../lib/admin-auth';
import { Solicitacao, supabaseDashboardRpc } from '../../../lib/supabase-dashboard';

export const dynamic = 'force-dynamic';

export default async function SolicitacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const adminEmail = getAdminEmail(await headers());

  if (!adminEmail) {
    return (
      <main className="access-denied">
        <span className="brand-mark">WG</span>
        <p className="public-kicker">Área restrita</p>
        <h1>Acesso não autorizado</h1>
        <p>Entre com a conta administrativa autorizada para consultar esta solicitação.</p>
        <Link href="/login">Voltar para o acesso</Link>
      </main>
    );
  }

  const { id } = await params;
  let requests: Solicitacao[] | null = null;

  try {
    requests = await supabaseDashboardRpc<Solicitacao[]>('listar_solicitacoes_painel');
  } catch {
    requests = null;
  }

  if (!requests) {
    return (
      <main className="access-denied">
        <span className="brand-mark">WG</span>
        <p className="public-kicker">Conexão indisponível</p>
        <h1>Não foi possível carregar</h1>
        <p>Tente novamente em instantes ou retorne ao painel comercial.</p>
        <Link href="/sistema">Voltar para o painel</Link>
      </main>
    );
  }

  const selectedRequest = requests.find((request) => request.id === id);

  if (!selectedRequest) {
    return (
      <main className="access-denied">
        <span className="brand-mark">WG</span>
        <p className="public-kicker">Solicitação</p>
        <h1>Registro não encontrado</h1>
        <p>A solicitação pode ter sido removida ou o endereço está incorreto.</p>
        <Link href="/sistema">Voltar para o painel</Link>
      </main>
    );
  }

  return <RequestDetail initialRequest={selectedRequest} adminEmail={adminEmail} />;
}
