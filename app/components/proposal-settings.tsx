'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { DadosProposta } from '../lib/supabase-dashboard';

type ProposalForm = {
  validadeDias: string;
  prazoEntrega: string;
  condicoesPagamento: string;
  observacoes: string;
};

const defaultForm: ProposalForm = {
  validadeDias: '15',
  prazoEntrega: '',
  condicoesPagamento: '',
  observacoes: '',
};

function toForm(proposal: DadosProposta): ProposalForm {
  return {
    validadeDias: String(proposal.validade_dias),
    prazoEntrega: proposal.prazo_entrega ?? '',
    condicoesPagamento: proposal.condicoes_pagamento ?? '',
    observacoes: proposal.observacoes ?? '',
  };
}

export function ProposalSettings({
  requestId,
  hasItems,
}: {
  requestId: string;
  hasItems: boolean;
}) {
  const [form, setForm] = useState<ProposalForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let isActive = true;

    fetch(`/api/painel/solicitacoes/${requestId}/proposta/dados`, { cache: 'no-store' })
      .then(async (response) => {
        const result = (await response.json()) as {
          proposta?: DadosProposta;
          message?: string;
        };
        if (!response.ok || !result.proposta) {
          throw new Error(result.message || 'Falha ao carregar a proposta.');
        }
        if (isActive) setForm(toForm(result.proposta));
      })
      .catch((loadError: unknown) => {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar.');
        }
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [requestId]);

  async function saveProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(
        `/api/painel/solicitacoes/${requestId}/proposta/dados`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Falha ao salvar.');
      setFeedback('Condições comerciais salvas. O PDF já pode ser gerado.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="proposal-settings" aria-labelledby="proposal-settings-title">
      <div>
        <p className="section-label">Condições da proposta</p>
        <h3 id="proposal-settings-title">Informações do documento</h3>
      </div>

      <form className="proposal-form" onSubmit={saveProposal}>
        <label>
          Validade em dias
          <input
            type="number"
            min="1"
            max="365"
            value={form.validadeDias}
            onChange={(event) => setForm({ ...form, validadeDias: event.target.value })}
            disabled={loading}
            required
          />
        </label>
        <label>
          Prazo de entrega
          <input
            maxLength={300}
            value={form.prazoEntrega}
            onChange={(event) => setForm({ ...form, prazoEntrega: event.target.value })}
            placeholder="Ex.: 20 dias úteis após aprovação"
            disabled={loading}
          />
        </label>
        <label className="proposal-payment">
          Condições de pagamento
          <textarea
            rows={2}
            maxLength={500}
            value={form.condicoesPagamento}
            onChange={(event) => setForm({ ...form, condicoesPagamento: event.target.value })}
            placeholder="Ex.: 50% na aprovação e 50% na entrega"
            disabled={loading}
          />
        </label>
        <label className="proposal-notes">
          Observações comerciais
          <textarea
            rows={3}
            maxLength={2000}
            value={form.observacoes}
            onChange={(event) => setForm({ ...form, observacoes: event.target.value })}
            placeholder="Garantia, frete, impostos ou outras informações relevantes"
            disabled={loading}
          />
        </label>
        <div className="proposal-actions">
          <button className="secondary-button" type="submit" disabled={loading || saving}>
            {saving ? 'Salvando…' : 'Salvar condições'}
          </button>
          <a
            className={`primary-button primary-link${hasItems ? '' : ' disabled'}`}
            href={hasItems ? `/api/painel/solicitacoes/${requestId}/proposta` : undefined}
            aria-disabled={!hasItems}
          >
            Baixar proposta em PDF
          </a>
        </div>
      </form>

      {!hasItems && <p className="proposal-hint">Adicione ao menos um item para gerar o PDF.</p>}
      {error && <p className="quote-message error" role="alert">{error}</p>}
      {feedback && <p className="quote-message success" role="status">{feedback}</p>}
    </section>
  );
}

