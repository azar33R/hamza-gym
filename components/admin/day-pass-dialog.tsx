"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { addManualRevenue } from "@/lib/revenue-actions";

export function DayPassDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [logDate, setLogDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setLogDate(new Date().toISOString().split("T")[0]);
    setQuantity("1");
    setAmount("");
    setNote("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await addManualRevenue({
        log_date: logDate,
        quantity: Number(quantity) || 1,
        amount: Number(amount) || 0,
        note: note.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("admin.day_pass.logged"));
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          {t("admin.day_pass.add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.day_pass.title")}</DialogTitle>
          <DialogDescription>{t("admin.day_pass.subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dp-date">{t("admin.day_pass.date")}</Label>
            <Input
              id="dp-date"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="dp-qty">{t("admin.day_pass.quantity")}</Label>
              <Input
                id="dp-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dp-amount">{t("admin.day_pass.amount")}</Label>
              <Input
                id="dp-amount"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dp-note">{t("admin.day_pass.note")}</Label>
            <Input
              id="dp-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("admin.day_pass.note_placeholder")}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? t("common.saving") : t("admin.day_pass.save")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
