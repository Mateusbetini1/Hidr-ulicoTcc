'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { emptyTriage, parseTriage, pendingFields, serviceLabels, triageDescription, type Triage } from '../lib/commercial-triage';

export function CommercialTriage() {
  const [step, setStep] = useState(1);
  const [description, setDescription] = useState('');
  const [data, setData] = useState<Triage>({ ...emptyTriage });
  const [contact, setContact] = useState({ name: '', company: '', phone: '', email: '', website: '' });
  const [aiAvailable, setAiAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { fetch('/api/triagem').then(r => r.json() as Promise<{ available?: boolean }>).then(r => setAiAvailable(r.available === true)).catch(() => {}); }, []);
  useEffect(() => { if (step > 1 || sent) heading.current?.focus(); }, [step, sent]);

  async function organize() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/triagem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request: description, website: contact.website }), signal: AbortSignal.timeout(25000) });
      const result = await response.json() as { message?: string; triage?: unknown };
      if (!response.ok) throw new Error(result.message);
      setData(parseTriage(result.triage));
      setMessage('A IA organizou os dados. Confira e corrija antes de enviar.');
      setStep(2);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível consultar a IA.'); }
    finally { lock.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (description.trim().length < 10) { setMessage('Descreva sua necessidade em pelo menos 10 caracteres.'); return; }
    if (step < 3) { setMessage(''); setStep(step + 1); return; }
    lock.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/solicitacoes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...contact, request: description, triage: data, confirmed: true }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Não foi possível enviar.');
      setSent(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível enviar. Seus dados foram mantidos.'); }
    finally { lock.current = false; setBusy(false); }
  }

  if (sent) return <section className="triage-card"><p className="public-kicker">Solicitação recebida</p><h2 ref={heading} tabIndex={-1}>Agora é com nossa equipe</h2><p>Seus dados foram enviados para avaliação. A equipe entrará em contato para confirmar as informações técnicas e preparar o orçamento.</p><p>O envio não confirma preço, prazo de entrega ou agendamento.</p><a href="/contato">Voltar ao contato</a></section>;
  const missing = pendingFields(data);
  return <form className="triage-card" onSubmit={submit}>
    <ol className="triage-progress" aria-label="Etapas do atendimento">{['Sua necessidade', 'Dados técnicos', 'Revisão e contato'].map((label, i) => <li key={label} aria-current={step === i + 1 ? 'step' : undefined}><span>{i + 1}</span>{label}</li>)}</ol>
    <h2 ref={heading} tabIndex={-1}>{step === 1 ? 'Conte o que você precisa' : step === 2 ? 'Vamos completar seu pedido' : 'Confira antes de enviar'}</h2>
    {step === 1 && <>
      <p>Descreva a fabricação, manutenção ou reforma de que precisa. Se não souber as medidas, podemos seguir com o que você tem.</p>
      <label>Sua necessidade<textarea disabled={busy} required minLength={10} maxLength={1000} rows={5} value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex.: preciso revisar dois cilindros de uma máquina florestal que estão vazando." /></label>
      {aiAvailable ? <><p className="triage-hint">Ao organizar com IA, esta descrição será processada pela OpenAI. Informe apenas a necessidade técnica, sem dados pessoais.</p><button type="button" className="triage-secondary" disabled={busy || description.trim().length < 10} onClick={organize}>{busy ? 'Organizando…' : 'Organizar descrição com IA'}</button></> : <p className="triage-hint">Atendimento guiado: preencha os dados e a equipe avaliará sua solicitação.</p>}
    </>}
    {step === 2 && <>
      <p>Preencha apenas o que souber. As informações em branco serão confirmadas pela equipe.</p>
      <label>Tipo de atendimento<select value={data.servico} onChange={e => setData({ ...data, servico: e.target.value as Triage['servico'] })}>{Object.entries(serviceLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {([
        ['aplicacao', 'Em qual equipamento ou aplicação?', 'Ex.: máquina florestal; informe o modelo se souber'],
        ['quantidade', 'Quantos cilindros ou peças?', 'Ex.: 2 cilindros'],
        ['medidas', 'Medidas ou identificação disponíveis', 'Modelo, código, curso, diâmetro ou pressão já conhecidos'],
        ['problema', 'Qual problema ou necessidade?', 'Ex.: vazamento, perda de força ou peça danificada'],
        ['prazoDesejado', 'Quando você precisa? (opcional)', 'Prazo desejado, sujeito à avaliação'],
      ] as const).map(([key,label,placeholder]) => <label key={key}>{label}<input value={data[key]} maxLength={key === 'quantidade' ? 80 : 250} placeholder={placeholder} onChange={e => setData({ ...data, [key]: e.target.value })} /></label>)}
      <p className="triage-hint">Não é necessário desmontar ou operar o equipamento para obter essas informações.</p>
    </>}
    {step === 3 && <>
      <div className="triage-summary"><p>{description}</p><dl>{[['Serviço', serviceLabels[data.servico]], ['Aplicação', data.aplicacao], ['Quantidade', data.quantidade], ['Medidas', data.medidas], ['Problema', data.problema], ['Prazo desejado', data.prazoDesejado]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value || 'A confirmar'}</dd></div>)}</dl></div>
      {missing.length > 0 && <p className="triage-hint">A equipe vai complementar: {missing.join(', ').toLowerCase()}.</p>}
      <fieldset><legend>Como podemos falar com você?</legend>{([
        ['name', 'Nome', 'text', 120, true], ['company', 'Empresa', 'text', 160, false],
        ['phone', 'WhatsApp', 'tel', 30, true], ['email', 'E-mail', 'email', 180, false],
      ] as const).map(([key,label,type,max,required]) => <label key={key}>{label}{required ? ' *' : ' (opcional)'}<input type={type} value={contact[key]} maxLength={max} minLength={key === 'phone' ? 8 : key === 'name' ? 2 : undefined} required={required} onChange={e => setContact({ ...contact, [key]: e.target.value })} /></label>)}</fieldset>
      <label className="triage-confirm"><input type="checkbox" required />Revisei os dados e quero encaminhá-los à equipe para retorno sobre esta solicitação.</label>
      <p className="triage-hint">Preço, compatibilidade e prazo de entrega serão definidos após avaliação. Nenhuma reunião será agendada neste envio.</p>
      <details><summary>Ver texto que será enviado</summary><pre>{triageDescription(description, data)}</pre></details>
    </>}
    <label className="quote-honeypot" aria-hidden="true">Site<input tabIndex={-1} autoComplete="off" value={contact.website} onChange={e => setContact({ ...contact, website: e.target.value })} /></label>
    {message && <p role="status" className="triage-message">{message}</p>}
    <div className="triage-actions">{step > 1 && <button type="button" className="triage-secondary" disabled={busy} onClick={() => { setMessage(''); setStep(step - 1); }}>Voltar e editar</button>}<button disabled={busy} type="submit">{busy ? 'Aguarde…' : step === 1 ? 'Continuar preenchimento' : step === 2 ? 'Revisar solicitação' : 'Enviar para avaliação'}</button></div>
  </form>;
}
