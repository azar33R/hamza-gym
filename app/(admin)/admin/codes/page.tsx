import { requireAdmin } from "@/lib/admin";
import { createClient } from "@supabase/supabase-js";
import { getSubscriptionCodes } from "@/lib/code-actions";
import { AdminCodes } from "@/components/admin/admin-codes";
import type { Plan } from "@/lib/types";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export const dynamic = "force-dynamic";

export default async function AdminCodesPage() {
  await requireAdmin();
  const supabase = serviceClient();

  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });

  const { codes } = await getSubscriptionCodes();

  return (
    <AdminCodes
      codes={codes}
      plans={(plans ?? []) as Plan[]}
    />
  );
}
