import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/ui/display";
import { Alert, Card } from "@/components/ui/form";
import { formatVolume } from "@/lib/format";
import type { ClientCategory, PriceRow } from "@/lib/pricing";
import { formatCasesBottles, splitBottles } from "@/lib/quantity";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import { loadPackagingOptions } from "../packaging-options";
import { PriceGrid } from "../price-grid";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Produit" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cree?: string }>;
}) {
  const ctx = await requireContext();
  const { id } = await params;
  const { cree } = await searchParams;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const { data: p } = await supabase
    .from("products")
    .select(
      "id, code, name, brand, category, volume_ml, bottles_per_case, crate_type_id, bottle_type_id, alert_threshold, is_active",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const role = ctx.member.role;
  const canEdit = can(role, "products.edit");
  const canSeePrices = can(role, "prices.read");
  const canManagePrices = can(role, "prices.manage");

  const [packaging, { data: priceRows }] = await Promise.all([
    canEdit ? loadPackagingOptions() : Promise.resolve([]),
    canSeePrices
      ? supabase.from("product_prices").select("client_category, case_price, bottle_price").eq("product_id", id)
      : Promise.resolve({
          data: [] as { client_category: string | null; case_price: number; bottle_price: number | null }[],
        }),
  ]);
  const prices: PriceRow[] = (priceRows ?? []).map((r) => ({
    clientCategory: r.client_category as ClientCategory | null,
    casePrice: r.case_price,
    bottlePrice: r.bottle_price,
  }));

  const threshold = splitBottles(p.alert_threshold, p.bottles_per_case);

  return (
    <>
      <PageHeader
        title={p.name}
        description={[p.code, p.brand, formatVolume(p.volume_ml)].filter(Boolean).join(" · ")}
      />

      {cree && (
        <div className="mb-6 max-w-3xl">
          <Alert tone="success">
            Produit créé.{canManagePrices ? " Saisissez maintenant son prix standard au casier." : ""}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card title="Fiche produit" className="max-w-3xl">
          {canEdit ? (
            <ProductForm
              productId={p.id}
              packaging={packaging}
              initial={{
                code: p.code,
                name: p.name,
                brand: p.brand ?? "",
                category: p.category ?? "",
                volumeCl: p.volume_ml ? String(p.volume_ml / 10).replace(".", ",") : "",
                bottlesPerCase: String(p.bottles_per_case),
                crateTypeId: p.crate_type_id ?? "",
                bottleTypeId: p.bottle_type_id ?? "",
                thresholdCases: threshold.cases ? String(threshold.cases) : "",
                thresholdBottles: threshold.bottles ? String(threshold.bottles) : "",
                isActive: String(p.is_active),
              }}
            />
          ) : (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Conditionnement</dt>
                <dd>{p.bottles_per_case} btl / casier</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Seuil d&apos;alerte</dt>
                <dd>{formatCasesBottles(p.alert_threshold, p.bottles_per_case)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Statut</dt>
                <dd>
                  <StatusBadge active={p.is_active} />
                </dd>
              </div>
            </dl>
          )}
        </Card>

        {canSeePrices && (
          <Card title="Grille de prix" className="max-w-3xl">
            <PriceGrid
              productId={p.id}
              bottlesPerCase={p.bottles_per_case}
              prices={prices}
              editable={canManagePrices}
            />
          </Card>
        )}
      </div>
    </>
  );
}
