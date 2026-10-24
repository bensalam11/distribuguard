-- Phase 0 — Journal d'audit : qui, quoi, quand, avant/après.

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- Lecture : propriétaire et gérant. Aucune écriture directe : uniquement via
-- private.write_audit / private.audit_row (security definer).
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (select private.has_role('{owner,manager}'))
  );

create function private.write_audit(
  p_organization_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_before jsonb,
  p_after jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, before, after)
  values (p_organization_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_before, p_after);
$$;

revoke all on function private.write_audit(uuid, text, text, text, jsonb, jsonb) from public;

-- Trigger générique : journalise les modifications d'une ligne.
-- TG_ARGV[0] = colonne contenant l'organization_id (par défaut 'organization_id').
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_column text := coalesce(tg_argv[0], 'organization_id');
  before_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  after_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  row_data jsonb := coalesce(after_row, before_row);
begin
  if tg_op = 'UPDATE' and before_row - 'updated_at' = after_row - 'updated_at' then
    return new;
  end if;

  perform private.write_audit(
    (row_data ->> org_column)::uuid,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    row_data ->> 'id',
    before_row,
    after_row
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_row() from public;

create trigger organizations_audit
  after update on public.organizations
  for each row execute function private.audit_row('id');

create trigger organization_settings_audit
  after update on public.organization_settings
  for each row execute function private.audit_row();

-- Changement de rôle / activation d'un membre.
create trigger members_audit
  after update on public.members
  for each row execute function private.audit_row();

create trigger subscriptions_audit
  after update on public.subscriptions
  for each row execute function private.audit_row();
