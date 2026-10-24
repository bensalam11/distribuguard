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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "anonymous" };

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, role, organization:organizations(id, name, city)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const organization = member?.organization as unknown as AppContext["organization"] | null;
  if (!member || !organization) {
    return { kind: "no_organization", email: user.email ?? "" };
  }

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_code, status, current_period_end, plan:plans(name)")
    .eq("organization_id", organization.id)
    .maybeSingle();

  return {
    kind: "ok",
    context: {
      userId: user.id,
      email: user.email ?? "",
      member: { id: member.id, fullName: member.full_name, role: member.role as MemberRole },
      organization,
      subscription: sub
        ? {
            planCode: sub.plan_code,
            planName: (sub.plan as unknown as { name: string } | null)?.name ?? sub.plan_code,
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
