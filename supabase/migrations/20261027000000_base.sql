-- Base do Escritório de Agentes: marcas, roteiros versionados, regras aprendidas,
-- posts, fila de passos e eventos (que o escritório 3D assina via Realtime).
-- Tudo pertence a um dono (auth.users) para o app poder virar multiusuário sem refazer tabelas.

create extension if not exists pgcrypto;

-- ───────── marcas ─────────
create table public.marcas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  instagram_usuario text,
  instagram_conta_id text,               -- IG Business Account id usado pela Graph API
  -- id do segredo no Supabase Vault com o token de acesso da Meta (o token nunca fica nesta tabela)
  meta_token_secret_id uuid,
  tom_de_voz text not null default '',
  identidade jsonb not null default '{}'::jsonb,   -- cores, fontes, logo, regras de foto
  hashtags_fixas text[] not null default '{}',
  aviso_final text,                      -- ex.: aviso +18
  modelo_slides_html text,               -- modelo HTML base do carrossel
  checklist_revisor text not null default '',
  criado_em timestamptz not null default now()
);

-- ───────── roteiros (a "linha de raciocínio" editável) ─────────
-- Cada edição cria uma versão nova; a ativa é a de maior versão.
create table public.roteiros (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas(id) on delete cascade,
  versao int not null,
  -- [{ "agente": "pesquisador", "ativo": true, "instrucoes": "..." }, ...] na ordem do fluxo
  etapas jsonb not null,
  nota text,                             -- o que mudou nesta versão
  criado_em timestamptz not null default now(),
  unique (marca_id, versao)
);

create view public.roteiro_ativo with (security_invoker = true) as
select distinct on (marca_id) * from public.roteiros order by marca_id, versao desc;

-- ───────── regras aprendidas ─────────
create type public.regra_status as enum ('proposta', 'ativa', 'arquivada');

create table public.regras (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas(id) on delete cascade,
  agente text not null,                  -- quem precisa seguir a regra
  regra text not null,                   -- curta e verificável
  motivo text,
  origem_correcao text,                  -- a frase original do usuário
  status public.regra_status not null default 'proposta',
  post_id uuid,                          -- post em que a correção aconteceu
  criado_em timestamptz not null default now()
);

-- ───────── posts ─────────
create type public.post_status as enum (
  'rascunho', 'em_producao', 'aguardando_aprovacao', 'aprovado', 'agendado', 'publicado', 'reprovado', 'erro'
);
create type public.post_formato as enum ('carrossel', 'foto', 'reel');

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas(id) on delete cascade,
  roteiro_id uuid references public.roteiros(id),
  briefing text not null,
  formato public.post_formato not null default 'carrossel',
  status public.post_status not null default 'rascunho',
  legenda text,
  slides jsonb not null default '[]'::jsonb,   -- [{ "ordem": 1, "url": "...", "texto": "..." }]
  voltas_revisao int not null default 0,
  agendado_para timestamptz,
  instagram_media_id text,
  publicado_em timestamptz,
  custo_usd numeric(10, 4) not null default 0,
  criado_em timestamptz not null default now()
);

-- ───────── fila de passos ─────────
create type public.passo_status as enum ('pendente', 'rodando', 'feito', 'falhou', 'cancelado');

create table public.passos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  agente text not null,
  ordem int not null,
  status public.passo_status not null default 'pendente',
  entrada jsonb not null default '{}'::jsonb,
  saida jsonb,
  tentativas int not null default 0,
  tokens_entrada int not null default 0,
  tokens_saida int not null default 0,
  custo_usd numeric(10, 4) not null default 0,
  iniciado_em timestamptz,
  terminado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index passos_fila_idx on public.passos (status, criado_em) where status = 'pendente';

-- Pega o próximo passo pendente sem dois executores pegarem o mesmo.
create or replace function public.pegar_proximo_passo()
returns public.passos
language plpgsql
security definer
set search_path = public
as $$
declare p public.passos;
begin
  select * into p from public.passos
   where status = 'pendente'
   order by criado_em
   for update skip locked
   limit 1;
  if not found then return null; end if;
  update public.passos
     set status = 'rodando', tentativas = tentativas + 1, iniciado_em = now()
   where id = p.id
   returning * into p;
  return p;
end $$;
revoke execute on function public.pegar_proximo_passo() from public, anon, authenticated;

-- ───────── eventos (o que o escritório 3D anima) ─────────
create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  agente text not null,                  -- id do agente ou 'voce'
  tipo text not null check (tipo in ('inicio', 'acao', 'texto', 'fim', 'entrega', 'espera', 'erro')),
  mensagem text not null,
  para text,
  custo_usd numeric(10, 4),
  criado_em timestamptz not null default now()
);
create index eventos_post_idx on public.eventos (post_id, criado_em);

-- ───────── mídias da marca ─────────
create table public.midias (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas(id) on delete cascade,
  caminho text not null,                 -- caminho no Storage
  descricao text,
  aprovada boolean not null default true,
  tags text[] not null default '{}',
  criado_em timestamptz not null default now()
);

-- ───────── segurança: cada dono só vê o que é seu ─────────
alter table public.marcas enable row level security;
alter table public.roteiros enable row level security;
alter table public.regras enable row level security;
alter table public.posts enable row level security;
alter table public.passos enable row level security;
alter table public.eventos enable row level security;
alter table public.midias enable row level security;

create policy "dono gerencia marcas" on public.marcas
  for all to authenticated using (dono_id = (select auth.uid())) with check (dono_id = (select auth.uid()));

create or replace function public.e_dono_da_marca(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.marcas where id = m and dono_id = (select auth.uid()))
$$;

create policy "dono gerencia roteiros" on public.roteiros
  for all to authenticated using (public.e_dono_da_marca(marca_id)) with check (public.e_dono_da_marca(marca_id));
create policy "dono gerencia regras" on public.regras
  for all to authenticated using (public.e_dono_da_marca(marca_id)) with check (public.e_dono_da_marca(marca_id));
create policy "dono gerencia posts" on public.posts
  for all to authenticated using (public.e_dono_da_marca(marca_id)) with check (public.e_dono_da_marca(marca_id));
create policy "dono gerencia midias" on public.midias
  for all to authenticated using (public.e_dono_da_marca(marca_id)) with check (public.e_dono_da_marca(marca_id));

-- passos e eventos são escritos só pelo executor (service role); o app apenas lê.
create policy "dono le passos" on public.passos
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id and public.e_dono_da_marca(p.marca_id)));
create policy "dono le eventos" on public.eventos
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id and public.e_dono_da_marca(p.marca_id)));

-- Realtime para o escritório e para a fila de aprovação
alter publication supabase_realtime add table public.eventos;
alter publication supabase_realtime add table public.posts;
