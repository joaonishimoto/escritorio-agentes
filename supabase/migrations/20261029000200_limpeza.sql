-- Faxina diária: o banco chama o app, que apaga narração antiga e arquivos que ninguém mais vê.
create or replace function public.chamar_limpeza()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url text;
  tok text;
begin
  select valor into url from public.config_app where chave = 'url_app';
  select valor into tok from public.config_app where chave = 'token_agendador';
  if url is null then return; end if;
  perform net.http_post(
    url := url || '/api/publicar-agendados',
    headers := jsonb_build_object('content-type', 'application/json', 'x-agendador', tok),
    body := '{"acao":"limpeza"}'::jsonb
  );
end $$;
revoke execute on function public.chamar_limpeza() from public, anon, authenticated;

-- todo dia às 6h43 UTC (madrugada no Brasil)
select cron.schedule('limpeza-diaria', '43 6 * * *', 'select public.chamar_limpeza()');
