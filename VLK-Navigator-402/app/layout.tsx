import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { VlkThemeProvider } from "@/components/vlk/theme-controls";

// Bundled, unmodified upstream fonts: builds do not contact Google Fonts.
const plexSans = localFont({
  src: [{ path: "./fonts/IBMPlexSans-Variable.ttf", weight: "400 700", style: "normal" }],
  display: "swap",
  variable: "--font-ui",
});

// Дослівний текст зберігає свою гарнітуру, ваги та курсив.
const ptSerif = localFont({
  src: [
    { path: "./fonts/PTSerif-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/PTSerif-Bold.ttf", weight: "700", style: "normal" },
    { path: "./fonts/PTSerif-Italic.ttf", weight: "400", style: "italic" },
    { path: "./fonts/PTSerif-BoldItalic.ttf", weight: "700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-normative",
  adjustFontFallback: "Times New Roman",
  preload: false,
});

const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-code",
  preload: false,
});

// Vercel supplies these hosts; custom hosting can set NEXT_PUBLIC_SITE_URL.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined)
  || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "VLK Навігатор — 402 Assist",
  description:
    "Професійний навігатор по наказу МОУ №402 для лікарів-членів ВЛК.",
  applicationName: "VLK Навігатор 402 Assist",
  icons: {
    icon: "/vlk-command-emblem.png",
    shortcut: "/vlk-command-emblem.png",
    apple: "/vlk-command-emblem.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={`${plexSans.variable} ${ptSerif.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased"><VlkThemeProvider>{children}</VlkThemeProvider></body>
    </html>
  );
}
