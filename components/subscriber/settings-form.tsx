"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, LogOut, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/client";
import { updateProfile } from "@/lib/profile-actions";
import {
  updateAuthPhone,
  updateAuthEmail,
  updateAuthPassword,
} from "@/lib/auth-update-actions";
import { createClient } from "@/lib/supabase/client";
import { PhotoUploader } from "@/components/subscriber/photo-uploader";
import type { Profile } from "@/lib/types";

export function SettingsForm({
  profile,
  phone: initialPhone,
  email: initialEmail,
}: {
  profile: Profile | null;
  phone: string | null;
  email: string | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const [pending, startTransition] = useTransition();

  const [height, setHeight] = useState(String(profile?.height_cm ?? ""));
  const [weight, setWeight] = useState(String(profile?.weight_kg ?? ""));
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    profile?.face_photo_url ?? null
  );

  // Contact fields.
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [contactPending, startContactTransition] = useTransition();

  // Password fields (collapsed by default).
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwPending, startPwTransition] = useTransition();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function handleSave() {
    const h = Number(height);
    const w = Number(weight);

    if (h <= 0 || w <= 0) {
      toast.error(t("settings.invalid_hw"));
      return;
    }

    startTransition(async () => {
      const res = await updateProfile({
        height_cm: h,
        weight_kg: w,
        face_photo_url: photoUrl,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("settings.profile_updated"));
      }
    });
  }

  function handleSaveContact() {
    startContactTransition(async () => {
      // Update whichever field changed. Skip empty fields so the user
      // can fill only what they want.
      const results: { error: string | null }[] = [];

      if (phone.trim() && phone !== initialPhone) {
        results.push(await updateAuthPhone(phone));
      }
      if (email.trim() && email !== initialEmail) {
        results.push(await updateAuthEmail(email));
      }

      // If neither field changed, nothing to do.
      if (results.length === 0) {
        toast.info(t("settings.no_changes"));
        return;
      }

      const firstError = results.find((r) => r.error);
      if (firstError?.error) {
        toast.error(firstError.error);
      } else {
        toast.success(t("settings.contact_updated"));
        router.refresh();
      }
    });
  }

  function handleChangePassword() {
    startPwTransition(async () => {
      const res = await updateAuthPassword(currentPassword, newPassword);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("settings.password_changed"));
        setCurrentPassword("");
        setNewPassword("");
        setShowPassword(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">{t("settings.profile")}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {profile?.full_name ?? "Athlete"}
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">
          {t("settings.profile_photo")}
        </h2>
        <PhotoUploader
          value={photoUrl}
          onUploaded={setPhotoUrl}
          size={128}
          shape="circle"
          takeLabel={t("photo.take")}
          galleryLabel={t("photo.gallery")}
          uploadingLabel={t("settings.uploading")}
          uploadedLabel={t("settings.photo_uploaded")}
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">
          {t("settings.physical_details")}
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-height">{t("settings.height")}</Label>
            <Input
              id="s-height"
              type="number"
              min={100}
              max={250}
              placeholder="178"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-weight">{t("settings.weight")}</Label>
            <Input
              id="s-weight"
              type="number"
              min={30}
              max={250}
              placeholder="80"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={pending || !height || !weight}
            onClick={handleSave}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("settings.save_changes")
            )}
          </Button>
        </div>
      </section>

      {/* ---- Contact & Security ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">
          {t("settings.contact_security")}
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="s-phone">{t("settings.phone")}</Label>
            <div className="flex items-center gap-2">
              <span className="flex h-10 items-center rounded-md border border-input bg-zinc-900 px-3 text-sm font-medium text-zinc-300">
                +20
              </span>
              <Input
                id="s-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="01006857031"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-email">{t("settings.email")}</Label>
            <Input
              id="s-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={contactPending}
            onClick={handleSaveContact}
          >
            {contactPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("settings.save_contact")
            )}
          </Button>
        </div>
      </section>

      {/* ---- Change Password (collapsed by default) ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        {!showPassword ? (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-zinc-200"
            onClick={() => setShowPassword(true)}
          >
            <KeyRound className="h-4 w-4" />
            {t("settings.change_password")}
          </Button>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-zinc-200">
            {t("settings.change_password")}
            </h2>
            <div className="space-y-2">
              <Label htmlFor="s-current-pw">{t("settings.current_password")}</Label>
              <Input
                id="s-current-pw"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-new-pw">{t("settings.new_password")}</Label>
              <Input
                id="s-new-pw"
                type="password"
                autoComplete="new-password"
                minLength={6}
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={pwPending || !currentPassword || newPassword.length < 6}
                onClick={handleChangePassword}
              >
                {pwPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  t("settings.update_password")
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPassword(false);
                  setCurrentPassword("");
                  setNewPassword("");
                }}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-red-400 hover:bg-red-950/30 hover:text-red-300"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          {t("auth.sign_out")}
        </Button>
      </section>
    </div>
  );
}
