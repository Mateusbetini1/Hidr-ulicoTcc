-- Dados comerciais usados para gerar a proposta em PDF.

create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null unique references public.solicitacoes(id) on delete cascade,
  validade_dias integer not null default 15 check (validade_dias between 1 and 365),
  prazo_entrega text,
  condicoes_pagamento text,
  observacoes text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.orcamentos enable row level security;
revoke all on public.orcamentos from anon, authenticated;

create or replace function public.obter_dados_proposta_painel(
  p_chave text,
  p_solicitacao_id uuid
)
returns table (
  validade_dias integer,
  prazo_entrega text,
  condicoes_pagamento text,
  observacoes text
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  return query
    select
      proposta.validade_dias,
      proposta.prazo_entrega,
      proposta.condicoes_pagamento,
      proposta.observacoes
    from public.orcamentos proposta
    where proposta.solicitacao_id = p_solicitacao_id;
end;
$$;

create or replace function public.salvar_dados_proposta_painel(
  p_chave text,
  p_solicitacao_id uuid,
  p_validade_dias integer,
  p_prazo_entrega text,
  p_condicoes_pagamento text,
  p_observacoes text
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if p_validade_dias < 1
     or p_validade_dias > 365
     or char_length(coalesce(p_prazo_entrega, '')) > 300
     or char_length(coalesce(p_condicoes_pagamento, '')) > 500
     or char_length(coalesce(p_observacoes, '')) > 2000 then
    raise exception 'Dados da proposta inválidos';
  end if;

  if not exists (
    select 1 from public.solicitacoes where id = p_solicitacao_id
  ) then
    raise exception 'Solicitação não encontrada';
  end if;

  insert into public.orcamentos (
    solicitacao_id,
    validade_dias,
    prazo_entrega,
    condicoes_pagamento,
    observacoes
  )
  values (
    p_solicitacao_id,
    p_validade_dias,
    nullif(trim(p_prazo_entrega), ''),
    nullif(trim(p_condicoes_pagamento), ''),
    nullif(trim(p_observacoes), '')
  )
  on conflict (solicitacao_id) do update set
    validade_dias = excluded.validade_dias,
    prazo_entrega = excluded.prazo_entrega,
    condicoes_pagamento = excluded.condicoes_pagamento,
    observacoes = excluded.observacoes,
    atualizado_em = now();

  return true;
end;
$$;

revoke all on function public.obter_dados_proposta_painel(text, uuid) from public;
revoke all on function public.salvar_dados_proposta_painel(text, uuid, integer, text, text, text) from public;
grant execute on function public.obter_dados_proposta_painel(text, uuid) to anon, authenticated;
grant execute on function public.salvar_dados_proposta_painel(text, uuid, integer, text, text, text) to anon, authenticated;

