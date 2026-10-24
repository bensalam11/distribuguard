"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Alert, Field, SelectField } from "@/components/ui/form";
import { QuantityField } from "@/components/ui/quantity-field";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { saveProductAction } from "./actions";

export type PackagingOption = {
  id: string;
  name: string;
  kind: "crate" | "bottle";
  capacity: number;
  isActive: boolean;
};

/** Fiche produit (sans prix : les prix sont dans une grille séparée). */
export function ProductForm({
  packaging,
  initial,
  productId,
}: {
  packaging: PackagingOption[];
  initial?: Record<string, string>;
  productId?: string;
}) {
  const [state, action] = useActionState(saveProductAction, initialActionState);
  const v = state.values ?? initial ?? {};
  const errors = state.fieldErrors ?? {};

  const crates = packaging.filter((p) => p.kind === "crate" && (p.isActive || p.id === v.crateTypeId));
  const bottles = packaging.filter((p) => p.kind === "bottle" && (p.isActive || p.id === v.bottleTypeId));
  const [bottlesPerCase, setBottlesPerCase] = useState(v.bottlesPerCase ?? "");

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      {productId && <input type="hidden" name="id" value={productId} />}

      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Field label="Code" name="code" defaultValue={v.code} required placeholder="KOLA65" errors={errors.code} />
        <Field
          label="Nom"
          name="name"
          defaultValue={v.name}
          required
          placeholder="Bière Kola 65 cl"
          errors={errors.name}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Marque (facultatif)" name="brand" defaultValue={v.brand} errors={errors.brand} />
        <Field
          label="Catégorie (facultatif)"
          name="category"
          defaultValue={v.category}
          placeholder="Bière, eau, soda…"
          list="product-categories"
          errors={errors.category}
        />
        <Field
          label="Contenance en cl (facultatif)"
          name="volumeCl"
          defaultValue={v.volumeCl}
          inputMode="decimal"
          placeholder="65"
          errors={errors.volumeCl}
        />
        <datalist id="product-categories">
          {["Bière", "Eau", "Soda", "Jus", "Boisson énergisante", "Vin", "Spiritueux"].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-800">Conditionnement et consigne</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Casier consigné"
            name="crateTypeId"
            defaultValue={v.crateTypeId ?? ""}
            options={[
              { value: "", label: "Aucun (non consigné)" },
              ...crates.map((c) => ({ value: c.id, label: `${c.name} (${c.capacity} btl)` })),
            ]}
            onChange={(e) => {
              const crate = crates.find((c) => c.id === e.target.value);
              if (crate) setBottlesPerCase(String(crate.capacity));
            }}
            errors={errors.crateTypeId}
          />
          <SelectField
            label="Bouteille consignée"
            name="bottleTypeId"
            defaultValue={v.bottleTypeId ?? ""}
            options={[
              { value: "", label: "Aucune (canette, PET…)" },
              ...bottles.map((b) => ({ value: b.id, label: b.name })),
            ]}
            errors={errors.bottleTypeId}
          />
          <Field
            label="Bouteilles par casier / pack"
            name="bottlesPerCase"
            value={bottlesPerCase}
            onChange={(e) => setBottlesPerCase(e.target.value)}
            inputMode="numeric"
            required
            placeholder="12"
            errors={errors.bottlesPerCase}
          />
        </div>
        {packaging.length === 0 && (
          <p className="text-xs text-slate-500">
            Aucun emballage enregistré.{" "}
            <Link href="/produits/emballages" className="font-medium text-brand-700 hover:underline">
              Ajouter un casier et une bouteille consignés
            </Link>
            .
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuantityField
          label="Seuil d'alerte de stock"
          name="threshold"
          defaultCases={v.thresholdCases}
          defaultBottles={v.thresholdBottles}
          errors={errors.thresholdCases ?? errors.thresholdBottles}
          hint="Alerte quand le stock passe sous ce niveau."
        />
        {productId && (
          <SelectField
            label="Statut"
            name="isActive"
            defaultValue={v.isActive ?? "true"}
            options={[
              { value: "true", label: "Actif" },
              { value: "false", label: "Inactif (n'apparaît plus dans les saisies)" },
            ]}
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Enregistrement…">{productId ? "Enregistrer" : "Créer le produit"}</SubmitButton>
        <Link href="/produits" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Annuler
        </Link>
      </div>
    </form>
  );
}
