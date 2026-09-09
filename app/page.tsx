import { PublicFooter, PublicHeader } from './components/public-shell';

const products = [
  ['Cilindros hidráulicos', 'Soluções para aplicações industriais e móveis.'],
  ['Cilindros especiais', 'Projetos desenvolvidos conforme a sua necessidade.'],
  ['Reforma e manutenção', 'Recuperação completa com avaliação técnica.'],
];

export default function LandingPage() {
  return (
    <main className="public-site">
      <PublicHeader />

      <section className="hero" id="inicio">
        <div className="hero-copy">
          <p className="public-kicker">Fabricação, reforma e manutenção</p>
          <h1>Cilindros hidráulicos feitos para a sua operação</h1>
          <p>Projetamos e recuperamos soluções hidráulicas para aplicações industriais, agrícolas e rodoviárias.</p>
          <div className="hero-actions"><a className="whatsapp-action" href="/contato">Fale com nossa equipe</a><a className="secondary-action" href="/produtos">Ver produtos</a></div>
        </div>
        <div className="hero-visual" role="img" aria-label="Área reservada para fotografia de cilindro hidráulico"><span>WG</span><small>Engenharia hidráulica sob medida</small></div>
      </section>

      <section className="public-section" id="produtos">
        <div className="section-intro"><p className="public-kicker">Soluções completas</p><h2>Nossos produtos</h2><p>Atendimento técnico desde o diagnóstico até a entrega.</p></div>
        <div className="product-grid">{products.map(([title, description], index) => <article className="product-card" key={title}><div className={`product-visual product-${index + 1}`}>WG</div><h3>{title}</h3><p>{description}</p><a href="/contato">Solicitar orçamento →</a></article>)}</div>
      </section>

      <section className="manufacturing" id="empresa">
        <div className="manufacturing-visual"><span>Projeto</span><span>Fabricação</span><span>Teste</span></div>
        <div><p className="public-kicker">Estrutura própria</p><h2>Fabricação própria, do projeto à entrega</h2><p>Nossa equipe acompanha todas as etapas para garantir precisão, resistência e confiabilidade.</p><div className="numbers"><span><strong>+400</strong>projetos</span><span><strong>+1000</strong>serviços</span><span><strong>100%</strong>testado</span></div></div>
      </section>

      <section className="applications" id="aplicacoes"><p className="public-kicker">Onde atuamos</p><h2>Soluções para diferentes operações</h2><div><span>Agrícola</span><span>Industrial</span><span>Rodoviário</span><span>Máquinas especiais</span></div></section>
      <section className="public-cta" id="contato"><h2>Precisa de um cilindro sob medida?</h2><p>Conte sua necessidade e nossa equipe prepara uma avaliação inicial.</p><a href="/contato">Solicitar orçamento</a></section>
      <PublicFooter />
    </main>
  );
}
