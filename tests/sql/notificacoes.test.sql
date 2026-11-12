-- Banco local descartável com as migrações aplicadas. psql -v ON_ERROR_STOP=1 -f ...
begin;

do $$
declare
  v_chave constant text := 'chave-isolada-de-teste';
  v_solicitacao uuid;
  v_reserva jsonb;
  v_retry jsonb;
  v_antes jsonb;
  v_historico jsonb;
begin
  insert into private.painel_config (id, chave_hash)
  values (true, encode(extensions.digest(v_chave, 'sha256'), 'hex'))
  on conflict (id) do update set chave_hash = excluded.chave_hash;

  set local role anon;
  v_solicitacao := public.criar_solicitacao_publica(
    'Cliente de teste', null, 'teste-' || gen_random_uuid(), null, 'Pedido de teste da fila'
  );
  perform public.atualizar_status_painel(v_chave, v_solicitacao, 'orcamento');
  begin
    perform public.reservar_notificacoes_solicitacao('chave-errada', 'origem', 'destino');
    raise exception 'RPC aceitou chave inválida';
  exception when insufficient_privilege then
    null;
  end;
  v_reserva := public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes'->0;
  reset role;

  if (v_reserva->>'solicitacao_id')::uuid is distinct from v_solicitacao then
    raise exception 'Reserva não encontrou solicitação na etapa orçamento';
  end if;
  if jsonb_array_length(public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes') <> 0 then
    raise exception 'A mesma notificação foi reservada duas vezes';
  end if;

  select to_jsonb(s) into v_antes from public.solicitacoes s where id = v_solicitacao;
  select jsonb_agg(to_jsonb(h) order by h.id) into v_historico
    from public.historico_status h where solicitacao_id = v_solicitacao;

  if not public.finalizar_notificacao_solicitacao(v_chave, v_solicitacao,
      (v_reserva->>'reserva')::uuid, 'repetir', null, 'HTTP 429') then
    raise exception 'Falha temporária não foi registrada';
  end if;
  if not exists (select 1 from private.notificacoes_solicitacao where solicitacao_id = v_solicitacao
      and estado = 'falhou' and ultimo_erro = 'HTTP 429' and proxima_tentativa_em > clock_timestamp()) then
    raise exception 'Falha não registrou o erro e o intervalo de nova tentativa';
  end if;
  if jsonb_array_length(public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes') <> 0 then
    raise exception 'A fila ignorou o intervalo de nova tentativa';
  end if;

  update private.notificacoes_solicitacao set proxima_tentativa_em = clock_timestamp()
    where solicitacao_id = v_solicitacao;
  v_retry := public.reservar_notificacoes_solicitacao(v_chave, 'outra origem', 'outro destino')->'notificacoes'->0;
  if v_retry is null or v_retry->'payload' is distinct from v_reserva->'payload'
     or v_retry->'chave_idempotencia' is distinct from v_reserva->'chave_idempotencia'
     or v_retry->'reserva' is not distinct from v_reserva->'reserva' then
    raise exception 'Nova tentativa deve manter chave e payload e trocar a reserva';
  end if;
  if public.finalizar_notificacao_solicitacao(v_chave, v_solicitacao,
      (v_reserva->>'reserva')::uuid, 'aceito', 'atrasado') then
    raise exception 'Uma reserva anterior conseguiu finalizar a notificação';
  end if;
  if not public.finalizar_notificacao_solicitacao(v_chave, v_solicitacao,
      (v_retry->>'reserva')::uuid, 'aceito', 'aceite-teste') then
    raise exception 'Aceite não foi registrado';
  end if;
  if public.finalizar_notificacao_solicitacao(v_chave, v_solicitacao,
      (v_retry->>'reserva')::uuid, 'rejeitado') then
    raise exception 'Uma finalização repetida substituiu o aceite';
  end if;
  if private.reprocessar_notificacao_solicitacao(v_solicitacao)
     or jsonb_array_length(public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes') <> 0
     or not exists (select 1 from private.notificacoes_solicitacao where solicitacao_id = v_solicitacao
       and estado = 'enviado' and resend_id = 'aceite-teste' and enviado_em is not null and payload is null) then
    raise exception 'Notificação aceita voltou para a fila ou perdeu o protocolo';
  end if;
  if (select to_jsonb(s) from public.solicitacoes s where id = v_solicitacao) is distinct from v_antes
     or (select jsonb_agg(to_jsonb(h) order by h.id) from public.historico_status h where solicitacao_id = v_solicitacao)
        is distinct from v_historico then
    raise exception 'A notificação alterou a solicitação ou seu histórico comercial';
  end if;

  v_solicitacao := public.criar_solicitacao_publica(
    'Cliente de teste', null, 'teste-' || gen_random_uuid(), null, 'Pedido para reprocessamento'
  );
  v_reserva := public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes'->0;
  perform public.finalizar_notificacao_solicitacao(v_chave, v_solicitacao,
    (v_reserva->>'reserva')::uuid, 'rejeitado', null, 'HTTP 422');
  if jsonb_array_length(public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes') <> 0
     or not private.reprocessar_notificacao_solicitacao(v_solicitacao) then
    raise exception 'Rejeição definitiva deve aguardar reprocessamento manual';
  end if;
  v_retry := public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino corrigido')->'notificacoes'->0;
  if v_retry->'chave_idempotencia' is not distinct from v_reserva->'chave_idempotencia'
     or v_retry#>>'{payload,to,0}' is distinct from 'destino corrigido' then
    raise exception 'Após rejeição confirmada, o novo ciclo deve aceitar uma configuração corrigida';
  end if;

  -- Simula interrupção após o envio, antes de gravar a resposta.
  update private.notificacoes_solicitacao set reservada_ate = clock_timestamp() - interval '1 second'
    where solicitacao_id = v_solicitacao;
  v_reserva := public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes'->0;
  if v_reserva is null or v_reserva->'reserva' is not distinct from v_retry->'reserva'
     or v_reserva->'chave_idempotencia' is distinct from v_retry->'chave_idempotencia'
     or v_reserva->'payload' is distinct from v_retry->'payload' then
    raise exception 'Recuperação de reserva expirada perdeu a idempotência';
  end if;
  perform public.finalizar_notificacao_solicitacao(v_chave, v_solicitacao,
    (v_reserva->>'reserva')::uuid, 'rejeitado');
  if not exists (select 1 from private.notificacoes_solicitacao where solicitacao_id = v_solicitacao
      and estado = 'revisao' and resultado_incerto)
     or not private.reprocessar_notificacao_solicitacao(v_solicitacao) then
    raise exception 'Rejeição posterior não pode apagar a incerteza anterior';
  end if;
  v_retry := public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes'->0;
  if v_retry is null or v_retry->'chave_idempotencia' is distinct from v_reserva->'chave_idempotencia'
     or v_retry->'payload' is distinct from v_reserva->'payload' then
    raise exception 'Reprocessamento incerto mudou chave ou conteúdo';
  end if;
  update private.notificacoes_solicitacao
    set primeira_tentativa_em = clock_timestamp() - interval '24 hours',
        reservada_ate = clock_timestamp() - interval '1 second'
    where solicitacao_id = v_solicitacao;
  if jsonb_array_length(public.reservar_notificacoes_solicitacao(v_chave, 'origem', 'destino')->'notificacoes') <> 0
     or private.reprocessar_notificacao_solicitacao(v_solicitacao) then
    raise exception 'Resultado incerto foi reprocessado fora da janela segura';
  end if;
end;
$$;

rollback;
