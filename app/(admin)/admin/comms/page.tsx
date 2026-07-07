import { createClient } from "@/lib/supabase/server";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { getT } from "@/lib/i18n/server";

export default async function CommsPage() {
  const t = await getT();
  const supabase = await createClient();

  // Subscriber list for the "specific user" audience option.
  const { data: users } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "subscriber")
    .order("full_name", { ascending: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          {t("comms.title")}
        </h1>
        <p className="text-sm text-zinc-400">
          {t("comms.subtitle")}
        </p>
      </header>

      <BroadcastForm users={(users as { id: string; full_name: string | null }[]) ?? []} />
    </div>
  );
}
