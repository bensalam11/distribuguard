import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Badge, ButtonLink } from "@/components/ui/display";
import { Card } from "@/components/ui/form";
import { can } from "@/lib/roles";
import { loadOnboarding } from "@/lib/server/onboarding";
import { requireContext } from "@/lib/server/session";
import { FinishButton, StepButton } from "./step-buttons";

export const metadata: Metadata = { title: "Démarrage" };

const STATUS = {
  done: { label: "Fait", tone: "brand" },
  skipped: { label: "Passée", tone: "neutral" },
  pending: { label: "À faire", tone: "warn" },
} as const;

export default async function OnboardingPage() {
  const ctx = await requireContext();
  if (!can(ctx.member.role, "onboarding.manage")) notFound();
  const { steps, finished } = await loadOnboarding();
  const remaining = steps.filter((s) => s.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Configurer votre entreprise"
        description="Chaque étape peut être passée et reprise plus tard. Le stock initial et les soldes de casiers viendront avec le moteur de stock."
      />

      <ol className="max-w-3xl space-y-3">
        {steps.map((s, i) => {
          const allowed = can(ctx.member.role, s.permission);
          const status = STATUS[s.status];
          return (
            <li key={s.step}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-800">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-slate-900">
                        {s.title} <Badge tone={status.tone}>{status.label}</Badge>
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{s.description}</p>
                      {s.summary && <p className="mt-1 text-xs text-slate-500">Actuellement : {s.summary}.</p>}
                      {!allowed && (
                        <p className="mt-1 text-xs text-amber-700">
                          Réservé au propriétaire : vous pouvez passer cette étape.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {s.status === "pending" ? (
                      <>
                        {allowed && (
                          <ButtonLink href={s.href} className="px-3 py-1.5 text-xs">
                            Ouvrir
                          </ButtonLink>
                        )}
                        {allowed && <StepButton step={s.step} status="done" label="Marquer comme fait" />}
                        <StepButton step={s.step} status="skipped" label="Passer" variant="ghost" />
                      </>
                    ) : (
                      <StepButton step={s.step} status="pending" label="Reprendre" variant="ghost" />
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 max-w-3xl">
        {finished ? (
          <p className="text-sm text-slate-600">
            La configuration est terminée. Vous pouvez revenir ici à tout moment.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <FinishButton label={remaining > 0 ? "Terminer plus tard" : "Terminer la configuration"} />
            {remaining > 0 && (
              <p className="text-xs text-slate-500">
                {remaining} étape{remaining > 1 ? "s" : ""} à faire : le rappel disparaîtra de l&apos;accueil.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
