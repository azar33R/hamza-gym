"use client";

import { useEffect, useState } from "react";
import { Cpu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { Machine } from "@/lib/types";

// Compact picker used inside the workout template editor. Lets the coach attach
// a machine_library entry (carrying its photo) to an exercise.
export function MachinePicker({
  selected,
  onSelect,
}: {
  selected: { id: string; name: string; photo_url: string | null } | null;
  onSelect: (m: { id: string; name: string; photo_url: string | null } | null) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    supabase
      .from("machine_library")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data }: { data: Machine[] | null }) => setMachines((data as Machine[]) ?? []));
  }, [open]);

  const filtered = q
    ? machines.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
    : machines;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={selected ? "secondary" : "outline"}
          className="gap-1.5"
        >
          <Cpu className="h-3.5 w-3.5" />
          {selected ? selected.name : t("admin.machine_picker.button_text")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {selected && (
          <div className="mb-2 flex items-center justify-between rounded-md bg-zinc-900 px-3 py-2">
            <span className="text-xs text-zinc-400">
              {t("admin.machine_picker.linked")} <span className="text-zinc-200">{selected.name}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
              className="text-zinc-400 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <Input
          placeholder={t("admin.machine_picker.search_ph")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3"
        />
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-500">
            {t("admin.machine_picker.no_results")}
          </p>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
            {filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelect({
                    id: m.id,
                    name: m.name,
                    photo_url: m.photo_url,
                  });
                  setOpen(false);
                }}
                className="overflow-hidden rounded-lg border border-border bg-zinc-950 text-start transition-colors hover:border-primary/50"
              >
                <div className="aspect-square bg-zinc-900">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Cpu className="h-6 w-6 text-zinc-700" />
                    </div>
                  )}
                </div>
                <p className="truncate px-2 py-1 text-xs text-zinc-300">{m.name}</p>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
