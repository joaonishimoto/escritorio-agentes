-- Anúncios no Meta: o post ganha o pedido do anúncio (objetivo da campanha, público, link de destino) e,
-- depois do copywriter, o pacote de textos para colar no Gerenciador de Anúncios. Nulo em post comum.
alter table public.posts add column if not exists anuncio jsonb;

comment on column public.posts.anuncio is 'Só nos anúncios: { objetivo, etapa, destino?, pacote?: { nome, texto_principal[], titulo[], descricao, botao } }. As artes ficam em slides: 1 = feed 4:5, 2 = Stories e Reels 9:16.';
