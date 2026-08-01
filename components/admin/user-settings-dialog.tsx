"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Ban, Loader2, ShieldCheck, Eye, EyeOff, MessageCircle, CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  activateViaCash,
  cancelSubscription,
  deleteUser,
  updateSubscriptionDates,
} from "@/lib/user-management-actions";
import { changeUserRole } from "@/lib/role-actions";
import { WeeklySchedule } from "@/components/admin/weekly-schedule";
import { createClient } from "@/lib/supabase/client";
import { useWriteGuard } from "@/lib/admin-write-guard";
import { useOffline } from "@/lib/offline/context";
import type { Plan, AttendanceLog } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";
import { getUserAuthInfo } from "@/lib/admin-user-actions";
import { normalizeEGPhone } from "@/lib/phone";
import { removeWorkout } from "@/lib/schedule-actions";
import { Lock } from "lucide-react";

type UserData = {
  id: string;
  full_name: string | null;
  subscription_status: string;
  created_at: string;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  role: UserRole;
};

export function UserSettingsDialog({
  user,
  sub,
  plans,
  attendance,
  templates,
  viewerRole,
  open,
  onOpenChange,
}: {
  user: UserData;
  sub: { plan_type: string; start_date: string | null; end_date: string | null } | null;
  plans: Plan[];
  attendance: AttendanceLog[];
  templates: { id: string; name: string }[];
  viewerRole: UserRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const can = useWriteGuard();
  const { isOnline } = useOffline();
  const [selectedPlan, setSelectedPlan] = useState<string>(
    plans[0]?.plan_type ?? ""
  );
  const [role, setRole] = useState<UserRole>(user.role);

  const today = new Date().toISOString().split("T")[0];
  const [cashStartDate, setCashStartDate] = useState<string>(today);
  const [subStart, setSubStart] = useState<string>(sub?.start_date ?? today);
  const [subEnd, setSubEnd] = useState<string>(sub?.end_date ?? today);

  useEffect(() => {
    setRole(user.role);
  }, [user.role]);

  // Reset the period editor whenever the dialog targets a different user.
  useEffect(() => {
    setCashStartDate(today);
    setSubStart(sub?.start_date ?? today);
    setSubEnd(sub?.end_date ?? today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user.id]);

  const isAdminViewer = viewerRole === "admin";
  const [scheduled, setScheduled] = useState<
    { id: string; scheduled_date: string; template_id: string }[]
  >([]);
  const [contact, setContact] = useState<{ phone: string | null; email: string | null } | null>(null);
  const [phoneRevealed, setPhoneRevealed] = useState(false);

  useEffect(() => {
    if (!open) return;
    getUserAuthInfo(user.id).then(setContact);
  }, [open, user.id]);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("scheduled_workouts")
      .select("id, scheduled_date, template_id")
      .eq("user_id", user.id)
      .then(({ data }: { data: { id: string; scheduled_date: string; template_id: string }[] | null }) => setScheduled(data ?? []));
  }, [open, user.id]);

  function run(
    fn: () => Promise<{ error: string | null }>,
    successMsg: string,
    closeAfter = false
  ) {
    if (!can("make this change")) return;
    startTransition(async () => {
      const res = await fn();
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(successMsg);
        router.refresh();
        if (closeAfter) onOpenChange(false);
      }
    });
  }

  const tmplName = (id: string) =>
    templates.find((t) => t.id === id)?.name ??
    t("admin.user_settings.unknown_template");

  function handleRemoveScheduled(id: string) {
    startTransition(async () => {
      const res = await removeWorkout(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        setScheduled((prev) => prev.filter((p) => p.id !== id));
        toast.success(t("admin.user_settings.removed_from_schedule"));
        router.refresh();
      }
    });
  }

  // "X days left" / "Ends today" / "Expired X days ago" for the overview tab.
  function daysUntilLabel(endDate: string | null): string {
    if (!endDate) return "—";
    const end = new Date(endDate + "T00:00:00");
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((end.getTime() - todayStart.getTime()) / 86400000);
    if (days > 0) return t("admin.user_settings.days_left_count", { n: days });
    if (days === 0) return t("admin.user_settings.ends_today");
    return t("admin.user_settings.expired_days_ago", { n: Math.abs(days) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-zinc-50">
            {user.full_name ?? t("admin.user_settings.member")}
          </DialogTitle>
          <Badge variant="muted" className="w-fit capitalize">
            {user.subscription_status.replace("_", " ")}
          </Badge>
        </DialogHeader>

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">{t("admin.user_settings.tabs.overview")}</TabsTrigger>
            <TabsTrigger value="payment">{t("admin.user_settings.tabs.payment")}</TabsTrigger>
            <TabsTrigger value="schedule">{t("admin.user_settings.tabs.schedule")}</TabsTrigger>
            {isAdminViewer && <TabsTrigger value="role">{t("admin.user_settings.tabs.role")}</TabsTrigger>}
          </TabsList>

          {/* ---- Overview ---- */}
          <TabsContent value="overview">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Stat label={t("admin.user_settings.stats.height")} value={user.height_cm ? `${user.height_cm} cm` : "—"} />
              <Stat label={t("admin.user_settings.stats.weight")} value={user.weight_kg ? `${user.weight_kg} kg` : "—"} />
              <Stat label={t("admin.user_settings.stats.gender")} value={user.gender ?? "—"} />
              <Stat
                label={t("admin.user_settings.stats.member_since")}
                value={new Date(user.created_at).toLocaleDateString()}
              />
              {sub && (
                <>
                  <Stat
                    label={t("admin.user_settings.stats.subscription_started")}
                    value={
                      sub.start_date
                        ? new Date(sub.start_date + "T00:00:00").toLocaleDateString()
                        : "—"
                    }
                  />
                  <Stat
                    label={t("admin.user_settings.stats.subscription_ends")}
                    value={
                      sub.end_date
                        ? new Date(sub.end_date + "T00:00:00").toLocaleDateString()
                        : "—"
                    }
                  />
                  <Stat
                    label={t("admin.user_settings.stats.days_left")}
                    value={daysUntilLabel(sub.end_date)}
                  />
                </>
              )}
              {isAdminViewer && contact && (
                <>
                  <div className="rounded-lg bg-zinc-900 p-3">
                    <dt className="text-xs text-zinc-400">{t("common.email")}</dt>
                    <dd className="mt-1 font-medium text-zinc-50">
                      {contact.email ?? "—"}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-zinc-900 p-3">
                    <dt className="flex items-center gap-1 text-xs text-zinc-400">
                      {t("common.phone")}
                      <button
                        type="button"
                        onClick={() => setPhoneRevealed((p) => !p)}
                        className="text-zinc-500 hover:text-zinc-300"
                      >
                        {phoneRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </dt>
                    <dd className="mt-1 font-medium text-zinc-50">
                       {phoneRevealed ? contact.phone ?? "—" : "•••••••"}
                     </dd>
                   </div>
                 </>
               )}

               {isAdminViewer && contact?.phone && (() => {
                 const wa = normalizeEGPhone(contact.phone!);
                 if (!wa) return null;
                 return (
                   <a
                     href={`https://wa.me/${wa.replace("+", "")}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                   >
                     <MessageCircle className="h-4 w-4" />
                     {t("admin.user_settings.whatsapp")}
                   </a>
                 );
               })()}
            </dl>

            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                {t("admin.user_settings.attendance_history")}
              </h3>
              {attendance.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {t("admin.user_settings.no_checkins")}
                </p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {attendance.slice(0, 10).map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-md bg-zinc-900 px-3 py-1.5 text-sm"
                    >
                      <span className="text-zinc-300">{t("admin.user_settings.checkin")}</span>
                      <span className="text-zinc-500">
                        {new Date(a.checked_in_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ---- Payment ---- */}
          <TabsContent value="payment">
            <div className="space-y-5">
              {sub && (
                <div className="rounded-lg border border-border bg-zinc-950/40 p-4">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-50">
                    <CalendarClock className="h-4 w-4 text-primary" />
                    {t("admin.user_settings.period_title")}
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400">
                    {t("admin.user_settings.period_desc")}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="us-start">{t("admin.user_settings.start_date")}</Label>
                      <Input
                        id="us-start"
                        type="date"
                        value={subStart}
                        onChange={(e) => setSubStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="us-end">{t("admin.user_settings.end_date")}</Label>
                      <Input
                        id="us-end"
                        type="date"
                        value={subEnd}
                        onChange={(e) => setSubEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-3 w-full"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateSubscriptionDates(user.id, subStart, subEnd),
                        t("admin.user_settings.dates_saved")
                      )
                    }
                  >
                    {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t("admin.user_settings.save_dates")}
                  </Button>
                </div>
              )}

              <div className="rounded-lg border border-border bg-zinc-950/40 p-4">
                <h3 className="text-sm font-medium text-zinc-50">
                  {t("admin.user_settings.manual_payment")}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {t("admin.user_settings.manual_payment_desc")}
                </p>
                <div className="mt-3 space-y-3">
                  <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("admin.user_settings.select_plan")} />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.plan_type} value={p.plan_type}>
                          {p.label} — {p.price_egp} {t("common.egp")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="space-y-1.5">
                    <Label htmlFor="us-cash-start">{t("admin.user_settings.start_date")}</Label>
                    <Input
                      id="us-cash-start"
                      type="date"
                      value={cashStartDate}
                      onChange={(e) => setCashStartDate(e.target.value)}
                    />
                    <p className="text-[11px] text-zinc-500">
                      {t("admin.user_settings.start_hint")}
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    disabled={pending || !selectedPlan}
                    onClick={() =>
                      run(
                        () =>
                          activateViaCash(
                            user.id,
                            selectedPlan as any,
                            cashStartDate
                          ),
                        t("admin.user_settings.activated_msg"),
                        true
                      )
                    }
                  >
                    {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t("admin.user_settings.activate_cash")}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-zinc-700 text-zinc-300"
                      disabled={pending}
                    >
                      <Ban className="h-4 w-4" /> {t("admin.user_settings.cancel_subscription")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("admin.user_settings.cancel_confirm_title")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("admin.user_settings.cancel_confirm_desc", { name: user.full_name ?? t("admin.user_settings.member") })}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("admin.user_settings.keep_active")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() =>
                          run(
                            () => cancelSubscription(user.id),
                            t("admin.user_settings.subscription_cancelled"),
                            true
                          )
                        }
                      >
                        {t("admin.user_settings.cancel_subscription_confirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={pending}
                    >
                      <Trash2 className="h-4 w-4" /> {t("admin.user_settings.delete_user")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("admin.user_settings.delete_confirm_title")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("admin.user_settings.delete_confirm_desc")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() =>
                          run(
                            () => deleteUser(user.id),
                            t("admin.user_settings.user_deleted"),
                            true
                          )
                        }
                      >
                        {t("admin.user_settings.delete_permanently")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>

          {/* ---- Schedule ---- */}
          <TabsContent value="schedule">
            <WeeklySchedule
              userId={user.id}
              templates={templates}
              existing={scheduled}
            />

            {/* Coach templates assigned to this member — "unlocked" simply by
                being on their schedule. The lock button removes it from the day. */}
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">
                {t("admin.user_settings.scheduled_templates")}
              </h3>
              {scheduled.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  {t("admin.user_settings.no_scheduled")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {scheduled.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-zinc-950/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-100">
                          {tmplName(s.template_id)}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          {s.scheduled_date} · {t("admin.user_settings.unlocked_for_user")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={pending}
                        onClick={() => handleRemoveScheduled(s.id)}
                      >
                        <Lock className="h-3.5 w-3.5" />
                        {t("admin.user_settings.lock")}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ---- Role (admin viewers only) ---- */}
          {isAdminViewer && (
            <TabsContent value="role">
              <div className="rounded-lg border border-border bg-zinc-950/40 p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-50">
                  <ShieldCheck className="h-4 w-4 text-primary" /> {t("admin.user_settings.access_level")}
                </h3>
                <p className="mt-1 text-xs text-zinc-400">
                  {t("admin.user_settings.role_desc")}
                </p>
                <div className="mt-3 space-y-3">
                  <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subscriber">{t("admin.user_settings.roles.subscriber")}</SelectItem>
                      <SelectItem value="staff">{t("admin.user_settings.roles.staff")}</SelectItem>
                      <SelectItem value="admin">{t("admin.user_settings.roles.admin")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full"
                    disabled={pending || role === user.role}
                    onClick={() =>
                      run(
                        () => changeUserRole(user.id, role),
                        t("admin.user_settings.role_updated"),
                        true
                      )
                    }
                  >
                    {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {t("admin.user_settings.save_role")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 p-3">
      <dt className="text-xs text-zinc-400">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-50">{value}</dd>
    </div>
  );
}
