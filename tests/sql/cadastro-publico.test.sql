-- Execute em um banco local de testes com as migrações aplicadas:
-- psql -v ON_ERROR_STOP=1 -f tests/sql/cadastro-publico.test.sql
begin;

do $$
declare
  v_whatsapp text := 'teste-' || gen_random_uuid()::text;
  v_primeira_id uuid;
  v_segunda_id uuid;
  v_cliente_id uuid;
  v_cadastro_original jsonb;
  v_solicitacao_original jsonb;
  v_historico_original jsonb;
begin
  set local role anon;
  v_primeira_id := public.criar_solicitacao_publica(
    'Cliente original', 'Empresa original', v_whatsapp,
    'original@example.invalid', 'Solicitação original de teste'
  );
  reset role;

  select id, to_jsonb(c) into strict v_cliente_id, v_cadastro_original
  from public.clientes c where whatsapp = v_whatsapp;

  select to_jsonb(s) into strict v_solicitacao_original
  from public.solicitacoes s
  where id = v_primeira_id and cliente_id = v_cliente_id
    and status = 'novo' and origem = 'site';

  select to_jsonb(h) into strict v_historico_original
  from public.historico_status h
  where solicitacao_id = v_primeira_id and status_novo = 'novo';

  set local role anon;
  v_segunda_id := public.criar_solicitacao_publica(
    'Outro nome', 'Outra empresa', ' ' || v_whatsapp || ' ',
    'outro@example.invalid', 'Nova solicitação de teste', 'site_triagem'
  );
  reset role;

  if (select to_jsonb(c) from public.clientes c where id = v_cliente_id)
     is distinct from v_cadastro_original then
    raise exception 'A solicitação pública alterou o cadastro original';
  end if;

  if (select to_jsonb(s) from public.solicitacoes s where id = v_primeira_id)
     is distinct from v_solicitacao_original
     or (select to_jsonb(h) from public.historico_status h where id = (v_historico_original ->> 'id')::uuid)
     is distinct from v_historico_original then
    raise exception 'A solicitação anterior ou seu histórico foi alterado';
  end if;

  if v_segunda_id is null or v_segunda_id = v_primeira_id or not exists (
    select 1 from public.solicitacoes s
    where s.id = v_segunda_id and s.cliente_id = v_cliente_id
      and s.descricao = 'Nova solicitação de teste'
      and s.origem = 'site_triagem' and s.status = 'novo'
  ) then
    raise exception 'A nova solicitação não foi vinculada ao cadastro existente';
  end if;

  if (select count(*) from public.historico_status
      where solicitacao_id = v_segunda_id and status_novo = 'novo') <> 1 then
    raise exception 'A nova solicitação deve ter um evento inicial no histórico';
  end if;
end;
$$;

rollback;
