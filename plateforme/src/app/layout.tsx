import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import "./globals.css";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { UsageTracker } from "@/components/sandbox/usage-tracker";
import { THEME_INIT_SCRIPT } from "@/components/ui/theme";

// Direction artistique § 4 : Figtree (interface, chiffres) + Fraunces (titres, créole). Polices auto-hébergées par next/font.
const sans = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree", display: "swap" });
// Fraunces variable (axe opsz) : les écrans actuels gardent leurs graisses ; le nouveau design utilise 400 et 500.
const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Koudmen — le lakou numérique", template: "%s · Koudmen" },
  description: "Le réseau de confiance qui veille sur nos aînés, ici et là-bas.",
  // D3 : aucune page indexée pendant le test (voir aussi l'en-tête X-Robots-Tag et robots.txt).
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Koudmen", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Couleur de la barre du navigateur = fond « sable » (clair) ou noir vert doux (sombre).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F2EA" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1413" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning : le script de thème pose data-theme avant l'hydratation (choix mémorisé).
    <html lang="fr" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
          Aller au contenu
        </a>
        <div className="flex flex-1 flex-col">{children}</div>
        {/* A9 : « Donner mon avis » est dans le flux, en bas de page : il ne masque plus le contenu. */}
        <FeedbackButton />
        <UsageTracker />
      </body>
    </html>
  );
}
