-- Memória da marca: uma ficha curta de cada post publicado (feito pelo app ou direto no Instagram).
-- O chefe de pauta e as ideias leem as fichas para não repetir tema; o Social Media vai montar planos a partir delas.
create table if not exists public.memoria_posts (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas (id) on delete cascade,
  origem text not null check (origem in ('app', 'instagram')),
  post_id uuid unique references public.posts (id) on delete cascade,
  instagram_media_id text,
  formato public.post_formato,
  publicado_em timestamptz,
  permalink text,
  texto text not null default '',     -- legenda e texto dos slides, cortados; é o que o resumo lê
  tema text,
  angulo text,
  gancho text,
  linha text,                         -- linha de conteúdo: educativo, receita, bastidor, promoção…
  resumido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (marca_id, instagram_media_id)
);
create index if not exists memoria_posts_marca_idx on public.memoria_posts (marca_id, publicado_em desc);
alter table public.memoria_posts enable row level security;
-- o dono só lê; quem grava é o app (service role)
create policy "dono lê a memória" on public.memoria_posts for select to authenticated using (privado.e_dono_da_marca(marca_id));
