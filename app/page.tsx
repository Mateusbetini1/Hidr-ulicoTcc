import { PublicFooter, PublicHeader } from './components/public-shell';

const products: [string, string, string, string][] = [
  [
    'Cilindros hidráulicos',
    'Soluções para aplicações industriais e móveis.',
    '/images/cards/card_olhais-amarelos.webp',
    'Olhais de cilindros amarelos com bloco de tomada usinado',
  ],
  [
    'Cilindros especiais',
    'Projetos desenvolvidos conforme a sua necessidade.',
    '/images/cards/card_cilindros-azuis.webp',
    'Cilindros hidráulicos azuis prontos, pendurados em suporte',
  ],
  [
    'Reforma e manutenção',
    'Recuperação completa com avaliação técnica.',
    '/images/cards/card_reforma_antes-e-depois.webp',
    'Antes e depois da reforma: cilindros com a pintura gasta e cilindro repintado de amarelo',
  ],
];

const steps: [string, string, string, string][] = [
  ['/images/processo/1_usinagem.webp', 'Blocos de aço usinados com furos roscados', 'Usinagem', 'Blocos, cabeçotes e roscas feitos sob medida.'],
  ['/images/processo/2_solda.webp', 'Solda do cabeçote no tubo do cilindro', 'Solda', 'Cabeçotes e olhais soldados ao tubo.'],
  ['/images/processo/3_montagem.webp', 'Cabeçote aparafusado com haste cromada', 'Montagem', 'Haste, vedação e cabeçote aparafusado.'],
  ['/images/processo/4_pintura.webp', 'Cilindros azuis na cabine de pintura', 'Pintura', 'Pintura e acabamento final.'],
  ['/images/processo/5_pronto.webp', 'Cilindros amarelos prontos com tomadas vedadas', 'Pronto', 'Tomadas vedadas, pronto para instalar.'],
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
        <img
          className="hero-visual"
          src="/images/destaques/hero_cilindros-amarelos.webp"
          alt="Cilindros hidráulicos amarelos com cabeçote aparafusado, haste cromada e olhal preto"
          width={1200}
          height={940}
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </section>

      <section className="public-section" id="produtos">
        <div className="section-intro"><p className="public-kicker">Soluções completas</p><h2>Nossos produtos</h2><p>Atendimento técnico desde o diagnóstico até a entrega.</p></div>
        <div className="product-grid">{products.map(([title, description, image, alt]) => <article className="product-card" key={title}><img className="product-visual" src={image} alt={alt} width={784} height={460} loading="lazy" decoding="async" /><h3>{title}</h3><p>{description}</p><a href="/contato">Solicitar orçamento →</a></article>)}</div>
      </section>

      <section className="process-section" id="producao">
        <div className="process-intro">
          <h2>Do aço bruto à peça pronta</h2>
          <p>Fotos reais da nossa produção.</p>
        </div>
        <ol className="process-steps">
          {steps.map(([image, alt, title, description]) => (
            <li key={title}>
              <img src={image} alt={alt} width={800} height={1000} loading="lazy" decoding="async" />
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="manufacturing" id="empresa">
        <img
          className="manufacturing-visual"
          src="/images/destaques/quem-somos_cabine-de-pintura.webp"
          alt="Cilindros azuis recém-pintados na cabine de pintura"
          width={1120}
          height={880}
          loading="lazy"
          decoding="async"
        />
        <div><p className="public-kicker">Estrutura própria</p><h2>Fabricação própria, do projeto à entrega</h2><p>Nossa equipe acompanha todas as etapas para garantir precisão, resistência e confiabilidade.</p><div className="numbers"><span><strong>+400</strong>projetos</span><span><strong>+1000</strong>serviços</span><span><strong>100%</strong>testado</span></div></div>
      </section>

      <section className="applications" id="aplicacoes"><p className="public-kicker">Onde atuamos</p><h2>Soluções para diferentes operações</h2><div><span>Agrícola</span><span>Industrial</span><span>Rodoviário</span><span>Máquinas especiais</span></div></section>
      <section className="public-cta" id="contato"><h2>Precisa de um cilindro sob medida?</h2><p>Conte sua necessidade e nossa equipe prepara uma avaliação inicial.</p><a href="/contato">Solicitar orçamento</a></section>
      <PublicFooter />
    </main>
  );
}
