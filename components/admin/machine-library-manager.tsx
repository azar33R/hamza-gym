"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, ImagePlus, Cpu } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveMachine, deleteMachine } from "@/lib/machine-actions";
import { uploadMachinePhoto } from "@/lib/storage";
import type { Machine } from "@/lib/types";

export function MachineEditor({
  trigger,
  machine,
  onSaved,
}: {
  trigger: React.ReactNode;
  machine?: Machine | null;
  onSaved?: (m: Machine) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(machine?.name ?? "");
  const [primaryMuscle, setPrimaryMuscle] = useState(machine?.primary_muscle ?? "");
  const [photoUrl, setPhotoUrl] = useState<string | null>(machine?.photo_url ?? null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await uploadMachinePhoto(file);
    setUploading(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      setPhotoUrl(res.url);
      toast.success(t("admin.machines.photo_uploaded"));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveMachine(machine?.id ?? null, {
        name,
        photo_url: photoUrl,
        primary_muscle: primaryMuscle,
      });
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(machine ? t("admin.machines.machine_updated") : t("admin.machines.machine_created"));
        if (res.machine) onSaved?.(res.machine);
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
          <DialogTitle>{machine ? t("admin.machines.edit_machine") : t("admin.machines.new_machine")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Photo */}
          <div className="space-y-2">
            <Label>{t("admin.machines.photo")}</Label>
            {photoUrl ? (
              <div className="relative overflow-hidden rounded-lg border border-border bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt={name || "Machine"} className="h-40 w-full object-cover" />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute end-2 top-2"
                  onClick={() => setPhotoUrl(null)}
                >
                  {t("common.remove")}
                </Button>
              </div>
            ) : (
              <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-zinc-950/40 text-zinc-400 transition-colors hover:border-primary/50 hover:text-zinc-200">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <ImagePlus className="h-6 w-6" />
                )}
                <span className="text-xs">
                  {uploading ? t("admin.machines.uploading") : t("admin.machines.tap_upload")}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFile}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-name">{t("common.name")}</Label>
            <Input
              id="m-name"
              required
              placeholder={t("admin.machines.name_ph")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-muscle">{t("admin.machines.primary_muscle")}</Label>
            <Input
              id="m-muscle"
              placeholder={t("admin.machines.muscle_ph")}
              value={primaryMuscle}
              onChange={(e) => setPrimaryMuscle(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {machine ? t("common.save_changes") : t("admin.machines.create_machine")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteMachineButton({ machineId }: { machineId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle() {
    startTransition(async () => {
      const res = await deleteMachine(machineId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("admin.machines.machine_deleted"));
        router.refresh();
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-zinc-400 hover:text-destructive"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("admin.machines.delete_title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.machines.delete_body")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handle}
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MachineLibraryManager({ machines }: { machines: Machine[] }) {
  const { t } = useI18n();
  const [list, setList] = useState<Machine[]>(machines);

  function handleSaved(m: Machine) {
    setList((prev) => {
      const exists = prev.some((p) => p.id === m.id);
      if (exists) return prev.map((p) => (p.id === m.id ? m : p));
      return [m, ...prev];
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
            {t("admin.machines.title")}
          </h1>
          <p className="text-sm text-zinc-400">
            {t("admin.machines.desc")}
          </p>
        </div>
        <MachineEditor
          onSaved={handleSaved}
          trigger={
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> {t("common.new")}
            </Button>
          }
        />
      </header>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
          <Cpu className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-400">{t("admin.machines.no_machines")}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {t("admin.machines.no_machines_desc")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {list.map((m) => (
            <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="relative aspect-square bg-zinc-950">
                {m.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo_url} alt={m.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Cpu className="h-8 w-8 text-zinc-700" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-zinc-50">{m.name}</p>
                {m.primary_muscle && (
                  <p className="truncate text-xs text-zinc-400">{m.primary_muscle}</p>
                )}
                <div className="mt-2 flex gap-1">
                  <MachineEditor
                    machine={m}
                    onSaved={handleSaved}
                    trigger={
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-zinc-50">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <DeleteMachineButton machineId={m.id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
