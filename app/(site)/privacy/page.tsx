import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What DaddyPromoos collects, what it never collects, and your choices.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy policy" />
      <Section>
        <Container size="narrow">
          <div className="space-y-8 text-ink-muted">
            <div>
              <h2 className="text-h4 font-bold text-pine">What we collect</h2>
              <p className="mt-3 leading-relaxed">
                When you use an outbound deal link, we record the deal that was
                clicked, the page it was clicked from, an anonymized (hashed)
                browser signature, and a country-level location where
                available. We never store your IP address, name, or any
                directly identifying information from browsing.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">What you give us</h2>
              <p className="mt-3 leading-relaxed">
                If you subscribe to the newsletter we store your email address
                and where on the site you subscribed. If you contact us we
                store your name, email, and message so we can reply.
                Unsubscribe links are in every email, and you can request
                deletion of any of this data at any time.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">Cookies</h2>
              <p className="mt-3 leading-relaxed">
                We use a small number of first-party cookies: one to remember
                that you dismissed a popup (so we don&apos;t show it again),
                and a session cookie for site administrators. No third-party
                advertising or cross-site tracking cookies are set.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">Third parties</h2>
              <p className="mt-3 leading-relaxed">
                Outbound links take you to stores whose privacy practices are
                their own; some of those links are partner links as described
                in our disclosure. We do not sell or share the data described
                above with anyone.
              </p>
            </div>
            <div>
              <h2 className="text-h4 font-bold text-pine">Contact</h2>
              <p className="mt-3 leading-relaxed">
                Privacy questions or deletion requests: use the contact page
                and we will respond within two business days.
              </p>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
