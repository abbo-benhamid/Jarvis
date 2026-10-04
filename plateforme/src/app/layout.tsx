import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TestBanner } from "@/components/layout/test-banner";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { UsageTracker } from "@/components/sandbox/usage-tracker";

export const metadata: Metadata = {
  title: { default: "Koudmen — le lakou numérique", template: "%s · Koudmen" },
  description: "Le réseau de confiance qui veille sur nos aînés, ici et là-bas. Prototype de test : données fictives uniquement.",
  // D3 : aucune page indexée pendant le test (voir aussi l'en-tête X-Robots-Tag et robots.txt).
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e6b63" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1a19" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-dvh flex-col">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
          Aller au contenu
        </a>
        <TestBanner />
        {/* pb-24 : le bouton flottant « Donner mon avis » ne cache jamais la fin du contenu (mobile). */}
        <div className="flex flex-1 flex-col pb-24">{children}</div>
        <FeedbackButton />
        <UsageTracker />
      </body>
    </html>
  );
}
