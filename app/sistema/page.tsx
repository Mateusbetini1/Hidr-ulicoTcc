import { headers } from 'next/headers';
import Image from 'next/image';
import { CommercialDashboard } from '../components/commercial-dashboard';
import { getAdminEmail } from '../lib/admin-auth';

export const dynamic = 'force-dynamic';

export default async function SistemaPage() {
  const requestHeaders = await headers();
  const adminEmail = await getAdminEmail(requestHeaders);

  if (!adminEmail) {
    return (
      <main className="access-denied">
        <span className="brand-mark">
          <Image src="/logo-wg-mark.png" alt="WG Hidráulica" width={400} height={125} />
        </span>
        <p className="public-kicker">Área restrita</p>
        <h1>Acesso não autorizado</h1>
        <p>Entre com a conta administrativa autorizada para consultar as solicitações.</p>
        <a href="/login">Voltar para o acesso</a>
      </main>
    );
  }

  return <CommercialDashboard adminEmail={adminEmail} />;
}
