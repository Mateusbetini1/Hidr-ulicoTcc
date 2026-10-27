'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  emptyTriage,
  parseChatbotResult,
  pendingFields,
  serviceLabels,
  triageDescription,
  type Triage,
} from '../lib/commercial-triage';

type Message = { role: 'assistant' | 'user'; content: string };

const welcome: Message = {
  role: 'assistant',
  content: 'Olá! Sou o assistente de triagem da WG Hidráulica. Conte o que você precisa fabricar, reformar ou verificar em um cilindro hidráulico.',
};

export function CommercialChatbot() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState('');
  const [description, setDescription] = useState('');
  const [triage, setTriage] = useState<Triage>({ ...emptyTriage });
  const [ready, setReady] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [contact, setContact] = useState({ name: '', company: '', phone: '', email: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/chatbot')
      .then(response => response.json() as Promise<{ available?: boolean }>)
      .then(result => setAvailable(result.available === true))
      .catch(() => setAvailable(false));
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, ready]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = input.trim();
    if (lock.current || content.length < 4) return;
    if (!description && content.length < 10) {
      setMessage('Conte sua necessidade em pelo menos 10 caracteres.');
      return;
    }
    const nextMessages = [...messages, { role: 'user' as const, content }];
    lock.current = true; setBusy(true); setMessage(''); setInput(''); setMessages(nextMessages);
    if (!description) setDescription(content);
    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages, triage, website: contact.website }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json() as { message?: string } & Record<string, unknown>;
      if (!response.ok) throw new Error(result.message || 'Não foi possível continuar o atendimento.');
      const parsed = parseChatbotResult(result);
      setTriage(parsed.triage);
      setReady(parsed.readyForReview);
      setHandoff(parsed.handoffRequested);
      setMessages(current => [...current, { role: 'assistant', content: parsed.reply }]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível continuar o atendimento.');
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, request: description, triage, confirmed: true }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Não foi possível enviar.');
      setSent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar. Seus dados foram mantidos.');
    } finally {
      lock.current = false; setBusy(false);
    }
  }

  if (available === null) return <section className="chatbot-card chatbot-unavailable"><p>Preparando o atendimento…</p></section>;
  if (!available) return <section className="chatbot-card chatbot-unavailable"><p className="public-kicker">Atendimento guiado</p><h2>Assistente temporariamente indisponível</h2><p>Você ainda pode enviar sua necessidade pelo formulário convencional.</p><Link href="/contato">Abrir formulário de orçamento</Link></section>;
  if (sent) return <section className="chatbot-card chatbot-unavailable"><p className="public-kicker">Solicitação recebida</p><h2>Atendimento encaminhado</h2><p>A equipe WG analisará as informações e entrará em contato. O envio não confirma preço, compatibilidade ou prazo de entrega.</p><Link href="/">Voltar ao site</Link></section>;

  const missing = pendingFields(triage);
  return <section className="chatbot-card">
    <header className="chatbot-heading"><div><p className="public-kicker">Assistente WG</p><h2>Triagem comercial</h2></div><span><i /> Online</span></header>
    <div className="chatbot-messages" aria-live="polite">
      {messages.map((item, index) => <div key={`${item.role}-${index}`} className={`chat-message ${item.role}`}><span>{item.role === 'assistant' ? 'WG' : 'Você'}</span><p>{item.content}</p></div>)}
      {busy && <div className="chat-message assistant"><span>WG</span><p>Organizando as informações…</p></div>}
      <div ref={end} />
    </div>
    <form className="chatbot-composer" onSubmit={send}>
      <label htmlFor="chat-message">Sua mensagem</label>
      <div><textarea id="chat-message" rows={2} maxLength={1000} value={input} disabled={busy} placeholder={ready ? 'Envie uma correção ou informação complementar' : 'Digite aqui…'} onChange={event => setInput(event.target.value)} /><button disabled={busy || input.trim().length < 4} type="submit">Enviar</button></div>
      <small>Não envie nome, telefone ou e-mail nesta conversa. A IA não informa preços nem confirma prazos.</small>
    </form>
    {ready && <form className="chatbot-review" onSubmit={submit}>
      <div className="chatbot-review-heading"><div><p className="public-kicker">Revisão humana</p><h3>{handoff ? 'Encaminhar para a equipe' : 'Confira a triagem'}</h3></div><span>{missing.length ? `${missing.length} ponto(s) a confirmar` : 'Dados organizados'}</span></div>
      <div className="chatbot-summary"><p>{description}</p><dl>{([
        ['Serviço', serviceLabels[triage.servico]], ['Aplicação', triage.aplicacao], ['Quantidade', triage.quantidade],
        ['Medidas', triage.medidas], ['Problema', triage.problema], ['Prazo desejado', triage.prazoDesejado],
      ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'A confirmar com a equipe'}</dd></div>)}</dl></div>
      <fieldset><legend>Como a equipe pode falar com você?</legend>{([
        ['name', 'Nome', 'text', 120, true], ['company', 'Empresa', 'text', 160, false],
        ['phone', 'WhatsApp', 'tel', 30, true], ['email', 'E-mail', 'email', 180, false],
      ] as const).map(([key, label, type, max, required]) => <label key={key}>{label}{required ? ' *' : ' (opcional)'}<input type={type} value={contact[key]} maxLength={max} minLength={key === 'phone' ? 8 : key === 'name' ? 2 : undefined} required={required} onChange={event => setContact({ ...contact, [key]: event.target.value })} /></label>)}</fieldset>
      <label className="triage-confirm"><input type="checkbox" required />Revisei os dados e autorizo o encaminhamento desta solicitação à equipe WG.</label>
      <details><summary>Ver texto que será enviado</summary><pre>{triageDescription(description, triage)}</pre></details>
      <label className="quote-honeypot" aria-hidden="true">Site<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={event => setContact({ ...contact, website: event.target.value })} /></label>
      <button disabled={busy} type="submit">{busy ? 'Enviando…' : 'Enviar para avaliação'}</button>
    </form>}
    {message && <p role="status" className="triage-message">{message}</p>}
  </section>;
}
