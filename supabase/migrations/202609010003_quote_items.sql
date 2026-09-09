-- Operações protegidas para montagem do orçamento comercial.

create or replace function public.listar_itens_orcamento_painel(
  p_chave text,
  p_solicitacao_id uuid
)
returns table (
  id uuid,
  descricao text,
  quantidade numeric,
  valor_unitario numeric,
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

  return query
    select
      item.id,
      item.descricao,
      item.quantidade,
      item.valor_unitario,
      item.criado_em
    from public.itens_orcamento item
    where item.solicitacao_id = p_solicitacao_id
    order by item.criado_em, item.id;
end;
$$;

create or replace function public.salvar_item_orcamento_painel(
  p_chave text,
  p_solicitacao_id uuid,
  p_item_id uuid,
  p_descricao text,
  p_quantidade numeric,
  p_valor_unitario numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_item_id uuid;
  v_status_anterior text;
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_descricao, ''))) < 2
     or char_length(trim(p_descricao)) > 500
     or p_quantidade <= 0
     or p_quantidade > 999999
     or p_valor_unitario < 0
     or p_valor_unitario > 9999999999.99 then
    raise exception 'Dados do item inválidos';
  end if;

  select status into v_status_anterior
  from public.solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;

  if p_item_id is null then
    insert into public.itens_orcamento (
      solicitacao_id,
      descricao,
      quantidade,
      valor_unitario
    )
    values (
      p_solicitacao_id,
      trim(p_descricao),
      p_quantidade,
      p_valor_unitario
    )
    returning id into v_item_id;
  else
    update public.itens_orcamento
    set
      descricao = trim(p_descricao),
      quantidade = p_quantidade,
      valor_unitario = p_valor_unitario
    where id = p_item_id
      and solicitacao_id = p_solicitacao_id
    returning id into v_item_id;

    if not found then
      raise exception 'Item não encontrado';
    end if;
  end if;

  -- O primeiro item inicia formalmente a etapa de orçamento.
  if v_status_anterior in ('novo', 'em_atendimento') then
    update public.solicitacoes
    set status = 'orcamento', atualizado_em = now()
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
      'orcamento',
      'Orçamento iniciado com o cadastro do primeiro item'
    );
  end if;

  return v_item_id;
end;
$$;

create or replace function public.remover_item_orcamento_painel(
  p_chave text,
  p_solicitacao_id uuid,
  p_item_id uuid
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

  delete from public.itens_orcamento
  where id = p_item_id
    and solicitacao_id = p_solicitacao_id;

  if not found then
    raise exception 'Item não encontrado';
  end if;

  return true;
end;
$$;

revoke all on function public.listar_itens_orcamento_painel(text, uuid) from public;
revoke all on function public.salvar_item_orcamento_painel(text, uuid, uuid, text, numeric, numeric) from public;
revoke all on function public.remover_item_orcamento_painel(text, uuid, uuid) from public;

grant execute on function public.listar_itens_orcamento_painel(text, uuid) to anon, authenticated;
grant execute on function public.salvar_item_orcamento_painel(text, uuid, uuid, text, numeric, numeric) to anon, authenticated;
grant execute on function public.remover_item_orcamento_painel(text, uuid, uuid) to anon, authenticated;

