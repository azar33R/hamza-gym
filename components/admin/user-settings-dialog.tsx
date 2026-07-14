"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Ban, Loader2, ShieldCheck, Eye, EyeOff, MessageCircle } from "lucide-react";
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
import {
  listPresetAccess,
  setPresetUnlocked,
  type PresetAccessRow,
} from "@/lib/preset-access-actions";
import { Lock, Unlock } from "lucide-react";

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
  plans,
  attendance,
  templates,
  viewerRole,
  open,
  onOpenChange,
}: {
  user: UserData;
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

  useEffect(() => {
    setRole(user.role);
  }, [user.role]);

  const isAdminViewer = viewerRole === "admin";
  const canManagePresets = viewerRole === "admin" || viewerRole === "staff";
  const [scheduled, setScheduled] = useState<
    { id: string; scheduled_date: string; template_id: string }[]
  >([]);
  const [contact, setContact] = useState<{ phone: string | null; email: string | null } | null>(null);
  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [presetAccess, setPresetAccess] = useState<PresetAccessRow[] | null>(null);
  const [togglingPreset, setTogglingPreset] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    getUserAuthInfo(user.id).then(setContact);
  }, [open, user.id]);

  useEffect(() => {
    if (!open || !canManagePresets) return;
    listPresetAccess(user.id).then((r) => setPresetAccess(r.presets));
  }, [open, canManagePresets, user.id]);

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
            {canManagePresets && <TabsTrigger value="presets">{t("admin.user_settings.tabs.presets")}</TabsTrigger>}
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
                  <Button
                    className="w-full"
                    disabled={pending || !selectedPlan}
                    onClick={() =>
                      run(
                        () => activateViaCash(user.id, selectedPlan as any),
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
          </TabsContent>

          {/* ---- Presets (coach/staff can unlock for this member) ---- */}
          {canManagePresets && (
            <TabsContent value="presets">
              <div className="space-y-2">
                <p className="text-xs text-zinc-400">
                  {t("admin.user_settings.presets_desc")}
                </p>
                {!presetAccess ? (
                  <p className="text-sm text-zinc-500">{t("common.loading")}</p>
                ) : presetAccess.length === 0 ? (
                  <p className="text-sm text-zinc-500">{t("admin.user_settings.no_presets")}</p>
                ) : (
                  <div className="space-y-1.5">
                    {presetAccess.map((p) => (
                      <div
                        key={p.presetId}
                        className="flex items-center justify-between rounded-lg border border-border bg-zinc-950/40 px-3 py-2"
                      >
                        <span className="truncate text-sm text-zinc-100">{p.name}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant={p.unlocked ? "secondary" : "outline"}
                          className="gap-1.5"
                          disabled={togglingPreset === p.presetId}
                          onClick={() => {
                            setTogglingPreset(p.presetId);
                            startTransition(async () => {
                              const res = await setPresetUnlocked(
                                user.id,
                                p.presetId,
                                !p.unlocked
                              );
                              if (res.error) {
                                toast.error(res.error);
                              } else {
                                toast.success(
                                  p.unlocked
                                    ? t("admin.user_settings.preset_locked")
                                    : t("admin.user_settings.preset_unlocked")
                                );
                                const r = await listPresetAccess(user.id);
                                setPresetAccess(r.presets);
                              }
                              setTogglingPreset(null);
                            });
                          }}
                        >
                          {p.unlocked ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" />
                              {t("admin.user_settings.unlocked")}
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              {t("admin.user_settings.locked")}
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          )}

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
