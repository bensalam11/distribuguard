-- Phase 0 — Création atomique à l'inscription.
--
-- Le trigger s'exécute dans la même transaction que l'insertion dans
-- auth.users : si une étape échoue, le compte n'est pas créé non plus.
--
--  * raw_user_meta_data.signup_kind = 'organization' (inscription publique) :
--    organisation + propriétaire + paramètres + « Dépôt principal » + abonnement en essai.
--  * raw_user_meta_data.invitation_id (invitation envoyée par l'API admin) :
--    rattache l'utilisateur à l'organisation qui l'a invité.
--  * Sinon (utilisateur créé à la main dans le tableau de bord Supabase) : rien.

create function private.create_organization_for_user(p_user_id uuid, p_email text, p_meta jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_plan public.plans;
  v_full_name text := btrim(coalesce(p_meta ->> 'full_name', ''));
  v_company text := btrim(coalesce(p_meta ->> 'company_name', ''));
  v_phone text := btrim(coalesce(p_meta ->> 'phone', ''));
  v_city text := btrim(coalesce(p_meta ->> 'city', ''));
  v_address text := btrim(coalesce(p_meta ->> 'address', ''));
begin
  select * into v_plan from public.plans where is_trial_default;
  if not found then
    raise exception 'Aucun plan d''essai configuré.';
  end if;

  insert into public.organizations (name, email, phone, city, address)
  values (v_company, lower(p_email), v_phone, v_city, v_address)
  returning id into v_org;

  insert into public.members (organization_id, user_id, full_name, email, phone, role)
  values (v_org, p_user_id, v_full_name, lower(p_email), v_phone, 'owner');

  insert into public.organization_settings (organization_id) values (v_org);

  insert into public.depots (organization_id, name, address, is_main)
  values (v_org, 'Dépôt principal', v_address, true);

  insert into public.subscriptions (organization_id, plan_code, status, current_period_end)
  values (
    v_org,
    v_plan.code,
    'essai',
    (now() at time zone 'Africa/Douala')::date + v_plan.trial_days
  );

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, after)
  values (v_org, p_user_id, 'organizations.create', 'organizations', v_org::text,
    jsonb_build_object('name', v_company, 'plan', v_plan.code));

  return v_org;
end;
$$;

create function private.accept_invitation_for_user(p_user_id uuid, p_email text, p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invitations;
  v_member uuid;
begin
  select * into v_inv
  from public.invitations
  where id = p_invitation_id
  for update;

  if not found
     or v_inv.status <> 'pending'
     or v_inv.expires_at <= now()
     or v_inv.email <> lower(p_email) then
    raise exception 'Invitation invalide ou expirée.';
  end if;

  insert into public.members (organization_id, user_id, full_name, email, role)
  values (v_inv.organization_id, p_user_id, v_inv.full_name, v_inv.email, v_inv.role)
  returning id into v_member;

  update public.invitations
  set status = 'accepted', member_id = v_member
  where id = v_inv.id;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, after)
  values (v_inv.organization_id, v_inv.invited_by, 'members.create', 'members', v_member::text,
    jsonb_build_object('email', v_inv.email, 'role', v_inv.role, 'invitation_id', v_inv.id));

  return v_member;
end;
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if v_meta ->> 'signup_kind' = 'organization' then
    perform private.create_organization_for_user(new.id, new.email, v_meta);
  elsif v_meta ? 'invitation_id' then
    perform private.accept_invitation_for_user(new.id, new.email, (v_meta ->> 'invitation_id')::uuid);
  end if;
  return new;
end;
$$;

revoke all on function private.create_organization_for_user(uuid, text, jsonb) from public;
revoke all on function private.accept_invitation_for_user(uuid, text, uuid) from public;
revoke all on function private.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
