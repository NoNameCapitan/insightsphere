import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Одна якісна гарнітура на весь інтерфейс: спокійна, з високою читабельністю.
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="uk" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
