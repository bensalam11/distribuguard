import { z } from "zod";
import { CLIENT_CATEGORIES } from "@/lib/pricing";
import { emailSchema, phoneSchema } from "./auth";
import {
  boolField,
  fcfaAmount,
  intField,
  optionalFcfaAmount,
  optionalIntField,
  optionalText,
  optionalUuid,
  requiredText,
} from "./common";

const optionalPhone = z.union([z.literal("").transform(() => null), phoneSchema]);
const optionalEmail = z.union([z.literal("").transform(() => null), emailSchema]);

// ---------------------------------------------------------------------------
// Emballages
// ---------------------------------------------------------------------------
export const PACKAGING_KINDS = ["crate", "bottle"] as const;

export const packagingCreateSchema = z
  .object({
    name: requiredText(2, 80, "Nom"),
    kind: z.enum(PACKAGING_KINDS, "Choisissez casier ou bouteille."),
    capacity: z.string().trim(),
    depositValue: fcfaAmount("Valeur de consigne", { allowZero: true }),
  })
  .transform((v, ctx) => {
    if (v.kind === "bottle") return { ...v, capacity: 1 };
    const parsed = intField("Bouteilles par casier", 1, 200).safeParse(v.capacity);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", path: ["capacity"], message: parsed.error.issues[0].message });
      return z.NEVER;
    }
    return { ...v, capacity: parsed.data };
  });

export const packagingUpdateSchema = z.object({
  id: z.uuid(),
  name: requiredText(2, 80, "Nom"),
  depositValue: fcfaAmount("Valeur de consigne", { allowZero: true }),
  isActive: boolField,
});

// ---------------------------------------------------------------------------
// Produits
// ---------------------------------------------------------------------------
/** Contenance saisie en cl (« 65 », « 37,5 ») → ml entiers. */
const volumeCl = z
  .string()
  .trim()
  .transform((v) => v.replace(",", "."))
  .refine((v) => v === "" || /^\d+(\.\d)?$/.test(v), "Contenance : nombre en cl (ex. 65 ou 37,5).")
  .transform((v) => (v === "" ? null : Math.round(Number(v) * 10)))
  .refine((v) => v === null || (v >= 1 && v <= 100_000), "Contenance invalide.");

export const productSchema = z
  .object({
    id: optionalUuid,
    code: requiredText(1, 30, "Code"),
    name: requiredText(2, 120, "Nom"),
    brand: optionalText(1, 80, "Marque"),
    category: optionalText(1, 60, "Catégorie"),
    volumeCl,
    bottlesPerCase: intField("Bouteilles par casier", 1, 200),
    crateTypeId: optionalUuid,
    bottleTypeId: optionalUuid,
    thresholdCases: z.union([z.literal("").transform(() => 0), intField("Seuil (casiers)", 0, 1_000_000)]),
    thresholdBottles: z.union([z.literal("").transform(() => 0), intField("Seuil (bouteilles)", 0, 1_000_000)]),
    isActive: boolField.default(true),
    /** Prix standard au casier, saisi à la création (facultatif). */
    casePrice: optionalFcfaAmount("Prix au casier").default(null),
  })
  .transform(({ thresholdCases, thresholdBottles, volumeCl: volumeMl, ...v }) => ({
    ...v,
    volumeMl,
    alertThreshold: thresholdCases * v.bottlesPerCase + thresholdBottles,
  }));

export type ProductInput = z.infer<typeof productSchema>;

// ---------------------------------------------------------------------------
// Grille de prix
// ---------------------------------------------------------------------------
const priceRow = z.object({
  category: z.union([z.literal("").transform(() => null), z.enum(CLIENT_CATEGORIES)]),
  casePrice: optionalFcfaAmount("Prix au casier"),
  bottlePrice: optionalFcfaAmount("Prix à la bouteille"),
});

export const priceGridSchema = z.object({ productId: z.uuid(), rows: z.array(priceRow) }).superRefine((v, ctx) => {
  const standard = v.rows.find((r) => r.category === null);
  if (!standard?.casePrice) {
    ctx.addIssue({
      code: "custom",
      path: ["standard.casePrice"],
      message: "Le prix standard au casier est obligatoire.",
    });
  }
  for (const r of v.rows) {
    if (r.bottlePrice !== null && r.casePrice === null) {
      ctx.addIssue({
        code: "custom",
        path: [`${r.category ?? "standard"}.casePrice`],
        message: "Saisissez d'abord le prix au casier.",
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Dépôts, véhicules, chauffeurs, fournisseurs, entreprise
// ---------------------------------------------------------------------------
export const depotSchema = z.object({
  id: optionalUuid,
  name: requiredText(2, 80, "Nom"),
  address: optionalText(2, 200, "Adresse"),
  isActive: boolField.default(true),
});

export const VEHICLE_KINDS = ["tricycle", "camionnette", "camion", "autre"] as const;
export const VEHICLE_KIND_LABELS: Record<(typeof VEHICLE_KINDS)[number], string> = {
  tricycle: "Tricycle",
  camionnette: "Camionnette",
  camion: "Camion",
  autre: "Autre",
};

export const vehicleSchema = z.object({
  id: optionalUuid,
  name: requiredText(2, 60, "Nom"),
  kind: z.enum(VEHICLE_KINDS, "Choisissez un type de véhicule."),
  plateNumber: optionalText(2, 20, "Immatriculation").transform((v) => v?.toUpperCase() ?? null),
  capacityCases: optionalIntField("Capacité (casiers)", 1, 10_000),
  isActive: boolField.default(true),
});

export const driverSchema = z.object({
  id: optionalUuid,
  fullName: requiredText(2, 120, "Nom"),
  phone: optionalPhone,
  isActive: boolField.default(true),
});

export const supplierSchema = z.object({
  id: optionalUuid,
  name: requiredText(2, 120, "Nom"),
  contactName: optionalText(2, 120, "Contact"),
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText(2, 200, "Adresse"),
  isActive: boolField.default(true),
});

export const companySchema = z.object({
  name: requiredText(2, 120, "Nom de l'entreprise"),
  email: emailSchema,
  phone: phoneSchema,
  city: requiredText(2, 80, "Ville"),
  address: requiredText(2, 200, "Adresse"),
});

export const ONBOARDING_STEPS = ["company", "depots", "vehicles", "catalog", "team"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const onboardingStepSchema = z.object({
  step: z.enum(ONBOARDING_STEPS),
  status: z.enum(["done", "skipped", "pending"]),
});
