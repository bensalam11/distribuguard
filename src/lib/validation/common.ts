import { z } from "zod";

/** Texte obligatoire, espaces retirés. */
export const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label} : ${min} caractère${min > 1 ? "s" : ""} minimum.`)
    .max(max, `${label} : ${max} caractères maximum.`);

/** Texte facultatif : une chaîne vide devient null. */
export const optionalText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(requiredText(min, max, label).nullable());

const MAX_FCFA = 1_000_000_000_000;

/** Montant en FCFA saisi « 1 250 000 » ou « 1250000 » → entier. Jamais de décimales. */
export const fcfaAmount = (label: string, { allowZero = false } = {}) =>
  z
    .string()
    .transform((v) => v.replace(/[\s  ]/g, ""))
    .refine((v) => /^\d+$/.test(v), `${label} : saisissez un montant en francs, sans virgule ni décimale.`)
    .transform((v) => Number(v))
    .refine((v) => v <= MAX_FCFA, `${label} : montant trop élevé.`)
    .refine((v) => allowZero || v > 0, `${label} : le montant doit être supérieur à 0.`);

/** Montant facultatif : vide → null. */
export const optionalFcfaAmount = (label: string) => z.union([z.literal("").transform(() => null), fcfaAmount(label)]);

/** Entier saisi dans un champ texte. */
export const intField = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v), `${label} : nombre entier attendu.`)
    .transform((v) => Number(v))
    .refine((v) => v >= min && v <= max, `${label} : entre ${min} et ${max}.`);

export const optionalIntField = (label: string, min: number, max: number) =>
  z.union([z.literal("").transform(() => null), intField(label, min, max)]);

/** Statut « true » | « false » (champ absent ou vide → actif, cas de la création). */
export const boolField = z.union([z.boolean(), z.enum(["true", "false", "on", ""]).transform((v) => v !== "false")]);

/** Identifiant facultatif : vide → null. */
export const optionalUuid = z.union([z.literal("").transform(() => null), z.uuid("Sélection invalide.")]);
