"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formValues } from "@/lib/form-data";
import { saveDepot } from "@/lib/server/catalog";

export async function saveDepotAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["id", "name", "address", "isActive"]);
  const result = await saveDepot(values);
  if (!result.ok) return { ...result, values };
  revalidatePath("/depots");
  revalidatePath("/tableau-de-bord");
  if (values.id) redirect("/depots");
  return result;
}
