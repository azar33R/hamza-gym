import { createClient } from "@/lib/supabase/client";

// ----------------------------------------------------------------------------
//  Supabase Storage uploads — browser-side helpers for the two public buckets
//  created in 0006_phase4_gamification.sql.
//
//  Both buckets are PUBLIC (so leaderboard avatars + machine cues render without
//  signed URLs), but writes are RLS-locked:
//    - face-photos:   owner only   (folder = <uid>/<uuid>.ext)
//    - machine-photos: staff/admin (folder = machines/<uuid>.ext)
// ----------------------------------------------------------------------------

export type UploadResult = { url: string; error: null } | { url: null; error: string };

function ext(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

// Client-side image compression using the Canvas API. Down-scales to maxPx on
// the longest edge (never upscales) and exports as JPEG at the given quality.
// Returns a new File — no new dependencies required.
function compressImage(
  file: File,
  maxPx: number,
  quality: number
): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = url;
  });
}

// Upload a face photo for the CURRENTLY signed-in user. Returns the public URL.
// Compresses to 256×256 max, JPEG @ 80% quality.
export async function uploadFacePhoto(file: File): Promise<UploadResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Not signed in." };

  const compressed = await compressImage(file, 256, 0.8);

  const path = `${user.id}/${crypto.randomUUID()}.${ext(compressed.name)}`;
  const { error } = await supabase.storage.from("face-photos").upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: compressed.type,
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("face-photos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// Upload a machine photo. Caller must be staff/admin (enforced by RLS).
// Compresses to 640×640 max, JPEG @ 80% quality.
export async function uploadMachinePhoto(file: File): Promise<UploadResult> {
  const supabase = createClient();
  const compressed = await compressImage(file, 640, 0.8);

  const path = `machines/${crypto.randomUUID()}.${ext(compressed.name)}`;
  const { error } = await supabase.storage.from("machine-photos").upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: compressed.type,
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("machine-photos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// Upload a shop product photo. Caller must be staff/admin (enforced by RLS).
// Compresses to 640×640 max, JPEG @ 80% quality.
export async function uploadShopProductPhoto(file: File): Promise<UploadResult> {
  const supabase = createClient();
  const compressed = await compressImage(file, 640, 0.8);

  const path = `${crypto.randomUUID()}.${ext(compressed.name)}`;
  const { error } = await supabase.storage.from("shop-products").upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: compressed.type,
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("shop-products").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// Upload a chat photo. Any signed-in user can write to their own folder
// (enforced by storage RLS). Compresses to 1024×1024 max, JPEG @ 80% quality.
export async function uploadChatPhoto(file: File): Promise<UploadResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { url: null, error: "Not signed in." };

  const compressed = await compressImage(file, 1024, 0.8);

  const path = `${user.id}/${crypto.randomUUID()}.${ext(compressed.name)}`;
  const { error } = await supabase.storage.from("chat-photos").upload(path, compressed, {
    cacheControl: "3600",
    upsert: false,
    contentType: compressed.type,
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from("chat-photos").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
