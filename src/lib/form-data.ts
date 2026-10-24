/** Lit des champs texte d'un FormData (valeur absente → chaîne vide). */
export function formValues<K extends string>(fd: FormData, names: readonly K[]): Record<K, string> {
  return Object.fromEntries(names.map((n) => [n, String(fd.get(n) ?? "")])) as Record<K, string>;
}
