-- Phase 0 — Invitations d'employés et gestion des membres.

create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'failed');

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  email text not null check (email = lower(email) and length(email) between 3 and 254),
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  role public.member_role not null check (role <> 'owner'),
  status public.invitation_status not null default 'pending',
  invited_by uuid not null,
  member_id uuid references public.members (id) on delete restrict,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invitations_organization_id_idx on public.invitations (organization_id);
create unique index invitations_one_pending_per_email
  on public.invitations (organization_id, email) where status = 'pending';

create trigger invitations_updated_at
  before update on public.invitations
  for each row execute function private.set_updated_at();

alter table public.invitations enable row level security;
revoke all on public.invitations from anon, authenticated;
grant select on public.invitations to authenticated;

create policy invitations_select on public.invitations
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner}'))
  );

-- Les messages d'erreur levés ci-dessous (SQLSTATE P0001) sont destinés à
-- être affichés tels quels à l'utilisateur.

-- ---------------------------------------------------------------------------
-- create_invitation : le propriétaire invite un employé.
-- L'envoi de l'e-mail est fait ensuite côté serveur (API admin Supabase).
-- ---------------------------------------------------------------------------
create function public.create_invitation(p_email text, p_full_name text, p_role public.member_role)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_email text := lower(btrim(p_email));
  v_max_users integer;
  v_used integer;
  v_id uuid;
begin
  if v_org is null or not private.has_role('{owner}') then
    raise exception 'Seul le propriétaire peut inviter des employés.';
  end if;

  if p_role = 'owner' then
    raise exception 'Ce rôle ne peut pas être attribué par invitation.';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'Cette adresse e-mail est déjà utilisée par un compte.';
  end if;

  -- Verrou sur l'abonnement : sérialise les invitations concurrentes.
  select p.max_users into v_max_users
  from public.subscriptions s
  join public.plans p on p.code = s.plan_code
  where s.organization_id = v_org
  for update of s;

  select
    (select count(*) from public.members m where m.organization_id = v_org and m.is_active)
    + (select count(*) from public.invitations i
       where i.organization_id = v_org and i.status = 'pending' and i.expires_at > now())
  into v_used;

  if v_max_users is not null and v_used >= v_max_users then
    raise exception 'Limite d''utilisateurs de votre abonnement atteinte (%).', v_max_users;
  end if;

  -- Une ancienne invitation expirée pour la même adresse est révoquée.
  update public.invitations
  set status = 'revoked'
  where organization_id = v_org and email = v_email and status = 'pending';

  insert into public.invitations (organization_id, email, full_name, role, invited_by)
  values (v_org, v_email, btrim(p_full_name), p_role, auth.uid())
  returning id into v_id;

  perform private.write_audit(v_org, 'invitations.create', 'invitations', v_id::text, null,
    jsonb_build_object('email', v_email, 'role', p_role));

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_invitation : révoque (ou marque en échec si l'e-mail n'a pas pu partir).
-- ---------------------------------------------------------------------------
create function public.cancel_invitation(p_invitation_id uuid, p_failed boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
begin
  if v_org is null or not private.has_role('{owner}') then
    raise exception 'Seul le propriétaire peut gérer les invitations.';
  end if;

  update public.invitations
  set status = case when p_failed then 'failed'::public.invitation_status else 'revoked'::public.invitation_status end
  where id = p_invitation_id and organization_id = v_org and status = 'pending';

  if not found then
    raise exception 'Invitation introuvable ou déjà traitée.';
  end if;

  perform private.write_audit(v_org, 'invitations.cancel', 'invitations', p_invitation_id::text, null,
    jsonb_build_object('failed', p_failed));
end;
$$;

-- ---------------------------------------------------------------------------
-- update_member : changement de rôle / désactivation (propriétaire seulement).
-- L'audit est écrit par le trigger members_audit.
-- ---------------------------------------------------------------------------
create function public.update_member(p_member_id uuid, p_role public.member_role, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_target public.members;
  v_remaining_owners integer;
begin
  if v_org is null or not private.has_role('{owner}') then
    raise exception 'Seul le propriétaire peut modifier les rôles.';
  end if;

  select * into v_target
  from public.members
  where id = p_member_id and organization_id = v_org
  for update;

  if not found then
    raise exception 'Membre introuvable.';
  end if;

  -- Verrouille les propriétaires pour empêcher deux rétrogradations simultanées.
  perform 1 from public.members
  where organization_id = v_org and role = 'owner' and is_active
  for update;

  if v_target.role = 'owner' and v_target.is_active and (p_role <> 'owner' or not p_is_active) then
    select count(*) into v_remaining_owners
    from public.members
    where organization_id = v_org and role = 'owner' and is_active and id <> p_member_id;

    if v_remaining_owners = 0 then
      raise exception 'L''entreprise doit garder au moins un propriétaire actif.';
    end if;
  end if;

  update public.members
  set role = p_role, is_active = p_is_active
  where id = p_member_id;
end;
$$;

revoke all on function public.create_invitation(text, text, public.member_role) from public, anon;
revoke all on function public.cancel_invitation(uuid, boolean) from public, anon;
revoke all on function public.update_member(uuid, public.member_role, boolean) from public, anon;
grant execute on function public.create_invitation(text, text, public.member_role) to authenticated;
grant execute on function public.cancel_invitation(uuid, boolean) to authenticated;
grant execute on function public.update_member(uuid, public.member_role, boolean) to authenticated;
