"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Copy, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createCode, updateCode, deleteCode } from "@/lib/code-actions";
import type { PlanType } from "@/lib/constants";
import type { SubscriptionCode, Plan } from "@/lib/types";

const PLAN_TYPES: PlanType[] = [
  "1-day",
  "1-month",
  "3-month",
  "6-month",
  "1-year",
];

function planLabel(plans: Plan[], type: PlanType): string {
  return plans.find((p) => p.plan_type === type)?.label ?? type;
}

// datetime-local helpers (store as timestamptz in UTC, edit in local time).
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}
function fromLocalInput(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type CodeStatus = "active" | "used_up" | "expired" | "inactive";

function statusOf(code: SubscriptionCode): CodeStatus {
  if (code.used_count >= code.max_uses) return "used_up";
  if (code.expires_at && new Date(code.expires_at).getTime() <= Date.now())
    return "expired";
  if (!code.is_active) return "inactive";
  return "active";
}

const STATUS_STYLES: Record<CodeStatus, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  used_up: "bg-zinc-500/15 text-zinc-400",
  expired: "bg-red-500/15 text-red-400",
  inactive: "bg-amber-500/15 text-amber-400",
};

function CodeForm({
  plans,
  code,
  onDone,
}: {
  plans: Plan[];
  code?: SubscriptionCode | null;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [planType, setPlanType] = useState<PlanType>(code?.plan_type ?? "1-month");
  const [label, setLabel] = useState(code?.label ?? "");
  const [maxUses, setMaxUses] = useState(String(code?.max_uses ?? 1));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(code?.expires_at ?? null));
  const [isActive, setIsActive] = useState(code?.is_active ?? true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      plan_type: planType,
      label: label.trim() || null,
      max_uses: Number(maxUses) || 1,
      expires_at: fromLocalInput(expiresAt),
      is_active: isActive,
    };

    startTransition(async () => {
      if (code) {
        const res = await updateCode(code.id, payload);
        if (res.error) toast.error(res.error);
        else {
          toast.success(t("admin.codes.updated"));
          onDone();
        }
      } else {
        const res = await createCode(payload);
        if (res.error) toast.error(res.error);
        else {
          toast.success(t("admin.codes.generated"), {
            description: res.code ?? "",
          });
          onDone();
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t("admin.codes.plan")}</Label>
        <Select value={planType} onValueChange={(v) => setPlanType(v as PlanType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLAN_TYPES.map((pt) => (
              <SelectItem key={pt} value={pt}>
                {planLabel(plans, pt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code-label">{t("admin.codes.label")}</Label>
        <Input
          id="code-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="March Promo"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="code-max">{t("admin.codes.max_uses")}</Label>
          <Input
            id="code-max"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code-exp">{t("admin.codes.expires_at")}</Label>
          <Input
            id="code-exp"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>

      {code && (
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-lime-500"
          />
          {t("admin.codes.active")}
        </label>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : code ? t("admin.codes.update") : t("admin.codes.create")}
      </Button>
    </form>
  );
}

export function AdminCodes({
  codes,
  plans,
}: {
  codes: SubscriptionCode[];
  plans: Plan[];
}) {
  const { t } = useI18n();
  const [, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [editCode, setEditCode] = useState<SubscriptionCode | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyCode(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      toast.success(t("admin.codes.copied"));
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error("Clipboard unavailable.");
    }
  }

  function handleDelete(code: SubscriptionCode) {
    if (!confirm(t("admin.codes.confirm_delete"))) return;
    startTransition(async () => {
      const res = await deleteCode(code.id);
      if (res.error) toast.error(res.error);
      else toast.success(t("admin.codes.deleted"));
    });
  }

  return (
    <div className="space-y-6 pb-24">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("admin.codes.title")}
          </h1>
          <p className="text-sm text-zinc-400">{t("admin.codes.subtitle")}</p>
        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 gap-2">
              <Plus className="h-4 w-4" />
              {t("admin.codes.add")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("admin.codes.add")}</DialogTitle>
              <DialogDescription>{t("admin.codes.add_desc")}</DialogDescription>
            </DialogHeader>
            <CodeForm plans={plans} onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </header>

      {codes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-zinc-500">
          {t("admin.codes.no_codes")}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.codes.code")}</TableHead>
                <TableHead>{t("admin.codes.plan")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("admin.codes.label")}</TableHead>
                <TableHead>{t("admin.codes.uses")}</TableHead>
                <TableHead>{t("admin.codes.status")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("admin.codes.created_at")}</TableHead>
                <TableHead className="text-end">{t("admin.codes.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {codes.map((code) => {
                const status = statusOf(code);
                return (
                  <TableRow key={code.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm tracking-wider text-zinc-100">
                          {code.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyCode(code.code, code.id)}
                          className="text-zinc-500 transition-colors hover:text-primary"
                          aria-label={t("admin.codes.copy")}
                        >
                          {copiedId === code.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {planLabel(plans, code.plan_type)}
                    </TableCell>
                    <TableCell className="hidden text-zinc-400 sm:table-cell">
                      {code.label ?? "—"}
                    </TableCell>
                    <TableCell className="text-zinc-300">
                      {code.used_count}/{code.max_uses}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                      >
                        {t(`admin.codes.status_${status}`)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-xs text-zinc-500 md:table-cell">
                      {formatDate(code.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Dialog
                          open={editCode?.id === code.id}
                          onOpenChange={(o) => setEditCode(o ? code : null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-zinc-400 hover:text-primary"
                              aria-label={t("admin.codes.edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>{t("admin.codes.edit")}</DialogTitle>
                              <DialogDescription>
                                {code.code}
                              </DialogDescription>
                            </DialogHeader>
                            <CodeForm
                              plans={plans}
                              code={code}
                              onDone={() => setEditCode(null)}
                            />
                          </DialogContent>
                        </Dialog>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-red-400"
                          onClick={() => handleDelete(code)}
                          aria-label={t("admin.codes.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
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
    </div>
  );
}
