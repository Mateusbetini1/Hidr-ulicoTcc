-- Homologação. Provisione o hash do segredo antes de liberar o formulário.
begin;

create table private.cadastro_worker_config (
  id boolean primary key default true check (id),
  segredo_hash text not null check (segredo_hash ~ '^[0-9a-f]{64}$')
);

alter table private.cadastro_worker_config enable row level security;
revoke all on private.cadastro_worker_config from public, anon, authenticated;

create function public.criar_solicitacao_worker(
  p_segredo text,
  p_nome text,
  p_empresa text,
  p_whatsapp text,
  p_email text,
  p_descricao text,
  p_origem text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_segredo is null or char_length(p_segredo) <> 64 or p_segredo !~ '^[0-9a-f]{64}$' or not exists (
    select 1 from private.cadastro_worker_config
    where id and segredo_hash = encode(extensions.digest(p_segredo, 'sha256'), 'hex')
  ) then
    raise exception 'Acesso ao cadastro não autorizado' using errcode = '42501';
  end if;

  return public.criar_solicitacao_publica(p_nome, p_empresa, p_whatsapp, p_email, p_descricao, p_origem);
end;
$$;

revoke execute on function public.criar_solicitacao_publica(text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.criar_solicitacao_worker(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.criar_solicitacao_worker(text, text, text, text, text, text, text) to anon;

commit;
