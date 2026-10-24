import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/form";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { loadPackagingOptions } from "../packaging-options";
import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProductPage() {
  const ctx = await requireContext();
  if (!can(ctx.member.role, "products.edit")) notFound();
  const packaging = await loadPackagingOptions();

  return (
    <>
      <PageHeader
        title="Nouveau produit"
        description={
          can(ctx.member.role, "prices.manage")
            ? "Après la création, vous saisirez ses prix."
            : "Les prix sont fixés par le propriétaire ou le gérant."
        }
      />
      <Card className="max-w-3xl">
        <ProductForm packaging={packaging} initial={{ bottlesPerCase: "12" }} />
      </Card>
    </>
  );
}
