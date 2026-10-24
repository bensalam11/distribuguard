import "server-only";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, loginSchema, setPasswordSchema, signupSchema } from "@/lib/validation/auth";
import { GENERIC_ERROR } from "./errors";

/**
 * Inscription d'une entreprise. Supabase crée le compte ; le trigger SQL
 * `on_auth_user_created` crée dans la même transaction l'organisation, le
 * propriétaire, les paramètres, le dépôt principal et l'abonnement en essai.
 */
export async function signUpOrganization(input: unknown): Promise<ActionState> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/confirm`,
      data: {
        signup_kind: "organization",
        full_name: v.fullName,
        company_name: v.companyName,
        phone: v.phone,
        city: v.city,
        address: v.address,
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { ok: false, fieldErrors: { password: ["Mot de passe trop faible."] } };
    }
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { ok: false, fieldErrors: { email: ["Un compte existe déjà avec cette adresse."] } };
    }
    if (error.code === "over_email_send_rate_limit") {
      return { ok: false, message: "Trop de tentatives. Réessayez dans quelques minutes." };
    }
    return { ok: false, message: GENERIC_ERROR };
  }

  // Message identique que l'adresse soit nouvelle ou non (pas d'énumération des comptes).
  return {
    ok: true,
    message: `Compte créé. Un e-mail de confirmation a été envoyé à ${v.email}. Cliquez sur le lien pour activer votre compte.`,
  };
}

export async function signIn(input: unknown): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        ok: false,
        message: "Votre adresse e-mail n'est pas encore confirmée. Vérifiez votre boîte de réception.",
      };
    }
    if (error.code === "invalid_credentials") {
      return { ok: false, message: "E-mail ou mot de passe incorrect." };
    }
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function requestPasswordReset(input: unknown): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/confirm?next=/mot-de-passe`,
  });
  return {
    ok: true,
    message: "Si un compte existe pour cette adresse, un e-mail de réinitialisation vient d'être envoyé.",
  };
}

/** Définition du mot de passe (après une invitation ou une réinitialisation). */
export async function setPassword(input: unknown): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { ok: false, fieldErrors: { password: ["Choisissez un mot de passe différent de l'ancien."] } };
    }
    if (error.code === "weak_password") {
      return { ok: false, fieldErrors: { password: ["Mot de passe trop faible."] } };
    }
    return { ok: false, message: "Lien expiré ou session invalide. Redemandez un lien." };
  }
  return { ok: true };
}
