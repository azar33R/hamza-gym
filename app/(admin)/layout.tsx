import { requireStaffOrAdmin } from "@/lib/admin";
import { fetchNotifications, unreadNotificationCount } from "@/lib/notification-actions";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { AdminBottomNav } from "@/components/admin/admin-bottom-nav";
import { AdminOfflineReadonlyBanner } from "@/components/admin/admin-offline-readonly-banner";

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
      <AdminTopBar
        coachName={firstName}
        role={role}
        notifications={notifications}
        unreadCount={unreadCount}
      />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 pb-28" style={{ viewTransitionName: "page-content" }}>
        <AdminOfflineReadonlyBanner />
        {children}
      </main>
      <AdminBottomNav role={role} />
    </div>
  );
}
