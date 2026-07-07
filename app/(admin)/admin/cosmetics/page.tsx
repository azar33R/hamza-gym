import { requireAdmin } from "@/lib/admin";
import { createClient } from "@supabase/supabase-js";
import { AdminCosmetics } from "@/components/admin/admin-cosmetics";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export default async function AdminCosmeticsPage() {
  await requireAdmin();
  const supabase = serviceClient();

  const { data: cosmetics } = await supabase
    .from("cosmetics")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <AdminCosmetics
      cosmetics={(cosmetics ?? []) as import("@/lib/types").Cosmetic[]}
    />
  );
}
