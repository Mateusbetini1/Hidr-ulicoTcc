'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { commercialStatusLabels, funnelStatuses } from '../lib/commercial-status';
import type { Solicitacao } from '../lib/supabase-dashboard';
import { SystemSidebar } from './system-sidebar';

async function fetchSolicitacoes() {
  const response = await fetch('/api/painel/solicitacoes', { cache: 'no-store' });
  const result = (await response.json()) as {
    solicitacoes?: Solicitacao[];
    message?: string;
  };

  if (!response.ok) throw new Error(result.message || 'Falha ao carregar.');
  return result.solicitacoes ?? [];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function CommercialDashboard({ adminEmail }: { adminEmail: string }) {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadSolicitacoes = useCallback(async () => {
    setError('');
    try {
      setSolicitacoes(await fetchSolicitacoes());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    fetchSolicitacoes()
      .then((items) => {
        if (isActive) setSolicitacoes(items);
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
  }, []);

  const metrics = useMemo(() => {
    const abertas = solicitacoes.filter(
      ({ status }) => status !== 'concluido' && status !== 'cancelado',
    ).length;
    const orcamentos = solicitacoes.filter(
      ({ status }) => status === 'orcamento' || status === 'negociacao',
    ).length;
    const concluidas = solicitacoes.filter(({ status }) => status === 'concluido').length;
    return { abertas, orcamentos, concluidas };
  }, [solicitacoes]);

  const funnel = useMemo(
    () =>
      funnelStatuses.map((status) => ({
        status,
        label: commercialStatusLabels[status],
        value: solicitacoes.filter((item) => item.status === status).length,
      })),
    [solicitacoes],
  );
  const maxFunnelValue = Math.max(1, ...funnel.map(({ value }) => value));

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    setError('');
    try {
      const response = await fetch(`/api/painel/solicitacoes/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Falha ao atualizar.');
      setSolicitacoes((items) =>
        items.map((item) => (item.id === id ? { ...item, status } : item)),
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Falha ao atualizar.');
    } finally {
      setUpdatingId(null);
    }
  }

  const latest = solicitacoes[0];

  return (
    <main className="app-shell">
      <SystemSidebar adminEmail={adminEmail} />

      <section className="workspace" id="inicio">
        <header className="topbar">
          <div>
            <p className="eyebrow">WG Hidráulica</p>
            <h1>Central comercial</h1>
            <p className="subtitle">Solicitações reais recebidas pelo site.</p>
          </div>
          <Link className="primary-button primary-link" href="/contato">+ Nova oportunidade</Link>
        </header>

        <section className="metrics" aria-label="Resumo comercial">
          <article><p>Oportunidades abertas</p><strong>{metrics.abertas}</strong><small>Em acompanhamento</small></article>
          <article><p>Em orçamento ou negociação</p><strong>{metrics.orcamentos}</strong><small>Etapas comerciais</small></article>
          <article><p>Atendimentos concluídos</p><strong>{metrics.concluidas}</strong><small>Histórico registrado</small></article>
        </section>

        {error && (
          <div className="dashboard-alert" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void loadSolicitacoes()}>Tentar novamente</button>
          </div>
        )}

        <section className="content-grid">
          <article className="panel" id="oportunidades">
            <div className="panel-heading">
              <div><p className="section-label">Pipeline</p><h2>Solicitações recentes</h2></div>
              <button className="refresh-button" type="button" onClick={() => void loadSolicitacoes()}>Atualizar</button>
            </div>
            <div className="opportunity-list">
              {loading && <p className="dashboard-state">Carregando solicitações…</p>}
              {!loading && solicitacoes.length === 0 && (
                <p className="dashboard-state">Nenhuma solicitação recebida ainda.</p>
              )}
              {solicitacoes.map((item) => (
                <article className="opportunity real-opportunity" key={item.id}>
                  <span className="company-mark">{initials(item.cliente_nome)}</span>
                  <div className="opportunity-copy">
                    <strong>{item.empresa || item.cliente_nome}</strong>
                    <p>{item.descricao}</p>
                    <small>{item.cliente_nome} · {item.whatsapp} · {formatDate(item.criado_em)}</small>
                  </div>
                  <div className="opportunity-actions">
                    <Link href={`/sistema/solicitacoes/${item.id}`}>Ver detalhes →</Link>
                    <label className="status-control">
                      <span className="sr-only">Status de {item.cliente_nome}</span>
                      <select
                        value={item.status}
                        disabled={updatingId === item.id}
                        onChange={(event) => void updateStatus(item.id, event.target.value)}
                        className={`stage stage-${item.status}`}
                      >
                        {Object.entries(commercialStatusLabels).map(([value, label]) => (
                          <option value={value} key={value}>{label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </article>
              ))}
            </div>
          </article>

          <aside className="panel funnel-panel" id="orcamentos">
            <div className="panel-heading"><div><p className="section-label">Visão rápida</p><h2>Funil comercial</h2></div></div>
            <div className="funnel-list">
              {funnel.map(({ status, label, value }) => (
                <div className="funnel-row" key={status}>
                  <div><span>{label}</span><strong>{value}</strong></div>
                  <div className="track"><span style={{ width: `${(value / maxFunnelValue) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="panel automation-panel" id="automacoes">
          <span className="automation-icon">⌁</span>
          <div>
            <p className="section-label">Integração ativa</p>
            <h2>{latest ? 'Última solicitação sincronizada' : 'Aguardando solicitações'}</h2>
            <p>{latest ? `${latest.cliente_nome} — ${latest.descricao}` : 'O formulário está conectado ao Supabase.'}</p>
          </div>
          <div className="automation-result"><span>Conectado</span><small>Supabase</small></div>
        </section>
      </section>
    </main>
  );
}
