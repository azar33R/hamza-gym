import { createClient } from "@/lib/supabase/server";
import { MachineLibraryManager } from "@/components/admin/machine-library-manager";
import type { Machine } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MachinesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("machine_library")
    .select("*")
    .order("created_at", { ascending: false });

  return <MachineLibraryManager machines={(data as Machine[]) ?? []} />;
}
