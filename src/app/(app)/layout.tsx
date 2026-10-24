import { AppShell } from "@/components/layout/app-shell";
import { requireContext } from "@/lib/server/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const context = await requireContext();
  return <AppShell context={context}>{children}</AppShell>;
}
