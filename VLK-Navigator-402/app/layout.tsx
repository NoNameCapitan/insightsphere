import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VLK Навігатор — 402 Assist",
  description:
    "Професійний навігатор по наказу МОУ №402 для лікарів-членів ВЛК.",
  applicationName: "VLK Навігатор 402 Assist",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className="antialiased">{children}</body>
    </html>
  );
}
