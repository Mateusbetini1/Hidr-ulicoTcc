import Image from 'next/image';
import Link from 'next/link';

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link className="public-logo" href="/" aria-label="WG Hidráulica, início">
        <Image src="/logo-wg.png" alt="WG Hidráulica" width={1000} height={311} priority />
      </Link>
      <nav aria-label="Navegação do site">
        <Link href="/">Início</Link>
        <Link href="/quem-somos">Quem somos</Link>
        <Link href="/produtos">Produtos</Link>
        <Link href="/aplicacoes">Aplicações</Link>
        <Link href="/contato">Contato</Link>
      </nav>
      <Link className="quote-link" href="/contato">Solicitar orçamento</Link>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-logo inverse">
        <Image src="/logo-wg-inverse.png" alt="WG Hidráulica" width={1000} height={311} />
      </div>
      <p>Soluções hidráulicas para operações que não podem parar.</p>
      <div>
        <strong>Navegação</strong>
        <Link href="/produtos">Produtos</Link>
        <Link href="/aplicacoes">Aplicações</Link>
        <Link href="/contato">Contato</Link>
      </div>
      <div>
        <strong>Sistema</strong>
        <Link href="/login">Acesso interno</Link>
      </div>
    </footer>
  );
}

export function PageHero({
  eyebrow,
  title,
  text,
  banner,
}: {
  eyebrow: string;
  title: string;
  text: string;
  banner?: string;
}) {
  return (
    <section
      className={banner ? 'page-hero with-banner' : 'page-hero'}
      style={banner ? { backgroundImage: `url('${banner}')` } : undefined}
    >
      <p className="public-kicker">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  );
}
