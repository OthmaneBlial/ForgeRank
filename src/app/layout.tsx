import "@fontsource-variable/ibm-plex-sans";
import "@fontsource-variable/newsreader";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "ForgeRank — Repository intelligence", template: "%s | ForgeRank" },
  description:
    "Rankings, momentum, growth and engineering activity across open-source repositories and developers, built without GitHub REST or GraphQL API credentials.",
  applicationName: "ForgeRank",
  category: "technology",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "ForgeRank",
    description: "Discover what matters in open source.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#10110f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isDemoMode = process.env.FORGERANK_DEMO_MODE === "1";

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {isDemoMode && (
          <div className="demo-banner" role="status">
            <strong>Sample mode</strong>
            <span>
              Illustrative synthetic values · isolated local database · no network collection
            </span>
          </div>
        )}
        <ServiceWorkerRegistration />
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
