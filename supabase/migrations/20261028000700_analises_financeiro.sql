-- Análises do agente Financeiro: os números do período e o que ele recomenda.
create table if not exists public.analises_financeiro (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  numeros jsonb not null,
  analise jsonb not null,
  custo_usd numeric(10, 4) not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists analises_financeiro_dono_idx on public.analises_financeiro (dono_id, criado_em desc);
alter table public.analises_financeiro enable row level security;
create policy "dono lê suas análises" on public.analises_financeiro for select to authenticated using (dono_id = (select auth.uid()));
