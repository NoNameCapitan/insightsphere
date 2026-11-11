import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/manrope";
import "./globals.css";
import { t } from "@/lib/i18n";
import { SITE, websiteJsonLd } from "@/lib/seo";
import { AmbientBackground } from "@/components/AmbientBackground";
import { JsonLd } from "@/components/JsonLd";
import { HeaderNav } from "@/components/HeaderNav";
import { MotionRuntime } from "@/components/motion/MotionRuntime";
import { TabBar } from "@/components/TabBar";
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
    images: [{ url: "/og.png", width: 1200, height: 630, alt: `${SITE.name} — ${t.tagline}` }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${t.tagline}`,
    description: t.hero.subtitle,
    site: SITE.twitter,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0B6B62",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function Header() {
  return (
    <header className="site-header">
      <nav className="site-header__bar" aria-label="Головна навігація">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold">
          <span aria-hidden className="relative grid h-7 w-7 place-items-center">
            <span className="absolute inset-0 rounded-full bg-brand/15" />
            <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping2" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          {t.brand}
        </Link>
        <HeaderNav />
        {/* Mobile: the tab bar carries navigation; the header keeps one calm link. */}
        <Link className="site-nav__link sm:hidden" href="/kyiv-updates">Актуальне</Link>
      </nav>
    </header>
  );
}

const FOOTER_GROUPS: { title: string; links: [string, string][] }[] = [
  {
    title: "Знайти поруч",
    links: [
      ["/vet-clinic-near-me", "Ветклініки"],
      ["/vet-pharmacy-near-me", "Ветаптеки"],
      ["/pet-store-near-me", "Зоомагазини"],
      ["/grooming-near-me", "Грумінг"],
      ["/pet-map-kyiv", "Карта Києва"],
    ],
  },
  {
    title: "Коли терміново",
    links: [
      ["/help", "Потрібна допомога"],
      ["/emergency-vet-near-me", "Термінова ситуація"],
      ["/lost-found", "Загублені / знайдені"],
      ["/kyiv-updates", "Оновлення Києва"],
      ["/city/kyiv/shelters", "Притулки Києва"],
    ],
  },
  {
    title: "VetNear",
    links: [
      ["/my-pets", "Мої тварини"],
      ["/add-place", "Додати заклад"],
      ["/for-partners", "Партнерам"],
      ["/privacy", "Конфіденційність"],
      ["/terms", "Умови користування"],
    ],
  },
];

function Footer() {
  return (
    <footer className="site-footer mt-16 border-t border-brand-100 bg-surface">
      <p aria-hidden className="site-footer__mark">{SITE.name}</p>
      <div className="container-px relative py-8 text-sm text-ink/60">
        <nav aria-label="Розділи сайту" className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
          {FOOTER_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{g.title}</p>
              <ul className="mt-2 space-y-1.5">
                {g.links.map(([href, label]) => (
                  <li key={href}>
                    <Link className="link-quiet hover:text-brand" href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-8 border-t border-brand-100/70 pt-5">
          <p className="font-semibold text-ink/80">{t.footer.madeWith}</p>
          <p className="mt-2">{t.disclaimerShort}</p>
          <p className="mt-4 text-xs">© {new Date().getFullYear()} {SITE.name}. {t.footer.rights}</p>
        </div>
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
        <a href="#main" className="skip-link">Перейти до вмісту</a>
        <MotionRuntime />
        <AmbientBackground />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <TabBar />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
