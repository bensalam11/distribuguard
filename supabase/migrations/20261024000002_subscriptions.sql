-- Phase 0 — Plans (configuration) et abonnements DistribuGuard.

create type public.subscription_status as enum ('essai', 'actif', 'en_retard', 'suspendu');

-- Configuration de la plateforme (pas une table métier : pas d'organization_id).
-- Les limites sont lues ici, jamais codées en dur.
create table public.plans (
  code text primary key check (code ~ '^[a-z_]+$'),
  name text not null,
  max_depots integer not null check (max_depots > 0),
  max_users integer not null check (max_users > 0),
  monthly_price bigint not null default 0 check (monthly_price >= 0),
  trial_days integer not null default 30 check (trial_days >= 0),
  is_trial_default boolean not null default false,
  sort_order integer not null default 0
);

create unique index plans_one_trial_default on public.plans ((true)) where is_trial_default;

-- Valeurs initiales indicatives : modifiables par l'éditeur sans changer le code.
insert into public.plans (code, name, max_depots, max_users, monthly_price, trial_days, is_trial_default, sort_order) values
  ('pilote',   'Pilote',   2,  5, 0, 30, true,  1),
  ('standard', 'Standard', 3, 10, 0, 30, false, 2),
  ('pro',      'Pro',     10, 30, 0, 30, false, 3);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete restrict,
  plan_code text not null references public.plans (code) on delete restrict,
  status public.subscription_status not null,
  current_period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;

revoke all on public.plans, public.subscriptions from anon, authenticated;
grant select on public.plans, public.subscriptions to authenticated;

create policy plans_select on public.plans
  for select to authenticated
  using (true);

-- Lecture de son propre abonnement ; écritures réservées à l'éditeur (phase 5).
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (organization_id = (select private.current_org_id()));
