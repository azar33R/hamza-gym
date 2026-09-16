import { createClient } from "@/lib/supabase/server";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ClientsDirectory } from "@/components/admin/clients-directory";
import {
  ExpiringTable,
  type ExpiringRow,
} from "@/components/admin/expiring-table";
import { AddMemberDialog } from "@/components/admin/add-member-dialog";
import { requireStaffOrAdmin } from "@/lib/admin";
import { getT } from "@/lib/i18n/server";
import type { Plan } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClientsPage() {
  const t = await getT();
  const { role: viewerRole } = await requireStaffOrAdmin();
  const supabase = await createClient();

  // Fetch ALL subscribers first — we partition into active/inactive below
  // using the *effective* status (an "active" row whose latest subscription
  // already ended counts as expired and belongs in the inactive tab, even
  // if the member hasn't logged in to trigger the self-heal yet).
  const { data: allSubs } = await supabase
    .from("profiles")
    .select("id, full_name, face_photo_url, subscription_status, created_at, height_cm, weight_kg, gender, role")
    .eq("role", "subscriber")
    .order("created_at", { ascending: false });

  // Staff & admin users (visible only to admin viewers).
  const { data: staffRaw } = viewerRole === "admin"
    ? await supabase
        .from("profiles")
        .select("id, full_name, face_photo_url, subscription_status, created_at, height_cm, weight_kg, gender, role")
        .in("role", ["staff", "admin"])
        .order("created_at", { ascending: false })
    : { data: [] };

  // Latest subscription per subscriber (for plan + expiry + effective status).
  // Include staff ids too so the staff tab keeps its plan/expiry display.
  const subIds = [
    ...((allSubs ?? []).map((p: { id: string }) => p.id)),
    ...((staffRaw ?? []).map((p: { id: string }) => p.id)),
  ];
  const { data: subs } = subIds.length
    ? await supabase
        .from("subscriptions")
        .select("id, user_id, plan_type, start_date, end_date")
        .in("user_id", subIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Keep the most recent subscription per user.
  const latestSub = new Map<
    string,
    { plan_type: string; start_date: string | null; end_date: string | null }
  >();
  for (const s of subs ?? []) {
    if (!latestSub.has(s.user_id)) {
      latestSub.set(s.user_id, {
        plan_type: s.plan_type,
        start_date: s.start_date,
        end_date: s.end_date,
      });
    }
  }

  // Partition by *effective* status: an "active" profile whose latest
  // subscription end_date is before today is treated as expired, so it
  // shows (and counts) in the inactive tab immediately — no need to wait
  // for the member to log in and trigger the self-heal.
  const todayStr = new Date().toISOString().split("T")[0];
  const isEffectivelyExpired = (p: { id: string; subscription_status: string }) => {
    if (p.subscription_status === "active") {
      const end = latestSub.get(p.id)?.end_date ?? null;
      if (end && end < todayStr) return true;
    }
    return p.subscription_status !== "active";
  };

  const activeRaw = (allSubs ?? []).filter(
    (p) => !isEffectivelyExpired(p as { id: string; subscription_status: string })
  );
  // Present date-expired "active" rows as expired in the inactive tab.
  const inactiveRaw = (allSubs ?? [])
    .filter((p) => isEffectivelyExpired(p as { id: string; subscription_status: string }))
    .map((p) =>
      p.subscription_status === "active"
        ? { ...p, subscription_status: "expired" as const }
        : p
    );

  // Best-effort DB heal so other screens/counters stay consistent.
  // (Inactive tab is already correct above even if this write fails.)
  const staleIds = (allSubs ?? [])
    .filter(
      (p) =>
        p.subscription_status === "active" &&
        (latestSub.get(p.id)?.end_date ?? null) !== null &&
        (latestSub.get(p.id)?.end_date as string) < todayStr
    )
    .map((p) => p.id);
  if (staleIds.length > 0) {
    await supabase
      .from("profiles")
      .update({ subscription_status: "expired" })
      .in("id", staleIds);
  }

  // Expiring soon: subscriptions ending within the next 5 days.
  const fiveDaysLater = new Date();
  fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
  const todayKey = new Date().toISOString().split("T")[0];
  const { data: expiring } = await supabase
    .from("subscriptions")
    .select(
      "id, user_id, plan_type, start_date, end_date, profiles(id, full_name, face_photo_url, subscription_status, created_at, height_cm, weight_kg, gender, role)"
    )
    .lte("end_date", fiveDaysLater.toISOString().split("T")[0])
    .gte("end_date", todayKey)
    .order("end_date", { ascending: true })
    .returns<ExpiringRow[]>();

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
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">{t("clients.title")}</h1>
          <p className="text-sm text-zinc-400">{t("clients.subtitle")}</p>
        </div>
        {viewerRole === "admin" && <AddMemberDialog plans={(plans as Plan[]) ?? []} />}
      </header>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            {t("clients.tab_active", { n: activeRaw?.length ?? 0 })}
          </TabsTrigger>
          <TabsTrigger value="inactive">
            {t("clients.tab_inactive", { n: inactiveRaw?.length ?? 0 })}
          </TabsTrigger>
          <TabsTrigger value="expiring">
            {t("clients.tab_expiring", { n: expiring?.length ?? 0 })}
          </TabsTrigger>
          {viewerRole === "admin" && (
            <TabsTrigger value="staff">
              {t("clients.tab_staff", { n: (staffRaw ?? []).filter((p: { role: string }) => p.role !== "admin").length })}
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
            showRenewal
          />
        </TabsContent>

        <TabsContent value="expiring">
          {(expiring?.length ?? 0) === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
              {t("triage.no_expiring")}
            </div>
          ) : (
            <ExpiringTable
              rows={expiring ?? []}
              plans={(plans as Plan[]) ?? []}
              templates={(templates as { id: string; name: string }[]) ?? []}
              viewerRole={viewerRole}
            />
          )}
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
