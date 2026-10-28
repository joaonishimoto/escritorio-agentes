-- Escolhas do dono no Novo post (formato, estrutura, layout, voz, slides, horário desejado)
alter table public.posts add column if not exists preferencias jsonb not null default '{}'::jsonb;
