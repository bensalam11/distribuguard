-- Invitations par lien : savoir si un employé a choisi son mot de passe.
-- Ouvrir le lien connecte déjà l'utilisateur ; seul l'enregistrement du mot de
-- passe active le compte. Tant que activated_at est vide, le propriétaire peut
-- générer un nouveau lien.

alter table public.members add column activated_at timestamptz;

-- Les comptes existants ont déjà un mot de passe.
update public.members set activated_at = created_at where activated_at is null;

-- Un propriétaire crée son mot de passe à l'inscription.
create function private.activate_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role = 'owner' and new.activated_at is null then
    new.activated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function private.activate_owner() from public;

create trigger members_activate_owner
  before insert on public.members
  for each row execute function private.activate_owner();

-- Appelée après l'enregistrement du mot de passe (invitation ou réinitialisation).
create function public.mark_password_set()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.members
  set activated_at = now()
  where user_id = auth.uid() and activated_at is null;
$$;

revoke all on function public.mark_password_set() from public, anon;
grant execute on function public.mark_password_set() to authenticated;
