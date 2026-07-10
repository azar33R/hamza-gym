"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadFacePhoto } from "@/lib/storage";
import { useI18n } from "@/lib/i18n/client";

// A profile-photo picker that exposes BOTH a camera capture and a gallery
// picker. The old single <input capture="user"> forced the camera and made
// gallery uploads impossible on phones (especially iOS). Splitting into two
// inputs — one with capture, one without — gives the native "choose from
// library" sheet on mobile while keeping the camera shortcut.
export function PhotoUploader({
  value,
  onUploaded,
  size = 128,
  shape = "circle",
  takeLabel,
  galleryLabel,
  uploadingLabel,
  uploadedLabel,
}: {
  value: string | null;
  onUploaded: (url: string) => void;
  size?: number;
  shape?: "circle" | "square";
  takeLabel: string;
  galleryLabel: string;
  uploadingLabel: string;
  uploadedLabel: string;
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so selecting the same file again still fires onChange.
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadFacePhoto(file);
      if (res.error !== null) toast.error(res.error);
      else {
        onUploaded(res.url);
        toast.success(uploadedLabel);
      }
    } finally {
      setUploading(false);
    }
  }

  const radius = shape === "circle" ? "rounded-full" : "rounded-2xl";

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className={`relative overflow-hidden bg-zinc-800 ring-2 ring-primary/30 ${radius}`}
        style={{ width: size, height: size }}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : null}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5" disabled={uploading}>
          <label className="cursor-pointer">
            <Camera className="h-4 w-4" /> {takeLabel}
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5" disabled={uploading}>
          <label className="cursor-pointer">
            <ImagePlus className="h-4 w-4" /> {galleryLabel}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
        </Button>
      </div>
    </div>
  );
}
