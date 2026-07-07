"use server";

import { createClient } from "@supabase/supabase-js";
import { requireStaffOrAdmin } from "@/lib/admin";
import type { LiftSubmission, LiftStatus } from "@/lib/types";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// A submission joined to the member who made it — for the Triage table.
export type AdminLiftSubmission = LiftSubmission & {
  member_name: string | null;
};

export type AdminLiftFilter = LiftStatus | "pending";

// Pending lift submissions for the coach to verify, newest first.
export async function pendingLifts(): Promise<{
  error: string | null;
  submissions: AdminLiftSubmission[];
}> {
  await requireStaffOrAdmin();
  const supabase = serviceClient();

  const { data, error } = await supabase
    .from("lift_submissions")
    .select("id, user_id, exercise_name, weight, calculated_ratio, status, reject_reason, reviewer_id, created_at, reviewed_at, profiles(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) return { error: error?.message ?? "Couldn't load submissions.", submissions: [] };

  return {
    error: null,
    submissions: (data as unknown as (LiftSubmission & {
      profiles: { full_name: string | null } | null;
    })[]).map((s) => ({
      ...s,
      member_name: s.profiles?.full_name ?? null,
    })),
  };
}

// Approve a submission: upserts the verified PR + awards points. Admin/staff.
export async function approveLift(submissionId: string): Promise<{ error: string | null }> {
  const { userId } = await requireStaffOrAdmin();
  const supabase = serviceClient();
  const { error } = await supabase.rpc("approve_lift", {
    p_submission_id: submissionId,
    p_reviewer_id: userId,
  });
  if (error) return { error: error.message };
  return { error: null };
}

// Reject a submission with an optional reason. Admin/staff.
export async function rejectLift(
  submissionId: string,
  reason?: string
): Promise<{ error: string | null }> {
  const { userId } = await requireStaffOrAdmin();
  const supabase = serviceClient();
  const { error } = await supabase.rpc("reject_lift", {
    p_submission_id: submissionId,
    p_reviewer_id: userId,
    p_reason: reason?.trim() || null,
  });
  if (error) return { error: error.message };
  return { error: null };
}
