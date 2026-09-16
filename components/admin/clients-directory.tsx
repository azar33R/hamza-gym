"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Settings, MessageCircle, Download, Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MemberAvatar } from "@/components/admin/member-avatar";
import { UserSettingsDialog } from "@/components/admin/user-settings-dialog";
import { WhatsAppRenewalButton } from "@/components/admin/whatsapp-renewal-button";
import {
  arabicDaysLeft,
  arabicExpiredAgo,
  isArabicLocale,
} from "@/lib/arabic-days";
import type { Plan, AttendanceLog } from "@/lib/types";
import type { UserRole } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/client";

type RowUser = {
  id: string;
  full_name: string | null;
  face_photo_url: string | null;
  subscription_status: string;
  created_at: string;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  role: UserRole;
};

// Smart, typo-tolerant matching: case-insensitive, ignores Arabic
// diacritics/alef variants/tatweel and Latin accents. Every word in the
// query must appear somewhere in the member's searchable text.
function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Whole days from today (date-only, UTC) until the given YYYY-MM-DD date.
// Negative = already ended that many days ago.
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const ms =
    Date.parse(`${dateStr}T00:00:00Z`) -
    Date.parse(`${new Date().toISOString().split("T")[0]}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

export function ClientsDirectory({
  users,
  latestSub,
  plans,
  templates,
  viewerRole,
  showRenewal = false,
}: {
  users: RowUser[];
  latestSub: Map<
    string,
    { plan_type: string; start_date: string | null; end_date: string | null }
  >;
  plans: Plan[];
  templates: { id: string; name: string }[];
  viewerRole: UserRole;
  /** True for the inactive/expired tab: shows the WhatsApp renewal icon in ACTIONS. */
  showRenewal?: boolean;
}) {
  const { t, locale } = useI18n();
  const ar = isArabicLocale(locale);
  const [selected, setSelected] = useState<RowUser | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const tokens = norm(query).split(" ").filter(Boolean);
    if (tokens.length === 0) return users;
    return users.filter((u) => {
      const sub = latestSub.get(u.id);
      const hay = norm(
        [
          u.full_name ?? "",
          u.subscription_status.replace(/_/g, " "),
          sub?.plan_type ?? "",
          sub?.end_date ?? "",
        ].join(" ")
      );
      return tokens.every((tok) => hay.includes(tok));
    });
  }, [users, latestSub, query]);

  function exportCsv() {
    const headers = [
      t("admin.clients.csv_full_name"),
      t("admin.clients.csv_status"),
      t("admin.clients.csv_plan"),
      t("admin.clients.csv_expiry"),
      t("admin.clients.csv_joined"),
    ];
    const rows = filtered.map((u) => {
      const sub = latestSub.get(u.id);
      return [
        u.full_name ?? "",
        u.subscription_status,
        sub?.plan_type ?? "",
        sub?.end_date ?? "",
        new Date(u.created_at).toLocaleDateString(),
      ];
    });
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clients-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("admin.clients.search_placeholder")}
            className="pe-9 ps-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("common.close")}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 transition-colors hover:text-zinc-50 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 shrink-0">
          <Download className="h-4 w-4" /> {t("admin.clients.export_csv")}
        </Button>
      </div>
      {query.trim() && (
        <p className="mb-2 text-xs text-zinc-500">
          {t("admin.clients.showing", {
            n: filtered.length,
            total: users.length,
          })}
        </p>
      )}

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
          {t("admin.clients.no_members")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
          {t("admin.clients.no_results")}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.clients.member")}</TableHead>
                <TableHead>{t("admin.clients.plan")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.clients.expiry")}</TableHead>
                <TableHead className="text-end">{t("admin.clients.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const sub = latestSub.get(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <MemberAvatar
                          photoUrl={u.face_photo_url}
                          name={u.full_name}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-zinc-50">
                            {u.full_name ?? t("common.unknown")}
                          </p>
                          <Badge variant="muted" className="mt-0.5 capitalize">
                            {u.subscription_status.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-zinc-300">
                      {sub?.plan_type?.replace("-", " ") ?? "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {sub?.end_date ? (
                        <div>
                          <span className="text-zinc-300">
                            {new Date(sub.end_date).toLocaleDateString()}
                          </span>
                          {(() => {
                            const left = daysUntil(sub.end_date);
                            if (left === null) return null;
                            if (left < 0)
                              return (
                                <p className="text-xs text-red-400">
                                  {ar
                                    ? arabicExpiredAgo(Math.abs(left))
                                    : t("admin.clients.expired_days_ago", {
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
                                {ar
                                  ? arabicDaysLeft(left)
                                  : t("admin.clients.days_left_count", {
                                      n: left,
                                    })}
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
                        {showRenewal && (
                          <WhatsAppRenewalButton
                            userId={u.id}
                            fullName={u.full_name}
                            endDate={sub?.end_date ?? null}
                            variant="icon"
                          />
                        )}
                        <Button
                          asChild
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-zinc-400 hover:text-zinc-50"
                        >
                          <Link href={`/admin/clients/${u.id}`}>
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-zinc-400 hover:text-zinc-50"
                          onClick={() => setSelected(u)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {selected && (
        <UserSettingsDialog
          user={selected}
          sub={latestSub.get(selected.id) ?? null}
          plans={plans}
          attendance={[] as AttendanceLog[]}
          templates={templates}
          viewerRole={viewerRole}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
      )}
    </>
  );
}
