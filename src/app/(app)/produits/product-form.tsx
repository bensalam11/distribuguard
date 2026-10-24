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

/**
 * Fiche produit. L'essentiel d'abord (code, nom, casier, prix au casier à la
 * création) ; le reste dans « Plus d'options ».
 */
export function ProductForm({
  packaging,
  initial,
  productId,
  canSetPrice = false,
}: {
  packaging: PackagingOption[];
  initial?: Record<string, string>;
  productId?: string;
  canSetPrice?: boolean;
}) {
  const [state, action] = useActionState(saveProductAction, initialActionState);
  const v = state.values ?? initial ?? {};
  const errors = state.fieldErrors ?? {};

  const crates = packaging.filter((p) => p.kind === "crate" && (p.isActive || p.id === v.crateTypeId));
  const bottles = packaging.filter((p) => p.kind === "bottle" && (p.isActive || p.id === v.bottleTypeId));
  const [crateId, setCrateId] = useState(v.crateTypeId ?? "");
  const [bottlesPerCase, setBottlesPerCase] = useState(v.bottlesPerCase ?? "12");
  const crate = crates.find((c) => c.id === crateId);

  // Les options avancées s'ouvrent d'elles-mêmes si l'une d'elles est en erreur ou déjà remplie.
  const advancedKeys = ["brand", "category", "volumeCl", "bottleTypeId", "thresholdCases", "thresholdBottles"];
  const openAdvanced = advancedKeys.some((k) => errors[k]?.length || (v[k] && v[k] !== "0"));

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && !state.ok && <Alert tone="error">{state.message}</Alert>}
      {productId && <input type="hidden" name="id" value={productId} />}

      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Casier consigné"
          name="crateTypeId"
          value={crateId}
          options={[
            { value: "", label: "Aucun (canette, PET, pack)" },
            ...crates.map((c) => ({ value: c.id, label: `${c.name} (${c.capacity} btl)` })),
          ]}
          onChange={(e) => {
            setCrateId(e.target.value);
            const selected = crates.find((c) => c.id === e.target.value);
            if (selected) setBottlesPerCase(String(selected.capacity));
          }}
          errors={errors.crateTypeId}
        />

        {crate ? (
          <input type="hidden" name="bottlesPerCase" value={crate.capacity} />
        ) : (
          <Field
            label="Bouteilles par pack"
            name="bottlesPerCase"
            value={bottlesPerCase}
            onChange={(e) => setBottlesPerCase(e.target.value)}
            inputMode="numeric"
            required
            placeholder="24"
            errors={errors.bottlesPerCase}
          />
        )}

        {!productId && canSetPrice && (
          <Field
            label="Prix au casier (FCFA)"
            name="casePrice"
            defaultValue={v.casePrice}
            inputMode="numeric"
            placeholder="7 800"
            hint="Prix standard. Les prix par type de client se règlent ensuite sur la fiche."
            errors={errors.casePrice}
          />
        )}
      </div>

      {crates.length === 0 && (
        <p className="text-xs text-slate-500">
          Pas encore de casier enregistré.{" "}
          <Link href="/produits/emballages" className="font-medium text-brand-700 hover:underline">
            Ajouter un casier consigné
          </Link>
        </p>
      )}

      <details open={openAdvanced} className="group rounded-lg border border-slate-200">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700 select-none">
          <span className="mr-1 inline-block transition group-open:rotate-90">›</span> Plus d&apos;options
        </summary>
        <div className="space-y-4 border-t border-slate-200 p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Marque" name="brand" defaultValue={v.brand} errors={errors.brand} />
            <Field
              label="Catégorie"
              name="category"
              defaultValue={v.category}
              placeholder="Bière, eau, soda"
              list="product-categories"
              errors={errors.category}
            />
            <Field
              label="Contenance (cl)"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Bouteille consignée"
              name="bottleTypeId"
              defaultValue={v.bottleTypeId ?? ""}
              options={[{ value: "", label: "Aucune" }, ...bottles.map((b) => ({ value: b.id, label: b.name }))]}
              errors={errors.bottleTypeId}
            />
            <QuantityField
              label="Seuil d'alerte de stock"
              name="threshold"
              defaultCases={v.thresholdCases}
              defaultBottles={v.thresholdBottles}
              errors={errors.thresholdCases ?? errors.thresholdBottles}
            />
          </div>

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
      </details>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Enregistrement…">{productId ? "Enregistrer" : "Créer le produit"}</SubmitButton>
        <Link href="/produits" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          Annuler
        </Link>
      </div>
    </form>
  );
}
