'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  commercialStatusLabels,
  CommercialStatus,
  isCommercialStatus,
} from '../lib/commercial-status';
import type { Solicitacao } from '../lib/supabase-dashboard';
import { QuoteBuilder } from './quote-builder';
import { RequestHistory } from './request-history';
import { SystemSidebar } from './system-sidebar';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function RequestDetail({
  initialRequest,
  adminEmail,
}: {
  initialRequest: Solicitacao;
  adminEmail: string;
}) {
  const [status, setStatus] = useState<CommercialStatus>(
    isCommercialStatus(initialRequest.status) ? initialRequest.status : 'novo',
  );
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  async function updateStatus(nextStatus: CommercialStatus) {
    const previousStatus = status;
    setStatus(nextStatus);
    setSaving(true);
    setFeedback('');

    try {
      const response = await fetch(
        `/api/painel/solicitacoes/${initialRequest.id}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Falha ao atualizar.');
      setFeedback('Status atualizado com sucesso.');
      setHistoryVersion((version) => version + 1);
    } catch (error) {
      setStatus(previousStatus);
      setFeedback(error instanceof Error ? error.message : 'Falha ao atualizar.');
    } finally {
      setSaving(false);
    }
  }

  const whatsappUrl = `https://wa.me/55${onlyDigits(initialRequest.whatsapp)}`;

  return (
    <main className="app-shell">
      <SystemSidebar adminEmail={adminEmail} />
      <section className="workspace request-workspace">
        <header className="detail-header">
          <div>
            <Link className="back-link" href="/sistema">← Voltar para solicitações</Link>
            <p className="eyebrow">Atendimento comercial</p>
            <h1>{initialRequest.empresa || initialRequest.cliente_nome}</h1>
            <p className="subtitle">Solicitação recebida em {formatDate(initialRequest.criado_em)}.</p>
          </div>
          <label className="detail-status">
            <span>Status do atendimento</span>
            <select
              value={status}
              disabled={saving}
              onChange={(event) => {
                if (isCommercialStatus(event.target.value)) {
                  void updateStatus(event.target.value);
                }
              }}
              className={`stage stage-${status}`}
            >
              {Object.entries(commercialStatusLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </label>
        </header>

        {feedback && (
          <p className="detail-feedback" role="status" aria-live="polite">{feedback}</p>
        )}

        <section className="detail-grid">
          <article className="panel request-description">
            <p className="section-label">Necessidade informada</p>
            <h2>Descrição da solicitação</h2>
            <p>{initialRequest.descricao}</p>
          </article>

          <aside className="panel contact-card">
            <p className="section-label">Contato</p>
            <h2>{initialRequest.cliente_nome}</h2>
            <dl>
              <div><dt>Empresa</dt><dd>{initialRequest.empresa || 'Não informada'}</dd></div>
              <div><dt>WhatsApp</dt><dd>{initialRequest.whatsapp}</dd></div>
              <div><dt>E-mail</dt><dd>{initialRequest.email || 'Não informado'}</dd></div>
              <div><dt>Origem</dt><dd>{initialRequest.origem}</dd></div>
            </dl>
            <div className="contact-actions">
              <a href={whatsappUrl} target="_blank" rel="noreferrer">Conversar no WhatsApp</a>
              {initialRequest.email && <a href={`mailto:${initialRequest.email}`}>Enviar e-mail</a>}
            </div>
          </aside>
        </section>

        <QuoteBuilder
          requestId={initialRequest.id}
          onBudgetStarted={() => {
            if (status === 'novo' || status === 'em_atendimento') setStatus('orcamento');
            setHistoryVersion((version) => version + 1);
          }}
        />

        <RequestHistory requestId={initialRequest.id} refreshKey={historyVersion} />
      </section>
    </main>
  );
}
