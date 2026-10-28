-- Referências enviadas junto com o pedido do post: imagens (url pública) e links/texto.
-- [{ "tipo": "imagem", "url": "..." } | { "tipo": "link", "url": "..." }]
alter table public.posts add column if not exists referencias jsonb not null default '[]'::jsonb;
