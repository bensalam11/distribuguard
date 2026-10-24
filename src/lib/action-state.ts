/** État renvoyé par les Server Actions aux formulaires. */
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Valeurs saisies, renvoyées pour réafficher le formulaire après une erreur (jamais de mot de passe). */
  values?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };
