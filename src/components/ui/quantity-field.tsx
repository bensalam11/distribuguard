import { cx } from "./form";

const input =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition " +
  "focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

/**
 * Saisie d'une quantité en « casiers + bouteilles ». Envoie deux champs :
 * `${name}Cases` et `${name}Bottles` ; le serveur convertit en bouteilles.
 */
export function QuantityField({
  label,
  name,
  defaultCases,
  defaultBottles,
  errors,
  hint,
}: {
  label: string;
  name: string;
  defaultCases?: number | string;
  defaultBottles?: number | string;
  errors?: string[];
  hint?: string;
}) {
  const border = errors?.length ? "border-red-400" : "border-slate-300";
  return (
    <fieldset>
      <legend className="mb-1 block text-sm font-medium text-slate-700">{label}</legend>
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-2">
          <input
            name={`${name}Cases`}
            inputMode="numeric"
            defaultValue={defaultCases}
            placeholder="0"
            className={cx(input, border)}
            aria-label={`${label} (casiers)`}
          />
          <span className="text-sm text-slate-500">casiers</span>
        </label>
        <label className="flex flex-1 items-center gap-2">
          <input
            name={`${name}Bottles`}
            inputMode="numeric"
            defaultValue={defaultBottles}
            placeholder="0"
            className={cx(input, border)}
            aria-label={`${label} (bouteilles)`}
          />
          <span className="text-sm text-slate-500">btl</span>
        </label>
      </div>
      {errors?.length ? (
        <p className="mt-1 text-xs text-red-600">{errors[0]}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </fieldset>
  );
}
