import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of DaddyPromoos.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <PageHeader title="Terms of service" />
      <Section>
        <Container size="narrow">
          <div className="space-y-8 text-ink-muted">
            <div>
              <h2 className="text-h4 font-bold text-pine">Using DaddyPromoos</h2>
              <p className="mt-3 leading-relaxed">
                DaddyPromoos is a free editorial service. You may browse, share
                links, and use the offers we list for personal or business
                purchases. Scraping the site, republishing our content at
                scale, or artificially inflating click or vote metrics is not
                permitted.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">Offers and accuracy</h2>
              <p className="mt-3 leading-relaxed">
                Offers link to each brand&apos;s own page, and we show expiry
                dates where known, but brands control their own pricing and
                promotions and can change or withdraw them without notice. A
                listed offer is not a guarantee of price; the price shown by the
                vendor at checkout is final. We are not a party to any purchase
                you make.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">Editorial content</h2>
              <p className="mt-3 leading-relaxed">
                Reviews and comparisons reflect our editors&apos; genuine
                assessment at the time of writing. Products change; verify
                current features with the vendor before relying on them.
                Content on this site is provided as-is without warranties.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">Liability</h2>
              <p className="mt-3 leading-relaxed">
                To the fullest extent permitted by law, DaddyPromoos is not
                liable for losses arising from your use of the site, expired
                offers, or your dealings with third-party stores.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">Changes</h2>
              <p className="mt-3 leading-relaxed">
                We may update these terms as the service evolves; the current
                version is always at this URL. Continued use after changes
                constitutes acceptance.
              </p>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
