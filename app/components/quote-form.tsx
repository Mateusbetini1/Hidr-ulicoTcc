'use client';

import { FormEvent, useRef, useState } from 'react';

type SubmissionState =
  | { kind: 'idle'; message: '' }
  | { kind: 'sending' | 'success' | 'error'; message: string };

export function QuoteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<SubmissionState>({ kind: 'idle', message: '' });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: 'sending', message: 'Enviando sua solicitação…' });

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch('/api/solicitacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message || 'Não foi possível enviar a solicitação.');
      }

      formRef.current?.reset();
      setState({
        kind: 'success',
        message: result.message || 'Solicitação enviada. Nossa equipe entrará em contato.',
      });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.',
      });
    }
  }

  return (
    <form ref={formRef} className="quote-form" onSubmit={handleSubmit}>
      <h2>Solicite seu orçamento</h2>
      <label>
        Nome
        <input name="name" placeholder="Seu nome" minLength={2} maxLength={120} required />
      </label>
      <label>
        Empresa
        <input name="company" placeholder="Nome da empresa" maxLength={160} />
      </label>
      <label>
        WhatsApp
        <input name="phone" type="tel" placeholder="(00) 00000-0000" minLength={8} maxLength={30} required />
      </label>
      <label>
        E-mail
        <input name="email" type="email" placeholder="voce@empresa.com.br" maxLength={180} />
      </label>
      <label>
        Como podemos ajudar?
        <textarea
          name="request"
          rows={4}
          placeholder="Descreva o produto, medida ou problema encontrado"
          minLength={10}
          maxLength={3000}
          required
        />
      </label>
      <label className="quote-honeypot" aria-hidden="true">
        Site
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button type="submit" disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Enviando…' : 'Enviar solicitação'}
      </button>
      {state.kind !== 'idle' && (
        <p className={`form-feedback ${state.kind}`} role="status" aria-live="polite">
          {state.message}
        </p>
      )}
    </form>
  );
}
