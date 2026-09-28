import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { DisclosureLine } from "@/components/marketing/DisclosureLine";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

export type TopPickData = {
  name: string;
  slug: string;
  logoUrl: string | null;
  themeColor: string | null;
  score: number | null;
  verdict: string | null;
  /** Tracked /go destination, or the brand URL when no offer exists. */
  goHref: string;
  ctaLabel: string;
  guides: { title: string; href: string }[];
  comparisons: { title: string; href: string }[];
};

/**
 * Homepage "where to start" band: our top pick for founders who don't write
 * code, its verdict (catch included), the guides that take a reader from
 * choosing to launching, and one clearly disclosed outbound CTA. It sits high
 * on the page so a first-time visitor sees what the site is for — and which
 * tool we'd start them on — before anything else.
 */
export function TopPick({ pick }: { pick: TopPickData }) {
  return (
    <Section tone="mint">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <Reveal className="lg:col-span-7">
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
              Where to start · Our top pick
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Building an app without a developer? Start with {pick.name}.
            </h2>
            {pick.verdict && (
              <p className="mt-4 max-w-2xl text-body-lg leading-relaxed text-ink-muted">
                {pick.verdict}
              </p>
            )}
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={pick.goHref}
                target="_blank"
                rel="sponsored noopener"
                className="btn-gloss btn-primary press-down inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-6 text-sm font-semibold"
              >
                {pick.ctaLabel}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
              <Link
                href={`/tools/${pick.slug}`}
                className="btn-gloss btn-secondary press-down inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-6 text-sm font-semibold"
              >
                Read our {pick.name} review
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <DisclosureLine className="mt-3 text-xs" />
          </Reveal>

          <Reveal delay={0.08} className="lg:col-span-5">
            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <StoreLogo
                  name={pick.name}
                  logoUrl={pick.logoUrl}
                  themeColor={pick.themeColor}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold text-ink">
                    {pick.name}
                  </p>
                  <p className="font-mono text-xs text-ink-subtle">
                    DaddyPromoos score
                  </p>
                </div>
                {pick.score !== null && (
                  <span className="font-mono text-2xl font-bold text-pine">
                    {pick.score.toFixed(1)}
                    <span className="text-xs font-normal text-ink-subtle">
                      /10
                    </span>
                  </span>
                )}
              </div>

              {pick.guides.length > 0 && (
                <>
                  <p className="mt-6 font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                    From idea to launch
                  </p>
                  <ol className="mt-2 divide-y divide-line">
                    {pick.guides.map((guide, i) => (
                      <li key={guide.href}>
                        <Link
                          href={guide.href}
                          className="group flex items-start gap-3 py-3 text-sm font-medium text-ink hover:text-pine"
                        >
                          <span className="mt-px font-mono text-xs text-emerald-600">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="flex-1">{guide.title}</span>
                          <ArrowRight
                            className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-pine"
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    ))}
                  </ol>
                </>
              )}

              {pick.comparisons.length > 0 && (
                <>
                  <p className="mt-5 font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                    Head-to-heads
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pick.comparisons.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className="rounded-full border border-line px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-emerald-600 hover:text-pine"
                      >
                        {c.title}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
