-- Renovação do token do Instagram: vale 60 dias e o app renova sozinho antes de vencer.

-- O app (service role) troca o token no Vault depois de renovar na Meta. Ninguém mais chama.
create or replace function public.trocar_token_meta(p_marca uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare segredo uuid;
begin
  select meta_token_secret_id into segredo from public.marcas where id = p_marca;
  if segredo is null then
    raise exception 'marca sem token';
  end if;
  perform vault.update_secret(segredo, p_token);
end $$;
revoke execute on function public.trocar_token_meta(uuid, text) from public, anon, authenticated;
grant execute on function public.trocar_token_meta(uuid, text) to service_role;

-- Uma vez por dia o banco chama o app para renovar os tokens que precisam.
create or replace function public.chamar_renovacao_tokens()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url text;
  tok text;
begin
  if not exists (select 1 from public.marcas where meta_token_secret_id is not null) then
    return;
  end if;
  select valor into url from public.config_app where chave = 'url_app';
  select valor into tok from public.config_app where chave = 'token_agendador';
  if url is null then return; end if;
  perform net.http_post(
    url := url || '/api/publicar-agendados',
    headers := jsonb_build_object('content-type', 'application/json', 'x-agendador', tok),
    body := '{"acao":"renovar_tokens"}'::jsonb
  );
end $$;
revoke execute on function public.chamar_renovacao_tokens() from public, anon, authenticated;

-- todo dia às 9h17 (UTC)
select cron.schedule('renovar-tokens-instagram', '17 9 * * *', 'select public.chamar_renovacao_tokens()');
