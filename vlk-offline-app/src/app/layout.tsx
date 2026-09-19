import type { Metadata, Viewport } from "next";
import { OfflineGuard } from "@/components/offline-guard";
import "./globals.css";
export const metadata: Metadata = {
  title: "ВЛК Offline / Standby",
  description: "Локальні робочі кабінети ВЛК",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  applicationName: "ВЛК Standby",
  appleWebApp: { capable: true, title: "ВЛК Standby" },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};
export const viewport: Viewport = { themeColor: "#126b62" };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        {children}
        <OfflineGuard />
      </body>
    </html>
  );
}
