"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardTab } from "@/components/subscriber/tabs/dashboard-tab";
import { WorkoutTab } from "@/components/subscriber/tabs/workout-tab";
import { LeaderboardTab } from "@/components/subscriber/tabs/leaderboard-tab";

export type TabId = "dashboard" | "workout" | "leaderboard";

type TabContextValue = {
  activeTab: TabId;
  switchTab: (tab: TabId, href: string) => void;
  notifyReady: (tab: TabId) => void;
  initialTab: TabId | null;
};

const TabContext = createContext<TabContextValue>({
  activeTab: "dashboard",
  switchTab: () => {},
  notifyReady: () => {},
  initialTab: null,
});

export function useTabContext() {
  return useContext(TabContext);
}

const TAB_ROUTES: Record<string, TabId> = {
  "/dashboard": "dashboard",
  "/workout": "workout",
  "/leaderboard": "leaderboard",
};

const ALL_TABS: { id: TabId; Comp: (props: { initialChildren?: React.ReactNode }) => React.ReactNode }[] = [
  { id: "dashboard", Comp: DashboardTab },
  { id: "workout", Comp: WorkoutTab },
  { id: "leaderboard", Comp: LeaderboardTab },
];

export function TabShellProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const initialTab = TAB_ROUTES[pathname] ?? null;

  // Tracks which tab is currently visible
  const [activeTab, setActiveTab] = useState<TabId | null>(initialTab);
  // Tabs whose client data has loaded (show children until ready)
  const [readyTabs, setReadyTabs] = useState<Set<TabId>>(new Set());

  // When a tab component finishes its first data load, mark it ready.
  // Initial tab starts with server-rendered children, so we keep showing
  // those until this fires. This avoids a flash of skeleton.
  const notifyReady = useCallback((tab: TabId) => {
    setReadyTabs((prev) => new Set(prev).add(tab));
  }, []);

  useEffect(() => {
    const tab = TAB_ROUTES[pathname];
    if (tab) {
      setActiveTab(tab);
    }
  }, [pathname]);

  const switchTab = useCallback(
    (tab: TabId, href: string) => {
      setActiveTab(tab);
      router.replace(href, { scroll: false });
    },
    [router]
  );

  const contextValue: TabContextValue = {
    activeTab: activeTab ?? initialTab ?? "dashboard",
    switchTab,
    notifyReady,
    initialTab,
  };

  // Non-tab route — pass through children but still wrap in provider so
  // BottomNav's switchTab works for tab links.
  if (!initialTab) {
    return (
      <TabContext.Provider value={contextValue}>
        {children}
      </TabContext.Provider>
    );
  }

  return (
    <TabContext.Provider value={contextValue}>
      {ALL_TABS.map(({ id, Comp }) => {
        const isActive = activeTab === id;
        const isInitial = initialTab === id;
        const showChildrenFallback = isInitial && !readyTabs.has(id);

        return (
          <div key={id} style={{ display: isActive ? "" : "none" }}>
            {showChildrenFallback ? children : <Comp />}
          </div>
        );
      })}
    </TabContext.Provider>
  );
}
