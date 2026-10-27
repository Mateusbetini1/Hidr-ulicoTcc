import { PublicFooter, PublicHeader } from '../components/public-shell';
import { CommercialTriage } from '../components/commercial-triage';

export default function AtendimentoPage() {
  return <main className="public-site"><PublicHeader /><section className="triage-layout"><header><p className="public-kicker">Atendimento WG</p><h1>Vamos entender sua necessidade</h1><p>Organize seu pedido de fabricação, manutenção ou reforma de cilindros hidráulicos para avaliação comercial.</p><a href="/contato">Prefere o formulário direto?</a></header><CommercialTriage /></section><PublicFooter /></main>;
}
