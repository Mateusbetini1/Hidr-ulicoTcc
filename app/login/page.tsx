import Link from 'next/link';

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-brand">
        <Link className="public-logo inverse" href="/">
          <span>WG</span><strong>WG Hidráulica</strong>
        </Link>
        <div>
          <p className="public-kicker">Área restrita</p>
          <h1>Sistema interno de produção</h1>
          <p>Central comercial, propostas e automações integradas.</p>
        </div>
      </section>
      <section className="login-form-area">
        <div className="login-form">
          <p className="public-kicker">Acesso da equipe</p>
          <h2>Entrar</h2>
          <p className="login-description">
            O painel utiliza a identidade autorizada do ambiente para proteger os dados comerciais.
          </p>
          <Link className="login-button" href="/sistema" target="_top">Entrar no sistema</Link>
          <small>Apenas contas administrativas autorizadas podem consultar e alterar solicitações.</small>
        </div>
      </section>
    </main>
  );
}
