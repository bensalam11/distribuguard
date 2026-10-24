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

export const FORBIDDEN_ERROR = "Vous n'avez pas les droits pour cette action.";

/**
 * Comme userMessageFromDbError, avec des messages pour les doublons (23505)
 * et les refus de droits (42501 / RLS).
 */
export function dbErrorMessage(
  error: { code?: string; message?: string } | null | undefined,
  messages: { duplicate?: string } = {},
): string {
  if (error?.code === "23505" && messages.duplicate) return messages.duplicate;
  if (error?.code === "42501") return FORBIDDEN_ERROR;
  return userMessageFromDbError(error);
}
