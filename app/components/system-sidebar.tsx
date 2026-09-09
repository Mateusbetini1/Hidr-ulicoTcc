import Link from 'next/link';

function initials(value: string) {
  return value
    .split(/[@.\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function SystemSidebar({ adminEmail }: { adminEmail: string }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">WG</span>
        <span>WG Hidráulica<small>Central comercial</small></span>
      </div>
      <nav aria-label="Navegação principal">
        <Link className="nav-item active" href="/sistema">▦ <span>Visão geral</span></Link>
        <Link className="nav-item" href="/sistema#oportunidades">◎ <span>Solicitações</span></Link>
        <Link className="nav-item" href="/sistema#orcamentos">▤ <span>Orçamentos</span></Link>
        <Link className="nav-item" href="/sistema#automacoes">⌁ <span>Automações</span></Link>
        <Link className="nav-item" href="/">↗ <span>Ver site</span></Link>
      </nav>
      <div className="profile">
        <span className="avatar">{initials(adminEmail)}</span>
        <span>{adminEmail}<small>Administrador</small></span>
      </div>
    </aside>
  );
}

