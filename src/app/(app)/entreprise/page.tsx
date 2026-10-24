import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EntityForm } from "@/components/forms/entity-form";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/form";
import { can } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import { updateCompanyAction } from "./actions";

export const metadata: Metadata = { title: "Entreprise" };

const FIELDS = [
  { name: "name", label: "Nom de l'entreprise", required: true },
  { name: "email", label: "E-mail", type: "email", required: true },
  { name: "phone", label: "Téléphone", type: "tel", required: true },
  { name: "city", label: "Ville", required: true },
  { name: "address", label: "Adresse", required: true },
] as const;

export default async function CompanyPage() {
  const ctx = await requireContext();
  if (!can(ctx.member.role, "settings.manage")) notFound();

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name, email, phone, city, address")
    .eq("id", ctx.organization.id)
    .single();

  return (
    <>
      <PageHeader title="Entreprise" description="Le profil de votre entreprise, utilisé sur vos factures." />
      <Card title="Profil de l'entreprise" className="max-w-xl">
        <EntityForm
          action={updateCompanyAction}
          fields={FIELDS}
          initial={org ?? undefined}
          cancelHref="/entreprise"
          submitLabel="Enregistrer"
        />
      </Card>
    </>
  );
}
