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
import { VEHICLE_KINDS, VEHICLE_KIND_LABELS } from "@/lib/validation/catalog";
import { saveVehicleAction } from "./actions";

export const metadata: Metadata = { title: "Véhicules" };

const FIELDS = [
  { name: "name", label: "Nom", required: true, placeholder: "Tricycle 1" },
  {
    name: "kind",
    label: "Type",
    type: "select",
    options: VEHICLE_KINDS.map((k) => ({ value: k, label: VEHICLE_KIND_LABELS[k] })),
  },
  { name: "plateNumber", label: "Immatriculation", placeholder: "LT 123 AB" },
  { name: "capacityCases", label: "Capacité en casiers", inputMode: "numeric" },
] as const;

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const ctx = await requireContext();
  const canManage = can(ctx.member.role, "logistics.manage");
  const { modifier } = await searchParams;

  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, name, kind, plate_number, capacity_cases, is_active")
    .order("is_active", { ascending: false })
    .order("name");
  const editing = canManage ? vehicles?.find((v) => v.id === modifier) : undefined;

  return (
    <>
      <PageHeader
        title="Dépôts et véhicules"
        description="Chaque véhicule est un emplacement de stock pendant la tournée."
      />
      <Tabs items={LOGISTICS_TABS} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title={`Véhicules (${vehicles?.length ?? 0})`}>
          {vehicles && vehicles.length > 0 ? (
            <DataTable
              head={
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Type</th>
                  <th className={th}>Immatriculation</th>
                  <th className={th}>Capacité</th>
                  <th className={th}>Statut</th>
                  {canManage && <th className={th} />}
                </tr>
              }
            >
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className={`${td} font-medium`}>{v.name}</td>
                  <td className={td}>{VEHICLE_KIND_LABELS[v.kind as keyof typeof VEHICLE_KIND_LABELS]}</td>
                  <td className={`${td} text-slate-600`}>{v.plate_number ?? "—"}</td>
                  <td className={`${td} text-slate-600`}>{v.capacity_cases ? `${v.capacity_cases} casiers` : "—"}</td>
                  <td className={td}>
                    <StatusBadge active={v.is_active} />
                  </td>
                  {canManage && (
                    <td className={`${td} text-right`}>
                      <Link
                        href={`/vehicules?modifier=${v.id}`}
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
                canManage
                  ? "Aucun véhicule — ajoutez votre premier tricycle ou camionnette."
                  : "Aucun véhicule pour le moment."
              }
            />
          )}
        </Card>

        {canManage && (
          <Card title={editing ? `Modifier « ${editing.name} »` : "Ajouter un véhicule"}>
            <EntityForm
              key={editing?.id ?? "new"}
              action={saveVehicleAction}
              fields={FIELDS}
              editingId={editing?.id}
              initial={
                editing
                  ? {
                      name: editing.name,
                      kind: editing.kind,
                      plateNumber: editing.plate_number ?? "",
                      capacityCases: editing.capacity_cases?.toString() ?? "",
                      isActive: String(editing.is_active),
                    }
                  : { kind: "tricycle" }
              }
              cancelHref="/vehicules"
              submitLabel={editing ? "Enregistrer" : "Ajouter le véhicule"}
            />
          </Card>
        )}
      </div>
    </>
  );
}
