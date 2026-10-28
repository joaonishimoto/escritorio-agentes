-- Gaveta de posts: post pronto guardado para usar depois
alter type public.post_status add value if not exists 'guardado';
