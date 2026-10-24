"use client";

import { useActionState, useState } from "react";
import { Alert, Field, SelectField } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { ROLE_LABELS, type MemberRole } from "@/lib/roles";
import { INVITABLE_ROLES, MEMBER_ROLES } from "@/lib/validation/auth";
import { cancelInvitationAction, inviteAction, updateMemberAction } from "./actions";

const INVITABLE_OPTIONS = INVITABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
const ROLE_OPTIONS = MEMBER_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));

export function InviteForm() {
  const [state, action] = useActionState(inviteAction, initialActionState);
  const v = state.values ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>}
      <Field
        label="Nom complet"
        name="fullName"
        defaultValue={v.fullName}
        required
        errors={state.fieldErrors?.fullName}
      />
      <Field
        label="E-mail"
        name="email"
        type="email"
        defaultValue={v.email}
        required
        errors={state.fieldErrors?.email}
      />
      <SelectField
        label="Rôle"
        name="role"
        defaultValue={v.role ?? "storekeeper"}
        options={INVITABLE_OPTIONS}
        errors={state.fieldErrors?.role}
      />
      <SubmitButton className="w-full" pendingLabel="Envoi de l'invitation…">
        Envoyer l&apos;invitation
      </SubmitButton>
      <p className="text-xs text-slate-500">
        L&apos;employé reçoit un e-mail pour choisir son mot de passe. Le lien est valable 7 jours.
      </p>
    </form>
  );
}

export function CancelInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, action] = useActionState(cancelInvitationAction, initialActionState);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="invitationId" value={invitationId} />
      {state.message && !state.ok && <span className="text-xs text-red-600">{state.message}</span>}
      <SubmitButton variant="danger" className="px-3 py-1 text-xs" pendingLabel="…">
        Annuler
      </SubmitButton>
    </form>
  );
}

type Member = { id: string; fullName: string; email: string; role: MemberRole; isActive: boolean };

export function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [state, action] = useActionState(updateMemberAction, initialActionState);
  const [role, setRole] = useState<MemberRole>(member.role);
  const changed = role !== member.role;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {member.fullName}
            {isSelf && <span className="ml-2 text-xs font-normal text-slate-500">(vous)</span>}
            {!member.isActive && (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                Désactivé
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">{member.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={action} className="flex items-center gap-2">
            <input type="hidden" name="memberId" value={member.id} />
            <input type="hidden" name="isActive" value={String(member.isActive)} />
            <label className="sr-only" htmlFor={`role-${member.id}`}>
              Rôle de {member.fullName}
            </label>
            <select
              id={`role-${member.id}`}
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {changed && (
              <SubmitButton className="px-3 py-1.5 text-xs" pendingLabel="…">
                Enregistrer
              </SubmitButton>
            )}
          </form>

          {!isSelf && (
            <form action={action}>
              <input type="hidden" name="memberId" value={member.id} />
              <input type="hidden" name="role" value={member.role} />
              <input type="hidden" name="isActive" value={String(!member.isActive)} />
              <SubmitButton
                variant={member.isActive ? "danger" : "secondary"}
                className="px-3 py-1.5 text-xs"
                pendingLabel="…"
              >
                {member.isActive ? "Désactiver" : "Réactiver"}
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
      {state.message && (
        <div className="mt-2">
          <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
        </div>
      )}
    </li>
  );
}
