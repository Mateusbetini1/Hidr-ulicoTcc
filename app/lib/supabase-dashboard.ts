export type Solicitacao = {
  id: string;
  descricao: string;
  status: string;
  origem: string;
  criado_em: string;
  cliente_nome: string;
  empresa: string | null;
  whatsapp: string;
  email: string | null;
};

export type ItemOrcamento = {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  criado_em: string;
};

export type DadosProposta = {
  validade_dias: number;
  prazo_entrega: string | null;
  condicoes_pagamento: string | null;
  observacoes: string | null;
};

export type HistoricoComercial = {
  id: string;
  tipo: 'status' | 'observacao' | 'contato' | 'medidas_recebidas' | 'proposta_enviada';
  descricao: string;
  responsavel: string;
  status_anterior: string | null;
  status_novo: string | null;
  criado_em: string;
};

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const dashboardSecret = process.env.SUPABASE_DASHBOARD_SECRET;

  if (!url || !key || !dashboardSecret) {
    throw new Error('A conexão administrativa com o banco não está configurada.');
  }

  return { url, key, dashboardSecret };
}

export async function supabaseDashboardRpc<T>(
  functionName: string,
  parameters: Record<string, unknown> = {},
) {
  const { url, key, dashboardSecret } = getConfig();
  // Esta chamada ocorre no servidor para que a chave do painel nunca chegue ao navegador.
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_chave: dashboardSecret, ...parameters }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Supabase dashboard request failed', response.status, details);
    throw new Error('Não foi possível consultar o painel.');
  }

  return (await response.json()) as T;
}
