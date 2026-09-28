import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "How We Make Money",
  description:
    "DaddyPromoos's disclosure: some links earn us a commission at no cost to you. Here's exactly how that works and what it never affects.",
  alternates: { canonical: "/disclosure" },
};

export default function DisclosurePage() {
  return (
    <>
      <PageHeader title="How we make money" />
      <Section>
        <Container size="narrow">
          <div className="space-y-5 text-body-lg leading-relaxed text-ink-muted">
            <p>
              When you click through to a tool from DaddyPromoos and sign up
              or buy, we may earn a commission from that company. This costs
              you nothing — prices are identical whether you arrive through our
              links or not.
            </p>
            <p>
              These commissions are how we fund the work: researching and
              writing reviews, comparisons, and guides. Not every link earns us
              anything, and we cover plenty of tools we have no relationship
              with, because the right tool is the right tool.
            </p>
            <p>
              What this never changes: our coverage. Companies cannot pay for a
              review, a rating, a ranking, or a place on the site. If a
              product is not worth your money, we say so — commission or not.
            </p>
            <p>
              Questions about any of this? Ask us directly through the{" "}
              <a href="/contact" className="font-medium text-pine underline decoration-emerald underline-offset-4 hover:text-emerald-600">
                contact page
              </a>
              , or read about{" "}
              <a href="/how-we-review" className="font-medium text-pine underline decoration-emerald underline-offset-4 hover:text-emerald-600">
                how we research and score tools
              </a>
              .
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
