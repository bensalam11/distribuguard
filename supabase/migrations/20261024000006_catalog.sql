-- Phase 1 — Catalogue, emballages, dépôts, véhicules, chauffeurs, fournisseurs.
--
-- Décisions (validées avec l'utilisateur) :
--  * Emballages : le casier vide et la bouteille vide sont deux types distincts,
--    chacun avec sa valeur de consigne. Un produit consigné référence son casier
--    et/ou sa bouteille ; un produit non consigné (canette, PET) n'en a aucun.
--  * Prix : prix au casier obligatoire, prix à la bouteille optionnel, par
--    produit et éventuellement par catégorie de client. Table séparée
--    `product_prices` : le magasinier ne la voit pas et ne peut pas l'écrire.
--  * Quantités en bouteilles (unité de base), montants en FCFA entiers (bigint).
--  * Aucune suppression : les fiches se désactivent.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.packaging_kind as enum ('crate', 'bottle');
create type public.client_category as enum ('bar', 'boutique', 'revendeur', 'particulier');
create type public.vehicle_kind as enum ('tricycle', 'camionnette', 'camion', 'autre');

-- ---------------------------------------------------------------------------
-- Types d'emballage
-- ---------------------------------------------------------------------------
create table public.packaging_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 80),
  kind public.packaging_kind not null,
  -- Équivalence en bouteilles : nombre d'emplacements du casier, 1 pour une bouteille.
  capacity integer not null,
  deposit_value bigint not null check (deposit_value >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check ((kind = 'bottle' and capacity = 1) or (kind = 'crate' and capacity between 1 and 200))
);

create unique index packaging_types_org_name_idx on public.packaging_types (organization_id, lower(name));

create trigger packaging_types_updated_at
  before update on public.packaging_types
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Produits
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  code text not null check (length(btrim(code)) between 1 and 30),
  name text not null check (length(btrim(name)) between 2 and 120),
  brand text check (brand is null or length(btrim(brand)) between 1 and 80),
  category text check (category is null or length(btrim(category)) between 1 and 60),
  volume_ml integer check (volume_ml is null or volume_ml between 1 and 100000),
  bottles_per_case integer not null check (bottles_per_case between 1 and 200),
  crate_type_id uuid,
  bottle_type_id uuid,
  -- Seuil d'alerte en bouteilles (saisi en casiers + bouteilles).
  alert_threshold integer not null default 0 check (alert_threshold >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- Clés composées : l'emballage appartient forcément à la même organisation.
  foreign key (organization_id, crate_type_id) references public.packaging_types (organization_id, id) on delete restrict,
  foreign key (organization_id, bottle_type_id) references public.packaging_types (organization_id, id) on delete restrict
);

create unique index products_org_code_idx on public.products (organization_id, lower(code));
create index products_org_name_idx on public.products (organization_id, name);

create trigger products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

-- Cohérence produit / emballages : bon type, et casier de la bonne taille.
create function private.check_product_packaging()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crate public.packaging_types;
  v_bottle public.packaging_types;
begin
  if new.crate_type_id is not null then
    select * into v_crate from public.packaging_types where id = new.crate_type_id;
    if v_crate.kind <> 'crate' then
      raise exception 'L''emballage « % » n''est pas un casier.', v_crate.name;
    end if;
    if v_crate.capacity <> new.bottles_per_case then
      raise exception 'Le casier « % » contient % bouteilles : le produit doit avoir le même nombre de bouteilles par casier.',
        v_crate.name, v_crate.capacity;
    end if;
  end if;

  if new.bottle_type_id is not null then
    select * into v_bottle from public.packaging_types where id = new.bottle_type_id;
    if v_bottle.kind <> 'bottle' then
      raise exception 'L''emballage « % » n''est pas une bouteille.', v_bottle.name;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.check_product_packaging() from public;

create trigger products_check_packaging
  before insert or update of crate_type_id, bottle_type_id, bottles_per_case on public.products
  for each row execute function private.check_product_packaging();

-- ---------------------------------------------------------------------------
-- Grille de prix : prix standard (client_category nulle) + prix par catégorie.
-- ---------------------------------------------------------------------------
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  product_id uuid not null,
  client_category public.client_category,
  case_price bigint not null check (case_price > 0),
  bottle_price bigint check (bottle_price is null or bottle_price > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, product_id) references public.products (organization_id, id) on delete restrict,
  unique nulls not distinct (product_id, client_category)
);

create index product_prices_org_idx on public.product_prices (organization_id);

create trigger product_prices_updated_at
  before update on public.product_prices
  for each row execute function private.set_updated_at();

-- Enregistre toute la grille de prix d'un produit en une transaction.
-- p_prices : [{ "category": null | "bar" | …, "case_price": 7800, "bottle_price": 700 | null }]
-- Une catégorie sans prix au casier est retirée ; le prix standard est obligatoire.
-- security invoker : la RLS (propriétaire / gérant) s'applique à chaque écriture.
create function public.save_product_prices(p_product_id uuid, p_prices jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
  v_item jsonb;
  v_category public.client_category;
  v_case bigint;
  v_bottle bigint;
begin
  if v_org is null or not private.has_role('{owner,manager}') then
    raise exception 'Seuls le propriétaire et le gérant peuvent modifier les prix.';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and organization_id = v_org) then
    raise exception 'Produit introuvable.';
  end if;
  if jsonb_typeof(p_prices) <> 'array' then
    raise exception 'Grille de prix invalide.';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(p_prices) e
    where e -> 'category' = 'null'::jsonb and coalesce(e ->> 'case_price', '') <> ''
  ) then
    raise exception 'Le prix standard au casier est obligatoire.';
  end if;

  for v_item in select * from jsonb_array_elements(p_prices) loop
    v_category := nullif(v_item ->> 'category', '')::public.client_category;
    v_case := nullif(v_item ->> 'case_price', '')::bigint;
    v_bottle := nullif(v_item ->> 'bottle_price', '')::bigint;

    if v_case is null then
      delete from public.product_prices
      where product_id = p_product_id and client_category = v_category;
    else
      insert into public.product_prices (organization_id, product_id, client_category, case_price, bottle_price)
      values (v_org, p_product_id, v_category, v_case, v_bottle)
      on conflict (product_id, client_category)
      do update set case_price = excluded.case_price, bottle_price = excluded.bottle_price;
    end if;
  end loop;
end;
$$;

revoke all on function public.save_product_prices(uuid, jsonb) from public, anon;
grant execute on function public.save_product_prices(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Véhicules, chauffeurs, fournisseurs
-- (pas de carburant / kilométrage / entretien : hors v1)
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 60),
  kind public.vehicle_kind not null,
  plate_number text check (plate_number is null or length(btrim(plate_number)) between 2 and 20),
  capacity_cases integer check (capacity_cases is null or capacity_cases between 1 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index vehicles_org_name_idx on public.vehicles (organization_id, lower(name));

create trigger vehicles_updated_at
  before update on public.vehicles
  for each row execute function private.set_updated_at();

-- Chauffeur : simple fiche, sans compte en v1.
create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  full_name text not null check (length(btrim(full_name)) between 2 and 120),
  phone text check (phone is null or length(btrim(phone)) between 6 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create index drivers_org_idx on public.drivers (organization_id);

create trigger drivers_updated_at
  before update on public.drivers
  for each row execute function private.set_updated_at();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (length(btrim(name)) between 2 and 120),
  contact_name text check (contact_name is null or length(btrim(contact_name)) between 2 and 120),
  phone text check (phone is null or length(btrim(phone)) between 6 and 30),
  email text check (email is null or (email = lower(email) and length(email) between 3 and 254)),
  address text check (address is null or length(btrim(address)) between 2 and 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index suppliers_org_name_idx on public.suppliers (organization_id, lower(name));

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Dépôts : limite du plan et dépôt principal toujours actif
-- ---------------------------------------------------------------------------
create unique index depots_org_lower_name_idx on public.depots (organization_id, lower(name));

create function private.enforce_depot_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max integer;
  v_active integer;
begin
  if tg_op = 'UPDATE' and old.is_main and not new.is_active then
    raise exception 'Le dépôt principal ne peut pas être désactivé.';
  end if;

  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    -- Verrou sur l'abonnement : sérialise les créations concurrentes.
    -- (À l'inscription, l'abonnement n'existe pas encore : pas de limite à vérifier.)
    select p.max_depots into v_max
    from public.subscriptions s
    join public.plans p on p.code = s.plan_code
    where s.organization_id = new.organization_id
    for update of s;

    if v_max is not null then
      select count(*) into v_active
      from public.depots
      where organization_id = new.organization_id and is_active and id <> new.id;

      if v_active >= v_max then
        raise exception 'Limite de dépôts de votre abonnement atteinte (%).', v_max;
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_depot_rules() from public;

create trigger depots_rules
  before insert or update of is_active on public.depots
  for each row execute function private.enforce_depot_rules();

create trigger depots_audit
  after update on public.depots
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- Assistant de démarrage (étapes sautables)
-- ---------------------------------------------------------------------------
alter table public.organization_settings
  add column onboarding_steps jsonb not null default '{}'::jsonb
    check (jsonb_typeof(onboarding_steps) = 'object'),
  add column onboarding_finished_at timestamptz;

create function public.set_onboarding_step(p_step text, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
begin
  if v_org is null or not private.has_role('{owner,manager}') then
    raise exception 'Seuls le propriétaire et le gérant peuvent configurer l''entreprise.';
  end if;
  if p_step not in ('company', 'depots', 'vehicles', 'catalog', 'team') then
    raise exception 'Étape inconnue.';
  end if;
  if p_status not in ('done', 'skipped', 'pending') then
    raise exception 'Statut d''étape invalide.';
  end if;

  update public.organization_settings
  set onboarding_steps = case
        when p_status = 'pending' then onboarding_steps - p_step
        else onboarding_steps || jsonb_build_object(p_step, p_status)
      end
  where organization_id = v_org;
end;
$$;

create function public.finish_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := private.current_org_id();
begin
  if v_org is null or not private.has_role('{owner,manager}') then
    raise exception 'Seuls le propriétaire et le gérant peuvent configurer l''entreprise.';
  end if;
  update public.organization_settings
  set onboarding_finished_at = coalesce(onboarding_finished_at, now())
  where organization_id = v_org;
end;
$$;

revoke all on function public.set_onboarding_step(text, text) from public, anon;
revoke all on function public.finish_onboarding() from public, anon;
grant execute on function public.set_onboarding_step(text, text) to authenticated;
grant execute on function public.finish_onboarding() to authenticated;

-- ---------------------------------------------------------------------------
-- Journal d'audit : prix, consignes, fiches produits
-- ---------------------------------------------------------------------------
create trigger packaging_types_audit
  after insert or update on public.packaging_types
  for each row execute function private.audit_row();

create trigger products_audit
  after insert or update on public.products
  for each row execute function private.audit_row();

create trigger product_prices_audit
  after insert or update or delete on public.product_prices
  for each row execute function private.audit_row();

-- ---------------------------------------------------------------------------
-- RLS et droits
-- Lecture : tous les membres actifs de l'organisation, sauf les prix
-- (propriétaire, gérant, caissier). Écriture : propriétaire et gérant ;
-- le magasinier peut créer et modifier les produits (sans prix).
-- Pas de DELETE, sauf pour retirer un prix par catégorie.
-- ---------------------------------------------------------------------------
alter table public.packaging_types enable row level security;
alter table public.products enable row level security;
alter table public.product_prices enable row level security;
alter table public.vehicles enable row level security;
alter table public.drivers enable row level security;
alter table public.suppliers enable row level security;

revoke all on public.packaging_types, public.products, public.product_prices,
  public.vehicles, public.drivers, public.suppliers from anon, authenticated;

grant select on public.packaging_types, public.products, public.product_prices,
  public.vehicles, public.drivers, public.suppliers to authenticated;

-- Le type et la capacité d'un emballage ne changent plus après création.
grant insert (organization_id, name, kind, capacity, deposit_value) on public.packaging_types to authenticated;
grant update (name, deposit_value, is_active) on public.packaging_types to authenticated;

grant insert (organization_id, code, name, brand, category, volume_ml, bottles_per_case,
  crate_type_id, bottle_type_id, alert_threshold) on public.products to authenticated;
grant update (code, name, brand, category, volume_ml, bottles_per_case,
  crate_type_id, bottle_type_id, alert_threshold, is_active) on public.products to authenticated;

grant insert (organization_id, product_id, client_category, case_price, bottle_price) on public.product_prices to authenticated;
grant update (case_price, bottle_price) on public.product_prices to authenticated;
grant delete on public.product_prices to authenticated;

grant insert (organization_id, name, kind, plate_number, capacity_cases) on public.vehicles to authenticated;
grant update (name, kind, plate_number, capacity_cases, is_active) on public.vehicles to authenticated;

grant insert (organization_id, full_name, phone) on public.drivers to authenticated;
grant update (full_name, phone, is_active) on public.drivers to authenticated;

grant insert (organization_id, name, contact_name, phone, email, address) on public.suppliers to authenticated;
grant update (name, contact_name, phone, email, address, is_active) on public.suppliers to authenticated;

-- Lecture par tous les membres de l'organisation
create policy packaging_types_select on public.packaging_types
  for select to authenticated using (organization_id = (select private.current_org_id()));
create policy products_select on public.products
  for select to authenticated using (organization_id = (select private.current_org_id()));
create policy vehicles_select on public.vehicles
  for select to authenticated using (organization_id = (select private.current_org_id()));
create policy drivers_select on public.drivers
  for select to authenticated using (organization_id = (select private.current_org_id()));
create policy suppliers_select on public.suppliers
  for select to authenticated using (organization_id = (select private.current_org_id()));

-- Prix : jamais visibles du magasinier
create policy product_prices_select on public.product_prices
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner,manager,cashier}'))
  );

-- Écritures propriétaire / gérant
create policy packaging_types_insert on public.packaging_types
  for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')));
create policy packaging_types_update on public.packaging_types
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')))
  with check (organization_id = (select private.current_org_id()));

create policy product_prices_insert on public.product_prices
  for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')));
create policy product_prices_update on public.product_prices
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')))
  with check (organization_id = (select private.current_org_id()));
-- Seuls les prix par catégorie peuvent être retirés ; le prix standard reste.
create policy product_prices_delete on public.product_prices
  for delete to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner,manager}'))
    and client_category is not null
  );

create policy vehicles_insert on public.vehicles
  for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')));
create policy vehicles_update on public.vehicles
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')))
  with check (organization_id = (select private.current_org_id()));

create policy drivers_insert on public.drivers
  for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')));
create policy drivers_update on public.drivers
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')))
  with check (organization_id = (select private.current_org_id()));

create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('{owner,manager}')))
  with check (organization_id = (select private.current_org_id()));

-- Produits : propriétaire, gérant et magasinier
create policy products_insert on public.products
  for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner,manager,storekeeper}'))
  );
create policy products_update on public.products
  for update to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner,manager,storekeeper}'))
  )
  with check (organization_id = (select private.current_org_id()));
