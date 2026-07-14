"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { ManualRevenue } from "@/lib/types";
import { deleteManualRevenue } from "@/lib/revenue-actions";

export function ManualRevenueList({ entries }: { entries: ManualRevenue[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pendingId, startTransition] = useTransition();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deleteManualRevenue(id);
      if (res.error) {
        toast.error(res.error);
        setConfirmId(null);
        return;
      }
      toast.success(t("admin.revenue.entry_deleted"));
      setConfirmId(null);
      router.refresh();
    });
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-zinc-500">{t("admin.revenue.no_data")}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-2 py-2 text-start font-medium">
              {t("admin.revenue.col_date")}
            </th>
            <th className="px-2 py-2 text-start font-medium">
              {t("admin.revenue.col_type")}
            </th>
            <th className="px-2 py-2 text-end font-medium">
              {t("admin.revenue.col_qty")}
            </th>
            <th className="px-2 py-2 text-end font-medium">
              {t("admin.revenue.col_amount")}
            </th>
            <th className="px-2 py-2 text-start font-medium">
              {t("admin.revenue.col_note")}
            </th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {entries.map((m) => (
            <tr key={m.id} className="border-b border-border/50">
              <td className="px-2 py-2 text-zinc-400">{m.log_date}</td>
              <td className="px-2 py-2 text-zinc-200">{m.type}</td>
              <td className="px-2 py-2 text-end text-zinc-300">{m.quantity}</td>
              <td className="px-2 py-2 text-end font-medium text-zinc-50">
                {Number(m.amount).toLocaleString()} EGP
              </td>
              <td className="px-2 py-2 text-xs text-zinc-500">
                {m.note ?? ""}
              </td>
              <td className="px-2 py-2 text-end">
                {confirmId === m.id ? (
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      disabled={!!pendingId}
                      onClick={() => handleDelete(m.id)}
                      className="rounded bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("common.confirm")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmId(m.id)}
                    className="text-zinc-500 hover:text-destructive"
                    aria-label={t("admin.revenue.delete_entry")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
