-- Gastos que não são de um post (ideias, pedidos avulsos, plano editorial, mural de regras, memória, análises do
-- Financeiro). Antes eles eram cobrados pela API mas não apareciam em lugar nenhum do app.
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null references auth.users (id) on delete cascade,
  marca_id uuid references public.marcas (id) on delete set null,
  origem text not null,
  descricao text,
  modelos text[] not null default '{}',
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric(10, 4) not null default 0,
  deu_erro boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists gastos_dono_idx on public.gastos (dono_id, criado_em desc);
create index if not exists gastos_marca_idx on public.gastos (marca_id, criado_em desc);
alter table public.gastos enable row level security;
-- só o servidor grava; o dono só lê os seus
create policy "dono lê seus gastos" on public.gastos for select to authenticated using (dono_id = (select auth.uid()));

-- Quais IAs cada passo usou de verdade (Claude, GPT, imagem, vídeo), para a tabela de custo por teste.
alter table public.passos add column if not exists modelos text[] not null default '{}';
