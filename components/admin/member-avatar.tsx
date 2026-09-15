"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// MemberAvatar — subscriber photo with:
// - hover: enlarges in place (scale + highlight ring)
// - click/press: opens a large preview dialog (when a photo exists)
export function MemberAvatar({
  photoUrl,
  name,
  className,
}: {
  photoUrl: string | null | undefined;
  name: string | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = name ?? "";

  return (
    <>
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={!photoUrl}
        onClick={() => photoUrl && setOpen(true)}
        className={cn(
          "group relative shrink-0 rounded-full outline-none",
          "focus-visible:ring-2 focus-visible:ring-lime-500",
          photoUrl
            ? "cursor-zoom-in active:scale-95"
            : "cursor-default"
        )}
      >
        <Avatar
          className={cn(
            "relative transition-transform duration-200 ease-out",
            photoUrl &&
              "group-hover:z-30 group-hover:scale-[2] group-hover:shadow-xl group-hover:ring-2 group-hover:ring-lime-500",
            className
          )}
        >
          {photoUrl && (
            <AvatarImage src={photoUrl} alt={label} />
          )}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
      </button>

      {photoUrl && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="truncate">{label}</DialogTitle>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={label}
              className="max-h-[70vh] w-full rounded-xl object-contain bg-zinc-950"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
