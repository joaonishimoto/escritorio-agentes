-- Posts agendados: a cada minuto o banco confere se algum chegou na hora e chama o app para publicar.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Configurações internas, lidas só pelo service role (RLS sem políticas).
create table if not exists public.config_app (
  chave text primary key,
  valor text not null,
  atualizado_em timestamptz not null default now()
);
alter table public.config_app enable row level security;

-- Senha que o banco manda ao app; gerada aqui, nunca sai do banco/servidor.
insert into public.config_app (chave, valor)
values ('token_agendador', encode(extensions.gen_random_bytes(24), 'hex'))
on conflict (chave) do nothing;

create or replace function public.chamar_agendador()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url text;
  tok text;
begin
  if not exists (select 1 from public.posts where status = 'agendado' and agendado_para <= now()) then
    return;
  end if;
  select valor into url from public.config_app where chave = 'url_app';
  select valor into tok from public.config_app where chave = 'token_agendador';
  if url is null then return; end if;
  perform net.http_post(
    url := url || '/api/publicar-agendados',
    headers := jsonb_build_object('content-type', 'application/json', 'x-agendador', tok),
    body := '{}'::jsonb
  );
end $$;
revoke execute on function public.chamar_agendador() from public, anon, authenticated;

select cron.schedule('publicar-agendados', '* * * * *', 'select public.chamar_agendador()');
