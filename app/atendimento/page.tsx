import { PublicFooter, PublicHeader } from '../components/public-shell';
import { CommercialChatbot } from '../components/commercial-chatbot';

export default function AtendimentoPage() {
  return <main className="public-site"><PublicHeader /><section className="triage-layout"><header><p className="public-kicker">Atendimento WG</p><h1>Converse sobre sua necessidade</h1><p>O assistente organiza as informações iniciais para fabricação, manutenção ou reforma de cilindros hidráulicos. A equipe humana revisa os dados antes de definir preço, compatibilidade e prazo.</p><a href="/contato">Prefere o formulário direto?</a></header><CommercialChatbot /></section><PublicFooter /></main>;
}
