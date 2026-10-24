import "server-only";
import type { Permission } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/validation/catalog";

export type StepStatus = "done" | "skipped" | "pending";

export type OnboardingStepView = {
  step: OnboardingStep;
  title: string;
  description: string;
  href: string;
  /** Permission pour réaliser l'étape ; sinon elle ne peut qu'être sautée. */
  permission: Permission;
  status: StepStatus;
  summary: string;
};

const STEP_DEFS: Record<OnboardingStep, Omit<OnboardingStepView, "step" | "status" | "summary">> = {
  company: {
    title: "Profil de l'entreprise",
    description: "Nom, téléphone, adresse : ils apparaîtront sur vos factures.",
    href: "/entreprise",
    permission: "settings.manage",
  },
  depots: {
    title: "Dépôts",
    description: "Le « Dépôt principal » existe déjà. Ajoutez vos autres dépôts.",
    href: "/depots",
    permission: "depots.manage",
  },
  vehicles: {
    title: "Véhicules et chauffeurs",
    description: "Vos tricycles et camionnettes, et les chauffeurs qui font les tournées.",
    href: "/vehicules",
    permission: "logistics.manage",
  },
  catalog: {
    title: "Emballages et produits",
    description: "Vos casiers et bouteilles consignés, puis vos boissons et leurs prix.",
    href: "/produits/emballages",
    permission: "packaging.manage",
  },
  team: {
    title: "Employés",
    description: "Invitez votre gérant, vos magasiniers et caissiers.",
    href: "/equipe",
    permission: "team.manage",
  },
};

export type OnboardingState = { finished: boolean; steps: OnboardingStepView[] };

/** État de l'assistant de démarrage, avec un résumé de ce qui existe déjà. */
export async function loadOnboarding(): Promise<OnboardingState> {
  const supabase = await createClient();
  const count = async (table: string) => {
    const { count: n } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("is_active", true);
    return n ?? 0;
  };

  const [{ data: settings }, depots, vehicles, drivers, packaging, products, members] = await Promise.all([
    supabase.from("organization_settings").select("onboarding_steps, onboarding_finished_at").maybeSingle(),
    count("depots"),
    count("vehicles"),
    count("drivers"),
    count("packaging_types"),
    count("products"),
    count("members"),
  ]);

  const stored = (settings?.onboarding_steps ?? {}) as Partial<Record<OnboardingStep, StepStatus>>;
  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;
  const summaries: Record<OnboardingStep, string> = {
    company: "",
    depots: plural(depots, "dépôt actif", "dépôts actifs"),
    vehicles: `${plural(vehicles, "véhicule", "véhicules")}, ${plural(drivers, "chauffeur", "chauffeurs")}`,
    catalog: `${plural(packaging, "emballage", "emballages")}, ${plural(products, "produit", "produits")}`,
    team: plural(members, "membre", "membres"),
  };

  return {
    finished: Boolean(settings?.onboarding_finished_at),
    steps: ONBOARDING_STEPS.map((step) => ({
      step,
      ...STEP_DEFS[step],
      status: stored[step] ?? "pending",
      summary: summaries[step],
    })),
  };
}
