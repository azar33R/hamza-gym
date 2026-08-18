"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// A live camera capture for the "add member" flow. Opens the laptop / mobile
// camera via getUserMedia, lets the coach frame the client, then snapshots a
// square JPEG data URL. If the camera is unavailable / permission is denied it
// falls back to the native camera app / gallery picker (same as the profile
// photo-uploader). The produced data URL is either uploaded immediately
// (online) or queued locally for the offline sync.
export function LivePhotoCapture({
  value,
  onCapture,
  onClear,
  takeLabel,
  captureLabel,
  retakeLabel,
  removeLabel,
  startingLabel,
  deniedLabel,
  galleryLabel,
}: {
  value: string | null;
  onCapture: (dataUrl: string) => void;
  onClear: () => void;
  takeLabel: string;
  captureLabel: string;
  retakeLabel: string;
  removeLabel: string;
  startingLabel: string;
  deniedLabel: string;
  galleryLabel: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "active" | "denied">(
    "idle"
  );
  const [loadingFile, setLoadingFile] = useState(false);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("denied");
      return;
    }
    setStatus("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStatus("active");
    } catch {
      // Permission denied, no camera, or non-HTTPS context — use the native
      // picker/camera input instead.
      setStatus("denied");
    }
  }

  useEffect(() => {
    if (status === "active" && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = streamRef.current;
    }
    if (status !== "active") stopStream();
  }, [status]);

  // Clean up the camera when the component unmounts.
  useEffect(() => () => stopStream(), []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const size = 256;
    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // Center-crop to a square then downscale — matches the 256px avatars the
    // rest of the app uses, and keeps the offline queue tiny.
    ctx.drawImage(
      video,
      (video.videoWidth - side) / 2,
      (video.videoHeight - side) / 2,
      side,
      side,
      0,
      0,
      size,
      size
    );
    stopStream();
    setStatus("idle");
    onCapture(canvas.toDataURL("image/jpeg", 0.8));
  }

  function fileToDataUrl(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      onCapture(String(reader.result));
      setStatus("idle");
    };
    reader.readAsDataURL(file);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoadingFile(true);
    fileToDataUrl(file);
    setLoadingFile(false);
  }

  if (status === "starting") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        {startingLabel}
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="space-y-3">
        <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-xl bg-zinc-900">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>
        <Button type="button" className="w-full gap-1.5" onClick={capture}>
          <Camera className="h-4 w-4" /> {captureLabel}
        </Button>
      </div>
    );
  }

  if (value) {
    // Captured preview — allow retaking or removing before submitting.
    return (
      <div className="flex flex-col items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt=""
          className="h-28 w-28 rounded-full object-cover ring-2 ring-primary/40"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={startCamera}
          >
            <RefreshCw className="h-4 w-4" /> {retakeLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onClear}
          >
            <Trash2 className="h-4 w-4" /> {removeLabel}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex flex-col items-center gap-3">
        <p className="text-center text-xs text-zinc-400">{deniedLabel}</p>
        <Button asChild variant="outline" size="sm" className="gap-1.5" disabled={loadingFile}>
          <label className="cursor-pointer">
            <Camera className="h-4 w-4" /> {takeLabel}
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFile}
            />
          </label>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5" disabled={loadingFile}>
          <label className="cursor-pointer">
            <ImagePlus className="h-4 w-4" /> {galleryLabel}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </Button>
      </div>
    );
  }

  // idle — offer to open the camera.
  return (
    <Button type="button" variant="outline" className="w-full gap-1.5" onClick={startCamera}>
      <Camera className="h-4 w-4" /> {takeLabel}
    </Button>
  );
}