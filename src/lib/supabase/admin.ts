import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Client « service_role » : contourne RLS. Réservé au serveur, et uniquement
 * pour les appels à l'API d'administration d'Auth (envoi d'invitations).
 * Ne jamais l'utiliser pour lire ou écrire des données métier.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant (voir .env.example).");
  }
  return createClient(publicEnv().url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
