import type { Metadata } from "next";
import Link from "next/link";
import { EntityForm } from "@/components/forms/entity-form";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, EmptyState, StatusBadge, td, th } from "@/components/ui/display";
import { Card } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { LOGISTICS_TABS } from "@/lib/navigation";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import { saveDriverAction } from "../vehicules/actions";

export const metadata: Metadata = { title: "Chauffeurs" };

const FIELDS = [
  { name: "fullName", label: "Nom complet", required: true },
  { name: "phone", label: "Téléphone", type: "tel", placeholder: "6 90 00 00 00" },
] as const;

export default async function DriversPage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const ctx = await requireContext();
  const canManage = can(ctx.member.role, "logistics.manage");
  const { modifier } = await searchParams;

  const supabase = await createClient();
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, full_name, phone, is_active")
    .order("is_active", { ascending: false })
    .order("full_name");
  const editing = canManage ? drivers?.find((d) => d.id === modifier) : undefined;

  return (
    <>
      <PageHeader
        title="Dépôts et véhicules"
        description="Les chauffeurs n'ont pas de compte : ce sont des fiches pour les affecter aux tournées."
      />
      <Tabs items={LOGISTICS_TABS} />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card title={`Chauffeurs (${drivers?.length ?? 0})`}>
          {drivers && drivers.length > 0 ? (
            <DataTable
              head={
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Téléphone</th>
                  <th className={th}>Statut</th>
                  {canManage && <th className={th} />}
                </tr>
              }
            >
              {drivers.map((d) => (
                <tr key={d.id}>
                  <td className={`${td} font-medium`}>{d.full_name}</td>
                  <td className={`${td} text-slate-600`}>{d.phone ?? "-"}</td>
                  <td className={td}>
                    <StatusBadge active={d.is_active} />
                  </td>
                  {canManage && (
                    <td className={`${td} text-right`}>
                      <Link
                        href={`/chauffeurs?modifier=${d.id}`}
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
            <EmptyState
              title={
                canManage ? "Aucun chauffeur. Ajoutez votre premier chauffeur." : "Aucun chauffeur pour le moment."
              }
            />
          )}
        </Card>

        {canManage && (
          <Card
            className="order-first lg:order-none"
            title={editing ? `Modifier « ${editing.full_name} »` : "Ajouter un chauffeur"}
          >
            <EntityForm
              key={editing?.id ?? "new"}
              action={saveDriverAction}
              fields={FIELDS}
              editingId={editing?.id}
              initial={
                editing
                  ? { fullName: editing.full_name, phone: editing.phone ?? "", isActive: String(editing.is_active) }
                  : undefined
              }
              cancelHref="/chauffeurs"
              submitLabel={editing ? "Enregistrer" : "Ajouter le chauffeur"}
            />
          </Card>
        )}
      </div>
    </>
  );
}
