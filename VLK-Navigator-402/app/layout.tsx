import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, PT_Serif } from "next/font/google";
import "./globals.css";
import { VlkThemeProvider } from "@/components/vlk/theme-controls";

// Інтерфейс: інженерний гротеск із повною кирилицею — спокійний, документальний.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ui",
});

// Дослівний нормативний текст: антиква, щоб слова Наказу візуально
// відрізнялися від підписів інтерфейсу.
const ptSerif = PT_Serif({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-normative",
});

// Лише коди: номер статті, пункт, МКХ-10, графа.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-code",
});

export const metadata: Metadata = {
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
