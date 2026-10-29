-- Aprovação do texto: o post para depois do redator e espera você aprovar o texto antes do designer começar.
alter type public.post_status add value if not exists 'aguardando_texto';
