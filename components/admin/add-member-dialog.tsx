"use client";

import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/client";
import { toast } from "sonner";
import { Plus, Copy, Check, UserPlus } from "lucide-react";
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

export function AddMemberDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFullName("");
    setPhone("");
    setEmail("");
    setGender("");
    setAge("");
    setHeight("");
    setWeight("");
    setGeneratedCode(null);
    setCopied(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createMember({
        fullName,
        phone: phone.trim() || null,
        email: email.trim() || null,
        gender: gender.trim() || null,
        age: age ? Number(age) : null,
        heightCm: height ? Number(height) : null,
        weightKg: weight ? Number(weight) : null,
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

        {generatedCode ? (
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
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="m-gender">{t("admin.members.gender")}</Label>
                <Input
                  id="m-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                />
              </div>
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
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? t("admin.members.creating") : t("admin.members.create")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
