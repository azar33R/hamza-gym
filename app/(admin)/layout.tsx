import { requireStaffOrAdmin } from "@/lib/admin";
import { fetchNotifications, unreadNotificationCount } from "@/lib/notification-actions";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminBottomNav } from "@/components/admin/admin-bottom-nav";
import { AdminOfflineReadonlyBanner } from "@/components/admin/admin-offline-readonly-banner";
import { OfflineBanner } from "@/components/pwa/offline-banner";

// Opt out of static caching — admin data changes constantly.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, role } = await requireStaffOrAdmin();
  const firstName = profile.full_name?.split(" ")[0] ?? null;

  // Recent notifications + unread count for the bell badge.
  const [{ notifications }, { count: unreadCount }] = await Promise.all([
    fetchNotifications(10),
    unreadNotificationCount(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminSidebar coachName={firstName} role={role} />
        <div className="min-w-0 flex-1">
          <AdminTopBar notifications={notifications} unreadCount={unreadCount} />
          <main
            className="mx-auto w-full max-w-5xl px-4 py-6 pb-24 md:px-6 md:pb-10"
            style={{ viewTransitionName: "page-content" }}
          >
            <AdminOfflineReadonlyBanner />
            {children}
          </main>
        </div>
      </div>
      {/* Bottom bar is mobile-only; desktop uses the sidebar. */}
      <AdminBottomNav role={role} />
      {/* Offline is already explained by AdminOfflineReadonlyBanner above, so
          this only surfaces queued/syncing work — e.g. members the coach added
          while offline, which otherwise replay silently. */}
      <OfflineBanner showOffline={false} />
    </div>
  );
}
