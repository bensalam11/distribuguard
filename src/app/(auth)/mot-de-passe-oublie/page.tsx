"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { forgotPasswordAction } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, initialActionState);
  return (
    <>
      <h1 className="text-xl font-bold text-slate-900">Mot de passe oublié</h1>
      <p className="mt-1 text-sm text-slate-500">Recevez un lien par e-mail pour choisir un nouveau mot de passe.</p>
      {state.ok ? (
        <div className="mt-6">
          <Alert tone="success">{state.message}</Alert>
        </div>
      ) : (
        <form action={action} className="mt-6 space-y-4" noValidate>
          {state.message && <Alert tone="error">{state.message}</Alert>}
          <Field
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            errors={state.fieldErrors?.email}
          />
          <SubmitButton className="w-full">Envoyer le lien</SubmitButton>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/connexion" className="text-brand-600 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </>
  );
}
