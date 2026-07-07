"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, MessageCircle, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserSettingsDialog } from "@/components/admin/user-settings-dialog";
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

function initials(name: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ClientsDirectory({
  users,
  latestSub,
  plans,
  templates,
  viewerRole,
}: {
  users: RowUser[];
  latestSub: Map<string, { plan_type: string; end_date: string | null }>;
  plans: Plan[];
  templates: { id: string; name: string }[];
  viewerRole: UserRole;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<RowUser | null>(null);

  function exportCsv() {
    const headers = [
      t("admin.clients.csv_full_name"),
      t("admin.clients.csv_status"),
      t("admin.clients.csv_plan"),
      t("admin.clients.csv_expiry"),
      t("admin.clients.csv_joined"),
    ];
    const rows = users.map((u) => {
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
      <div className="mb-3 flex justify-end">
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
          <Download className="h-4 w-4" /> {t("admin.clients.export_csv")}
        </Button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-400">
          {t("admin.clients.no_members")}
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
              {users.map((u) => {
                const sub = latestSub.get(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          {u.face_photo_url && (
                            <AvatarImage src={u.face_photo_url} alt={u.full_name ?? ""} />
                          )}
                          <AvatarFallback>{initials(u.full_name)}</AvatarFallback>
                        </Avatar>
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
                    <TableCell className="hidden text-zinc-400 sm:table-cell">
                      {sub?.end_date
                        ? new Date(sub.end_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
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
