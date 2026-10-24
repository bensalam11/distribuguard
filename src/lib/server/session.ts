import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { MemberRole } from "@/lib/roles";
import { LOGIN_PATH } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

export type AppContext = {
  userId: string;
  email: string;
  member: { id: string; fullName: string; role: MemberRole };
  organization: { id: string; name: string; city: string };
  subscription: { planCode: string; planName: string; status: string; currentPeriodEnd: string } | null;
};

export type ContextResult =
  { kind: "anonymous" } | { kind: "no_organization"; email: string } | { kind: "ok"; context: AppContext };

/**
 * Charge l'utilisateur connecté, son membre et son organisation. Les lectures
 * passent par RLS : un membre désactivé ne voit plus rien.
 * Mis en cache pour la durée d'une requête.
 */
export const loadContext = cache(async (): Promise<ContextResult> => {
  const supabase = await createClient();
  // Vérification locale du jeton (le middleware l'a déjà rafraîchi).
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return { kind: "anonymous" };
  const email = typeof claims.email === "string" ? claims.email : "";

  // Membre, organisation et abonnement en une seule requête.
  const { data: member } = await supabase
    .from("members")
    .select(
      "id, full_name, role, organization:organizations(id, name, city, " +
        "subscription:subscriptions(plan_code, status, current_period_end, plan:plans(name)))",
    )
    .eq("user_id", claims.sub)
    .eq("is_active", true)
    .maybeSingle();

  type Row = {
    id: string;
    full_name: string;
    role: MemberRole;
    organization:
      | (AppContext["organization"] & {
          subscription:
            | { plan_code: string; status: string; current_period_end: string; plan: { name: string } | null }
            | { plan_code: string; status: string; current_period_end: string; plan: { name: string } | null }[]
            | null;
        })
      | null;
  };
  const row = member as unknown as Row | null;
  const organization = row?.organization;
  if (!row || !organization) {
    return { kind: "no_organization", email };
  }
  const sub = Array.isArray(organization.subscription) ? organization.subscription[0] : organization.subscription;

  return {
    kind: "ok",
    context: {
      userId: claims.sub,
      email,
      member: { id: row.id, fullName: row.full_name, role: row.role },
      organization: { id: organization.id, name: organization.name, city: organization.city },
      subscription: sub
        ? {
            planCode: sub.plan_code,
            planName: sub.plan?.name ?? sub.plan_code,
            status: sub.status,
            currentPeriodEnd: sub.current_period_end,
          }
        : null,
    },
  };
});

/** Pour les pages de l'application : redirige si pas de session ou pas d'organisation. */
export async function requireContext(): Promise<AppContext> {
  const result = await loadContext();
  if (result.kind === "anonymous") redirect(LOGIN_PATH);
  if (result.kind === "no_organization") redirect("/acces-refuse");
  return result.context;
}
