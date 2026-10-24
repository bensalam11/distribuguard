import "server-only";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { can, type Permission } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import {
  companySchema,
  depotSchema,
  driverSchema,
  onboardingStepSchema,
  packagingCreateSchema,
  packagingUpdateSchema,
  priceGridSchema,
  productSchema,
  supplierSchema,
  vehicleSchema,
} from "@/lib/validation/catalog";
import { FORBIDDEN_ERROR, dbErrorMessage } from "./errors";
import { requireContext } from "./session";

/**
 * Catalogue et logistique (phase 1). Chaque fonction valide l'entrée (Zod),
 * vérifie le rôle côté serveur, puis écrit avec la session de l'utilisateur :
 * la RLS revérifie organisation et rôle en base.
 */

export type SaveResult = ActionState & { id?: string };

type Ctx = Awaited<ReturnType<typeof requireContext>>;

async function authorize(permission: Permission): Promise<Ctx | null> {
  const ctx = await requireContext();
  return can(ctx.member.role, permission) ? ctx : null;
}

function invalid(error: z.ZodError): SaveResult {
  return { ok: false, fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}

type Table = "depots" | "vehicles" | "drivers" | "suppliers" | "products";

/** Insertion (sans id) ou mise à jour (avec id) d'une fiche de l'organisation. */
async function saveRow(
  ctx: Ctx,
  table: Table,
  id: string | null,
  values: Record<string, unknown>,
  messages: { duplicate: string; created: string; updated: string },
): Promise<SaveResult> {
  const supabase = await createClient();
  if (id) {
    const { data, error } = await supabase.from(table).update(values).eq("id", id).select("id").maybeSingle();
    if (error) return { ok: false, message: dbErrorMessage(error, messages) };
    if (!data) return { ok: false, message: "Fiche introuvable." };
    return { ok: true, id: data.id, message: messages.updated };
  }
  // À la création, une fiche est toujours active (pas de colonne is_active autorisée en insertion).
  const insertValues = Object.fromEntries(Object.entries(values).filter(([key]) => key !== "is_active"));
  const { data, error } = await supabase
    .from(table)
    .insert({ ...insertValues, organization_id: ctx.organization.id })
    .select("id")
    .single();
  if (error) return { ok: false, message: dbErrorMessage(error, messages) };
  return { ok: true, id: data.id, message: messages.created };
}

// ---------------------------------------------------------------------------
// Emballages
// ---------------------------------------------------------------------------
export async function createPackaging(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("packaging.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = packagingCreateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packaging_types")
    .insert({
      organization_id: ctx.organization.id,
      name: v.name,
      kind: v.kind,
      capacity: v.capacity,
      deposit_value: v.depositValue,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: dbErrorMessage(error, { duplicate: "Un emballage porte déjà ce nom." }) };
  return { ok: true, id: data.id, message: "Emballage ajouté." };
}

export async function updatePackaging(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("packaging.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = packagingUpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("packaging_types")
    .update({ name: v.name, deposit_value: v.depositValue, is_active: v.isActive })
    .eq("id", v.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, message: dbErrorMessage(error, { duplicate: "Un emballage porte déjà ce nom." }) };
  if (!data) return { ok: false, message: "Emballage introuvable." };
  return { ok: true, id: data.id, message: "Emballage enregistré." };
}

// ---------------------------------------------------------------------------
// Produits et prix
// ---------------------------------------------------------------------------
export async function saveProduct(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("products.edit");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;

  return saveRow(
    ctx,
    "products",
    v.id,
    {
      code: v.code,
      name: v.name,
      brand: v.brand,
      category: v.category,
      volume_ml: v.volumeMl,
      bottles_per_case: v.bottlesPerCase,
      crate_type_id: v.crateTypeId,
      bottle_type_id: v.bottleTypeId,
      alert_threshold: v.alertThreshold,
      is_active: v.isActive,
    },
    { duplicate: "Un produit porte déjà ce code.", created: "Produit créé.", updated: "Produit enregistré." },
  );
}

export async function savePriceGrid(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("prices.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = priceGridSchema.safeParse(input);
  if (!parsed.success) {
    // Erreurs indexées par ligne de la grille (« standard.casePrice », « bar.bottlePrice »).
    const rows = (input as { rows?: Array<{ category?: string }> }).rows ?? [];
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const [first, index, field] = issue.path;
      const key =
        first === "rows" && typeof index === "number"
          ? `${rows[index]?.category || "standard"}.${String(field)}`
          : issue.path.join(".");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_product_prices", {
    p_product_id: parsed.data.productId,
    p_prices: parsed.data.rows.map((r) => ({
      category: r.category,
      case_price: r.casePrice,
      bottle_price: r.bottlePrice,
    })),
  });
  if (error) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, message: "Prix enregistrés." };
}

// ---------------------------------------------------------------------------
// Dépôts, véhicules, chauffeurs, fournisseurs
// ---------------------------------------------------------------------------
export async function saveDepot(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("depots.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = depotSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  return saveRow(
    ctx,
    "depots",
    v.id,
    { name: v.name, address: v.address, is_active: v.isActive },
    { duplicate: "Un dépôt porte déjà ce nom.", created: "Dépôt ajouté.", updated: "Dépôt enregistré." },
  );
}

export async function saveVehicle(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("logistics.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = vehicleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  return saveRow(
    ctx,
    "vehicles",
    v.id,
    {
      name: v.name,
      kind: v.kind,
      plate_number: v.plateNumber,
      capacity_cases: v.capacityCases,
      is_active: v.isActive,
    },
    { duplicate: "Un véhicule porte déjà ce nom.", created: "Véhicule ajouté.", updated: "Véhicule enregistré." },
  );
}

export async function saveDriver(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("logistics.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = driverSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  return saveRow(
    ctx,
    "drivers",
    v.id,
    { full_name: v.fullName, phone: v.phone, is_active: v.isActive },
    { duplicate: "Ce chauffeur existe déjà.", created: "Chauffeur ajouté.", updated: "Chauffeur enregistré." },
  );
}

export async function saveSupplier(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("logistics.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  return saveRow(
    ctx,
    "suppliers",
    v.id,
    {
      name: v.name,
      contact_name: v.contactName,
      phone: v.phone,
      email: v.email,
      address: v.address,
      is_active: v.isActive,
    },
    {
      duplicate: "Un fournisseur porte déjà ce nom.",
      created: "Fournisseur ajouté.",
      updated: "Fournisseur enregistré.",
    },
  );
}

// ---------------------------------------------------------------------------
// Profil de l'entreprise et assistant de démarrage
// ---------------------------------------------------------------------------
export async function updateCompany(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("settings.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", ctx.organization.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: dbErrorMessage(error) };
  return { ok: true, message: "Profil de l'entreprise enregistré." };
}

export async function setOnboardingStep(input: unknown): Promise<SaveResult> {
  const ctx = await authorize("onboarding.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const parsed = onboardingStepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Étape inconnue." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_onboarding_step", {
    p_step: parsed.data.step,
    p_status: parsed.data.status,
  });
  return error ? { ok: false, message: dbErrorMessage(error) } : { ok: true };
}

export async function finishOnboarding(): Promise<SaveResult> {
  const ctx = await authorize("onboarding.manage");
  if (!ctx) return { ok: false, message: FORBIDDEN_ERROR };
  const supabase = await createClient();
  const { error } = await supabase.rpc("finish_onboarding");
  return error ? { ok: false, message: dbErrorMessage(error) } : { ok: true, message: "Configuration terminée." };
}
