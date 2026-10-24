import type { Metadata } from "next";
import Link from "next/link";
import { EntityForm } from "@/components/forms/entity-form";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, DataTable, EmptyState, StatusBadge, td, th } from "@/components/ui/display";
import { Card } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { LOGISTICS_TABS } from "@/lib/navigation";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import { saveDepotAction } from "./actions";

export const metadata: Metadata = { title: "Dépôts" };

const FIELDS = [
  { name: "name", label: "Nom", required: true, placeholder: "Dépôt Bonabéri" },
  { name: "address", label: "Adresse" },
] as const;

export default async function DepotsPage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const ctx = await requireContext();
  const canManage = can(ctx.member.role, "depots.manage");
  const { modifier } = await searchParams;

  const supabase = await createClient();
  const [{ data: depots }, { data: plan }] = await Promise.all([
    supabase
      .from("depots")
      .select("id, name, address, is_main, is_active")
      .order("is_main", { ascending: false })
      .order("name"),
    supabase.from("subscriptions").select("plan:plans(max_depots)").maybeSingle(),
  ]);
  const maxDepots = (plan?.plan as unknown as { max_depots: number } | null)?.max_depots;
  const activeCount = (depots ?? []).filter((d) => d.is_active).length;
  const editing = canManage ? depots?.find((d) => d.id === modifier) : undefined;

  return (
    <>
      <PageHeader title="Dépôts et véhicules" description="Les lieux où se trouve votre stock." />
      <Tabs items={LOGISTICS_TABS} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card
          title={`Dépôts (${activeCount} actif${activeCount > 1 ? "s" : ""}${maxDepots ? ` sur ${maxDepots} autorisés` : ""})`}
        >
          {depots && depots.length > 0 ? (
            <DataTable
              head={
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Adresse</th>
                  <th className={th}>Statut</th>
                  {canManage && <th className={th} />}
                </tr>
              }
            >
              {depots.map((d) => (
                <tr key={d.id}>
                  <td className={`${td} font-medium`}>
                    {d.name} {d.is_main && <Badge tone="brand">Principal</Badge>}
                  </td>
                  <td className={`${td} text-slate-600`}>{d.address ?? "-"}</td>
                  <td className={td}>
                    <StatusBadge active={d.is_active} />
                  </td>
                  {canManage && (
                    <td className={`${td} text-right`}>
                      <Link
                        href={`/depots?modifier=${d.id}`}
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        Modifier
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </DataTable>
          ) : (
            <EmptyState title="Aucun dépôt. Ajoutez votre premier dépôt." />
          )}
        </Card>

        {canManage && (
          <Card
            className="order-first lg:order-none"
            title={editing ? `Modifier « ${editing.name} »` : "Ajouter un dépôt"}
          >
            <EntityForm
              key={editing?.id ?? "new"}
              action={saveDepotAction}
              fields={FIELDS}
              editingId={editing?.id}
              canDeactivate={!editing?.is_main}
              initial={
                editing
                  ? { name: editing.name, address: editing.address ?? "", isActive: String(editing.is_active) }
                  : undefined
              }
              cancelHref="/depots"
              submitLabel={editing ? "Enregistrer" : "Ajouter le dépôt"}
            />
            {!editing && maxDepots && activeCount >= maxDepots && (
              <p className="mt-3 text-xs text-amber-700">
                Votre abonnement autorise {maxDepots} dépôts actifs : désactivez-en un ou changez de formule.
              </p>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
