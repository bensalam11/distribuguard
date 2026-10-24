"use client";

import { useActionState } from "react";
import { Alert, cx } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { formatFCFA } from "@/lib/format";
import { CLIENT_CATEGORIES, CLIENT_CATEGORY_LABELS, proratedBottlePrice, type PriceRow } from "@/lib/pricing";
import { savePriceGridAction } from "./actions";

const ROWS = [
  { key: "standard", label: "Prix standard", hint: "Obligatoire" },
  ...CLIENT_CATEGORIES.map((c) => ({ key: c, label: CLIENT_CATEGORY_LABELS[c], hint: "Sinon : prix standard" })),
];

const input =
  "block w-full rounded-lg border bg-white px-3 py-2 text-right text-sm tabular-nums text-slate-900 shadow-sm " +
  "outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-600";

/**
 * Grille de prix (FCFA, au casier ; bouteille facultative). Modifiable par le
 * propriétaire et le gérant ; en lecture seule pour le caissier.
 */
export function PriceGrid({
  productId,
  bottlesPerCase,
  prices,
  editable,
}: {
  productId: string;
  bottlesPerCase: number;
  prices: PriceRow[];
  editable: boolean;
}) {
  const [state, action] = useActionState(savePriceGridAction, initialActionState);
  const initial: Record<string, string> = {};
  for (const p of prices) {
    const key = p.clientCategory ?? "standard";
    initial[`${key}.casePrice`] = String(p.casePrice);
    initial[`${key}.bottlePrice`] = p.bottlePrice?.toString() ?? "";
  }
  const v = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  const standardCase = Number(v["standard.casePrice"]?.replace(/\s/g, "")) || 0;
  const hasCategoryPrice = CLIENT_CATEGORIES.some(
    (c) => v[`${c}.casePrice`] || errors[`${c}.casePrice`] || errors[`${c}.bottlePrice`],
  );

  function renderTable(rows: typeof ROWS) {
    return (
      <div className="-mx-5 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <tr>
              <th className="px-5 py-2">Catégorie de client</th>
              <th className="px-5 py-2 text-right">Prix au casier</th>
              <th className="px-5 py-2 text-right">Prix à la bouteille</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const caseErr = errors[`${row.key}.casePrice`];
              const bottleErr = errors[`${row.key}.bottlePrice`];
              return (
                <tr key={row.key}>
                  <td className="px-5 py-3 align-top">
                    <p className="font-medium">{row.label}</p>
                    <p className="text-xs text-slate-500">{row.hint}</p>
                  </td>
                  <td className="px-5 py-3 align-top">
                    <input
                      name={`${row.key}.casePrice`}
                      aria-label={`${row.label}, prix au casier`}
                      inputMode="numeric"
                      defaultValue={v[`${row.key}.casePrice`]}
                      disabled={!editable}
                      placeholder={row.key === "standard" ? "7 800" : "-"}
                      className={cx(input, caseErr ? "border-red-400" : "border-slate-300")}
                    />
                    {caseErr && <p className="mt-1 text-xs text-red-600">{caseErr[0]}</p>}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <input
                      name={`${row.key}.bottlePrice`}
                      aria-label={`${row.label}, prix à la bouteille`}
                      inputMode="numeric"
                      defaultValue={v[`${row.key}.bottlePrice`]}
                      disabled={!editable}
                      placeholder={
                        row.key === "standard" && standardCase > 0
                          ? `${proratedBottlePrice(standardCase, bottlesPerCase)} (prorata)`
                          : "prorata"
                      }
                      className={cx(input, bottleErr ? "border-red-400" : "border-slate-300")}
                    />
                    {bottleErr && <p className="mt-1 text-xs text-red-600">{bottleErr[0]}</p>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <input type="hidden" name="productId" value={productId} />

      {renderTable(ROWS.slice(0, 1))}

      <details open={hasCategoryPrice} className="group rounded-lg border border-slate-200">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-slate-700 select-none">
          <span className="mr-1 inline-block transition group-open:rotate-90">›</span> Prix par type de client
          (facultatif)
        </summary>
        <div className="border-t border-slate-200 px-5">{renderTable(ROWS.slice(1))}</div>
      </details>

      <p className="text-xs text-slate-500">
        Montants en FCFA entiers. Sans prix à la bouteille, la vente au détail utilise le prix au casier ÷{" "}
        {bottlesPerCase}, arrondi au franc
        {standardCase > 0 &&
          ` (soit ${formatFCFA(proratedBottlePrice(standardCase, bottlesPerCase))} la bouteille au prix standard)`}
        . Chaque modification est enregistrée dans le journal.
      </p>

      {editable && <SubmitButton pendingLabel="Enregistrement…">Enregistrer les prix</SubmitButton>}
    </form>
  );
}
