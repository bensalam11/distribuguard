/**
 * Les fonctions SQL lèvent des messages destinés à l'utilisateur avec le code
 * P0001 (raise exception). Tout le reste est remplacé par un message générique :
 * aucun détail technique n'est affiché.
 */
export const GENERIC_ERROR = "Une erreur est survenue. Réessayez dans un instant.";

export function userMessageFromDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code === "P0001" && error.message) {
    return error.message;
  }
  return GENERIC_ERROR;
}
