"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Copy, Check, UserPlus, CloudUpload, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createMember } from "@/lib/member-actions";
import { queueCreateMember } from "@/lib/offline";
import { useOffline } from "@/lib/offline/context";
import { LivePhotoCapture } from "@/components/admin/live-photo-capture";
import type { Plan } from "@/lib/types";

type Props = {
  plans: Plan[];
};

export function AddMemberDialog({ plans }: Props) {
  const { t } = useI18n();
  const { isOnline } = useOffline();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [plan, setPlan] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [queuedOffline, setQueuedOffline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  // Partial cash payment: checked = the member paid only part of the plan
  // price now and promises the rest later.
  const [isPartial, setIsPartial] = useState(false);
  const [paidNow, setPaidNow] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTouched, setDueTouched] = useState(false);
  // Auto WhatsApp nudges for the remainder. Stored per subscription as
  // reminder_every_days (null = off, otherwise 7 or 15).
  const [autoRemind, setAutoRemind] = useState(true);
  const [remindEvery, setRemindEvery] = useState<7 | 15>(7);

  const selectedPlan = plans.find((p) => p.plan_type === plan) ?? null;
  const planPrice = selectedPlan ? Number(selectedPlan.price_egp) : 0;

  // Due date defaults to 7 days after the start date. It fills in the moment
  // partial is switched on (or the start date changes) until the coach edits
  // it by hand — after that we never overwrite their choice.
  useEffect(() => {
    if (!isPartial || dueTouched) return;
    const base = startDate || new Date().toISOString().split("T")[0];
    const d = new Date(`${base}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    d.setDate(d.getDate() + 7);
    setDueDate(d.toISOString().split("T")[0]);
  }, [isPartial, startDate, dueTouched]);

  // The partial box only makes sense once a plan (and its price) exists.
  useEffect(() => {
    if (!plan) {
      setIsPartial(false);
    }
  }, [plan]);
  const paidAmount = Math.floor(Number(paidNow));
  const partialValid =
    !isPartial ||
    (Number.isFinite(paidAmount) && paidAmount > 0 && paidAmount < planPrice);
  const remaining = isPartial && partialValid ? planPrice - paidAmount : 0;

  function reset() {
    setFullName("");
    setPhone("");
    setEmail("");
    setGender("");
    setPlan("");
    setStartDate(new Date().toISOString().split("T")[0]);
    setAge("");
    setHeight("");
    setWeight("");
    setPhotoDataUrl(null);
    setGeneratedCode(null);
    setQueuedOffline(false);
    setCopied(false);
    setIsPartial(false);
    setPaidNow("");
    setDueDate("");
    setDueTouched(false);
    setAutoRemind(true);
    setRemindEvery(7);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!plan) {
      toast.error(t("admin.members.plan_required"));
      return;
    }
    if (isPartial && !partialValid) {
      toast.error(t("admin.members.partial_invalid"));
      return;
    }

    const payload = {
      fullName,
      phone: phone.trim() || null,
      email: email.trim() || null,
      gender: gender || null,
      planType: (plan as any) || null,
      startDate: startDate || null,
      age: age ? Number(age) : null,
      heightCm: height ? Number(height) : null,
      weightKg: weight ? Number(weight) : null,
      partialPayment: isPartial
        ? {
            paidNow: paidAmount,
            dueDate: dueDate || null,
            reminderEveryDays: autoRemind ? remindEvery : null,
          }
        : null,
      priceSnapshot: planPrice || null,
    };

    // Offline: save the form + live photo locally and queue them for replay
    // the next time the coach's device is back online.
    if (!isOnline) {
      startTransition(async () => {
        await queueCreateMember({ ...payload, photoDataUrl });
        setQueuedOffline(true);
      });
      return;
    }

    startTransition(async () => {
      const res = await createMember({
        ...payload,
        photoDataUrl,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("admin.members.created"));
      setGeneratedCode(res.code);
    });
  }

  async function copyCode() {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast.success(t("admin.members.copied"));
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Clipboard unavailable.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t("admin.members.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("admin.members.title")}</DialogTitle>
          <DialogDescription>{t("admin.members.desc")}</DialogDescription>
        </DialogHeader>

        {queuedOffline ? (
          <div className="space-y-4 text-center">
            <CloudUpload className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-zinc-300">
              {t("admin.members.queued_offline")}
            </p>
            <p className="text-xs text-zinc-500">{t("admin.members.queued_offline_hint")}</p>
            <Button className="w-full" onClick={() => { setOpen(false); reset(); }}>
              {t("common.done")}
            </Button>
          </div>
        ) : generatedCode ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-zinc-400">{t("admin.members.give_code")}</p>
            <div className="flex items-center justify-center gap-3">
              <span className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-2xl font-bold tracking-widest text-primary">
                {generatedCode}
              </span>
              <Button
                size="icon"
                variant="ghost"
                onClick={copyCode}
                aria-label={t("admin.members.copy_code")}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button className="w-full" onClick={() => { setOpen(false); reset(); }}>
              {t("common.done")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="m-name">{t("admin.members.full_name")}</Label>
              <Input
                id="m-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{t("admin.members.photo")}</Label>
              <LivePhotoCapture
                value={photoDataUrl}
                onCapture={(dataUrl) => setPhotoDataUrl(dataUrl)}
                onClear={() => setPhotoDataUrl(null)}
                takeLabel={t("admin.members.take_photo")}
                captureLabel={t("admin.members.capture")}
                retakeLabel={t("admin.members.retake_photo")}
                removeLabel={t("admin.members.remove_photo")}
                startingLabel={t("admin.members.camera_starting")}
                deniedLabel={t("admin.members.camera_denied")}
                galleryLabel={t("admin.members.choose_gallery")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-phone">{t("admin.members.phone")}</Label>
              <div className="flex items-center gap-2">
                <span className="flex h-10 items-center rounded-md border border-input bg-zinc-900 px-3 text-sm font-medium text-zinc-300">
                  +20
                </span>
                <Input
                  id="m-phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="01006857031"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-email">{t("admin.members.email")}</Label>
              <Input
                id="m-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="m-gender">{t("admin.members.gender")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger id="m-gender">
                  <SelectValue placeholder={t("admin.members.select_gender")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("admin.members.gender_male")}</SelectItem>
                  <SelectItem value="female">{t("admin.members.gender_female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("admin.members.plan")}</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.members.select_plan")} />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.plan_type}>
                      {p.label} — {p.price_egp} EGP
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {plan ? (
              <button
                type="button"
                onClick={() => setIsPartial((v) => !v)}
                aria-pressed={isPartial}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-start transition-colors ${
                  isPartial
                    ? "border-primary bg-primary/10"
                    : "border-dashed border-zinc-700 bg-zinc-950/40 hover:border-primary/50"
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    isPartial ? "bg-primary text-black" : "bg-zinc-800 text-primary"
                  }`}
                >
                  <HandCoins className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-zinc-50">
                    {t("admin.members.partial_box_title")}
                  </span>
                  <span className="block text-xs text-zinc-400">
                    {t("admin.members.partial_box_desc")}
                  </span>
                </span>
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    isPartial ? "bg-primary" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                      isPartial ? "" : ""
                    }`}
                    style={
                      isPartial
                        ? { insetInlineEnd: "2px" }
                        : { insetInlineStart: "2px" }
                    }
                  />
                </span>
              </button>
            ) : null}
            {plan && isPartial ? (
              <div className="space-y-3 rounded-xl border-2 border-primary/50 bg-primary/5 p-4">
                <div className="space-y-1.5">
                  <Label htmlFor="m-paid" className="text-sm font-bold">
                    {t("admin.members.paid_now")}
                  </Label>
                  <Input
                    id="m-paid"
                    type="number"
                    min={1}
                    max={planPrice > 0 ? planPrice - 1 : undefined}
                    placeholder="200"
                    value={paidNow}
                    onChange={(e) => setPaidNow(e.target.value)}
                    className="h-12 text-lg font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-due" className="text-sm font-bold">
                    {t("admin.members.due_date")}
                  </Label>
                  <Input
                    id="m-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setDueDate(e.target.value);
                      setDueTouched(true);
                    }}
                    className="h-12 text-base"
                  />
                  <p className="text-[11px] text-zinc-500">
                    {t("admin.members.due_auto_hint")}
                  </p>
                </div>
                <p
                  className={`rounded-lg px-3 py-2.5 text-sm font-bold ${
                    partialValid && planPrice > 0
                      ? "bg-zinc-900 text-zinc-100"
                      : "bg-red-950/60 text-red-300"
                  }`}
                >
                  {partialValid && planPrice > 0 ? (
                    <>
                      {t("admin.members.remaining")}:{" "}
                      <span className="text-lg text-primary">
                        {remaining} {t("common.egp")}
                      </span>
                    </>
                  ) : (
                    t("admin.members.partial_invalid")
                  )}
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <input
                    type="checkbox"
                    checked={autoRemind}
                    onChange={(e) => setAutoRemind(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-lime-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-zinc-100">
                      {t("admin.members.auto_remind")}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                      {t("admin.members.every")}
                      <select
                        value={remindEvery}
                        onChange={(e) =>
                          setRemindEvery(Number(e.target.value) === 15 ? 15 : 7)
                        }
                        onClick={(e) => e.stopPropagation()}
                        disabled={!autoRemind}
                        className="rounded-md border border-input bg-zinc-900 px-2 py-1 text-xs font-bold text-zinc-100 disabled:opacity-40"
                      >
                        <option value={7}>{t("admin.members.every_7")}</option>
                        <option value={15}>{t("admin.members.every_15")}</option>
                      </select>
                    </span>
                  </span>
                </label>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="m-start">{t("admin.members.start_date")}</Label>
              <Input
                id="m-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="text-[11px] text-zinc-500">{t("admin.members.start_hint")}</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-age">{t("admin.members.age")}</Label>
                <Input
                  id="m-age"
                  type="number"
                  min={0}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-height">{t("admin.members.height")}</Label>
                <Input
                  id="m-height"
                  type="number"
                  min={0}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-weight">{t("admin.members.weight")}</Label>
                <Input
                  id="m-weight"
                  type="number"
                  min={0}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t("admin.members.creating") : t("admin.members.create")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
