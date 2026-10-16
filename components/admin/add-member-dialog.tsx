"use client";

import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Copy, Check, UserPlus, CloudUpload, Plus } from "lucide-react";
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
import { createMember } from "@/lib/member-actions";
import { queueCreateMember } from "@/lib/offline";
import { useOffline } from "@/lib/offline/context";
import { LivePhotoCapture } from "@/components/admin/live-photo-capture";
import type { Plan } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  // Optional vitals are collapsed by default — most members never fill them in.
  const [showMore, setShowMore] = useState(false);
  // The compact photo tile asks us to go full-width while the camera is live.
  const [cameraOpen, setCameraOpen] = useState(false);
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
  // Cardio add-on — only offered when the chosen plan prices one.
  const [cardio, setCardio] = useState(false);

  const selectedPlan = plans.find((p) => p.plan_type === plan) ?? null;
  const planPrice = selectedPlan ? Number(selectedPlan.price_egp) : 0;
  const cardioPrice = selectedPlan ? Number(selectedPlan.cardio_price) || 0 : 0;
  const cardioAddon = cardio && cardioPrice > 0 ? cardioPrice : 0;
  // Everything owed (and validated against) is the TOTAL: plan + cardio.
  const totalPrice = planPrice + cardioAddon;

  // Human duration for the plan cards ("30 days", "3 months", "1-day pass").
  function planDuration(p: Plan) {
    if (p.duration_days && p.duration_days > 0) {
      return t("plans.n_days", { n: p.duration_days });
    }
    if (p.duration_months > 1) {
      return t("plans.n_months", { n: p.duration_months });
    }
    if (p.duration_months === 1) {
      return t("plans.1_month", { n: 1 });
    }
    return t("plans.one_day_pass");
  }

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
      setCardio(false);
    } else if (cardioPrice <= 0) {
      setCardio(false);
    }
  }, [plan, cardioPrice]);
  const paidAmount = Math.floor(Number(paidNow));
  const partialValid =
    !isPartial ||
    (Number.isFinite(paidAmount) && paidAmount > 0 && paidAmount < totalPrice);
  const remaining = isPartial && partialValid ? totalPrice - paidAmount : 0;

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
    setShowMore(false);
    setCameraOpen(false);
    setIsPartial(false);
    setPaidNow("");
    setDueDate("");
    setDueTouched(false);
    setAutoRemind(true);
    setRemindEvery(7);
    setCardio(false);
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
      cardio: cardioAddon > 0,
      cardioPriceSnapshot: cardioAddon > 0 ? cardioAddon : null,
      partialPayment: isPartial
        ? {
            paidNow: paidAmount,
            dueDate: dueDate || null,
            reminderEveryDays: autoRemind ? remindEvery : null,
          }
        : null,
      priceSnapshot: totalPrice || null,
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

      {/* Fixed header / scrolling body / pinned footer. */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border p-5 pe-14 text-start">
          <DialogTitle>{t("admin.members.title")}</DialogTitle>
          <DialogDescription>{t("admin.members.desc")}</DialogDescription>
        </DialogHeader>

        {queuedOffline ? (
          <div className="flex-1 space-y-4 p-6 text-center">
            <CloudUpload className="mx-auto h-10 w-10 text-primary" />
            <p className="text-sm text-zinc-300">
              {t("admin.members.queued_offline")}
            </p>
            <p className="text-xs text-zinc-500">
              {t("admin.members.queued_offline_hint")}
            </p>
            <Button
              className="w-full"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              {t("common.done")}
            </Button>
          </div>
        ) : generatedCode ? (
          <div className="flex-1 space-y-4 p-6 text-center">
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
            <Button
              className="w-full"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              {t("common.done")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {/* Identity: photo tile beside name + phone. Goes full-width
                  while the camera is open so the live preview has room. */}
              <div
                className={cn(
                  "flex gap-4",
                  cameraOpen ? "flex-col" : "items-start"
                )}
              >
                <div className={cn(cameraOpen ? "w-full" : "w-[88px] shrink-0")}>
                  <LivePhotoCapture
                    compact
                    onExpandChange={setCameraOpen}
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

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="m-name">
                      {t("admin.members.full_name")}{" "}
                      <span className="text-primary">*</span>
                    </Label>
                    <Input
                      id="m-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="m-phone">{t("admin.members.phone")}</Label>
                    {/* +20 prefix lives inside the field so it reads as one control. */}
                    <div className="flex h-11 items-center rounded-md border border-border bg-zinc-950/50 transition-colors focus-within:ring-2 focus-within:ring-ring">
                      <span className="flex h-full items-center border-e border-border px-3 text-sm font-semibold text-zinc-400">
                        +20
                      </span>
                      <input
                        id="m-phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        placeholder="01006857031"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-full min-w-0 flex-1 bg-transparent px-3 text-base text-zinc-50 outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Email + gender */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="m-email">{t("admin.members.email")}</Label>
                  <Input
                    id="m-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.members.gender")}</Label>
                  <div className="flex h-11 gap-1 rounded-md border border-border bg-zinc-950/50 p-1">
                    {(["male", "female"] as const).map((g) => {
                      const active = gender === g;
                      return (
                        <button
                          key={g}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setGender(active ? "" : g)}
                          className={cn(
                            "flex-1 rounded text-sm font-semibold transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "text-zinc-400 hover:text-zinc-100"
                          )}
                        >
                          {t(
                            g === "male"
                              ? "admin.members.gender_male"
                              : "admin.members.gender_female"
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Plan picker */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {t("admin.members.plan")}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              {plans.length > 0 ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {plans.map((p) => {
                    const active = plan === p.plan_type;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPlan(active ? "" : p.plan_type)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-2 p-3.5 text-start transition-colors",
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border bg-zinc-950/40 hover:border-primary/50"
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2",
                            active ? "border-primary" : "border-zinc-600"
                          )}
                        >
                          {active ? (
                            <span className="h-2 w-2 rounded-full bg-primary" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-zinc-50">
                            {p.label}
                          </span>
                          <span className="block text-[11px] text-zinc-500">
                            {planDuration(p)}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-bold",
                            active ? "text-primary" : "text-zinc-400"
                          )}
                        >
                          {p.price_egp} {t("common.egp")}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">{t("admin.members.select_plan")}</p>
              )}

              {/* Cardio add-on — only when the chosen plan prices one. */}
              {selectedPlan && cardioPrice > 0 ? (
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-zinc-950/40 px-4 py-3 transition-colors hover:border-primary/50">
                  <input
                    type="checkbox"
                    checked={cardio}
                    onChange={(e) => setCardio(e.target.checked)}
                    className="h-4 w-4 shrink-0 accent-lime-500"
                  />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-zinc-100">
                    {t("billing.add_cardio", { price: cardioPrice })}
                  </span>
                  {cardio ? (
                    <span className="shrink-0 text-xs font-bold text-primary">
                      +{cardioPrice} {t("common.egp")}
                    </span>
                  ) : null}
                </label>
              ) : null}

              {/* Partial payment */}
              {plan ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setIsPartial((v) => !v)}
                    aria-pressed={isPartial}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border p-3 text-start transition-colors",
                      isPartial
                        ? "border-primary bg-primary/10"
                        : "border-border bg-zinc-950/40 hover:border-primary/50"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-zinc-50">
                        {t("admin.members.partial_box_title")}
                      </span>
                      <span className="block text-[11px] text-zinc-400">
                        {t("admin.members.partial_box_desc")}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                        isPartial ? "bg-primary" : "bg-zinc-700"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                          isPartial ? "start-5" : "start-0.5"
                        )}
                      />
                    </span>
                  </button>

                  {isPartial ? (
                    <div className="space-y-3 rounded-xl border-2 border-primary/50 bg-primary/5 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="m-paid" className="text-sm font-bold">
                            {t("admin.members.paid_now")}
                          </Label>
                          <Input
                            id="m-paid"
                            type="number"
                            min={1}
                            max={totalPrice > 0 ? totalPrice - 1 : undefined}
                            placeholder="200"
                            value={paidNow}
                            onChange={(e) => setPaidNow(e.target.value)}
                            className="h-11 text-base font-bold"
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
                            className="h-11 text-base"
                          />
                        </div>
                      </div>

                      <p
                        className={cn(
                          "rounded-lg px-3 py-2.5 text-sm font-bold",
                          partialValid && totalPrice > 0
                            ? "bg-zinc-950/60 text-zinc-100"
                            : "bg-red-950/60 text-red-300"
                        )}
                      >
                        {partialValid && totalPrice > 0 ? (
                          <>
                            {t("admin.members.remaining")}{" "}
                            <span className="text-primary">
                              {remaining} {t("common.egp")}
                            </span>
                          </>
                        ) : (
                          t("admin.members.partial_invalid")
                        )}
                      </p>

                      <p className="text-[11px] text-zinc-500">
                        {t("admin.members.due_auto_hint")}
                      </p>

                      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-zinc-950/60 p-3">
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
                </div>
              ) : null}

              {/* Plan start date */}
              <div className="space-y-2">
                <Label htmlFor="m-start">{t("admin.members.start_date")}</Label>
                <Input
                  id="m-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="max-w-[220px]"
                />
                <p className="text-[11px] text-zinc-500">
                  {t("admin.members.start_hint")}
                </p>
              </div>

              {/* Optional vitals — collapsed by default. */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setShowMore((v) => !v)}
                  aria-expanded={showMore}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-zinc-950/40 px-4 py-3 text-start transition-colors hover:border-zinc-700"
                >
                  <Plus
                    className={cn(
                      "h-4 w-4 shrink-0 text-primary transition-transform",
                      showMore && "rotate-45"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-100">
                      {t("admin.members.more_details")}
                    </span>
                    <span className="block text-[11px] text-zinc-500">
                      {t("admin.members.more_details_hint")}
                    </span>
                  </span>
                </button>

                {showMore ? (
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
                ) : null}
              </div>
            </div>

            {/* Pinned footer with a live summary. */}
            <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 text-xs leading-snug text-zinc-400">
                {selectedPlan ? (
                  <>
                    {t("admin.members.summary_selected", {
                      plan: selectedPlan.label,
                      price: totalPrice.toLocaleString("en-US"),
                    })}
                    {cardioAddon > 0 ? (
                      <span className="text-primary">
                        {" "}
                        · {t("billing.cardio")}
                      </span>
                    ) : null}
                    {isPartial ? (
                      <span className="text-zinc-500">
                        {" "}
                        · {t("admin.members.summary_partial")}
                      </span>
                    ) : null}
                  </>
                ) : (
                  t("admin.members.summary_none")
                )}
              </p>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 sm:flex-none"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  {t("common.cancel")}
                </Button>
                <Button type="submit" className="flex-1 sm:flex-none" disabled={pending}>
                  {pending ? t("admin.members.creating") : t("admin.members.create")}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
