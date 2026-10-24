"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { formValues } from "@/lib/form-data";
import { updateCompany } from "@/lib/server/catalog";

export async function updateCompanyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["name", "email", "phone", "city", "address"]);
  const result = await updateCompany(values);
  if (result.ok) revalidatePath("/", "layout");
  return { ...result, values };
}
