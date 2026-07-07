import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

// TEMPORARY diagnostic page. Visit /debug while signed in.
export default async function DebugPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  // ---- Service role check ----
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKeyPresent = Boolean(serviceKey && serviceKey.length > 10);
  const serviceKeyPreview = serviceKey ? `${serviceKey.slice(0, 8)}...${serviceKey.slice(-4)}` : "MISSING";

  let serviceResult: string;
  if (serviceKeyPresent && serviceKey) {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error: svcErr } = await svc.from("workout_templates").select("id").limit(1);
    serviceResult = svcErr
      ? `ERROR: ${svcErr.message} (code: ${svcErr.code})`
      : `OK — can read workout_templates (${(data ?? []).length} rows)`;
  } else {
    serviceResult = "SKIPPED — SUPABASE_SERVICE_ROLE_KEY is not set!";
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 p-6 font-mono text-sm">
      <h1 className="text-lg font-bold text-lime-500 mb-4">Auth + Profile Debug (v2)</h1>

      <h2 className="text-zinc-400 mt-6 mb-2">auth.users user:</h2>
      <pre className="bg-zinc-900 p-3 rounded border border-zinc-800 overflow-auto">
        {JSON.stringify({ id: user.id, email: user.email, created_at: user.created_at }, null, 2)}
      </pre>

      <h2 className="text-zinc-400 mt-6 mb-2">profiles row (anon key):</h2>
      <pre className="bg-zinc-900 p-3 rounded border border-zinc-800 overflow-auto">
        {error ? `ERROR: ${error.message} (code: ${error.code})` : JSON.stringify(profile, null, 2)}
      </pre>

      <h2 className="text-zinc-400 mt-6 mb-2">SUPABASE_SERVICE_ROLE_KEY:</h2>
      <pre className="bg-zinc-900 p-3 rounded border border-zinc-800 overflow-auto">
        {serviceKeyPresent ? `PRESENT: ${serviceKeyPreview}` : "MISSING — this is the problem!"}
      </pre>

      <h2 className="text-zinc-400 mt-6 mb-2">Service role test (workout_templates):</h2>
      <pre className="bg-zinc-900 p-3 rounded border border-zinc-800 overflow-auto">
        {serviceResult}
      </pre>
    </div>
  );
}
