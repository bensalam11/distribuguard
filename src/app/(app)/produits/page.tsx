import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, ButtonLink, DataTable, EmptyState, StatusBadge, td, th } from "@/components/ui/display";
import { Card } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { formatFCFA, formatVolume } from "@/lib/format";
import { CATALOG_TABS } from "@/lib/navigation";
import { formatCasesBottles } from "@/lib/quantity";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Produits" };

type ProductRow = {
  id: string;
  code: string;
  name: string;
  brand: string | null;
  category: string | null;
  volume_ml: number | null;
  bottles_per_case: number;
  alert_threshold: number;
  is_active: boolean;
  crate: { name: string } | null;
  bottle: { name: string } | null;
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const ctx = await requireContext();
  const canEdit = can(ctx.member.role, "products.edit");
  const canSeePrices = can(ctx.member.role, "prices.read");
  const { q = "", statut } = await searchParams;
  const showAll = statut === "tous";

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(
      "id, code, name, brand, category, volume_ml, bottles_per_case, alert_threshold, is_active, " +
        "crate:packaging_types!products_organization_id_crate_type_id_fkey(name), " +
        "bottle:packaging_types!products_organization_id_bottle_type_id_fkey(name)",
    )
    .order("name");
  if (!showAll) query = query.eq("is_active", true);
  const search = q.trim().replace(/[%_,()]/g, " ");
  if (search) query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%,brand.ilike.%${search}%`);
  const { data } = await query;
  const products = (data ?? []) as unknown as ProductRow[];

  // Le magasinier n'a pas accès aux prix (la RLS renverrait de toute façon une liste vide).
  const standardPrices = new Map<string, number>();
  if (canSeePrices && products.length > 0) {
    const { data: prices } = await supabase
      .from("product_prices")
      .select("product_id, case_price")
      .is("client_category", null)
      .in(
        "product_id",
        products.map((p) => p.id),
      );
    for (const p of prices ?? []) standardPrices.set(p.product_id, p.case_price);
  }

  return (
    <>
      <PageHeader title="Produits" description="Vos boissons, leur conditionnement et leur consigne." />
      <Tabs items={CATALOG_TABS} />

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <form className="flex flex-1 flex-wrap items-center gap-2" role="search">
            <label htmlFor="q" className="sr-only">
              Rechercher un produit
            </label>
            <input
              id="q"
              name="q"
              defaultValue={q}
              placeholder="Rechercher (nom, code, marque)"
              className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
            <select
              name="statut"
              defaultValue={showAll ? "tous" : ""}
              aria-label="Statut"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Actifs</option>
              <option value="tous">Tous (y compris inactifs)</option>
            </select>
            <button type="submit" className="rounded-lg px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50">
              Filtrer
            </button>
          </form>
          {canEdit && <ButtonLink href="/produits/nouveau">Nouveau produit</ButtonLink>}
        </div>

        {products.length > 0 ? (
          <DataTable
            head={
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Produit</th>
                <th className={th}>Conditionnement</th>
                <th className={th}>Consigne</th>
                {canSeePrices && <th className={`${th} text-right`}>Prix casier</th>}
                <th className={th}>Seuil d&apos;alerte</th>
                <th className={th}>Statut</th>
              </tr>
            }
          >
            {products.map((p) => {
              const price = standardPrices.get(p.id);
              return (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className={`${td} font-mono text-xs`}>{p.code}</td>
                  <td className={td}>
                    <Link href={`/produits/${p.id}`} className="font-medium text-brand-800 hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[p.brand, p.category, formatVolume(p.volume_ml)].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{p.bottles_per_case} btl / casier</td>
                  <td className={`${td} text-slate-600`}>
                    {p.crate || p.bottle ? (
                      [p.crate?.name, p.bottle?.name].filter(Boolean).join(" + ")
                    ) : (
                      <span className="text-slate-400">Non consigné</span>
                    )}
                  </td>
                  {canSeePrices && (
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {price !== undefined ? formatFCFA(price) : <Badge tone="warn">À définir</Badge>}
                    </td>
                  )}
                  <td className={`${td} whitespace-nowrap`}>
                    {p.alert_threshold > 0 ? formatCasesBottles(p.alert_threshold, p.bottles_per_case) : "—"}
                  </td>
                  <td className={td}>
                    <StatusBadge active={p.is_active} />
                  </td>
                </tr>
              );
            })}
          </DataTable>
        ) : (
          <EmptyState
            title={
              search
                ? "Aucun produit ne correspond à votre recherche."
                : canEdit
                  ? "Aucun produit — ajoutez votre premier produit."
                  : "Aucun produit pour le moment."
            }
            action={
              !search && canEdit ? <ButtonLink href="/produits/nouveau">Ajouter un produit</ButtonLink> : undefined
            }
          />
        )}
      </Card>
    </>
  );
}
