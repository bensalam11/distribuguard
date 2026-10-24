import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { HOME_PATH, LOGIN_PATH, safeNextPath } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "recovery", "magiclink", "email", "email_change"];

/**
 * Point d'arrivée des liens envoyés par e-mail (confirmation d'inscription,
 * invitation, réinitialisation du mot de passe). Voir docs/SUPABASE_SETUP.md
 * pour les modèles d'e-mails à configurer.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const defaultNext = type === "invite" || type === "recovery" ? "/mot-de-passe" : HOME_PATH;
  const next = safeNextPath(searchParams.get("next"), defaultNext);

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const target = request.nextUrl.clone();
  target.search = "";
  if (ok) {
    target.pathname = next;
  } else {
    target.pathname = LOGIN_PATH;
    target.searchParams.set("erreur", "lien");
  }
  return NextResponse.redirect(target);
}
