"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Field, SelectField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/action-state";

export type EntityField = {
  name: string;
  label: string;
  type?: "text" | "tel" | "email" | "select";
  options?: ReadonlyArray<{ value: string; label: string }>;
  required?: boolean;
  hint?: string;
  inputMode?: "numeric" | "text";
  placeholder?: string;
};

/**
 * Formulaire de création / modification d'une fiche simple (dépôt, véhicule,
 * chauffeur, fournisseur). En modification, ajoute le statut Actif / Inactif.
 */
export function EntityForm({
  action,
  fields,
  initial,
  editingId,
  cancelHref,
  submitLabel,
  canDeactivate = true,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  fields: readonly EntityField[];
  initial?: Record<string, string>;
  editingId?: string;
  cancelHref: string;
  submitLabel: string;
  canDeactivate?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const v = state.values ?? initial ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      {editingId && <input type="hidden" name="id" value={editingId} />}

      {fields.map((f) =>
        f.type === "select" ? (
          <SelectField
            key={f.name}
            label={f.label}
            name={f.name}
            options={f.options ?? []}
            defaultValue={v[f.name]}
            errors={state.fieldErrors?.[f.name]}
          />
        ) : (
          <Field
            key={f.name}
            label={f.required ? f.label : `${f.label} (facultatif)`}
            name={f.name}
            type={f.type ?? "text"}
            inputMode={f.inputMode}
            placeholder={f.placeholder}
            defaultValue={v[f.name]}
            required={f.required}
            hint={f.hint}
            errors={state.fieldErrors?.[f.name]}
          />
        ),
      )}

      {editingId && canDeactivate && (
        <SelectField
          label="Statut"
          name="isActive"
          defaultValue={v.isActive ?? "true"}
          options={[
            { value: "true", label: "Actif" },
            { value: "false", label: "Inactif" },
          ]}
        />
      )}

      <div className="flex items-center gap-3">
        <SubmitButton className="flex-1" pendingLabel="Enregistrement…">
          {submitLabel}
        </SubmitButton>
        {editingId && (
          <Link href={cancelHref} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Annuler
          </Link>
        )}
      </div>
    </form>
  );
}
