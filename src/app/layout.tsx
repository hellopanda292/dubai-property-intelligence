import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Manrope } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { market } from "@/lib/data";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", display: "swap" });
const sans = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://dubai-property-iq.vercel.app"),
  title: { default: "Dubai Property Intelligence", template: "%s · Dubai Property Intelligence" },
  description: `Explore ${market.areas} Dubai areas, estimate apartment and villa prices, and compare the market, built on ${market.sales.toLocaleString("en-US")} official Dubai Land Department sales.`,
  openGraph: { title: "Dubai Property Intelligence", type: "website" },
};

export const viewport: Viewport = { themeColor: "#f6f7fc" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="pb-16">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
