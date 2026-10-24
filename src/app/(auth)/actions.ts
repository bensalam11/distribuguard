"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { safeNextPath } from "@/lib/routes";
import { requestPasswordReset, setPassword, signIn, signUpOrganization } from "@/lib/server/auth";

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await signIn({ email: field(fd, "email"), password: field(fd, "password") });
  if (!result.ok) return { ...result, values: { email: field(fd, "email") } };
  redirect(safeNextPath(field(fd, "next")));
}

export async function signupAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const values = {
    fullName: field(fd, "fullName"),
    companyName: field(fd, "companyName"),
    email: field(fd, "email"),
    phone: field(fd, "phone"),
    city: field(fd, "city"),
    address: field(fd, "address"),
  };
  const result = await signUpOrganization({ ...values, password: field(fd, "password") });
  return result.ok ? result : { ...result, values };
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return requestPasswordReset({ email: field(fd, "email") });
}

export async function setPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const result = await setPassword({ password: field(fd, "password"), confirm: field(fd, "confirm") });
  if (!result.ok) return result;
  redirect("/tableau-de-bord");
}
