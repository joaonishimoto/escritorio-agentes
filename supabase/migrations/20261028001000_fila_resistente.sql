-- Fila mais resistente: a ordem do passo vem do banco, o cron também acorda a fila esquecida
-- e as chaves estrangeiras ganham índice (advisor do Supabase).

-- ordem = próximo número do post, calculado no insert (antes era count+1 no servidor, sujeito a corrida)
create or replace function public.proxima_ordem_do_passo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ordem is null then
    select coalesce(max(ordem), 0) + 1 into new.ordem from public.passos where post_id = new.post_id;
  end if;
  return new;
end $$;
alter table public.passos alter column ordem drop not null;
drop trigger if exists passos_ordem on public.passos;
create trigger passos_ordem before insert on public.passos
  for each row execute function public.proxima_ordem_do_passo();

-- o banco chama o app a cada minuto também quando há passo pendente parado há mais de 2 minutos
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
  if not exists (select 1 from public.posts where status = 'agendado' and agendado_para <= now())
     and not exists (select 1 from public.passos where status = 'pendente' and criado_em < now() - interval '2 minutes') then
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

-- índices das chaves estrangeiras
create index if not exists posts_marca_idx on public.posts (marca_id, criado_em desc);
create index if not exists posts_roteiro_idx on public.posts (roteiro_id);
create index if not exists passos_post_idx on public.passos (post_id, ordem);
create index if not exists regras_marca_idx on public.regras (marca_id, status);
create index if not exists midias_marca_idx on public.midias (marca_id);
create index if not exists marcas_dono_idx on public.marcas (dono_id);
