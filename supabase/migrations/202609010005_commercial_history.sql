-- Linha do tempo comercial: complementa as mudanças de status com atividades da equipe.

create table if not exists public.atividades_comerciais (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.solicitacoes(id) on delete cascade,
  tipo text not null check (
    tipo in ('observacao', 'contato', 'medidas_recebidas', 'proposta_enviada')
  ),
  descricao text not null check (char_length(descricao) between 2 and 2000),
  responsavel_email text not null check (char_length(responsavel_email) between 3 and 254),
  criado_em timestamptz not null default now()
);

create index if not exists atividades_solicitacao_idx
  on public.atividades_comerciais(solicitacao_id, criado_em desc);

alter table public.atividades_comerciais enable row level security;
revoke all on public.atividades_comerciais from anon, authenticated;

create or replace function public.listar_historico_painel(
  p_chave text,
  p_solicitacao_id uuid
)
returns table (
  id uuid,
  tipo text,
  descricao text,
  responsavel text,
  status_anterior text,
  status_novo text,
  criado_em timestamptz
)
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.solicitacoes where solicitacoes.id = p_solicitacao_id
  ) then
    raise exception 'Solicitação não encontrada';
  end if;

  return query
    select
      h.id,
      'status'::text,
      coalesce(h.observacao, 'Etapa comercial atualizada')::text,
      case
        when h.observacao ~* '^Status alterado por .+$'
          then substring(h.observacao from '(?i)^Status alterado por (.+)$')
        else 'Sistema'
      end::text,
      h.status_anterior,
      h.status_novo,
      h.criado_em
    from public.historico_status h
    where h.solicitacao_id = p_solicitacao_id

    union all

    select
      a.id,
      a.tipo,
      a.descricao,
      a.responsavel_email,
      null::text,
      null::text,
      a.criado_em
    from public.atividades_comerciais a
    where a.solicitacao_id = p_solicitacao_id

    order by 7 desc;
end;
$$;

create or replace function public.registrar_atividade_painel(
  p_chave text,
  p_solicitacao_id uuid,
  p_tipo text,
  p_descricao text,
  p_responsavel_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_atividade_id uuid;
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if p_tipo not in ('observacao', 'contato', 'medidas_recebidas', 'proposta_enviada')
     or char_length(trim(coalesce(p_descricao, ''))) not between 2 and 2000
     or char_length(trim(coalesce(p_responsavel_email, ''))) not between 3 and 254 then
    raise exception 'Dados da atividade inválidos';
  end if;

  if not exists (
    select 1 from public.solicitacoes where solicitacoes.id = p_solicitacao_id
  ) then
    raise exception 'Solicitação não encontrada';
  end if;

  insert into public.atividades_comerciais (
    solicitacao_id,
    tipo,
    descricao,
    responsavel_email
  )
  values (
    p_solicitacao_id,
    p_tipo,
    trim(p_descricao),
    lower(trim(p_responsavel_email))
  )
  returning atividades_comerciais.id into v_atividade_id;

  return v_atividade_id;
end;
$$;

revoke all on function public.listar_historico_painel(text, uuid) from public;
revoke all on function public.registrar_atividade_painel(text, uuid, text, text, text) from public;
grant execute on function public.listar_historico_painel(text, uuid) to anon, authenticated;
grant execute on function public.registrar_atividade_painel(text, uuid, text, text, text) to anon, authenticated;
