import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PackagingOption } from "./product-form";

export async function loadPackagingOptions(): Promise<PackagingOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("packaging_types").select("id, name, kind, capacity, is_active").order("name");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    kind: p.kind,
    capacity: p.capacity,
    isActive: p.is_active,
  }));
}
