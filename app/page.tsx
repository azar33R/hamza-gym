import { redirect } from "next/navigation";

// Root is just a router: middleware sends unauthenticated users to /login,
// and authenticated users land here — we push them to the dashboard.
export default async function RootPage() {
  redirect("/dashboard");
}
