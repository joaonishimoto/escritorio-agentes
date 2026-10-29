-- Métricas do Instagram de cada post publicado: o app busca na Meta a cada 6 horas nos primeiros 60 dias.
create table if not exists public.metricas (
  post_id uuid primary key references public.posts (id) on delete cascade,
  marca_id uuid not null references public.marcas (id) on delete cascade,
  alcance integer,
  visualizacoes integer,
  curtidas integer,
  comentarios integer,
  salvos integer,
  compartilhamentos integer,
  interacoes integer,
  atualizado_em timestamptz not null default now()
);
create index if not exists metricas_marca_idx on public.metricas (marca_id);
alter table public.metricas enable row level security;
-- o dono só lê; quem grava é o app (service role)
create policy "dono lê métricas" on public.metricas for select to authenticated using (privado.e_dono_da_marca(marca_id));

create or replace function public.chamar_metricas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  url text;
  tok text;
begin
  if not exists (select 1 from public.posts where status = 'publicado' and instagram_media_id is not null and publicado_em > now() - interval '60 days') then
    return;
  end if;
  select valor into url from public.config_app where chave = 'url_app';
  select valor into tok from public.config_app where chave = 'token_agendador';
  if url is null then return; end if;
  perform net.http_post(
    url := url || '/api/publicar-agendados',
    headers := jsonb_build_object('content-type', 'application/json', 'x-agendador', tok),
    body := '{"acao":"atualizar_metricas"}'::jsonb
  );
end $$;
revoke execute on function public.chamar_metricas() from public, anon, authenticated;

-- a cada 6 horas, no minuto 37
select cron.schedule('metricas-instagram', '37 */6 * * *', 'select public.chamar_metricas()');
