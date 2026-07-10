"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2,
  UserCircle2,
  Dumbbell,
  LayoutGrid,
  Pencil,
  Check,
} from "lucide-react";
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
import { saveOnboarding } from "@/lib/onboarding-actions";
import type { WorkoutPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";
import { PhotoUploader } from "@/components/subscriber/photo-uploader";

// Mandatory onboarding wizard. Step 1 physical details, Step 2 face photo,
// Step 3 workout path.
export function OnboardingForm({ fullName }: { fullName: string | null }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<0 | 1 | 2>(0);

  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [workoutPath, setWorkoutPath] = useState<WorkoutPath | null>(null);

  function finish() {
    if (!workoutPath) {
      toast.error(t("onb.path_required"));
      return;
    }
    if (!photoUrl) {
      toast.error(t("onb.photo_required"));
      return;
    }
    startTransition(async () => {
      const res = await saveOnboarding({
        age: Number(age),
        height_cm: Number(height),
        weight_kg: Number(weight),
        gender: gender || null,
        face_photo_url: photoUrl,
        workout_path: workoutPath,
      });
      if (res.error) {
        toast.error(t("onb.save_error", { error: res.error }));
      } else {
        toast.success(t("onb.complete"));
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  const pathOptions: {
    value: WorkoutPath;
    title: string;
    desc: string;
    icon: typeof UserCircle2;
  }[] = [
    { value: "coach_plan", title: t("onboarding.coach_plan"), desc: t("onboarding.coach_plan_desc"), icon: UserCircle2 },
    { value: "presets", title: t("onboarding.browse_presets"), desc: t("onboarding.browse_presets_desc"), icon: LayoutGrid },
    { value: "custom", title: t("onboarding.custom"), desc: t("onboarding.custom_desc"), icon: Pencil },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-10">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">
            {t("onb.step", { current: step + 1, total: 3 })}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-50">
            {t("onb.title")}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {step === 0 && t("onb.step0_desc")}
            {step === 1 && t("onb.face_photo_desc")}
            {step === 2 && t("onb.workout_path_desc")}
          </p>
        </div>

        {/* Progress dots */}
        <div className="mb-8 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-zinc-800"
              )}
            />
          ))}
        </div>

        {/* Step 0 — physical details */}
        {step === 0 && (
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-semibold text-zinc-50">{t("onb.physical")}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="o-age">{t("onb.age")}</Label>
                <Input
                  id="o-age"
                  type="number"
                  min={10}
                  max={100}
                  placeholder={t("onb.age_placeholder")}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-gender">{t("onb.gender")}</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger id="o-gender">
                    <SelectValue placeholder={t("onb.gender_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("onb.male")}</SelectItem>
                    <SelectItem value="female">{t("onb.female")}</SelectItem>
                    <SelectItem value="other">{t("onb.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-height">{t("onb.height")}</Label>
              <Input
                id="o-height"
                type="number"
                min={100}
                max={250}
                placeholder={t("onb.height_placeholder")}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-weight">{t("onb.weight")}</Label>
              <Input
                id="o-weight"
                type="number"
                min={30}
                max={250}
                placeholder={t("onb.weight_placeholder")}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <Button
              className="mt-2 w-full"
              onClick={() => {
                if (!age || !height || !weight || Number(age) <= 0 || Number(height) <= 0 || Number(weight) <= 0) {
                  toast.error(t("onb.valid_measurements"));
                  return;
                }
                setStep(1);
              }}
            >
              {t("onb.continue")}
            </Button>
          </div>
        )}

        {/* Step 1 — face photo */}
        {step === 1 && (
          <div className="flex flex-1 flex-col">
            <h2 className="mb-4 text-lg font-semibold text-zinc-50">{t("onb.face_photo")}</h2>
            <div className="flex flex-1 flex-col items-center justify-center">
              <PhotoUploader
                value={photoUrl}
                onUploaded={setPhotoUrl}
                size={224}
                shape="square"
                takeLabel={t("photo.take")}
                galleryLabel={t("photo.gallery")}
                uploadingLabel={t("onb.uploading")}
                uploadedLabel={t("onb.photo_uploaded")}
              />
            </div>

            <div className="mt-auto flex gap-2 pt-6">
              <Button variant="ghost" onClick={() => setStep(0)} className="flex-1">
                {t("onb.back")}
              </Button>
              <Button
                className="flex-[2]"
                disabled={!photoUrl}
                onClick={() => setStep(2)}
              >
                {t("onb.continue")}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2 — workout path */}
        {step === 2 && (
          <div className="flex flex-1 flex-col">
            <h2 className="mb-4 text-lg font-semibold text-zinc-50">{t("onb.workout_path")}</h2>
            <div className="space-y-3">
              {pathOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = workoutPath === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWorkoutPath(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-start transition-all active:scale-[0.98]",
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-xl",
                        selected ? "bg-primary text-primary-foreground" : "bg-primary/15 text-primary"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-zinc-50">{opt.title}</p>
                      <p className="text-sm text-zinc-400">{opt.desc}</p>
                    </div>
                    {selected && <Check className="h-5 w-5 text-primary" />}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto flex gap-2 pt-6">
              <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">
                {t("onb.back")}
              </Button>
              <Button
                className="flex-[2] gap-2"
                disabled={pending || !workoutPath || !photoUrl}
                onClick={finish}
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Dumbbell className="h-4 w-4" />
                )}
                {t("onb.finish")}
              </Button>
            </div>
          </div>
        )}

        {/* Skip link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => { router.push("/dashboard"); router.refresh(); }}
            className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
          >
            {t("onb.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
