import "server-only";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema, updateMemberSchema } from "@/lib/validation/auth";
import { GENERIC_ERROR, userMessageFromDbError } from "./errors";

/**
 * Invitation d'un employé :
 *  1. `create_invitation` (en tant qu'utilisateur) vérifie en base que l'appelant
 *     est propriétaire et que la limite d'utilisateurs du plan est respectée ;
 *  2. l'e-mail est envoyé par l'API admin d'Auth avec l'identifiant de l'invitation ;
 *     le trigger SQL rattache le compte créé à l'organisation avec le bon rôle.
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
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { invitation_id: invitationId, full_name: fullName },
    redirectTo: `${siteUrl()}/auth/confirm?next=/mot-de-passe`,
  });

  if (inviteError) {
    await supabase.rpc("cancel_invitation", { p_invitation_id: invitationId, p_failed: true });
    if (inviteError.code === "email_exists" || inviteError.code === "user_already_exists") {
      return { ok: false, message: "Cette adresse e-mail est déjà utilisée par un compte." };
    }
    return { ok: false, message: "L'e-mail d'invitation n'a pas pu être envoyé. Réessayez." };
  }

  return { ok: true, message: `Invitation envoyée à ${email}.` };
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
