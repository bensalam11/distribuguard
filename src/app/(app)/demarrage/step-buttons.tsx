"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/action-state";
import { finishOnboardingAction, setStepAction } from "./actions";

export function StepButton({
  step,
  status,
  label,
  variant = "secondary",
}: {
  step: string;
  status: "done" | "skipped" | "pending";
  label: string;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [state, action] = useActionState(setStepAction, initialActionState);
  return (
    <form action={action} className="inline-flex items-center gap-2">
      <input type="hidden" name="step" value={step} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant} className="px-3 py-1.5 text-xs" pendingLabel="…">
        {label}
      </SubmitButton>
      {state.message && !state.ok && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}

export function FinishButton({ label }: { label: string }) {
  const [state, action] = useActionState(finishOnboardingAction, initialActionState);
  return (
    <form action={action} className="flex items-center gap-3">
      <SubmitButton pendingLabel="…">{label}</SubmitButton>
      {state.message && !state.ok && <span className="text-sm text-red-600">{state.message}</span>}
    </form>
  );
}
