import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/form";
import { formatDate } from "@/lib/format";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Accueil" };

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  essai: { label: "Essai", className: "bg-brand-50 text-brand-800" },
  actif: { label: "Actif", className: "bg-accent-50 text-accent-700" },
  en_retard: { label: "Paiement en retard", className: "bg-amber-50 text-amber-800" },
  suspendu: { label: "Suspendu", className: "bg-red-50 text-red-700" },
};

export default async function DashboardPage() {
  const ctx = await requireContext();
  const supabase = await createClient();
  const { data: depots } = await supabase
    .from("depots")
    .select("id, name, address, is_main")
    .eq("is_active", true)
    .order("is_main", { ascending: false })
    .order("name");

  const sub = ctx.subscription;
  const status = sub ? (STATUS_LABELS[sub.status] ?? { label: sub.status, className: "bg-slate-100" }) : null;

  return (
    <>
      <PageHeader title={`Bonjour ${ctx.member.fullName}`} description={ctx.organization.name} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Abonnement">
          {sub && status ? (
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Formule</dt>
                <dd className="font-medium">{sub.planName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Statut</dt>
                <dd>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">{sub.status === "essai" ? "Fin de l'essai" : "Fin de période"}</dt>
                <dd className="font-medium">{formatDate(sub.currentPeriodEnd)}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Aucun abonnement trouvé.</p>
          )}
        </Card>

        <Card title="Entreprise">
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Nom</dt>
              <dd className="truncate font-medium">{ctx.organization.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Ville</dt>
              <dd className="font-medium">{ctx.organization.city}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Dépôts">
          {depots && depots.length > 0 ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {depots.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{d.name}</span>
                  {d.is_main && (
                    <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-700">
                      Principal
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Aucun dépôt.</p>
          )}
        </Card>
      </div>
    </>
  );
}
