"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { formValues } from "@/lib/form-data";
import { saveDriver, saveVehicle } from "@/lib/server/catalog";

export async function saveVehicleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["id", "name", "kind", "plateNumber", "capacityCases", "isActive"]);
  const result = await saveVehicle(values);
  if (!result.ok) return { ...result, values };
  revalidatePath("/vehicules");
  if (values.id) redirect("/vehicules");
  return result;
}

export async function saveDriverAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = formValues(fd, ["id", "fullName", "phone", "isActive"]);
  const result = await saveDriver(values);
  if (!result.ok) return { ...result, values };
  revalidatePath("/chauffeurs");
  if (values.id) redirect("/chauffeurs");
  return result;
}
