import { createClient } from "@/lib/supabase/server";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ApproveButton,
  RejectButton,
  NudgeButton,
  ApproveLiftButton,
  RejectLiftButton,
} from "@/components/admin/triage-actions";
import { pendingLifts } from "@/lib/lift-actions";
import { getT } from "@/lib/i18n/server";

export default async function TriagePage() {
  const t = await getT();
  const supabase = await createClient();

  // 1) Pending Vodafone Cash requests
  type PendingReq = {
    id: string;
    user_id: string;
    plan_type: string;
    transaction_id: string;
    cardio: boolean;
    created_at: string;
    profiles: { full_name: string | null } | null;
  };
  const { data: pendingReqs } = await supabase
    .from("payment_requests")
    .select("id, user_id, plan_type, transaction_id, cardio, created_at, profiles(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .returns<PendingReq[]>();

  // 2) AWOL: active members with no activity in 7+ days (or never)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const { data: awol } = await supabase
    .from("profiles")
    .select("id, full_name, last_workout_date, last_attendance_date, created_at")
    .eq("subscription_status", "active")
    .or(`last_workout_date.is.null,last_workout_date.lt.${sevenDaysAgo.toISOString().split("T")[0]},last_attendance_date.is.null,last_attendance_date.lt.${sevenDaysAgo.toISOString().split("T")[0]}`)
    .order("created_at", { ascending: false });

  // 3) Expiring soon: active subscriptions ending within 5 days
  type ExpiringSub = {
    id: string;
    user_id: string;
    plan_type: string;
    end_date: string | null;
    profiles: { full_name: string | null } | null;
  };
  const fiveDaysLater = new Date();
  fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
  const { data: expiring } = await supabase
    .from("subscriptions")
    .select("id, user_id, plan_type, end_date, profiles(full_name)")
    .lte("end_date", fiveDaysLater.toISOString().split("T")[0])
    .gte("end_date", new Date().toISOString().split("T")[0])
    .order("end_date", { ascending: true })
    .returns<ExpiringSub[]>();

  // 4) Pending lift verifications
  const { submissions: liftSubmissions } = await pendingLifts();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          {t("triage.title")}
        </h1>
        <p className="text-sm text-zinc-400">{t("triage.subtitle")}</p>
      </header>

      <Tabs defaultValue="pending">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="pending">
            {t("triage.pending_cash")}
            <Badge variant="muted" className="ms-1.5">
              {pendingReqs?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="awol">
            {t("triage.awol")}
            <Badge variant="muted" className="ms-1.5">
              {awol?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="expiring">
            {t("triage.expiring")}
            <Badge variant="muted" className="ms-1.5">
              {expiring?.length ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="lifts">
            {t("triage.verify_lifts")}
            <Badge variant="muted" className="ms-1.5">
              {liftSubmissions.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* ---- Pending Vodafone Cash ---- */}
        <TabsContent value="pending">
          {(pendingReqs?.length ?? 0) === 0 ? (
            <EmptyState message={t("triage.no_pending")} />
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("triage.col_member")}</TableHead>
                    <TableHead>{t("triage.col_plan")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("triage.col_txn")}</TableHead>
                    <TableHead className="text-end">{t("triage.col_action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingReqs!.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-zinc-50">
                        {r.profiles?.full_name ?? t("common.unknown")}
                      </TableCell>
                       <TableCell className="capitalize text-zinc-300">
                         <span className="flex items-center gap-2">
                           {r.plan_type.replace("-", " ")}
                           {r.cardio && (
                             <Badge className="bg-primary/15 text-primary">
                               {t("billing.cardio")}
                             </Badge>
                           )}
                         </span>
                       </TableCell>
                      <TableCell className="hidden font-mono text-xs text-zinc-400 sm:table-cell">
                        {r.transaction_id}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          <ApproveButton requestId={r.id} />
                          <RejectButton requestId={r.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---- AWOL Clients ---- */}
        <TabsContent value="awol">
          {(awol?.length ?? 0) === 0 ? (
            <EmptyState message={t("triage.no_awol")} />
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("triage.col_member")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("triage.col_last_active")}</TableHead>
                    <TableHead className="text-end">{t("triage.col_action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {awol!.map((p) => {
                    const last =
                      (p.last_workout_date ?? p.last_attendance_date) as string | null;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium text-zinc-50">
                          {p.full_name ?? t("common.unknown")}
                        </TableCell>
                        <TableCell className="hidden text-zinc-400 sm:table-cell">
                          {last ? new Date(last).toLocaleDateString() : t("triage.never")}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex justify-end">
                            <NudgeButton userId={p.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---- Expiring Soon ---- */}
        <TabsContent value="expiring">
          {(expiring?.length ?? 0) === 0 ? (
            <EmptyState message={t("triage.no_expiring")} />
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("triage.col_member")}</TableHead>
                    <TableHead>{t("triage.col_plan")}</TableHead>
                    <TableHead className="text-end">{t("triage.col_expires")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expiring!.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-zinc-50">
                        {s.profiles?.full_name ?? t("common.unknown")}
                      </TableCell>
                      <TableCell className="capitalize text-zinc-300">
                        {s.plan_type.replace("-", " ")}
                      </TableCell>
                      <TableCell className="text-right text-zinc-400">
                        {s.end_date ? new Date(s.end_date).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ---- Verify Lifts ---- */}
        <TabsContent value="lifts">
          {liftSubmissions.length === 0 ? (
            <EmptyState message={t("triage.no_lifts")} />
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("triage.col_member")}</TableHead>
                    <TableHead>{t("triage.col_exercise")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("triage.col_weight")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("triage.col_ratio")}</TableHead>
                    <TableHead className="text-end">{t("triage.col_action")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liftSubmissions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium text-zinc-50">
                        {s.member_name ?? t("common.unknown")}
                      </TableCell>
                      <TableCell className="text-zinc-300">{s.exercise_name}</TableCell>
                      <TableCell className="hidden text-zinc-400 sm:table-cell">
                        {s.weight} kg
                      </TableCell>
                      <TableCell className="hidden font-mono text-xs text-zinc-500 sm:table-cell">
                        {s.calculated_ratio != null ? `${s.calculated_ratio}×` : "—"}
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-2">
                          <ApproveLiftButton submissionId={s.id} />
                          <RejectLiftButton submissionId={s.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
      {message}
    </div>
  );
}
