import type { Metadata, Viewport } from "next";
import { Inter, Tajawal } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import { OfflineProvider } from "@/lib/offline/context";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { getLocale, getDict, MESSAGES } from "@/lib/i18n/server";
import { dir } from "@/lib/i18n/config";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/client";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic"],
  variable: "--font-tajawal",
  display: "swap",
  weight: ["400", "500", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = MESSAGES[locale];
  return {
    title: dict["app.name"],
    description: dict["app.tagline"],
    manifest: "/manifest.webmanifest",
    applicationName: dict["app.name"],
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: dict["app.name"],
    },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#84cc16",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const dict = await getDict(locale);
  const fallbackDict = MESSAGES[DEFAULT_LOCALE];

  return (
    <html lang={locale} dir={dir(locale)} className="dark" suppressHydrationWarning>
      <body className={`min-h-screen bg-background ${locale === "ar" ? tajawal.className : inter.className}`} suppressHydrationWarning>
        <I18nProvider locale={locale} dict={dict} fallbackDict={fallbackDict}>
          <OfflineProvider>
            {children}
            <Toaster
              position="top-center"
              theme="dark"
              toastOptions={{
                style: {
                  background: "hsl(240 10% 9%)",
                  border: "1px solid hsl(240 4% 16%)",
                  color: "hsl(0 0% 98%)",
                },
              }}
            />
            <OfflineBanner />
            <RegisterSW />
          </OfflineProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
