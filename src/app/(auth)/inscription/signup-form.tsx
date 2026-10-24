"use client";

import { useActionState } from "react";
import { Alert, Field } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { signupAction } from "../actions";

export function SignupForm() {
  const [state, action] = useActionState(signupAction, initialActionState);
  const e = state.fieldErrors ?? {};
  const v = state.values ?? {};

  if (state.ok) {
    return (
      <div className="mt-6">
        <Alert tone="success">{state.message}</Alert>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      {state.message && <Alert tone="error">{state.message}</Alert>}
      <Field
        label="Nom du responsable"
        name="fullName"
        defaultValue={v.fullName}
        autoComplete="name"
        required
        errors={e.fullName}
      />
      <Field
        label="Nom de l'entreprise"
        name="companyName"
        defaultValue={v.companyName}
        autoComplete="organization"
        required
        errors={e.companyName}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="E-mail"
          name="email"
          defaultValue={v.email}
          type="email"
          autoComplete="email"
          required
          errors={e.email}
        />
        <Field
          label="Téléphone"
          name="phone"
          defaultValue={v.phone}
          type="tel"
          autoComplete="tel"
          placeholder="+237 6XX XX XX XX"
          required
          errors={e.phone}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Ville"
          name="city"
          defaultValue={v.city}
          autoComplete="address-level2"
          placeholder="Douala"
          required
          errors={e.city}
        />
        <Field
          label="Adresse"
          name="address"
          defaultValue={v.address}
          autoComplete="street-address"
          placeholder="Quartier, rue, repère"
          required
          errors={e.address}
        />
      </div>
      <Field
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="8 caractères minimum."
        errors={e.password}
      />
      <SubmitButton className="w-full" pendingLabel="Création du compte…">
        Créer mon compte
      </SubmitButton>
    </form>
  );
}
