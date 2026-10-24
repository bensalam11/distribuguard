"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formValues } from "@/lib/form-data";
import { saveSupplier } from "@/lib/server/catalog";

export async function saveSupplierAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["id", "name", "contactName", "phone", "email", "address", "isActive"]);
  const result = await saveSupplier(values);
  if (!result.ok) return { ...result, values };
  revalidatePath("/fournisseurs");
  if (values.id) redirect("/fournisseurs");
  return result;
}
