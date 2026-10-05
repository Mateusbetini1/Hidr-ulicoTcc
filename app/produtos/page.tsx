import { PageHero, PublicFooter, PublicHeader } from '../components/public-shell';

const catalog: [string, string | null, string][] = [
  ['Cilindro agrícola', '/images/cards/card_cilindros-azuis.webp', 'Cilindros hidráulicos azuis prontos, pendurados em suporte'],
  ['Cilindro industrial', '/images/cards/card_cabecote-montado.webp', 'Cabeçote de cilindro aparafusado com haste cromada'],
  ['Cilindro rodoviário', '/images/cards/card_cilindro-longo.webp', 'Cilindro hidráulico longo pintado de amarelo, com olhal preto'],
  ['Cilindro telescópico', null, ''],
  ['Reforma de cilindro', '/images/cards/card_reforma_antes-e-depois.webp', 'Antes e depois da reforma: cilindros com a pintura gasta e cilindro repintado de amarelo'],
  ['Soluções sob medida', '/images/cards/card_flange-usinada.webp', 'Flange de aço usinada com furação para parafusos'],
];

export default function ProdutosPage() {
  return <main className="public-site"><PublicHeader/><PageHero eyebrow="Soluções hidráulicas" title="Produtos e serviços" text="Projetamos, fabricamos e recuperamos cilindros para diferentes setores e condições de trabalho." banner="/images/banners/banner_produtos.webp"/><section className="catalog-section"><div className="filter-row"><span className="active">Todos</span><span>Agrícola</span><span>Industrial</span><span>Rodoviário</span><span>Serviços</span></div><div className="catalog-grid">{catalog.map(([item,image,alt],index)=><article key={item}>{image?<img className="catalog-image" src={image} alt={alt} width={784} height={460} loading="lazy" decoding="async"/>:<div className={`catalog-image product-${(index%3)+1}`}>WG</div>}<h2>{item}</h2><p>Configuração técnica definida conforme curso, força e aplicação.</p><a href="/contato">Solicitar orçamento →</a></article>)}</div></section>

    {/* TODO: as duas fotos são de cilindros diferentes (do mesmo tipo). Trocar pelas fotos da MESMA
        peça — mesma angulação e mesmo fundo, uma na chegada e outra na saída — assim que a empresa
        registrar um serviço completo. */}
    <section className="rebuild-section">
      <div className="section-intro"><h2>Reforma de cilindros</h2><p>Como os cilindros chegam e como saem daqui.</p></div>
      <div className="rebuild-pair">
        <figure>
          <img src="/images/reforma/reforma_antes.webp" alt="Antes: cilindros com a pintura gasta, como chegam para reforma" width={800} height={1000} loading="lazy" decoding="async"/>
          <figcaption className="rebuild-tag before">Antes</figcaption>
        </figure>
        <figure>
          <img src="/images/reforma/reforma_depois.webp" alt="Depois: cilindro reformado e repintado de amarelo" width={800} height={1000} loading="lazy" decoding="async"/>
          <figcaption className="rebuild-tag after">Depois</figcaption>
        </figure>
      </div>
    </section>

    <section className="project-process"><div><p className="public-kicker">Projeto sob medida</p><h2>O que precisamos saber para criar</h2><p>Nossa equipe organiza as informações essenciais antes de elaborar a proposta.</p></div><ol><li>Curso necessário</li><li>Diâmetro e força de trabalho</li><li>Pressão de operação</li><li>Tipo de fixação</li><li>Ambiente de uso</li></ol></section><PublicFooter/></main>;
}
