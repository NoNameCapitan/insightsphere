import type { Metadata } from "next";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Lead Hunter — знаходь локальних клієнтів поруч",
  description:
    "Знаходь локальні бізнеси поруч, яким реально можна запропонувати твою послугу: сайт, онлайн-запис, AI-бот, SEO, репутація.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body className="min-h-screen antialiased">
        <Nav />
        <main id="main-content" className="app-main min-h-screen page-enter">
          {children}
        </main>
        <footer className="app-footer mt-10 border-t border-slate-200 px-7 py-6 text-xs text-slate-500">
          <p>
            AI Lead Hunter використовує публічну інформацію про бізнеси для
            етичного пошуку клієнтів. Перевіряйте лідів вручну перед контактом і
            не надсилайте спам.
          </p>
        </footer>
      </body>
    </html>
  );
}
