'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { ItemOrcamento } from '../lib/supabase-dashboard';
import { ProposalSettings } from './proposal-settings';

type ItemForm = {
  itemId: string;
  descricao: string;
  quantidade: string;
  valorUnitario: string;
};

const emptyForm: ItemForm = {
  itemId: '',
  descricao: '',
  quantidade: '1',
  valorUnitario: '',
};

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

async function fetchItems(requestId: string) {
  const response = await fetch(`/api/painel/solicitacoes/${requestId}/itens`, {
    cache: 'no-store',
  });
  const result = (await response.json()) as {
    itens?: ItemOrcamento[];
    message?: string;
  };

  if (!response.ok) throw new Error(result.message || 'Falha ao carregar o orçamento.');
  return result.itens ?? [];
}

export function QuoteBuilder({
  requestId,
  onBudgetStarted,
}: {
  requestId: string;
  onBudgetStarted: () => void;
}) {
  const [items, setItems] = useState<ItemOrcamento[]>([]);
  const [form, setForm] = useState<ItemForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    setError('');
    try {
      setItems(await fetchItems(requestId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    let isActive = true;

    fetchItems(requestId)
      .then((loadedItems) => {
        if (isActive) setItems(loadedItems);
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

  const total = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.quantidade) * Number(item.valor_unitario), 0),
    [items],
  );

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(`/api/painel/solicitacoes/${requestId}/itens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Falha ao salvar.');

      setForm(emptyForm);
      setFeedback(form.itemId ? 'Item atualizado.' : 'Item adicionado ao orçamento.');
      onBudgetStarted();
      await loadItems();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  function editItem(item: ItemOrcamento) {
    setForm({
      itemId: item.id,
      descricao: item.descricao,
      quantidade: String(item.quantidade),
      valorUnitario: String(item.valor_unitario),
    });
    setFeedback('Editando item selecionado.');
  }

  async function removeItem(item: ItemOrcamento) {
    if (!window.confirm(`Remover “${item.descricao}” do orçamento?`)) return;

    setRemovingId(item.id);
    setError('');
    setFeedback('');

    try {
      const response = await fetch(
        `/api/painel/solicitacoes/${requestId}/itens/${item.id}`,
        { method: 'DELETE' },
      );
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || 'Falha ao remover.');

      if (form.itemId === item.id) setForm(emptyForm);
      setFeedback('Item removido do orçamento.');
      await loadItems();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Falha ao remover.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="panel quote-builder" aria-labelledby="quote-title">
      <div className="quote-heading">
        <div>
          <p className="section-label">Orçamento comercial</p>
          <h2 id="quote-title">Itens da proposta</h2>
        </div>
        <strong>{currency(total)}</strong>
      </div>

      <form className="item-form" onSubmit={saveItem}>
        <label className="item-description">
          Descrição do produto ou serviço
          <input
            value={form.descricao}
            onChange={(event) => setForm({ ...form, descricao: event.target.value })}
            minLength={2}
            maxLength={500}
            placeholder="Ex.: Cilindro hidráulico sob medida"
            required
          />
        </label>
        <label>
          Quantidade
          <input
            value={form.quantidade}
            onChange={(event) => setForm({ ...form, quantidade: event.target.value })}
            type="number"
            min="0.001"
            max="999999"
            step="0.001"
            required
          />
        </label>
        <label>
          Valor unitário
          <input
            value={form.valorUnitario}
            onChange={(event) => setForm({ ...form, valorUnitario: event.target.value })}
            type="number"
            min="0"
            max="9999999999.99"
            step="0.01"
            placeholder="0,00"
            required
          />
        </label>
        <div className="item-form-actions">
          {form.itemId && (
            <button className="secondary-button" type="button" onClick={() => setForm(emptyForm)}>
              Cancelar edição
            </button>
          )}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Salvando…' : form.itemId ? 'Salvar alteração' : '+ Adicionar item'}
          </button>
        </div>
      </form>

      {error && <p className="quote-message error" role="alert">{error}</p>}
      {feedback && <p className="quote-message success" role="status">{feedback}</p>}

      <div className="quote-items">
        {loading && <p className="dashboard-state">Carregando itens…</p>}
        {!loading && items.length === 0 && !error && (
          <p className="dashboard-state">Nenhum item adicionado. Preencha o formulário para iniciar o orçamento.</p>
        )}
        {items.map((item) => {
          const subtotal = Number(item.quantidade) * Number(item.valor_unitario);
          return (
            <article className="quote-item" key={item.id}>
              <div>
                <strong>{item.descricao}</strong>
                <small>{Number(item.quantidade).toLocaleString('pt-BR')} × {currency(Number(item.valor_unitario))}</small>
              </div>
              <strong>{currency(subtotal)}</strong>
              <div className="quote-item-actions">
                <button type="button" onClick={() => editItem(item)}>Editar</button>
                <button
                  className="danger-action"
                  type="button"
                  disabled={removingId === item.id}
                  onClick={() => void removeItem(item)}
                >
                  {removingId === item.id ? 'Removendo…' : 'Remover'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="quote-total">
        <span>Valor total do orçamento</span>
        <strong>{currency(total)}</strong>
      </footer>

      <ProposalSettings requestId={requestId} hasItems={items.length > 0} />
    </section>
  );
}
