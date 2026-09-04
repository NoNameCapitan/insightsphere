import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { t } from "@/lib/i18n";
import { SITE, websiteJsonLd } from "@/lib/seo";
import { AmbientBackground } from "@/components/AmbientBackground";
import { JsonLd } from "@/components/JsonLd";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${t.tagline}`,
    template: `%s — ${SITE.name}`,
  },
  description: t.hero.subtitle,
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  keywords: [
    "вет допомога поруч",
    "ветклініка поруч",
    "цілодобова ветклініка",
    "зоомагазин поруч",
    "ветаптека",
    "грумінг",
    "притулок для тварин",
    "veterinary near me",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    title: `${SITE.name} — ${t.tagline}`,
    description: t.hero.subtitle,
    url: SITE.url,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${t.tagline}`,
    description: t.hero.subtitle,
    site: SITE.twitter,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0E7C66",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-100/70 bg-canvas/80 backdrop-blur">
      <nav className="container-px flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
          <span aria-hidden className="relative grid h-7 w-7 place-items-center">
            <span className="absolute inset-0 rounded-full bg-brand/15" />
            <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping2" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          {t.brand}
        </Link>
        <div className="flex items-center gap-0.5 overflow-x-auto text-sm">
          <Link className="whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700" href="/my-pets">Мої тварини</Link>
          <Link className="whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700" href="/nearby">Поруч</Link>
          <Link className="whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700" href="/assistant">ШІ-асистент</Link>
          <Link className="whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700" href="/add-place">Додати</Link>
          <Link className="whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors hover:bg-brand-50 hover:text-brand-700" href="/for-partners">Партнерам</Link>
        </div>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-brand-100 bg-surface">
      <div className="container-px py-8 text-sm text-ink/60">
        <p className="font-semibold text-ink/80">{t.footer.madeWith}</p>
        <p className="mt-2">{t.disclaimerShort}</p>
        <p className="mt-4 text-xs">© {new Date().getFullYear()} {SITE.name}. {t.footer.rights}</p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Link className="link-quiet hover:text-brand" href="/pet-services-near-me">Послуги поруч</Link>
          <Link className="link-quiet hover:text-brand" href="/pet-map-kyiv">Карта Києва</Link>
          <Link className="link-quiet hover:text-brand" href="/vet-clinic-near-me">Ветклініки</Link>
          <Link className="link-quiet hover:text-brand" href="/emergency-vet-near-me">Термінова ситуація</Link>
          <Link className="link-quiet hover:text-brand" href="/pet-store-near-me">Зоомагазини</Link>
          <Link className="link-quiet hover:text-brand" href="/vet-pharmacy-near-me">Ветаптеки</Link>
          <Link className="link-quiet hover:text-brand" href="/grooming-near-me">Грумінг</Link>
          <Link className="link-quiet hover:text-brand" href="/products-nearby">Товари поруч</Link>
          <Link className="link-quiet hover:text-brand" href="/lost-found">Загублені/знайдені</Link>
          <Link className="link-quiet hover:text-brand" href="/pet-scan">Скан улюбленця</Link>
          <Link className="link-quiet hover:text-brand" href="/city/kyiv/pet-services">Київ: послуги</Link>
          <Link className="link-quiet hover:text-brand" href="/city/kyiv/shelters">Київ: притулки</Link>
          <Link className="link-quiet hover:text-brand" href="/for-partners">Партнерам</Link>
          <Link className="link-quiet hover:text-brand" href="/demo">Демо для журі</Link>
        </nav>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        <JsonLd data={websiteJsonLd()} />
        <AmbientBackground />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
