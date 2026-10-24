import "server-only";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/roles";
import { inviteSchema, updateMemberSchema } from "@/lib/validation/auth";
import { GENERIC_ERROR, userMessageFromDbError } from "./errors";
import { requireContext } from "./session";

/** Lien d'arrivée : vérifie le jeton puis ouvre la page « choisir son mot de passe ». */
function passwordLink(hashedToken: string, type: "invite" | "recovery"): string {
  const params = new URLSearchParams({ token_hash: hashedToken, type, next: "/mot-de-passe" });
  return `${siteUrl()}/auth/confirm?${params.toString()}`;
}

/**
 * Invitation d'un employé, par lien à transmettre (WhatsApp…) plutôt que par e-mail :
 *  1. `create_invitation` (en tant qu'utilisateur) vérifie en base que l'appelant
 *     est propriétaire et que la limite d'utilisateurs du plan est respectée ;
 *  2. l'API admin d'Auth crée le compte et génère un lien d'invitation, sans envoyer
 *     d'e-mail ; le trigger SQL rattache le compte à l'organisation avec le bon rôle ;
 *  3. le lien est renvoyé au propriétaire (affiché une fois, jamais stocké ni journalisé).
 * La clé service_role n'est utilisée que pour l'étape 2, jamais pour les données.
 */
export async function inviteEmployee(input: unknown): Promise<ActionState> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { email, fullName, role } = parsed.data;
  const supabase = await createClient();

  const { data: invitationId, error } = await supabase.rpc("create_invitation", {
    p_email: email,
    p_full_name: fullName,
    p_role: role,
  });
  if (error || !invitationId) {
    return { ok: false, message: userMessageFromDbError(error) };
  }

  const admin = createAdminClient();
  const { data: generated, error: inviteError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { invitation_id: invitationId, full_name: fullName },
      redirectTo: `${siteUrl()}/auth/confirm?next=/mot-de-passe`,
    },
  });

  if (inviteError || !generated?.properties?.hashed_token) {
    await supabase.rpc("cancel_invitation", { p_invitation_id: invitationId, p_failed: true });
    if (inviteError?.code === "email_exists" || inviteError?.code === "user_already_exists") {
      return { ok: false, message: "Cette adresse e-mail est déjà utilisée par un compte." };
    }
    return { ok: false, message: "Le lien d'invitation n'a pas pu être créé. Réessayez." };
  }

  return {
    ok: true,
    message: `Invitation créée pour ${fullName}. Envoyez-lui ce lien personnel :`,
    link: passwordLink(generated.properties.hashed_token, "invite"),
  };
}

/**
 * Nouveau lien pour un employé qui n'a pas encore choisi son mot de passe (lien perdu ou expiré).
 * La clé service_role contourne la RLS : on vérifie d'abord, avec la session de
 * l'appelant, qu'il est propriétaire et que le membre est dans son organisation.
 */
export async function regenerateInviteLink(memberId: unknown): Promise<ActionState> {
  const parsed = z.uuid().safeParse(memberId);
  if (!parsed.success) return { ok: false, message: GENERIC_ERROR };

  const ctx = await requireContext();
  if (!can(ctx.member.role, "team.manage")) {
    return { ok: false, message: "Seul le propriétaire peut gérer les invitations." };
  }

  const supabase = await createClient();
  const { data: member } = await supabase
    .from("members")
    .select("email, full_name, is_active, role, activated_at")
    .eq("id", parsed.data)
    .eq("organization_id", ctx.organization.id)
    .maybeSingle();
  if (!member || member.role === "owner") return { ok: false, message: "Membre introuvable." };
  if (!member.is_active) return { ok: false, message: "Réactivez d'abord ce membre." };
  if (member.activated_at) {
    return {
      ok: false,
      message: "Ce membre a déjà choisi son mot de passe : un nouveau lien n'est pas nécessaire.",
    };
  }

  const admin = createAdminClient();
  const { data: generated, error } = await admin.auth.admin.generateLink({ type: "recovery", email: member.email });
  if (error || !generated?.properties?.hashed_token) {
    return { ok: false, message: "Le lien n'a pas pu être créé. Réessayez." };
  }
  return {
    ok: true,
    message: `Nouveau lien pour ${member.full_name} :`,
    link: passwordLink(generated.properties.hashed_token, "recovery"),
  };
}

/** Membres de l'organisation qui n'ont pas encore choisi leur mot de passe (lecture RLS). */
export async function membersAwaitingFirstLogin(): Promise<Set<string>> {
  const ctx = await requireContext();
  if (!can(ctx.member.role, "team.manage")) return new Set();

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("id")
    .eq("organization_id", ctx.organization.id)
    .is("activated_at", null)
    .eq("is_active", true);
  return new Set((members ?? []).map((m) => m.id));
}

export async function cancelInvitation(invitationId: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_invitation", { p_invitation_id: invitationId });
  return error ? { ok: false, message: userMessageFromDbError(error) } : { ok: true, message: "Invitation annulée." };
}

export async function updateMember(input: unknown): Promise<ActionState> {
  const parsed = updateMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: GENERIC_ERROR };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member", {
    p_member_id: parsed.data.memberId,
    p_role: parsed.data.role,
    p_is_active: parsed.data.isActive,
  });
  return error ? { ok: false, message: userMessageFromDbError(error) } : { ok: true, message: "Membre mis à jour." };
}
