"use client";

import { useActionState } from "react";
import { Alert, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { setPasswordAction } from "../actions";

/** Après une invitation ou une réinitialisation : l'utilisateur choisit son mot de passe. */
export default function SetPasswordPage() {
  const [state, action] = useActionState(setPasswordAction, initialActionState);
  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Choisir un mot de passe</h1>
      <p className="mt-1 text-sm text-slate-500">Il vous servira à vous connecter à DistribuGuard.</p>
      <form action={action} className="mt-6 space-y-4" noValidate>
        {state.message && <Alert tone="error">{state.message}</Alert>}
        <Field
          label="Nouveau mot de passe"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="8 caractères minimum."
          required
          errors={state.fieldErrors?.password}
        />
        <Field
          label="Confirmer le mot de passe"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          errors={state.fieldErrors?.confirm}
        />
        <SubmitButton className="w-full">Enregistrer</SubmitButton>
      </form>
    </>
  );
}
