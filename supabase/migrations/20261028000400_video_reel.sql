-- Vídeo do Reel gerado na Kling e guardado no bucket "posts".
-- { "url", "caminho", "prompt", "segundos", "modelo", "kling_id" }
alter table public.posts add column if not exists video jsonb;
