"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, MessageCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { UserSettingsDialog } from "@/components/admin/user-settings-dialog";
import { WhatsAppRenewalButton } from "@/components/admin/whatsapp-renewal-button";
import type { Plan, AttendanceLog } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";

export type ExpiringRow = {
  id: string;
  user_id: string;
  plan_type: string;
  start_date: string | null;
  end_date: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    face_photo_url: string | null;
    subscription_status: string;
    created_at: string;
    height_cm: number | null;
    weight_kg: number | null;
    gender: string | null;
    role: UserRole;
  } | null;
};

// Whole days from today (date-only, UTC) until YYYY-MM-DD — same math as the
// clients directory so the "x days left" line matches everywhere.
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms =
    Date.parse(`${dateStr}T00:00:00Z`) -
    Date.parse(`${new Date().toISOString().split("T")[0]}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// Expiring-soon table with the same member actions as the clients
// directory: avatar enlarge, profile link, chat shortcut, and the full
// user-options (settings) dialog.
export function ExpiringTable({
  rows,
  plans,
  templates,
  viewerRole,
}: {
  rows: ExpiringRow[];
  plans: Plan[];
  templates: { id: string; name: string }[];
  viewerRole: UserRole;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<ExpiringRow["profiles"] | null>(
    null
  );
  const [selectedSub, setSelectedSub] = useState<{
    plan_type: string;
    start_date: string | null;
    end_date: string | null;
  } | null>(null);

  function openSettings(row: ExpiringRow) {
    if (!row.profiles) return;
    setSelected(row.profiles);
    setSelectedSub({
      plan_type: row.plan_type,
      start_date: row.start_date,
      end_date: row.end_date,
    });
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("triage.col_member")}</TableHead>
              <TableHead>{t("triage.col_plan")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("triage.col_expires")}
              </TableHead>
              <TableHead className="text-end">
                {t("admin.clients.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <MemberAvatar
                      photoUrl={s.profiles?.face_photo_url ?? null}
                      name={s.profiles?.full_name}
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/admin/clients/${s.user_id}`}
                        className="block truncate font-medium text-zinc-50 underline-offset-4 hover:underline"
                      >
                        {s.profiles?.full_name ?? t("common.unknown")}
                      </Link>
                      <span className="text-xs text-zinc-400 sm:hidden">
                        {s.end_date
                          ? `${new Date(s.end_date).toLocaleDateString()} · ${(() => {
                              const left = daysUntil(s.end_date);
                              if (left === null) return "";
                              if (left < 0)
                                return t("admin.clients.expired_days_ago", {
                                  n: Math.abs(left),
                                });
                              if (left === 0) return t("admin.clients.ends_today");
                              return t("admin.clients.days_left_count", { n: left });
                            })()}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="capitalize text-zinc-300">
                  {s.plan_type.replace("-", " ")}
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {s.end_date ? (
                    <div>
                      <span className="text-zinc-400">
                        {new Date(s.end_date).toLocaleDateString()}
                      </span>
                      {(() => {
                        const left = daysUntil(s.end_date);
                        if (left === null) return null;
                        if (left < 0)
                          return (
                            <p className="text-xs text-red-400">
                              {t("admin.clients.expired_days_ago", {
                                n: Math.abs(left),
                              })}
                            </p>
                          );
                        if (left === 0)
                          return (
                            <p className="text-xs text-amber-400">
                              {t("admin.clients.ends_today")}
                            </p>
                          );
                        return (
                          <p className="text-xs text-zinc-500">
                            {t("admin.clients.days_left_count", { n: left })}
                          </p>
                        );
                      })()}
                    </div>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-end">
                  <div className="flex justify-end gap-1">
                    <WhatsAppRenewalButton
                      userId={s.user_id}
                      fullName={s.profiles?.full_name ?? null}
                      endDate={s.end_date}
                      variant="icon"
                    />
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-zinc-400 hover:text-zinc-50"
                    >
                      <Link href={`/admin/clients/${s.user_id}`}>
                        <MessageCircle className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-zinc-400 hover:text-zinc-50"
                      onClick={() => openSettings(s)}
                      disabled={!s.profiles}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <UserSettingsDialog
          user={selected}
          sub={selectedSub}
          plans={plans}
          attendance={[] as AttendanceLog[]}
          templates={templates}
          viewerRole={viewerRole}
          open={!!selected}
          onOpenChange={(o) => {
            if (!o) {
              setSelected(null);
              setSelectedSub(null);
            }
          }}
        />
      )}
    </>
  );
}
