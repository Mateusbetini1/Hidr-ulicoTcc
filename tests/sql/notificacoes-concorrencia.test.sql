-- Execute como administrador no PostgreSQL local descartável wg_notificacoes_test.
-- O dblink abre duas conexões para manter uma transação concorrente real.
begin;

create extension if not exists dblink with schema extensions;

do $$
declare
  v_chave constant text := 'chave-concorrencia-de-teste';
  v_hash text := encode(extensions.digest(v_chave, 'sha256'), 'hex');
  v_telefone text := 'teste-' || gen_random_uuid();
  v_conexao text;
  v_consulta text;
  v_id uuid;
  v_a jsonb;
  v_b jsonb;
begin
  if current_database() <> 'wg_notificacoes_test'
     or exists (select 1 from private.notificacoes_solicitacao)
     or exists (select 1 from private.painel_config) then
    raise exception 'Use um banco local descartável wg_notificacoes_test com a fila e a configuração vazias';
  end if;

  v_conexao := format('host=127.0.0.1 port=%s dbname=%s user=%s connect_timeout=3',
    current_setting('port'), current_database(), current_user);
  v_consulta := format('select public.reservar_notificacoes_solicitacao(%L, %L, %L)',
    v_chave, 'origem@example.invalid', 'destino@example.invalid');

  perform extensions.dblink_connect('notificacoes_a', v_conexao);
  perform extensions.dblink_connect('notificacoes_b', v_conexao);
  perform extensions.dblink_exec('notificacoes_b', 'set statement_timeout = ''3s''');
  perform extensions.dblink_exec('notificacoes_b',
    format('insert into private.painel_config (id, chave_hash) values (true, %L)', v_hash));
  select id into strict v_id from extensions.dblink('notificacoes_b',
    format('select public.criar_solicitacao_publica(%L, null, %L, null, %L)',
      'Cliente de teste', v_telefone, 'Solicitação para teste concorrente')
  ) as criada(id uuid);

  perform extensions.dblink_exec('notificacoes_a', 'begin');
  select resposta into strict v_a from extensions.dblink('notificacoes_a', v_consulta) as r(resposta jsonb);
  select resposta into strict v_b from extensions.dblink('notificacoes_b', v_consulta) as r(resposta jsonb);

  if jsonb_array_length(v_a->'notificacoes') <> 1
     or (v_a->'notificacoes'->0->>'solicitacao_id')::uuid is distinct from v_id
     or jsonb_array_length(v_b->'notificacoes') <> 0 then
    raise exception 'As duas conexões não respeitaram a exclusividade da reserva';
  end if;

  perform extensions.dblink_exec('notificacoes_a', 'commit');
  select resposta into strict v_b from extensions.dblink('notificacoes_b', v_consulta) as r(resposta jsonb);
  if jsonb_array_length(v_b->'notificacoes') <> 0 then
    raise exception 'Uma reserva confirmada voltou para a fila antes de expirar';
  end if;

  perform extensions.dblink_exec('notificacoes_b', format(
    'delete from public.solicitacoes where id = %L;
     delete from public.clientes where whatsapp = %L;
     delete from private.painel_config where chave_hash = %L', v_id, v_telefone, v_hash));
  perform extensions.dblink_disconnect('notificacoes_a');
  perform extensions.dblink_disconnect('notificacoes_b');
end;
$$;

rollback;
