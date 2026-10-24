import { z } from "zod";

const trimmed = (min: number, max: number, label: string) =>
  z.string().trim().min(min, `${label} : ${min} caractères minimum.`).max(max, `${label} : ${max} caractères maximum.`);

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide."));

/** Téléphone : chiffres, espaces, +, tirets, points ; 8 à 15 chiffres. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 .\-]{6,30}$/, "Numéro de téléphone invalide.")
  .refine((v) => {
    const digits = v.replace(/\D/g, "").length;
    return digits >= 8 && digits <= 15;
  }, "Numéro de téléphone invalide.");

export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .max(72, "Le mot de passe doit contenir au plus 72 caractères.");

export const signupSchema = z.object({
  fullName: trimmed(2, 120, "Nom du responsable"),
  companyName: trimmed(2, 120, "Nom de l'entreprise"),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  city: trimmed(2, 80, "Ville"),
  address: trimmed(2, 200, "Adresse"),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const setPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirm"],
  });

export const MEMBER_ROLES = ["owner", "manager", "storekeeper", "cashier"] as const;
export const INVITABLE_ROLES = ["manager", "storekeeper", "cashier"] as const;

export const inviteSchema = z.object({
  fullName: trimmed(2, 120, "Nom de l'employé"),
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES, "Choisissez un rôle."),
});

export const updateMemberSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(MEMBER_ROLES, "Rôle invalide."),
  isActive: z.boolean(),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
