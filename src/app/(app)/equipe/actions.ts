"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { cancelInvitation, inviteEmployee, updateMember } from "@/lib/server/team";

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");

export async function inviteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = { fullName: field(fd, "fullName"), email: field(fd, "email"), role: field(fd, "role") };
  const result = await inviteEmployee(values);
  if (result.ok) {
    revalidatePath("/equipe");
    return result;
  }
  return { ...result, values };
}

export async function cancelInvitationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await cancelInvitation(field(fd, "invitationId"));
  if (result.ok) revalidatePath("/equipe");
  return result;
}

export async function updateMemberAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await updateMember({
    memberId: field(fd, "memberId"),
    role: field(fd, "role"),
    isActive: field(fd, "isActive") === "true",
  });
  if (result.ok) revalidatePath("/equipe");
  return result;
}
