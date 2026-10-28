-- Tira a função de checagem de dono da API pública (usada só pelas políticas RLS).
create schema if not exists privado;
grant usage on schema privado to authenticated;

create or replace function privado.e_dono_da_marca(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.marcas where id = m and dono_id = (select auth.uid()))
$$;
revoke execute on function privado.e_dono_da_marca(uuid) from public, anon;
grant execute on function privado.e_dono_da_marca(uuid) to authenticated;

alter policy "dono gerencia roteiros" on public.roteiros using (privado.e_dono_da_marca(marca_id)) with check (privado.e_dono_da_marca(marca_id));
alter policy "dono gerencia regras" on public.regras using (privado.e_dono_da_marca(marca_id)) with check (privado.e_dono_da_marca(marca_id));
alter policy "dono gerencia posts" on public.posts using (privado.e_dono_da_marca(marca_id)) with check (privado.e_dono_da_marca(marca_id));
alter policy "dono gerencia midias" on public.midias using (privado.e_dono_da_marca(marca_id)) with check (privado.e_dono_da_marca(marca_id));
alter policy "dono le passos" on public.passos using (exists (select 1 from public.posts p where p.id = post_id and privado.e_dono_da_marca(p.marca_id)));
alter policy "dono le eventos" on public.eventos using (exists (select 1 from public.posts p where p.id = post_id and privado.e_dono_da_marca(p.marca_id)));

-- a versão antiga em public fica sem uso e sem permissão de execução
revoke execute on function public.e_dono_da_marca(uuid) from public, anon, authenticated;
