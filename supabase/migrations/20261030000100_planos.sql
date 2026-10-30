-- Plano editorial do Social Media: um plano (período, ritmo, mix) e as vagas dele no calendário, cada uma com um tema.
-- O app cria planos e vagas (service role); o dono lê, edita, aprova e apaga direto pelo app.
create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  marca_id uuid not null references public.marcas (id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'encerrado')),
  custo_usd numeric(10, 4) not null default 0,
  aprovado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists planos_marca_idx on public.planos (marca_id, criado_em desc);

create table if not exists public.vagas (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.planos (id) on delete cascade,
  marca_id uuid not null references public.marcas (id) on delete cascade,
  ordem int not null,
  quando timestamptz not null,
  formato public.post_formato not null,
  linha text,
  tema_obrigatorio text,
  titulo text not null default '',
  gancho text not null default '',
  briefing text not null default '',
  novidade text,          -- inedito | angulo_novo
  parecido_com text,      -- o post antigo mais parecido, para você comparar
  status text not null default 'proposta' check (status in ('proposta', 'aprovada', 'descartada')),
  post_id uuid references public.posts (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index if not exists vagas_plano_idx on public.vagas (plano_id, ordem);
create index if not exists vagas_marca_idx on public.vagas (marca_id, quando);

alter table public.planos enable row level security;
alter table public.vagas enable row level security;
create policy "dono lê planos" on public.planos for select to authenticated using (privado.e_dono_da_marca(marca_id));
create policy "dono muda planos" on public.planos for update to authenticated using (privado.e_dono_da_marca(marca_id)) with check (privado.e_dono_da_marca(marca_id));
create policy "dono apaga planos" on public.planos for delete to authenticated using (privado.e_dono_da_marca(marca_id));
create policy "dono lê vagas" on public.vagas for select to authenticated using (privado.e_dono_da_marca(marca_id));
create policy "dono muda vagas" on public.vagas for update to authenticated using (privado.e_dono_da_marca(marca_id)) with check (privado.e_dono_da_marca(marca_id));
create policy "dono apaga vagas" on public.vagas for delete to authenticated using (privado.e_dono_da_marca(marca_id));
