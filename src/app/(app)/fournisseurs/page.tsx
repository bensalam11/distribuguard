import type { Metadata } from "next";
import Link from "next/link";
import { EntityForm } from "@/components/forms/entity-form";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, EmptyState, StatusBadge, td, th } from "@/components/ui/display";
import { Card } from "@/components/ui/form";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import { saveSupplierAction } from "./actions";

export const metadata: Metadata = { title: "Fournisseurs" };

const FIELDS = [
  { name: "name", label: "Nom", required: true, placeholder: "Brasserie Kola" },
  { name: "contactName", label: "Personne à contacter" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "E-mail", type: "email" },
  { name: "address", label: "Adresse" },
] as const;

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ modifier?: string }> }) {
  const ctx = await requireContext();
  const canManage = can(ctx.member.role, "logistics.manage");
  const { modifier } = await searchParams;

  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name, contact_name, phone, email, address, is_active")
    .order("is_active", { ascending: false })
    .order("name");
  const editing = canManage ? suppliers?.find((s) => s.id === modifier) : undefined;

  return (
    <>
      <PageHeader title="Fournisseurs" description="Brasseries et autres fournisseurs de boissons." />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card title={`Fournisseurs (${suppliers?.length ?? 0})`}>
          {suppliers && suppliers.length > 0 ? (
            <DataTable
              head={
                <tr>
                  <th className={th}>Nom</th>
                  <th className={th}>Contact</th>
                  <th className={th}>Téléphone</th>
                  <th className={th}>Statut</th>
                  {canManage && <th className={th} />}
                </tr>
              }
            >
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className={td}>
                    <p className="font-medium">{s.name}</p>
                    {s.address && <p className="text-xs text-slate-500">{s.address}</p>}
                  </td>
                  <td className={`${td} text-slate-600`}>
                    {s.contact_name ?? "—"}
                    {s.email && <p className="text-xs text-slate-500">{s.email}</p>}
                  </td>
                  <td className={`${td} text-slate-600`}>{s.phone ?? "—"}</td>
                  <td className={td}>
                    <StatusBadge active={s.is_active} />
                  </td>
                  {canManage && (
                    <td className={`${td} text-right`}>
                      <Link
                        href={`/fournisseurs?modifier=${s.id}`}
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
              title={canManage ? "Aucun fournisseur — ajoutez votre brasserie." : "Aucun fournisseur pour le moment."}
            />
          )}
        </Card>

        {canManage && (
          <Card title={editing ? `Modifier « ${editing.name} »` : "Ajouter un fournisseur"}>
            <EntityForm
              key={editing?.id ?? "new"}
              action={saveSupplierAction}
              fields={FIELDS}
              editingId={editing?.id}
              initial={
                editing
                  ? {
                      name: editing.name,
                      contactName: editing.contact_name ?? "",
                      phone: editing.phone ?? "",
                      email: editing.email ?? "",
                      address: editing.address ?? "",
                      isActive: String(editing.is_active),
                    }
                  : undefined
              }
              cancelHref="/fournisseurs"
              submitLabel={editing ? "Enregistrer" : "Ajouter le fournisseur"}
            />
          </Card>
        )}
      </div>
    </>
  );
}
