"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { finishOnboarding, setOnboardingStep } from "@/lib/server/catalog";

export async function setStepAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await setOnboardingStep({ step: fd.get("step"), status: fd.get("status") });
  if (result.ok) revalidatePath("/demarrage");
  return result;
}

export async function finishOnboardingAction(): Promise<ActionState> {
  const result = await finishOnboarding();
  if (!result.ok) return result;
  revalidatePath("/tableau-de-bord");
  redirect("/tableau-de-bord");
}
