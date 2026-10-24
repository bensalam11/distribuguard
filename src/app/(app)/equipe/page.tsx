import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/form";
import { formatDate } from "@/lib/format";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, can, type MemberRole } from "@/lib/roles";
import { requireContext } from "@/lib/server/session";
import { createClient } from "@/lib/supabase/server";
import { CancelInvitationButton, InviteForm, MemberRow } from "./team-forms";

export const metadata: Metadata = { title: "Équipe" };

export default async function TeamPage() {
  const ctx = await requireContext();
  if (!can(ctx.member.role, "team.manage")) notFound();

  const supabase = await createClient();
  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase.from("members").select("id, full_name, email, role, is_active").order("created_at"),
    supabase
      .from("invitations")
      .select("id, full_name, email, role, expires_at")
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader title="Équipe" description="Invitez vos employés et attribuez-leur un rôle." />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card title={`Membres (${members?.length ?? 0})`}>
            <ul className="divide-y divide-slate-100">
              {(members ?? []).map((m) => (
                <MemberRow
                  key={m.id}
                  member={{
                    id: m.id,
                    fullName: m.full_name,
                    email: m.email,
                    role: m.role as MemberRole,
                    isActive: m.is_active,
                  }}
                  isSelf={m.id === ctx.member.id}
                />
              ))}
            </ul>
          </Card>

          <Card title="Invitations en attente">
            {invitations && invitations.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{inv.full_name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {inv.email} · {ROLE_LABELS[inv.role as MemberRole]} · expire le {formatDate(inv.expires_at)}
                      </p>
                    </div>
                    <CancelInvitationButton invitationId={inv.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aucune invitation en attente.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Inviter un employé">
            <InviteForm />
          </Card>
          <Card title="Rôles">
            <dl className="space-y-3 text-sm">
              {(Object.keys(ROLE_LABELS) as MemberRole[]).map((r) => (
                <div key={r}>
                  <dt className="font-medium">{ROLE_LABELS[r]}</dt>
                  <dd className="text-slate-500">{ROLE_DESCRIPTIONS[r]}</dd>
                </div>
              ))}
              <div>
                <dt className="font-medium">Chauffeur</dt>
                <dd className="text-slate-500">Pas de compte : simple fiche pour l&apos;affectation aux tournées.</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
