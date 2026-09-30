import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbLd, ogImageUrl } from "@/lib/seo/jsonld";

export const metadata: Metadata = {
  title: "How We Review — Our Methodology",
  description:
    "How DaddyPromoos researches, scores, and maintains its reviews — the five criteria, the 0–10 scale, where offers come from, how we use AI, and our independence statement.",
  alternates: { canonical: "/how-we-review" },
  openGraph: {
    title: "How We Review — DaddyPromoos",
    description: "Our methodology for researching and scoring tools.",
    images: [ogImageUrl("How We Review", "Our methodology")],
  },
};

const criteria = [
  {
    label: "Ease of use",
    body: "How quickly a capable person gets from signup to a real result, and how much the interface fights them along the way.",
  },
  {
    label: "Power & features",
    body: "Depth and ceiling — what the tool can do once you're past the happy path, and where it runs out of room.",
  },
  {
    label: "Output quality",
    body: "How good the actual result is, and how much human review it needs before you can rely on it.",
  },
  {
    label: "Pricing value",
    body: "What you get for the money against the alternatives — including free tiers, and how costs scale with real use.",
  },
  {
    label: "Support & docs",
    body: "Documentation, responsiveness, and how supported you feel when something breaks.",
  },
];

export default function HowWeReviewPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", href: "/" },
            { name: "How We Review", href: "/how-we-review" },
          ]),
        ]}
      />

      <Section tone="pine" padding="tight">
        <Container size="wide">
          <p className="font-mono text-xs font-semibold tracking-[0.2em] text-mint/70 uppercase">
            Methodology
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            How we review
          </h1>
          <p className="mt-4 max-w-2xl text-body-lg text-mint/85">
            No fabricated stats, no pay-to-play scores, no invented
            methodology. Here is exactly how a tool earns a score and where the
            offers on DaddyPromoos come from.
          </p>
        </Container>
      </Section>

      <Section>
        <Container className="max-w-3xl space-y-12">
          <div>
            <h2 className="font-display text-2xl font-bold text-pine">
              How we research
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              We research each product the way a careful buyer would: its
              official documentation and pricing, and the public track record
              of how it behaves for real users. We write the verdict before we
              look at any offer — the recommendation is never the product of
              what pays. Every review states a clear bottom line <em>and</em>{" "}
              the catch, because a review without a downside isn&apos;t a
              review.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-pine">
              The five criteria
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              Every tool is scored on the same five axes, each on a 0–10 scale.
              The headline DaddyPromoos score is our editorial read of how they
              add up for a typical buyer — not a raw average, and always ours.
            </p>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {criteria.map((c) => (
                <div key={c.label} className="py-4 sm:flex sm:gap-6">
                  <dt className="font-mono text-sm font-semibold tracking-wide text-pine sm:w-48 sm:shrink-0">
                    {c.label}
                  </dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-muted sm:mt-0">
                    {c.body}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-pine">
              The 0–10 scale
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              A score in the 8s is a tool we&apos;d recommend without much
              hesitation for the right buyer. The 7s are solid with real
              trade-offs worth knowing. Below that, proceed with your eyes open.
              We don&apos;t grade on a curve, and a high score is not a
              guarantee the tool is right for <em>you</em> — that&apos;s what the
              &ldquo;best for / not for&rdquo; and the comparisons are for.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-pine">
              Where offers come from
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              Offers on DaddyPromoos come from brands&apos; own pages — free
              plans, trials, education discounts, and published promotions —
              and every one links to the brand&apos;s official page. We never
              invent codes. Reviews show when they were last updated, but
              vendors change pricing often: confirm the current price on the
              vendor&apos;s own page before you pay. Usage counts only appear
              once there&apos;s real data behind them.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-pine">
              How we use AI
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              We use AI tools to help research and draft our coverage. Scores,
              verdicts, and what gets published are our own decisions.
            </p>
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold text-pine">
              Independence
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">
              DaddyPromoos may earn a commission when you buy through some links.
              That is how the site is funded, and it changes nothing about the
              scores or verdicts — a tool cannot buy a better review, and we say
              so plainly next to the links it applies to. If you ever think a
              score reads like marketing, tell us.
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-mint p-6">
            <p className="font-display text-base font-semibold text-pine">
              Questions about a review?
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              We&apos;re transparent about how this works.{" "}
              <Link
                href="/contact"
                className="font-medium text-pine underline hover:text-emerald-600"
              >
                Reach out
              </Link>{" "}
              if anything seems off, or read{" "}
              <Link
                href="/disclosure"
                className="font-medium text-pine underline hover:text-emerald-600"
              >
                how we make money
              </Link>
              .
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
