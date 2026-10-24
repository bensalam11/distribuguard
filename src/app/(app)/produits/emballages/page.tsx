import type { Metadata } from "next";
import Link from "next/link";
import { EntityForm } from "@/components/forms/entity-form";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, EmptyState, StatusBadge, td, th } from "@/components/ui/display";
import { Card } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { formatFCFA } from "@/lib/format";
import { CATALOG_TABS } from "@/lib/navigation";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import { createPackagingAction, updatePackagingAction } from "../actions";

export const metadata: Metadata = { title: "Emballages" };

const KIND_LABELS = { crate: "Casier", bottle: "Bouteille" } as const;

const CREATE_FIELDS = [
  { name: "name", label: "Nom", required: true, placeholder: "Casier 12 × 65 cl" },
  {
    name: "kind",
    label: "Type",
    type: "select",
    options: [
      { value: "crate", label: "Casier (vide)" },
      { value: "bottle", label: "Bouteille (vide)" },
    ],
  },
  {
    name: "capacity",
    label: "Bouteilles par casier",
    inputMode: "numeric",
    required: true,
    hint: "Pour un casier uniquement (ex. 12). Ne pourra plus être modifié.",
  },
  {
    name: "depositValue",
    label: "Valeur de consigne (FCFA)",
    inputMode: "numeric",
    required: true,
    placeholder: "1 200",
  },
] as const;

const EDIT_FIELDS = [
  { name: "name", label: "Nom", required: true },
  { name: "depositValue", label: "Valeur de consigne (FCFA)", inputMode: "numeric", required: true },
] as const;

export default async function PackagingPage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const ctx = await requireContext();
  const canManage = can(ctx.member.role, "packaging.manage");
  const { modifier } = await searchParams;

  const supabase = await createClient();
  const { data: types } = await supabase
    .from("packaging_types")
    .select("id, name, kind, capacity, deposit_value, is_active")
    .order("is_active", { ascending: false })
    .order("kind")
    .order("name");
  const editing = canManage ? types?.find((t) => t.id === modifier) : undefined;

  return (
    <>
      <PageHeader
        title="Produits"
        description="Les emballages consignés : prêtés au client avec la boisson, suivis séparément."
      />
      <Tabs items={CATALOG_TABS} />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title={`Emballages (${types?.length ?? 0})`}>
          {types && types.length > 0 ? (
            <DataTable
              head={
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Type</th>
                  <th className={`${th} text-right`}>Consigne</th>
                  <th className={th}>Statut</th>
                  {canManage && <th className={th} />}
                </tr>
              }
            >
              {types.map((t) => (
                <tr key={t.id}>
                  <td className={`${td} font-medium`}>{t.name}</td>
                  <td className={td}>
                    {KIND_LABELS[t.kind as keyof typeof KIND_LABELS]}
                    {t.kind === "crate" && <span className="text-slate-500"> · {t.capacity} btl</span>}
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>{formatFCFA(t.deposit_value)}</td>
                  <td className={td}>
                    <StatusBadge active={t.is_active} />
                  </td>
                  {canManage && (
                    <td className={`${td} text-right`}>
                      <Link
                        href={`/produits/emballages?modifier=${t.id}`}
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
                  ? "Aucun emballage — ajoutez votre casier vide et votre bouteille vide consignés."
                  : "Aucun emballage pour le moment."
              }
            />
          )}
          <p className="mt-4 text-xs text-slate-500">
            Un casier plein = la boisson (vendue) + le casier et ses bouteilles (consignés, prêtés). Créez un emballage
            « casier » et un emballage « bouteille » pour chaque format.
          </p>
        </Card>

        {canManage && (
          <Card title={editing ? `Modifier « ${editing.name} »` : "Ajouter un emballage"}>
            {editing ? (
              <EntityForm
                key={editing.id}
                action={updatePackagingAction}
                fields={EDIT_FIELDS}
                editingId={editing.id}
                initial={{
                  name: editing.name,
                  depositValue: String(editing.deposit_value),
                  isActive: String(editing.is_active),
                }}
                cancelHref="/produits/emballages"
                submitLabel="Enregistrer"
              />
            ) : (
              <EntityForm
                key="new"
                action={createPackagingAction}
                fields={CREATE_FIELDS}
                initial={{ kind: "crate" }}
                cancelHref="/produits/emballages"
                submitLabel="Ajouter l'emballage"
              />
            )}
          </Card>
        )}
      </div>
    </>
  );
}
