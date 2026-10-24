-- Phase 0 — Fondations : organisations, membres, paramètres, dépôts (minimal), helpers RLS.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'manager', 'storekeeper', 'cashier');

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  email text not null check (length(btrim(email)) between 3 and 254),
  phone text not null check (length(btrim(phone)) between 6 and 30),
  city text not null check (length(btrim(city)) between 2 and 80),
  address text not null check (length(btrim(address)) between 2 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Paramètres de l'organisation (une ligne par organisation)
-- ---------------------------------------------------------------------------
create table public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete restrict,
  allow_negative_stock boolean not null default false,
  block_on_credit_limit boolean not null default false,
  currency text not null default 'XAF' check (currency = 'XAF'),
  timezone text not null default 'Africa/Douala',
  updated_at timestamptz not null default now()
);

create trigger organization_settings_updated_at
  before update on public.organization_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membres (un utilisateur appartient à une seule organisation en v1)
-- ---------------------------------------------------------------------------
create table public.members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  user_id uuid not null unique references auth.users (id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  email text not null check (email = lower(email)),
  phone text,
  role public.member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index members_organization_id_idx on public.members (organization_id);

create trigger members_updated_at
  before update on public.members
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Dépôts (version minimale ; complétée en phase 1)
-- ---------------------------------------------------------------------------
create table public.depots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 80),
  address text,
  is_main boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index depots_organization_id_idx on public.depots (organization_id);
create unique index depots_one_main_per_org on public.depots (organization_id) where is_main;

create trigger depots_updated_at
  before update on public.depots
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers RLS (security definer : évite la récursion sur members)
-- ---------------------------------------------------------------------------
create function private.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organization_id
  from public.members m
  where m.user_id = auth.uid() and m.is_active
$$;

create function private.has_role(roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.user_id = auth.uid() and m.is_active and m.role = any (roles)
  )
$$;

revoke all on function private.current_org_id() from public;
revoke all on function private.has_role(public.member_role[]) from public;
grant execute on function private.current_org_id() to authenticated, service_role;
grant execute on function private.has_role(public.member_role[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS et droits
-- Par défaut Supabase accorde tout à anon/authenticated : on retire et on
-- n'accorde que le strict nécessaire, RLS faisant le filtrage par organisation.
-- ---------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_settings enable row level security;
alter table public.members enable row level security;
alter table public.depots enable row level security;

revoke all on public.organizations, public.organization_settings, public.members, public.depots
  from anon, authenticated;

grant select on public.organizations, public.organization_settings, public.members, public.depots
  to authenticated;
grant update (name, email, phone, city, address) on public.organizations to authenticated;
grant update (allow_negative_stock, block_on_credit_limit) on public.organization_settings to authenticated;
grant insert (organization_id, name, address) on public.depots to authenticated;
grant update (name, address, is_active) on public.depots to authenticated;

-- organizations
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = (select private.current_org_id()));

create policy organizations_update on public.organizations
  for update to authenticated
  using (id = (select private.current_org_id()) and (select private.has_role('{owner}')))
  with check (id = (select private.current_org_id()));

-- organization_settings
create policy organization_settings_select on public.organization_settings
  for select to authenticated
  using (organization_id = (select private.current_org_id()));

create policy organization_settings_update on public.organization_settings
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('{owner}')))
  with check (organization_id = (select private.current_org_id()));

-- members : lecture dans l'organisation ; écritures uniquement via fonctions
create policy members_select on public.members
  for select to authenticated
  using (organization_id = (select private.current_org_id()));

-- depots
create policy depots_select on public.depots
  for select to authenticated
  using (organization_id = (select private.current_org_id()));

create policy depots_insert on public.depots
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner,manager}'))
  );

create policy depots_update on public.depots
  for update to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner,manager}'))
  )
  with check (organization_id = (select private.current_org_id()));
