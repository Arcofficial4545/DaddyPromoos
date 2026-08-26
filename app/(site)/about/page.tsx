import type { Metadata } from "next";
import { BadgeCheck, Newspaper, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "About DaddyPromoos",
  description:
    "Who we are, how we score tools, and why DaddyPromoos exists: independent reviews of AI tools and SaaS, paired with codes that actually work. Founded by Abdul Rehman Ch.",
  alternates: { canonical: "/about" },
};

const principles = [
  {
    icon: BadgeCheck,
    title: "Offers come from official sources",
    body: "We list what the brand publishes on its own pricing, education, or promotions page, and we link you straight there. We do not invent codes, and an offer only carries a verified stamp once a person has checked it and dated the check.",
  },
  {
    icon: Newspaper,
    title: "Editorial first",
    body: "We write reviews and comparisons the way we want to read them: opinionated, specific, and honest about the trade-offs. Deals support the coverage, never the other way round.",
  },
  {
    icon: RefreshCcw,
    title: "Dated, not evergreen",
    body: "SaaS pricing moves. Every pricing claim carries the date it was checked against the brand's own page, so you can see how fresh it is instead of taking our word for it.",
  },
];

const founders = [
  {
    name: "Abdul Rehman Ch",
    role: "Founder & CEO",
    initials: "AR",
    bio: "Abdul founded DaddyPromoos on a simple idea: buyers deserve reviews that name the catch, not just the praise. He sets the editorial standard and guards the rule that no company can pay for a score.",
  },
  {
    name: "Ahmed Raza Hassan",
    role: "Co-Founder & CTO",
    initials: "AH",
    bio: "Ahmed leads engineering and the systems behind our testing. He builds the tooling that lets us verify deals at scale and keep every score backed by real, repeatable checks.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="Independent reviews for people who read the fine print"
        description="DaddyPromoos covers AI tools, SaaS products, and digital services, scores them from 0 to 10, and pairs that coverage with verified codes so you never overpay for software again."
      />
      <Section>
        <Container>
          <div className="grid gap-5 md:grid-cols-3">
            {principles.map((principle) => (
              <Card key={principle.title} className="p-6">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-pine">
                  <principle.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                  {principle.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  {principle.body}
                </p>
              </Card>
            ))}
          </div>

          <div className="mx-auto mt-16 max-w-2xl space-y-5 text-body-lg leading-relaxed text-ink-muted">
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
              Why we exist
            </h2>
            <p>
              DaddyPromoos started with a simple irritation. Software buyers
              routinely pay 20 to 30 percent more than they need to, because
              working discounts are scattered across newsletters, partner pages,
              and expired listicles. We fix that by doing the tedious part,
              finding, testing, and re-testing offers, and publishing only what
              works.
            </p>
            <p>
              The editorial side exists because a discount is only useful if the
              product is worth buying. Our reviews and comparisons are written by
              people who use these tools every day, and no company can pay for
              coverage or a rating. When we hand out a score, the number is ours
              alone.
            </p>
            <p>
              Some outbound links earn us a commission at no cost to you. That is
              the business model, disclosed in full on our disclosure page. It
              has never changed a verdict, and it never will.
            </p>
          </div>

          {/* --------------------------------------------- Founders */}
          <div className="mx-auto mt-16 max-w-3xl">
            <h2 className="text-center font-display text-2xl font-bold tracking-tight text-ink">
              Meet the founders
            </h2>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {founders.map((person) => (
                <div
                  key={person.name}
                  className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine font-display text-lg font-bold text-mint"
                      aria-hidden="true"
                    >
                      {person.initials}
                    </span>
                    <div>
                      <p className="font-display text-lg font-semibold text-ink">
                        {person.name}
                      </p>
                      <p className="font-mono text-xs tracking-wide text-ink-subtle uppercase">
                        {person.role}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-ink-muted">
                    {person.bio}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* --------------------------------------------- Founder note */}
          <div className="mx-auto mt-10 max-w-2xl">
            <figure className="rounded-[var(--radius-card)] border border-line bg-mint/40 p-8 sm:p-10">
              <blockquote className="space-y-4 text-body leading-relaxed text-ink-muted">
                <p>
                  I built DaddyPromoos because I was tired of buying software on
                  faith. The reviews I could find were either paid placements
                  dressed up as opinion, or thin roundups that never told me the
                  one thing I actually needed to know, which is where the tool
                  falls short.
                </p>
                <p>
                  So we do it differently. We test each tool the way a real user
                  would, we score it honestly, and we say the catch out loud.
                  Then, once you have decided what to buy, we make sure you start
                  on the best honest price we can find. Proof first, price
                  second, in that order and never the reverse.
                </p>
                <p>
                  If we ever publish a score you cannot trust, we have failed at
                  the only job that matters. My inbox is open if we get it wrong.
                </p>
              </blockquote>

              <figcaption className="mt-6 font-display text-base font-semibold text-pine">
                Abdul Rehman Ch
                <span className="ml-2 font-sans text-sm font-normal text-ink-subtle">
                  Founder &amp; CEO, DaddyPromoos
                </span>
              </figcaption>
            </figure>
          </div>
        </Container>
      </Section>
    </>
  );
}
