import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./care-system.css";
import "./theme-dark.generated.css";
import "./theme.css";
import { IconMaterialDefs } from "@/components/icons/ServiceIcons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { THEME_BOOTSTRAP_SCRIPT, THEME_COLOR } from "@/lib/theme/theme";
import { t } from "@/lib/i18n";
import { SITE, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { HeaderNav } from "@/components/HeaderNav";
import { MotionRuntime } from "@/components/motion/MotionRuntime";
import { TabBar } from "@/components/TabBar";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { LaunchMeasurement } from "@/components/LaunchMeasurement";

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
  // Matches the system scheme on first load; ThemeToggle updates it live.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function Header() {
  return (
    <header className="site-header">
      <nav className="site-header__bar" aria-label="Головна навігація">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-brand text-white"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><ellipse cx="6.5" cy="9" rx="2" ry="2.7" transform="rotate(-24 6.5 9)" /><ellipse cx="10.5" cy="5.8" rx="1.9" ry="2.5" transform="rotate(-8 10.5 5.8)" /><ellipse cx="15" cy="6.3" rx="1.9" ry="2.5" transform="rotate(15 15 6.3)" /><ellipse cx="18.4" cy="10" rx="1.8" ry="2.5" transform="rotate(28 18.4 10)" /><path d="M7.4 14.5c1.4-1.2 2-3.4 4.4-3.4 2.6 0 3.2 2.4 4.8 3.6 1.5 1.3 1.3 4.7-1 5.2-1.6.4-2.4-.8-3.7-.8-1.4 0-2.5 1-4 .5-2.2-.7-2.2-3.7-.5-5.1Z" /></svg></span>
          {t.brand}
        </Link>
        <HeaderNav />
        <div className="flex shrink-0 items-center gap-1">
          {/* Mobile: the tab bar carries navigation; the header keeps one calm link. */}
          <Link className="site-nav__link md:hidden" href="/kyiv-updates">Події та користь</Link>
          <ThemeToggle />
        </div>
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
      ["/kyiv-updates", "Події та користь"],
      ["/city/kyiv/shelters", "Притулки Києва"],
    ],
  },
  {
    title: "VetNear",
    links: [
      ["/my-pets", "Мої тварини"],
      ["/saved", "Збережені місця"],
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
    // The bootstrap script sets data-theme before hydration, hence the warning opt-out.
    <html lang="uk" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Applies the saved/system theme before first paint (no white flash). */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <IconMaterialDefs />
        <JsonLd data={websiteJsonLd()} />
        <a href="#main" className="skip-link">Перейти до вмісту</a>
        <MotionRuntime />
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <TabBar />
        <ServiceWorkerRegister />
        <LaunchMeasurement />
      </body>
    </html>
  );
}
