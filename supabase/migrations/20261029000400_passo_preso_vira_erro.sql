-- Um passo preso em "rodando" por mais de 6 minutos na terceira tentativa virava "falhou" sem mensagem, sem
-- hora de término e sem o post sair de "em_producao": o post ficava parado para sempre, sem o botão de tentar
-- de novo. Agora o passo ganha o erro e o fim, e o post vai para "erro", como numa falha normal.
create or replace function public.pegar_proximo_passo()
returns public.passos
language plpgsql
security definer
set search_path = public
as $$
declare p public.passos;
begin
  with presos as (
    update public.passos
       set status = case when tentativas >= 3 then 'falhou'::public.passo_status else 'pendente'::public.passo_status end,
           terminado_em = case when tentativas >= 3 then now() else terminado_em end,
           saida = case when tentativas >= 3
                        then coalesce(saida, '{}'::jsonb) || jsonb_build_object('erro', 'O passo passou de 6 minutos sem terminar, 3 vezes (a função caiu ou ficou presa).')
                        else saida end
     where status = 'rodando' and iniciado_em < now() - interval '6 minutes'
     returning post_id, status
  )
  update public.posts set status = 'erro'
   where id in (select post_id from presos where status = 'falhou') and status = 'em_producao';

  select * into p from public.passos
   where status = 'pendente'
   order by criado_em
   for update skip locked
   limit 1;
  if not found then return null; end if;
  update public.passos
     set status = 'rodando', tentativas = tentativas + 1, iniciado_em = now()
   where id = p.id
   returning * into p;
  return p;
end $$;
