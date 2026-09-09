-- Estrutura inicial do fluxo comercial da WG Hidráulica.
-- Execute este arquivo no SQL Editor do projeto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 120),
  empresa text,
  whatsapp text not null unique,
  email text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.solicitacoes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete restrict,
  descricao text not null check (char_length(descricao) between 10 and 3000),
  status text not null default 'novo' check (
    status in ('novo', 'em_atendimento', 'orcamento', 'negociacao', 'concluido', 'cancelado')
  ),
  origem text not null default 'site',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.itens_orcamento (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  descricao text not null,
  quantidade numeric(12, 3) not null default 1 check (quantidade > 0),
  valor_unitario numeric(12, 2) check (valor_unitario >= 0),
  criado_em timestamptz not null default now()
);

create table if not exists public.historico_status (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  observacao text,
  alterado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists solicitacoes_status_idx on public.solicitacoes(status);
create index if not exists solicitacoes_criado_em_idx on public.solicitacoes(criado_em desc);
create index if not exists historico_solicitacao_idx on public.historico_status(solicitacao_id, criado_em desc);

alter table public.clientes enable row level security;
alter table public.solicitacoes enable row level security;
alter table public.itens_orcamento enable row level security;
alter table public.historico_status enable row level security;

create or replace function public.criar_solicitacao_publica(
  p_nome text,
  p_empresa text,
  p_whatsapp text,
  p_email text,
  p_descricao text,
  p_origem text default 'site'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cliente_id uuid;
  v_solicitacao_id uuid;
begin
  if char_length(trim(p_nome)) < 2
     or char_length(trim(p_whatsapp)) < 8
     or char_length(trim(p_descricao)) < 10 then
    raise exception 'Dados obrigatórios inválidos';
  end if;

  insert into public.clientes (nome, empresa, whatsapp, email)
  values (
    trim(p_nome),
    nullif(trim(p_empresa), ''),
    trim(p_whatsapp),
    nullif(trim(p_email), '')
  )
  on conflict (whatsapp) do update set
    nome = excluded.nome,
    empresa = coalesce(excluded.empresa, public.clientes.empresa),
    email = coalesce(excluded.email, public.clientes.email),
    atualizado_em = now()
  returning id into v_cliente_id;

  insert into public.solicitacoes (cliente_id, descricao, origem)
  values (v_cliente_id, trim(p_descricao), coalesce(nullif(trim(p_origem), ''), 'site'))
  returning id into v_solicitacao_id;

  insert into public.historico_status (solicitacao_id, status_novo, observacao)
  values (v_solicitacao_id, 'novo', 'Solicitação recebida pelo site');

  return v_solicitacao_id;
end;
$$;

revoke all on function public.criar_solicitacao_publica(text, text, text, text, text, text) from public;
grant execute on function public.criar_solicitacao_publica(text, text, text, text, text, text) to anon, authenticated;

revoke all on public.clientes, public.solicitacoes, public.itens_orcamento, public.historico_status from anon;
