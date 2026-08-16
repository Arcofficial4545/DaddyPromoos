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
              When you click through to a store from DaddyPromoos and make a
              purchase, we may earn a commission from that store. This costs
              you nothing — prices and discounts are identical whether you
              arrive through our links or not.
            </p>
            <p>
              These commissions are how we fund the work: testing codes,
              writing reviews, and keeping the deal feed current. Not every
              link earns us anything, and we list plenty of offers from stores
              we have no relationship with, because a good deal is a good deal.
            </p>
            <p>
              What this never changes: our coverage. Stores cannot pay for a
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
                how we verify offers and write reviews
              </a>
              .
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
