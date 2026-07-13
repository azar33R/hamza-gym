"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { KeyRound, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoUploader } from "@/components/subscriber/photo-uploader";
import { completePasswordSetup } from "@/lib/member-actions";
import { updateFacePhoto } from "@/lib/profile-actions";
import { createClient } from "@/lib/supabase/client";

export function SetupPassword() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  // After the password is set, we show the "sign in again" hint and, if the
  // account has no photo yet, a photo capture step.
  const [step, setStep] = useState<"password" | "next">("password");
  const [identifier, setIdentifier] = useState("");
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  function goToApp() {
    router.push("/dashboard");
    router.refresh();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error(t("setup.short"));
      return;
    }
    if (password !== confirm) {
      toast.error(t("setup.mismatch"));
      return;
    }
    startTransition(async () => {
      const res = await completePasswordSetup(password);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(t("setup.success"));

      // Resolve how the member will sign in next time + whether they need a photo.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const id = (user?.phone || user?.email || "") as string;
      setIdentifier(id);

      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("face_photo_url")
          .eq("id", user.id)
          .single();
        setHasPhoto(!!prof?.face_photo_url);
      } else {
        setHasPhoto(true); // skip the photo step if we can't read the profile
      }

      setStep("next");
    });
  }

  function handlePhotoUploaded(url: string) {
    setPhotoUrl(url);
    updateFacePhoto(url).then((r) => {
      if (r.error) toast.error(r.error);
      else toast.success(t("settings.photo_uploaded"));
    });
  }

  if (step === "next") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
            <KeyRound className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("setup.success")}
          </h1>
          <p className="text-sm text-zinc-400">
            {t("setup.signin_hint", { identifier })}
          </p>

          {hasPhoto === false && (
            <div className="rounded-2xl border border-border bg-card p-5 text-start">
              <h2 className="text-center text-base font-semibold text-zinc-50">
                {t("setup.photo_title")}
              </h2>
              <p className="mb-4 mt-1 text-center text-sm text-zinc-400">
                {t("setup.photo_desc")}
              </p>
              <PhotoUploader
                value={photoUrl}
                onUploaded={handlePhotoUploaded}
                size={120}
                shape="circle"
                takeLabel={t("photo.take")}
                galleryLabel={t("photo.gallery")}
                uploadingLabel={t("settings.uploading")}
                uploadedLabel={t("settings.photo_uploaded")}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full gap-2" onClick={goToApp}>
              {t("common.continue")}
            </Button>
            {hasPhoto === false && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={goToApp}
              >
                {t("common.skip")}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Camera className="h-8 w-8" />
        </div>
        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-50">
          {t("setup.title")}
        </h1>
        <p className="mt-2 text-center text-sm text-zinc-400">{t("setup.desc")}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sp-pw">{t("setup.password")}</Label>
            <Input
              id="sp-pw"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-confirm">{t("setup.confirm")}</Label>
            <Input
              id="sp-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : t("setup.submit")}
          </Button>
        </form>
      </div>
    </div>
  );
}
