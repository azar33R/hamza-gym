"use server";

import { randomBytes, randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createSSRClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { normalizeEGPhone } from "@/lib/phone";
import { sendPushToUser } from "@/lib/push";
import type { PlanType } from "@/lib/constants";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function currentUserId(): Promise<string | null> {
  const ssr = await createSSRClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  return user?.id ?? null;
}

function randomPassword(): string {
  // Supabase requires >= 6 chars; 16-char alphanumeric+symbol is plenty.
  return randomBytes(12).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) + "Aa1!";
}

function generateCodeString(): string {
  // 6-digit numeric code — short and easy to read / type for members.
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

// Shared default password for manually-created members. Lets a member who
// forgot / never received their access code still sign in with their phone
// or email + this password, then change it on first sign-in. Supabase requires
// passwords >= 6 chars, so we append digits to "hamza".
const DEFAULT_MEMBER_PASSWORD = "Hamza123";

export type CreateMemberInput = {
  fullName: string;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  planType?: PlanType | null;
  startDate?: string | null;
  // A base64 JPEG data URL of the client's live photo (captured from the
  // coach's camera). Optional — when present it's stored in the member's
  // face-photos folder and attached to their profile.
  photoDataUrl?: string | null;
};

// Upload a base64 image to the member's face-photos folder using the
// service-role client. RLS normally lets only the account owner write their
// own folder, but the account hasn't been signed into yet — the coach is
// creating it — so we bypass RLS here. Returns the public URL or null.
async function uploadMemberPhoto(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  photoDataUrl: string
): Promise<string | null> {
  const m = /^data:image\/([a-zA-Z0-9]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    photoDataUrl
  );
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const ext = mime === "jpeg" ? "jpg" : mime;
  const buffer = Buffer.from(m[2], "base64");
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("face-photos")
    .upload(path, buffer, {
      contentType: `image/${mime}`,
      cacheControl: "3600",
      upsert: false,
    });
  if (error) return null;
  const { data } = supabase.storage.from("face-photos").getPublicUrl(path);
  return data.publicUrl ?? null;
}

// Insert a unique access code for a member. Used by both the online action
// and the offline replay, so code generation stays in exactly one place.
async function insertMemberCode(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  adminId: string | null
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateCodeString();
    const { data, error } = await supabase
      .from("member_access_codes")
      .insert({
        code: candidate,
        user_id: userId,
        created_by: adminId,
      })
      .select("code")
      .single();
    if (!error && data) return data.code;
  }
  return null;
}

// Shared implementation for creating a member — form fields + optional live
// photo. Used by BOTH the online server action (createMember) and the offline
// sync engine (replaying a queued "createMember" op) so the two paths never
// drift apart. Callers are responsible for authorizing the request.
export async function createMemberRecord(input: CreateMemberInput & {
  clientOpId?: string | null;
}): Promise<{ error: string | null; code: string | null; userId: string | null }> {
  const fullName = input.fullName?.trim();
  if (!fullName) return { error: "Full name is required.", code: null, userId: null };

  const phone = input.phone?.trim() ? normalizeEGPhone(input.phone) : null;
  const email = input.email?.trim() || null;
  if (!phone && !email) {
    return { error: "Provide a phone number or email.", code: null, userId: null };
  }

  const supabase = serviceClient();
  const adminId = await currentUserId();

  // Offline-replay idempotency: if this exact queued op already created the
  // member (e.g. a sync attempt completed half-way), skip creating a
  // duplicate account.
  if (input.clientOpId) {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("client_op_id", input.clientOpId)
      .maybeSingle();
    if (existing) {
      // The first replay may have died after creating the account but before
      // generating the access code — make sure one exists.
      const { count } = await supabase
        .from("member_access_codes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", existing.id);
      if (!count) await insertMemberCode(supabase, existing.id, adminId);
      return { error: null, code: null, userId: existing.id };
    }
  }

  const password = DEFAULT_MEMBER_PASSWORD;

  const createPayload: Record<string, unknown> = {
    password,
    user_metadata: { full_name: fullName },
  };
  if (phone) {
    createPayload.phone = phone;
    createPayload.phone_confirm = true;
  } else if (email) {
    createPayload.email = email;
    createPayload.email_confirm = true;
  }

  const { data: newUser, error: createError } =
    await supabase.auth.admin.createUser(createPayload as any);
  if (createError || !newUser.user) {
    return { error: createError?.message ?? "Couldn't create member.", code: null, userId: null };
  }

  // Upload the live client photo (if any) before attaching it to the profile.
  let photoUrl: string | null = null;
  if (input.photoDataUrl) {
    photoUrl = await uploadMemberPhoto(supabase, newUser.user.id, input.photoDataUrl);
  }

  // Populate the physical profile fields + flag the one-time password setup.
  const { error: profError } = await supabase
    .from("profiles")
    .update({
      gender: input.gender ?? null,
      age: input.age ?? null,
      height_cm: input.heightCm ?? null,
      weight_kg: input.weightKg ?? null,
      face_photo_url: photoUrl,
      client_op_id: input.clientOpId ?? null,
      force_password_setup: true,
    })
    .eq("id", newUser.user.id);
  if (profError) return { error: profError.message, code: null, userId: null };

  // Activate subscription immediately if a plan was chosen.
  if (input.planType) {
    const { error: actError } = await supabase.rpc("activate_subscription", {
      p_user_id: newUser.user.id,
      p_plan_type: input.planType,
      p_method: "manual_coach",
      p_start_date: input.startDate || null,
    });
    if (actError) return { error: actError.message, code: null, userId: null };

    await sendPushToUser(
      newUser.user.id,
      { title: "Membership Activated! 💪", body: "Your plan has been activated by the coach." },
      "payment",
      null,
      "/dashboard"
    );
  }

  // Generate a unique access code.
  const code = await insertMemberCode(supabase, newUser.user.id, adminId);
  if (!code) return { error: "Couldn't generate an access code.", code: null, userId: null };

  revalidatePath("/admin/clients");
  return { error: null, code, userId: newUser.user.id };
}

// Admin manually creates a member account + a one-time access code, optionally
// attaching a live client photo. Online-only — offline submissions go through
// the queued "createMember" op and replay here via createMemberRecord.
export async function createMember(input: CreateMemberInput): Promise<{
  error: string | null;
  code: string | null;
  userId: string | null;
}> {
  await requireAdmin();
  return createMemberRecord(input);
}

// Member-facing: exchange an access code for a temporary sign-in, returning
// the credentials the client uses to establish a real session.
export async function redeemAccessCode(rawCode: string): Promise<{
  error: string | null;
  identifier: string | null;
  identifierType: "phone" | "email" | null;
  tempPassword: string | null;
}> {
  const code = (rawCode ?? "").trim().toUpperCase();
  if (!code) return { error: "Enter your access code.", identifier: null, identifierType: null, tempPassword: null };

  const supabase = serviceClient();

  const { data: row, error: lookupError } = await supabase
    .from("member_access_codes")
    .select("id, user_id, used_at, expires_at, is_active")
    .eq("code", code)
    .maybeSingle();

  const fail = (error: string) => ({ error, identifier: null, identifierType: null as "phone" | "email" | null, tempPassword: null });

  if (lookupError) return fail("Something went wrong. Try again.");
  if (!row || !row.is_active) return fail("invalid");
  if (row.used_at) return fail("used");
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return fail("expired");
  }

  // Read the user's contact so we know how to sign them in.
  const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(row.user_id);
  if (userError || !authUser.user) return fail("invalid");
  const u = authUser.user;
  const identifier = u.phone ?? u.email;
  const identifierType: "phone" | "email" | null = u.phone ? "phone" : u.email ? "email" : null;
  if (!identifier || !identifierType) return fail("invalid");

  // Set a fresh one-time password, then hand it to the client to sign in.
  const tempPassword = randomPassword();
  const { error: pwError } = await supabase.auth.admin.updateUserById(row.user_id, {
    password: tempPassword,
  });
  if (pwError) return { error: "Something went wrong. Try again.", identifier: null, identifierType: null, tempPassword: null };

  // Mark the code consumed + ensure the setup flag is set.
  await supabase
    .from("member_access_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);
  await supabase
    .from("profiles")
    .update({ force_password_setup: true })
    .eq("id", row.user_id);

  return { error: null, identifier, identifierType, tempPassword };
}

// Member sets their own password after code sign-in (no old password needed).
export async function completePasswordSetup(newPassword: string): Promise<{
  error: string | null;
}> {
  if (!newPassword || newPassword.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }
  const supabase = await createSSRClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
  if (pwError) return { error: pwError.message };

  const { error: profError } = await supabase
    .from("profiles")
    .update({ force_password_setup: false })
    .eq("id", user.id);
  if (profError) return { error: profError.message };

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { error: null };
}
