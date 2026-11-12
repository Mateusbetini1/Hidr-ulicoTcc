-- A fila só recebe solicitações inseridas após a migração.
-- Registros antigos podem já ter sido notificados pelo workflow anterior.
create table private.notificacoes_solicitacao (
  solicitacao_id uuid primary key references public.solicitacoes(id) on delete cascade,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'processando', 'falhou', 'revisao', 'enviado')),
  chave_idempotencia uuid not null unique default gen_random_uuid(),
  payload jsonb,
  primeira_tentativa_em timestamptz,
  tentativas integer not null default 0,
  proxima_tentativa_em timestamptz default now(),
  reserva uuid,
  reservada_ate timestamptz,
  resultado_incerto boolean not null default false,
  ultimo_erro text,
  resend_id text,
  enviado_em timestamptz,
  criado_em timestamptz not null default now()
);

alter table private.notificacoes_solicitacao enable row level security;
revoke all on private.notificacoes_solicitacao from public, anon, authenticated;

create index notificacoes_solicitacao_prontas_idx
  on private.notificacoes_solicitacao (proxima_tentativa_em, solicitacao_id)
  where estado in ('pendente', 'falhou') and proxima_tentativa_em is not null;

create index notificacoes_solicitacao_reservas_idx
  on private.notificacoes_solicitacao (reservada_ate)
  where estado = 'processando';

create index notificacoes_solicitacao_incertas_idx
  on private.notificacoes_solicitacao (primeira_tentativa_em)
  where estado in ('pendente', 'falhou') and resultado_incerto;

create function private.enfileirar_notificacao_solicitacao()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into private.notificacoes_solicitacao (solicitacao_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.enfileirar_notificacao_solicitacao() from public, anon, authenticated;

create trigger enfileirar_notificacao_solicitacao
after insert on public.solicitacoes
for each row execute function private.enfileirar_notificacao_solicitacao();

create function public.reservar_notificacoes_solicitacao(
  p_chave text,
  p_remetente text,
  p_destinatario text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_agora timestamptz := clock_timestamp();
  v_notificacoes jsonb;
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if nullif(btrim(p_remetente), '') is null or char_length(p_remetente) > 320
     or nullif(btrim(p_destinatario), '') is null or char_length(p_destinatario) > 254 then
    raise exception 'Configure o remetente e o destinatário das notificações';
  end if;

  -- Uma execução interrompida pode ter enviado o e-mail antes de cair.
  update private.notificacoes_solicitacao
  set estado = case when tentativas < 3 and primeira_tentativa_em > v_agora - interval '23 hours'
                    then 'falhou' else 'revisao' end,
      proxima_tentativa_em = case when tentativas < 3 and primeira_tentativa_em > v_agora - interval '23 hours'
                                 then v_agora end,
      reserva = null,
      reservada_ate = null,
      resultado_incerto = true,
      ultimo_erro = 'reserva_expirada'
  where estado = 'processando' and reservada_ate <= v_agora;

  update private.notificacoes_solicitacao
  set estado = 'revisao', proxima_tentativa_em = null
  where estado in ('pendente', 'falhou') and resultado_incerto
    and primeira_tentativa_em <= v_agora - interval '23 hours';

  with selecionadas as (
    select n.solicitacao_id
    from private.notificacoes_solicitacao n
    where n.estado in ('pendente', 'falhou')
      and n.proxima_tentativa_em <= v_agora
      and n.tentativas < 3
      and (n.primeira_tentativa_em is null or n.primeira_tentativa_em > v_agora - interval '23 hours')
    order by n.proxima_tentativa_em, n.solicitacao_id
    limit 10
    for update skip locked
  ), reservadas as (
    update private.notificacoes_solicitacao n
    set estado = 'processando',
        tentativas = n.tentativas + 1,
        primeira_tentativa_em = coalesce(n.primeira_tentativa_em, v_agora),
        reserva = gen_random_uuid(),
        reservada_ate = least(
          v_agora + interval '10 minutes',
          coalesce(n.primeira_tentativa_em, v_agora) + interval '23 hours'
        ),
        proxima_tentativa_em = null,
        -- Reutiliza o mesmo conteúdo, inclusive remetente e destinatário,
        -- em todas as tentativas que compartilham a chave do Resend.
        payload = coalesce(n.payload, jsonb_build_object(
          'from', btrim(p_remetente),
          'to', jsonb_build_array(btrim(p_destinatario)),
          'subject', 'Nova solicitação — ' || coalesce(c.empresa, c.nome),
          'text', concat(
            E'Uma nova solicitação de orçamento foi recebida pela WG Hidráulica.\n\n',
            'Solicitação: ', s.id, E'\n',
            'Cliente: ', c.nome, E'\n',
            'Empresa: ', coalesce(c.empresa, 'Não informada'), E'\n',
            'WhatsApp: ', c.whatsapp, E'\n',
            'Necessidade: ', s.descricao, E'\n',
            'Recebida em: ', s.criado_em, E'\n\n',
            'Acesse o painel comercial para continuar o atendimento.'
          )
        ))
    from selecionadas q
    join public.solicitacoes s on s.id = q.solicitacao_id
    join public.clientes c on c.id = s.cliente_id
    where n.solicitacao_id = q.solicitacao_id
    returning n.solicitacao_id, n.reserva, n.chave_idempotencia, n.payload, n.reservada_ate
  )
  select coalesce(jsonb_agg(to_jsonb(reservadas)), '[]'::jsonb)
    into v_notificacoes
  from reservadas;

  return jsonb_build_object('notificacoes', v_notificacoes);
end;
$$;

create function public.finalizar_notificacao_solicitacao(
  p_chave text,
  p_solicitacao_id uuid,
  p_reserva uuid,
  p_resultado text,
  p_resend_id text default null,
  p_erro text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_agora timestamptz := clock_timestamp();
begin
  if not private.validar_chave_painel(p_chave) then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if p_resultado is null or p_resultado not in ('aceito', 'rejeitado', 'repetir', 'incerto')
     or (p_resultado = 'aceito' and (nullif(btrim(p_resend_id), '') is null or char_length(p_resend_id) > 128)) then
    raise exception 'Resultado de notificação inválido';
  end if;

  with resultado as (
    select n.solicitacao_id,
      n.resultado_incerto or p_resultado = 'incerto' as incerto,
      p_resultado in ('repetir', 'incerto') and n.tentativas < 3
        and v_agora + interval '5 minutes' < n.primeira_tentativa_em + interval '23 hours' as repetir
    from private.notificacoes_solicitacao n
    where n.solicitacao_id = p_solicitacao_id
      and n.estado = 'processando' and n.reserva = p_reserva
    for update
  )
  update private.notificacoes_solicitacao n
  set estado = case when p_resultado = 'aceito' then 'enviado'
                    when r.incerto and not r.repetir then 'revisao'
                    else 'falhou' end,
      proxima_tentativa_em = case when r.repetir then v_agora + interval '5 minutes' end,
      reserva = null,
      reservada_ate = null,
      resultado_incerto = p_resultado <> 'aceito' and r.incerto,
      payload = case when p_resultado <> 'aceito' then n.payload end,
      ultimo_erro = case when p_resultado <> 'aceito' then left(coalesce(p_erro, p_resultado), 120) end,
      resend_id = case when p_resultado = 'aceito' then btrim(p_resend_id) end,
      enviado_em = case when p_resultado = 'aceito' then v_agora end
  from resultado r
  where n.solicitacao_id = r.solicitacao_id;

  return found;
end;
$$;

-- Operação manual exclusiva do banco. Resultados incertos só podem repetir
-- dentro da janela segura, com o mesmo payload e a mesma chave do Resend.
create function private.reprocessar_notificacao_solicitacao(p_solicitacao_id uuid)
returns boolean
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_agora timestamptz := clock_timestamp();
begin
  update private.notificacoes_solicitacao n
  set estado = 'pendente',
      tentativas = 0,
      proxima_tentativa_em = v_agora,
      chave_idempotencia = case when n.resultado_incerto then n.chave_idempotencia else gen_random_uuid() end,
      payload = case when n.resultado_incerto then n.payload end,
      primeira_tentativa_em = case when n.resultado_incerto then n.primeira_tentativa_em end
  where n.solicitacao_id = p_solicitacao_id and n.estado in ('falhou', 'revisao')
    and (not n.resultado_incerto or n.primeira_tentativa_em > v_agora - interval '23 hours');

  return found;
end;
$$;

revoke all on function public.reservar_notificacoes_solicitacao(text, text, text) from public, anon, authenticated;
revoke all on function public.finalizar_notificacao_solicitacao(text, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reservar_notificacoes_solicitacao(text, text, text) to anon, authenticated;
grant execute on function public.finalizar_notificacao_solicitacao(text, uuid, uuid, text, text, text)
  to anon, authenticated;
revoke all on function private.reprocessar_notificacao_solicitacao(uuid) from public, anon, authenticated;
