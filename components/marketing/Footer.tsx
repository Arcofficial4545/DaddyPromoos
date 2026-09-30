import Link from "next/link";
import { AtSign, Mail, Rss } from "lucide-react";
import { Logo } from "@/components/marketing/Logo";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import { getSettings } from "@/lib/db/repositories/settings";

const columns = [
  {
    heading: "Explore",
    links: [
      { href: "/build-with-ai", label: "Build with AI" },
      { href: "/reviews", label: "Reviews" },
      { href: "/compare", label: "Compare" },
      { href: "/tools", label: "Tools" },
      { href: "/blog", label: "Blog" },
      // /deals is linked from here only — never the top nav or homepage.
      { href: "/deals", label: "Offers" },
    ],
  },
  {
    heading: "Categories",
    links: [
      { href: "/categories/no-code-app-builders", label: "AI App Builders" },
      { href: "/categories/ai-ides-coding-agents", label: "AI Coding Tools" },
      { href: "/categories/ai-tools", label: "AI Tools" },
      { href: "/categories/productivity", label: "Productivity" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/how-we-review", label: "How we review" },
      { href: "/disclosure", label: "How we make money" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/disclosure", label: "Disclosure" },
    ],
  },
];

/** Subtle circular icon button used for the social/utility row. */
function SocialButton({
  href,
  label,
  external,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:border-emerald/40 hover:bg-emerald/10 hover:text-emerald";
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}

export async function Footer() {
  const settings = await getSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-pine text-white">
      <div className="mx-auto w-full max-w-[92rem] px-6 sm:px-10 lg:px-14">
        {/* ----------------------------------------- Brand + links */}
        <div className="grid gap-12 py-16 lg:grid-cols-[1.4fr_2fr] lg:gap-24 lg:py-20">
          {/* Brand + newsletter */}
          <div className="max-w-md">
            <Logo
              id="pp-footer"
              name={settings.siteName}
              tone="light"
              markClassName="h-9 w-9"
              wordmarkClassName="text-2xl"
            />
            <p className="mt-4 text-sm leading-relaxed text-mint/75">
              {settings.footerTagline}
            </p>

            <div className="mt-8">
              <p className="text-sm font-semibold text-white">
                New reviews in your inbox
              </p>
              <p className="mt-1 text-xs text-mint/60">
                One email a week — reviews, head-to-heads, and build guides.
              </p>
              <NewsletterForm source="footer" className="mt-3 max-w-sm" />
            </div>

            <div className="mt-8 flex items-center gap-2.5">
              {settings.socialLinks.x && (
                <SocialButton
                  href={settings.socialLinks.x}
                  label={`${settings.siteName} on X`}
                  external
                >
                  <AtSign className="h-4 w-4" aria-hidden="true" />
                </SocialButton>
              )}
              <SocialButton href="/rss.xml" label="DaddyPromoos RSS feed">
                <Rss className="h-4 w-4" aria-hidden="true" />
              </SocialButton>
              <SocialButton href="/contact" label="Contact DaddyPromoos">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </SocialButton>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {columns.map((column) => (
              <nav key={column.heading} aria-label={column.heading}>
                <p className="font-mono text-xs font-semibold tracking-[0.15em] text-mint/60 uppercase">
                  {column.heading}
                </p>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={`${column.heading}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="text-sm text-white/70 transition-colors hover:text-emerald"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        {/* ----------------------------------------- Bottom bar */}
        <div className="flex flex-col gap-4 border-t border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/50">
            &copy; {year} {settings.siteName}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/50">
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link
              href="/disclosure"
              className="transition-colors hover:text-white"
            >
              Disclosure
            </Link>
          </div>
        </div>

        {/* ----------------------------------------- Fine print */}
        <div className="border-t border-white/10 py-6">
          <p className="max-w-4xl text-xs leading-relaxed text-white/40">
            {settings.disclosureText}{" "}
            <Link href="/disclosure" className="underline hover:text-white/70">
              Learn more
            </Link>
            .
          </p>
          <p className="mt-2 max-w-4xl text-xs leading-relaxed text-white/35">
            All product names, logos, and brands are property of their
            respective owners and are used for identification purposes only. Use
            of these names, logos, and brands does not imply endorsement.
          </p>
        </div>
      </div>
    </footer>
  );
}
