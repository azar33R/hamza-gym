"use client";

import { useEffect, useState } from "react";
import { getDashboardData, type DashboardData } from "@/app/(subscriber)/tab-actions";
import { createClient } from "@/lib/supabase/client";
import { DashboardShell } from "@/components/subscriber/tabs/dashboard-shell";
import { useTabContext } from "@/app/(subscriber)/tab-context";

export function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const { notifyReady, initialTab } = useTabContext();
  const id = "dashboard" as const;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then((res: { data: { user: { id: string } | null } }) => {
      const user = res.data.user;
      if (user) setUserId(user.id);
    });
    getDashboardData().then((res) => {
      if (res.error) setError(res.error);
      else setData(res.data);
      if (initialTab === id) notifyReady(id);
    });
  }, [initialTab, notifyReady]);

  if (error) {
    if (initialTab === id) notifyReady(id);
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-zinc-500">
        {error}
      </div>
    );
  }

  if (!data || !userId) return null;

  return <DashboardShell data={data} userId={userId} />;
}
