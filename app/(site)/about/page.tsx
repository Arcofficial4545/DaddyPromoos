import type { Metadata } from "next";
import { BadgeCheck, Newspaper, RefreshCcw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PageHeader } from "@/components/marketing/PageHeader";

export const metadata: Metadata = {
  title: "About DaddyPromoos",
  description:
    "Who we are and why DaddyPromoos exists: independent, research-based reviews of the AI app builders and coding tools founders use to ship software. Founded by Abdul Rehman Ch.",
  alternates: { canonical: "/about" },
};

const principles = [
  {
    icon: Newspaper,
    title: "Written for founders who ship",
    body: "We cover the AI app builders and coding tools that take a product from idea to launch, and we write for the person choosing one — often a founder who doesn't write code.",
  },
  {
    icon: BadgeCheck,
    title: "Research, with the catch up front",
    body: "Every review is researched against the vendor's official documentation and pricing, scored on the same five criteria, and says who should skip the tool as plainly as who should use it.",
  },
  {
    icon: RefreshCcw,
    title: "Dated, not evergreen",
    body: "AI tools change monthly. Reviews show when they were last updated and link to the vendor's own pricing page, so you can check what's current before you pay.",
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
    bio: "Ahmed leads engineering: the site, its data, and the publishing tools that keep reviews and pricing details current.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        title="Independent reviews for founders building with AI"
        description="DaddyPromoos researches the AI app builders and coding tools founders use to ship, scores them from 0 to 10, and says who each one is for — and who should skip it."
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
              DaddyPromoos started with a simple frustration. Choosing an AI
              builder means wading through launch hype, roundups that rate
              everything highly, and pricing pages built on credits nobody
              explains. Founders who can&apos;t read code have the most to lose
              from a wrong pick, and the least ability to tell.
            </p>
            <p>
              So we do the research: official documentation and pricing, the
              public track record, and how each tool&apos;s costs actually scale.
              Then we score it on five criteria, say who it&apos;s for and who
              should skip it, and compare it head to head with the
              alternatives. No company can pay for coverage or a rating. When
              we hand out a score, the number is ours alone.
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
                  So we do it differently. We research each tool against its
                  official docs and pricing, score it on the same five criteria,
                  and say the catch out loud. If a tool isn&apos;t right for
                  you, we would rather point you to the one that is.
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
