-- Execute em PostgreSQL isolado, após as migrações 001–008.
begin;

do $$
declare
  v_original regprocedure := 'public.criar_solicitacao_publica(text,text,text,text,text,text)';
  v_worker regprocedure := 'public.criar_solicitacao_worker(text,text,text,text,text,text,text)';
  v_id uuid;
  v_segredo text := repeat('a', 64);
  v_telefone text := '+55 00 00000-0081';
begin
  if has_function_privilege('anon', v_original, 'EXECUTE') or
     has_function_privilege('authenticated', v_original, 'EXECUTE') or
     has_function_privilege('authenticated', v_worker, 'EXECUTE') or
     has_table_privilege('anon', 'private.cadastro_worker_config', 'SELECT') then
    raise exception 'Privilégios públicos indevidos';
  end if;

  delete from private.cadastro_worker_config;
  set local role anon;
  begin
    perform public.criar_solicitacao_worker(v_segredo, 'Cliente sintético', null, v_telefone, null, 'Descrição de teste', 'site');
    raise exception 'Cadastro sem hash provisionado foi aceito';
  exception when insufficient_privilege then null;
  end;
  reset role;

  insert into private.cadastro_worker_config (segredo_hash) values (encode(extensions.digest(v_segredo, 'sha256'), 'hex'));
  insert into private.painel_config (id, chave_hash) values (true, encode(extensions.digest('painel-local-teste', 'sha256'), 'hex'))
    on conflict (id) do update set chave_hash = excluded.chave_hash;

  set local role anon;
  begin
    perform public.criar_solicitacao_publica('Cliente sintético', null, v_telefone, null, 'Descrição de teste', 'site');
    raise exception 'Cadastro anônimo pela RPC original foi aceito';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.criar_solicitacao_worker(null, 'Cliente sintético', null, v_telefone, null, 'Descrição de teste', 'site');
    raise exception 'Cadastro sem segredo foi aceito';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.criar_solicitacao_worker(repeat('b', 64), 'Cliente sintético', null, v_telefone, null, 'Descrição de teste', 'site');
    raise exception 'Cadastro com segredo incorreto foi aceito';
  exception when insufficient_privilege then null;
  end;
  reset role;

  if exists (select 1 from public.clientes where whatsapp = v_telefone) then
    raise exception 'A tentativa não autorizada deixou dados';
  end if;

  set local role anon;
  v_id := public.criar_solicitacao_worker(v_segredo, 'Cliente sintético', null, v_telefone, null, 'Descrição de teste', 'site');
  begin
    perform public.listar_solicitacoes_painel(v_segredo);
    raise exception 'Segredo de cadastro foi aceito no painel';
  exception when insufficient_privilege then null;
  end;
  if not exists (select 1 from public.listar_solicitacoes_painel('painel-local-teste') where id = v_id) then
    raise exception 'O painel perdeu acesso à solicitação';
  end if;
  reset role;

  if not exists (select 1 from public.historico_status where solicitacao_id = v_id and status_novo = 'novo') or
     not exists (select 1 from private.notificacoes_solicitacao where solicitacao_id = v_id) then
    raise exception 'O cadastro perdeu o histórico ou a fila';
  end if;
end;
$$;

rollback;
