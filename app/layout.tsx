import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Impact.com site verification. Spread as a props object rather than written
 * as `<meta value="...">` because Impact's snippet uses a `value` attribute,
 * which isn't part of React's `meta` prop types — and the Metadata API's
 * `verification.other` would emit `content="..."` instead, which is not the
 * tag Impact asks for. Must stay in the <head> of the homepage.
 */
const IMPACT_SITE_VERIFICATION = {
  name: "impact-site-verification",
  value: "8c458551-17b6-435c-a021-48cee8e6a1e9",
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: "DaddyPromoos — Verified deals on AI tools and SaaS",
    template: "%s | DaddyPromoos",
  },
  description:
    "DaddyPromoos is a deals and discovery platform for AI tools, SaaS products, and digital services. Editorial reviews plus verified coupon codes, updated daily.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta {...IMPACT_SITE_VERIFICATION} />
      </head>
      {/* suppressHydrationWarning: browser extensions commonly inject
          attributes onto <html>/<body> before hydration; this silences the
          resulting attribute-only mismatch without affecting real content. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
