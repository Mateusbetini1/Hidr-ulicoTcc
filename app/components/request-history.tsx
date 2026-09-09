'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { commercialStatusLabels, isCommercialStatus } from '../lib/commercial-status';
import type { HistoricoComercial } from '../lib/supabase-dashboard';

const activityLabels = {
  status: 'Mudança de status',
  observacao: 'Observação interna',
  contato: 'Contato com o cliente',
  medidas_recebidas: 'Medidas recebidas',
  proposta_enviada: 'Proposta enviada',
} satisfies Record<HistoricoComercial['tipo'], string>;

type ActivityType = Exclude<HistoricoComercial['tipo'], 'status'>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(value: string | null) {
  return value && isCommercialStatus(value) ? commercialStatusLabels[value] : null;
}

async function fetchHistory(requestId: string) {
  const response = await fetch(`/api/painel/solicitacoes/${requestId}/historico`, {
    cache: 'no-store',
  });
  const result = (await response.json()) as {
    historico?: HistoricoComercial[];
    message?: string;
  };

  if (!response.ok) throw new Error(result.message || 'Falha ao carregar o histórico.');
  return result.historico ?? [];
}

export function RequestHistory({
  requestId,
  refreshKey,
}: {
  requestId: string;
  refreshKey: number;
}) {
  const [history, setHistory] = useState<HistoricoComercial[]>([]);
  const [activityType, setActivityType] = useState<ActivityType>('observacao');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadHistory = useCallback(async () => {
    setError('');
    try {
      setHistory(await fetchHistory(requestId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    let isActive = true;

    fetchHistory(requestId)
      .then((loadedHistory) => {
        if (isActive) setHistory(loadedHistory);
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
  }, [requestId, refreshKey]);

  async function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(`/api/painel/solicitacoes/${requestId}/historico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: activityType, descricao: description }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Falha ao registrar.');

      setDescription('');
      setFeedback('Atividade adicionada à linha do tempo.');
      await loadHistory();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel request-history" aria-labelledby="history-title">
      <div className="history-heading">
        <div>
          <p className="section-label">Rastreabilidade</p>
          <h2 id="history-title">Histórico do atendimento</h2>
        </div>
        <button className="history-refresh" type="button" onClick={() => void loadHistory()}>
          Atualizar
        </button>
      </div>

      <form className="history-form" onSubmit={saveActivity}>
        <label>
          Tipo de registro
          <select
            value={activityType}
            onChange={(event) => setActivityType(event.target.value as ActivityType)}
          >
            <option value="observacao">Observação interna</option>
            <option value="contato">Contato com o cliente</option>
            <option value="medidas_recebidas">Medidas recebidas</option>
            <option value="proposta_enviada">Proposta enviada</option>
          </select>
        </label>
        <label className="history-description">
          Descrição
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            minLength={2}
            maxLength={2000}
            rows={3}
            placeholder="Ex.: Cliente confirmou as medidas e aguarda retorno até sexta-feira."
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? 'Registrando…' : 'Registrar atividade'}
        </button>
      </form>

      {error && <p className="quote-message error" role="alert">{error}</p>}
      {feedback && <p className="quote-message success" role="status">{feedback}</p>}

      <div className="timeline" aria-live="polite">
        {loading && <p className="dashboard-state">Carregando histórico…</p>}
        {!loading && history.length === 0 && !error && (
          <p className="dashboard-state">Nenhum evento registrado.</p>
        )}
        {history.map((entry) => {
          const previousStatus = statusLabel(entry.status_anterior);
          const nextStatus = statusLabel(entry.status_novo);

          return (
            <article className="timeline-entry" key={`${entry.tipo}-${entry.id}`}>
              <span className={`timeline-marker timeline-${entry.tipo}`} aria-hidden="true" />
              <div>
                <div className="timeline-title">
                  <strong>{activityLabels[entry.tipo]}</strong>
                  <time dateTime={entry.criado_em}>{formatDate(entry.criado_em)}</time>
                </div>
                {entry.tipo === 'status' && nextStatus && (
                  <p className="status-transition">
                    {previousStatus ? `${previousStatus} → ${nextStatus}` : nextStatus}
                  </p>
                )}
                <p>{entry.descricao}</p>
                <small>Responsável: {entry.responsavel || 'Sistema'}</small>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
