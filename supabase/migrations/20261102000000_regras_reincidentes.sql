-- Regras reincidentes: quando o dono corrige algo que uma regra (ou a composição de todas as marcas) já cobria,
-- o curador não cria regra repetida; ele conta mais uma vez na regra que falhou. Regra com vezes >= 2 vai para o
-- topo do prompt de quem desenha e vira item obrigatório da autoconferência e do revisor.
alter table public.regras add column if not exists vezes integer not null default 1;
alter table public.regras add column if not exists ultima_vez timestamptz;

comment on column public.regras.vezes is 'Quantas vezes o dono teve de corrigir o que esta regra cobre (1 = só a correção que criou a regra).';
comment on column public.regras.ultima_vez is 'Quando o dono corrigiu de novo algo que esta regra já cobria.';
