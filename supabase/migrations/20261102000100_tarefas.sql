-- Tarefas da Assistente da sua sala: qualquer coisa que você precisa fazer, pessoal ou de uma marca, separada por tópico.
-- Só o dono vê e mexe nas próprias tarefas; uma tarefa de marca só pode apontar para uma marca dele.
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- sem marca = pessoal; se a marca for apagada, a tarefa fica como pessoal
  marca_id uuid references public.marcas (id) on delete set null,
  titulo text not null check (char_length(titulo) between 1 and 300),
  topico text not null default 'Geral' check (char_length(topico) between 1 and 40),
  notas text check (notas is null or char_length(notas) <= 2000),
  prazo date,
  importante boolean not null default false,
  feita_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists tarefas_dono_idx on public.tarefas (dono_id, feita_em, prazo);

alter table public.tarefas enable row level security;
create policy "dono lê tarefas" on public.tarefas for select to authenticated using (dono_id = (select auth.uid()));
create policy "dono cria tarefas" on public.tarefas for insert to authenticated
  with check (dono_id = (select auth.uid()) and (marca_id is null or privado.e_dono_da_marca(marca_id)));
create policy "dono muda tarefas" on public.tarefas for update to authenticated
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid()) and (marca_id is null or privado.e_dono_da_marca(marca_id)));
create policy "dono apaga tarefas" on public.tarefas for delete to authenticated using (dono_id = (select auth.uid()));
