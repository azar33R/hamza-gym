import { createClient } from "@/lib/supabase/server";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ClientsDirectory } from "@/components/admin/clients-directory";
import { requireStaffOrAdmin } from "@/lib/admin";
import { getT } from "@/lib/i18n/server";
import type { Plan } from "@/lib/types";

export default async function ClientsPage() {
  const t = await getT();
  const { role: viewerRole } = await requireStaffOrAdmin();
  const supabase = await createClient();

  // Fetch members with their latest subscription.
  const { data: activeRaw } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, subscription_status, created_at, height_cm, weight_kg, gender, role")
    .eq("role", "subscriber")
    .eq("subscription_status", "active")
    .order("created_at", { ascending: false });

  const { data: inactiveRaw } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, subscription_status, created_at, height_cm, weight_kg, gender, role")
    .eq("role", "subscriber")
    .neq("subscription_status", "active")
    .order("created_at", { ascending: false });

  // Staff & admin users (visible only to admin viewers).
  const { data: staffRaw } = viewerRole === "admin"
    ? await supabase
        .from("profiles")
        .select("id, full_name, face_photo_url, subscription_status, created_at, height_cm, weight_kg, gender, role")
        .in("role", ["staff", "admin"])
        .order("created_at", { ascending: false })
    : { data: [] };

  // Latest subscription per active user (for plan + expiry).
  const activeIds = [...(activeRaw ?? []).map((p) => p.id), ...(staffRaw ?? []).map((p) => p.id)];
  const { data: subs } = activeIds.length
    ? await supabase
        .from("subscriptions")
        .select("id, user_id, plan_type, end_date")
        .in("user_id", activeIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Keep the most recent subscription per user.
  const latestSub = new Map<string, { plan_type: string; end_date: string | null }>();
  for (const s of subs ?? []) {
    if (!latestSub.has(s.user_id)) {
      latestSub.set(s.user_id, { plan_type: s.plan_type, end_date: s.end_date });
    }
  }

  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });

  // Workout templates — small list, shared by all user-settings modals.
  const { data: templates } = await supabase
    .from("workout_templates")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{t("clients.title")}</h1>
        <p className="text-sm text-zinc-400">{t("clients.subtitle")}</p>
      </header>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            {t("clients.tab_active", { n: activeRaw?.length ?? 0 })}
          </TabsTrigger>
          <TabsTrigger value="inactive">
            {t("clients.tab_inactive", { n: inactiveRaw?.length ?? 0 })}
          </TabsTrigger>
          {viewerRole === "admin" && (
            <TabsTrigger value="staff">
              {t("clients.tab_staff", { n: (staffRaw ?? []).filter((p) => p.role !== "admin").length })}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="active">
          <ClientsDirectory
            users={activeRaw ?? []}
            latestSub={latestSub}
            plans={(plans as Plan[]) ?? []}
            templates={(templates as { id: string; name: string }[]) ?? []}
            viewerRole={viewerRole}
          />
        </TabsContent>

        <TabsContent value="inactive">
          <ClientsDirectory
            users={inactiveRaw ?? []}
            latestSub={latestSub}
            plans={(plans as Plan[]) ?? []}
            templates={(templates as { id: string; name: string }[]) ?? []}
            viewerRole={viewerRole}
          />
        </TabsContent>

        {viewerRole === "admin" && (
          <TabsContent value="staff">
            <ClientsDirectory
              users={staffRaw ?? []}
              latestSub={latestSub}
              plans={(plans as Plan[]) ?? []}
              templates={(templates as { id: string; name: string }[]) ?? []}
              viewerRole={viewerRole}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
