-- Création d'un produit et de son prix standard en une seule transaction
-- (formulaire produit simplifié). security invoker : la RLS s'applique ;
-- le prix passe par save_product_prices (propriétaire / gérant uniquement).

create function public.create_product(
  p_code text,
  p_name text,
  p_bottles_per_case integer,
  p_crate_type_id uuid default null,
  p_bottle_type_id uuid default null,
  p_brand text default null,
  p_category text default null,
  p_volume_ml integer default null,
  p_alert_threshold integer default 0,
  p_case_price bigint default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.products (
    organization_id, code, name, brand, category, volume_ml, bottles_per_case,
    crate_type_id, bottle_type_id, alert_threshold
  )
  values (
    private.current_org_id(), p_code, p_name, p_brand, p_category, p_volume_ml, p_bottles_per_case,
    p_crate_type_id, p_bottle_type_id, coalesce(p_alert_threshold, 0)
  )
  returning id into v_id;

  if p_case_price is not null then
    perform public.save_product_prices(
      v_id,
      jsonb_build_array(jsonb_build_object('category', null, 'case_price', p_case_price, 'bottle_price', null))
    );
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_product(text, text, integer, uuid, uuid, text, text, integer, integer, bigint)
  from public, anon;
grant execute on function public.create_product(text, text, integer, uuid, uuid, text, text, integer, integer, bigint)
  to authenticated;
