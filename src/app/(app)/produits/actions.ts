"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formValues } from "@/lib/form-data";
import { CLIENT_CATEGORIES } from "@/lib/pricing";
import { createPackaging, savePriceGrid, saveProduct, updatePackaging } from "@/lib/server/catalog";

export async function createPackagingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["name", "kind", "capacity", "depositValue"]);
  const result = await createPackaging(values);
  if (!result.ok) return { ...result, values };
  revalidatePath("/produits/emballages");
  return result;
}

export async function updatePackagingAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["id", "name", "depositValue", "isActive"]);
  const result = await updatePackaging(values);
  if (!result.ok) return { ...result, values };
  revalidatePath("/produits/emballages");
  redirect("/produits/emballages");
}

const PRODUCT_FIELDS = [
  "id",
  "code",
  "name",
  "brand",
  "category",
  "volumeCl",
  "bottlesPerCase",
  "crateTypeId",
  "bottleTypeId",
  "thresholdCases",
  "thresholdBottles",
  "isActive",
] as const;

export async function saveProductAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, PRODUCT_FIELDS);
  const result = await saveProduct(values);
  if (!result.ok) return { ...result, values };
  revalidatePath("/produits");
  // Après création : la fiche, pour saisir les prix.
  redirect(values.id ? "/produits" : `/produits/${result.id}?cree=1`);
}

export async function savePriceGridAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const productId = String(fd.get("productId") ?? "");
  const categories = ["", ...CLIENT_CATEGORIES];
  const rows = categories.map((category) => {
    const key = category || "standard";
    return {
      category,
      casePrice: String(fd.get(`${key}.casePrice`) ?? ""),
      bottlePrice: String(fd.get(`${key}.bottlePrice`) ?? ""),
    };
  });
  const values = Object.fromEntries(
    rows.flatMap((r) => [
      [`${r.category || "standard"}.casePrice`, r.casePrice],
      [`${r.category || "standard"}.bottlePrice`, r.bottlePrice],
    ]),
  );
  const result = await savePriceGrid({ productId, rows });
  if (!result.ok) return { ...result, values };
  revalidatePath("/produits");
  revalidatePath(`/produits/${productId}`);
  return { ...result, values };
}
