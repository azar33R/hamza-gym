"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
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
import { Checkbox } from "@/components/ui/checkbox";
import { upsertPlan } from "@/lib/plan-actions";
import type { PlanType } from "@/lib/constants";
import type { Plan } from "@/lib/types";

const PLAN_TYPES: { value: PlanType; label: string }[] = [
  { value: "1-day", label: "1-Day" },
  { value: "1-month", label: "1-Month" },
  { value: "3-month", label: "3-Month" },
  { value: "6-month", label: "6-Month" },
  { value: "1-year", label: "1-Year" },
];

export function PlanEditor({
  trigger,
  plan,
}: {
  trigger: React.ReactNode;
  plan?: Plan | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [planType, setPlanType] = useState<PlanType>(plan?.plan_type ?? "1-month");
  const [label, setLabel] = useState(plan?.label ?? "");
  const [price, setPrice] = useState(String(plan?.price_egp ?? ""));
  const [duration, setDuration] = useState(String(plan?.duration_months ?? "1"));
  const [features, setFeatures] = useState<string[]>(plan?.features ?? [""]);
  const [isActive, setIsActive] = useState(plan?.is_active ?? true);
  const [sortOrder, setSortOrder] = useState(String(plan?.sort_order ?? "0"));

  function addFeature() {
    setFeatures((prev) => [...prev, ""]);
  }
  function updateFeature(idx: number, value: string) {
    setFeatures((prev) => prev.map((f, i) => (i === idx ? value : f)));
  }
  function removeFeature(idx: number) {
    setFeatures((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await upsertPlan(plan?.id ?? null, {
        plan_type: planType,
        label,
        price_egp: Number(price) || 0,
        duration_months: Number(duration) || 0,
        features: features.filter((f) => f.trim()),
        is_active: isActive,
        sort_order: Number(sortOrder) || 0,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(plan ? t("admin.plans.updated") : t("admin.plans.created"));
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? t("admin.plans.edit_plan") : t("admin.plans.new_plan")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin.plans.plan_type")}</Label>
            <Select value={planType} onValueChange={(v) => setPlanType(v as PlanType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {t(`admin.plans.type.${p.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-label">{t("admin.plans.label")}</Label>
            <Input
              id="p-label"
              required
              placeholder={t("admin.plans.label_placeholder")}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-price">{t("admin.plans.price")}</Label>
              <Input
                id="p-price"
                type="number"
                min={0}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-duration">{t("admin.plans.duration")}</Label>
              <Input
                id="p-duration"
                type="number"
                min={0}
                required
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-sort">{t("admin.plans.sort_order")}</Label>
            <Input
              id="p-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>{t("admin.plans.features")}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addFeature} className="gap-1">
                <Plus className="h-4 w-4" /> {t("admin.plans.add_feature")}
              </Button>
            </div>
            <div className="space-y-2">
              {features.map((f, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder={t("admin.plans.feature_placeholder")}
                    value={f}
                    onChange={(e) => updateFeature(idx, e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-zinc-400 hover:text-destructive"
                    onClick={() => removeFeature(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="p-active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="p-active" className="cursor-pointer">
              {t("admin.plans.visible_label")}
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {plan ? t("admin.plans.save") : t("admin.plans.add_plan")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
