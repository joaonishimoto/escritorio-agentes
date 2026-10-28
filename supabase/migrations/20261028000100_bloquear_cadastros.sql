-- App de uso pessoal: só a conta do dono existe. Qualquer cadastro novo é recusado no banco.
create or replace function privado.bloquear_cadastro() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'Cadastros novos estão fechados neste app';
end $$;

create trigger bloquear_cadastro
  before insert on auth.users
  for each row execute function privado.bloquear_cadastro();
