import Image from 'next/image';
import Link from 'next/link';

const messages: Record<string, string> = {
  credenciais: 'E-mail ou senha inválidos.',
  'nao-autorizado': 'Esta conta não está autorizada a acessar o painel.',
  configuracao: 'O acesso ainda não foi configurado pelo administrador.',
  indisponivel: 'Não foi possível entrar agora. Tente novamente em instantes.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  return (
    <main className="login-page">
      <section className="login-brand">
        <Link className="public-logo inverse" href="/" aria-label="WG Hidráulica, início">
          <Image src="/logo-wg-inverse.png" alt="WG Hidráulica" width={1000} height={311} priority />
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
            Use a conta administrativa cadastrada para acessar os dados comerciais.
          </p>
          {erro && messages[erro] && <p className="login-error" role="alert">{messages[erro]}</p>}
          <form action="/api/auth/login" method="post">
            <label>
              E-mail
              <input name="email" type="email" autoComplete="username" maxLength={254} required />
            </label>
            <label>
              Senha
              <input name="password" type="password" autoComplete="current-password" minLength={6} maxLength={200} required />
            </label>
            <button type="submit">Entrar no sistema</button>
          </form>
          <small>Apenas contas administrativas autorizadas podem consultar e alterar solicitações.</small>
        </div>
      </section>
    </main>
  );
}
