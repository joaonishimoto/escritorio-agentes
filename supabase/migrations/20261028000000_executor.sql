-- Executor dos agentes: fila com retomada, token da Meta no Vault e buckets de imagens.

-- A fila só é lida pelo executor (service role). Passos presos em "rodando" há mais de
-- 6 minutos (função que caiu no meio) voltam para a fila, até 3 tentativas.
create or replace function public.pegar_proximo_passo()
returns public.passos
language plpgsql
security definer
set search_path = public
as $$
declare p public.passos;
begin
  update public.passos
     set status = case when tentativas >= 3 then 'falhou'::public.passo_status else 'pendente'::public.passo_status end
   where status = 'rodando' and iniciado_em < now() - interval '6 minutes';

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
revoke execute on function public.pegar_proximo_passo() from public, anon, authenticated;
grant execute on function public.pegar_proximo_passo() to service_role;

-- Token da Meta de cada marca guardado no Vault (criptografado).
-- O dono grava pelo app; só o executor lê.
create or replace function public.definir_token_meta(p_marca uuid, p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare segredo uuid;
begin
  if not exists (select 1 from public.marcas where id = p_marca and dono_id = (select auth.uid())) then
    raise exception 'marca não encontrada';
  end if;
  select meta_token_secret_id into segredo from public.marcas where id = p_marca;
  if segredo is null then
    segredo := vault.create_secret(p_token, 'meta_token_' || p_marca::text, 'Token do Instagram da marca');
    update public.marcas set meta_token_secret_id = segredo where id = p_marca;
  else
    perform vault.update_secret(segredo, p_token);
  end if;
end $$;
revoke execute on function public.definir_token_meta(uuid, text) from public, anon;
grant execute on function public.definir_token_meta(uuid, text) to authenticated;

create or replace function public.ler_token_meta(p_marca uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select s.decrypted_secret
    from public.marcas m
    join vault.decrypted_secrets s on s.id = m.meta_token_secret_id
   where m.id = p_marca
$$;
revoke execute on function public.ler_token_meta(uuid) from public, anon, authenticated;
grant execute on function public.ler_token_meta(uuid) to service_role;

-- Buckets públicos: o Instagram baixa as imagens por URL.
insert into storage.buckets (id, name, public) values ('posts', 'posts', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('marcas', 'marcas', true) on conflict (id) do nothing;

-- O dono sobe fotos da marca em marcas/<marca_id>/...
create policy "dono sobe fotos da marca" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'marcas' and privado.e_dono_da_marca(((storage.foldername(name))[1])::uuid));
create policy "dono apaga fotos da marca" on storage.objects
  for delete to authenticated
  using (bucket_id = 'marcas' and privado.e_dono_da_marca(((storage.foldername(name))[1])::uuid));
