-- Funções protegidas usadas exclusivamente pelo backend do painel.
-- A chave deve ser configurada separadamente, sem ser salva no repositório.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.painel_config (
  id boolean primary key default true check (id),
  chave_hash text not null,
  atualizado_em timestamptz not null default now()
);

alter table private.painel_config enable row level security;
revoke all on private.painel_config from public, anon, authenticated;

create or replace function private.validar_chave_painel(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = private, public
as $$
  select exists (
    select 1
    from private.painel_config
    where id = true
      and chave_hash = encode(extensions.digest(coalesce(p_chave, ''), 'sha256'), 'hex')
  );
$$;

revoke all on function private.validar_chave_painel(text) from public, anon, authenticated;

create or replace function public.listar_solicitacoes_painel(p_chave text)
returns table (
  id uuid,
  descricao text,
  status text,
  origem text,
  criado_em timestamptz,
  cliente_nome text,
  empresa text,
  whatsapp text,
  email text
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
      s.id,
      s.descricao,
      s.status,
      s.origem,
      s.criado_em,
      c.nome,
      c.empresa,
      c.whatsapp,
      c.email
    from public.solicitacoes s
    join public.clientes c on c.id = s.cliente_id
    order by s.criado_em desc;
end;
$$;

create or replace function public.atualizar_status_painel(
  p_chave text,
  p_solicitacao_id uuid,
  p_status text,
  p_observacao text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_status_anterior text;
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if p_status not in ('novo', 'em_atendimento', 'orcamento', 'negociacao', 'concluido', 'cancelado') then
    raise exception 'Status inválido';
  end if;

  select status into v_status_anterior
  from public.solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;

  if v_status_anterior = p_status then
    return true;
  end if;

  update public.solicitacoes
  set status = p_status, atualizado_em = now()
  where id = p_solicitacao_id;

  insert into public.historico_status (
    solicitacao_id,
    status_anterior,
    status_novo,
    observacao
  )
  values (
    p_solicitacao_id,
    v_status_anterior,
    p_status,
    nullif(trim(p_observacao), '')
  );

  return true;
end;
$$;

revoke all on function public.listar_solicitacoes_painel(text) from public;
revoke all on function public.atualizar_status_painel(text, uuid, text, text) from public;
grant execute on function public.listar_solicitacoes_painel(text) to anon, authenticated;
grant execute on function public.atualizar_status_painel(text, uuid, text, text) to anon, authenticated;
