-- Mantém o cadastro existente e registra somente a nova solicitação.
-- CREATE OR REPLACE preserva a assinatura e as permissões da RPC.
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
  v_whatsapp text := trim(p_whatsapp);
begin
  if char_length(trim(p_nome)) < 2
     or char_length(v_whatsapp) < 8
     or char_length(trim(p_descricao)) < 10 then
    raise exception 'Dados obrigatórios inválidos';
  end if;

  insert into public.clientes (nome, empresa, whatsapp, email)
  values (
    trim(p_nome),
    nullif(trim(p_empresa), ''),
    v_whatsapp,
    nullif(trim(p_email), '')
  )
  on conflict (whatsapp) do nothing
  returning id into v_cliente_id;

  if v_cliente_id is null then
    -- Em READ COMMITTED, esta consulta usa um novo snapshot e pode ver o
    -- cadastro criado por uma transação concorrente que venceu a inserção.
    select id into v_cliente_id
    from public.clientes
    where whatsapp = v_whatsapp;
  end if;

  insert into public.solicitacoes (cliente_id, descricao, origem)
  values (v_cliente_id, trim(p_descricao), coalesce(nullif(trim(p_origem), ''), 'site'))
  returning id into v_solicitacao_id;

  insert into public.historico_status (solicitacao_id, status_novo, observacao)
  values (v_solicitacao_id, 'novo', 'Solicitação recebida pelo site');

  return v_solicitacao_id;
end;
$$;
