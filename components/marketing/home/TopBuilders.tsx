import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { ScoreBadge } from "@/components/marketing/company/ScoreBadge";
import { Reveal } from "@/components/motion/Reveal";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

export type RankedBuilder = {
  name: string;
  slug: string;
  logoUrl: string | null;
  themeColor: string | null;
  score: number | null;
  /** "Best overall", "Best all-in-one"… (see TOP_BUILDERS). */
  label: string;
  /** First sentence of the verdict. */
  verdict: string | null;
  /** The review's "Best for" line. */
  bestFor: string | null;
  /** The store's affiliate URL exactly as stored, else its website. */
  tryHref: string;
};

/**
 * Homepage ranking under the hero: our top-rated AI app builders, best first.
 * The #1 pick gets the feature card and the rest are compact rows — scores,
 * who each one suits, and the review, like any "best of" list.
 */
export function TopBuilders({ builders }: { builders: RankedBuilder[] }) {
  if (builders.length === 0) return null;
  const [top, ...rest] = builders;

  return (
    <Section tone="mint">
      <Container size="wide">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
                Our rankings
              </p>
              <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
                The best AI app builders right now
              </h2>
              <p className="mt-2 max-w-xl text-ink-muted">
                Each one scored 0–10 against its official docs and pricing.
                Start with our top pick, or match a builder to what you&apos;re
                making.
              </p>
            </div>
            <Link
              href="/how-we-review"
              className="group inline-flex items-center gap-1 text-sm font-semibold text-pine hover:text-emerald-600"
            >
              How we score
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Reveal className="h-full">
            <TopPick builder={top} />
          </Reveal>

          {rest.length > 0 && (
            <Reveal delay={0.08} className="h-full">
              <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-white shadow-xs">
                <ol className="divide-y divide-line">
                  {rest.map((b, i) => (
                    <RankRow key={b.slug} rank={i + 2} builder={b} />
                  ))}
                </ol>
                <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 border-t border-line px-5 py-4 text-sm font-semibold">
                  <Link
                    href="/categories/no-code-app-builders"
                    className="text-pine hover:text-emerald-600"
                  >
                    All AI app builders →
                  </Link>
                  <Link
                    href="/build-with-ai"
                    className="text-pine hover:text-emerald-600"
                  >
                    How to choose one →
                  </Link>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </Container>
    </Section>
  );
}

function TopPick({ builder: b }: { builder: RankedBuilder }) {
  return (
    <article className="relative isolate flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] bg-pine p-6 text-white shadow-md sm:p-8">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-20 -z-10 h-72 w-72 rounded-full bg-emerald/25 blur-3xl"
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rounded-full bg-emerald px-2.5 py-1 font-mono text-[0.65rem] font-bold tracking-[0.15em] text-pine-900 uppercase">
          #1 · Our top pick
        </span>
        <span className="font-mono text-[0.65rem] font-semibold tracking-[0.15em] text-mint/70 uppercase">
          {b.label}
        </span>
      </div>

      <div className="mt-6 flex items-center gap-4">
        {/* White tile so a dark logo stays visible on pine. */}
        <span className="inline-flex shrink-0 rounded-2xl bg-white p-1.5 shadow-sm">
          <StoreLogo
            name={b.name}
            logoUrl={b.logoUrl}
            themeColor={b.themeColor}
            size="md"
          />
        </span>
        <h3 className="min-w-0 flex-1 truncate font-display text-3xl font-bold">
          {b.name}
        </h3>
        {b.score !== null && (
          <div className="shrink-0 text-right">
            <p className="font-mono text-4xl leading-none font-bold text-emerald">
              {b.score.toFixed(1)}
              <span className="text-base font-normal text-mint/60">/10</span>
            </p>
            <p className="mt-1 font-mono text-[0.65rem] tracking-wider text-mint/60 uppercase">
              Our score
            </p>
          </div>
        )}
      </div>

      {b.verdict && (
        <p className="mt-6 text-body-lg leading-relaxed text-mint/90">
          {b.verdict}
        </p>
      )}
      {b.bestFor && (
        <p className="mt-4 text-sm leading-relaxed text-mint/75">
          <span className="font-semibold text-white">Best for:</span>{" "}
          {b.bestFor}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-3 pt-7">
        <a
          href={b.tryHref}
          target="_blank"
          rel="sponsored nofollow noopener"
          className="btn-gloss btn-primary press-down inline-flex h-11 items-center gap-2 rounded-[var(--radius-btn)] px-5 text-sm font-semibold"
        >
          Try {b.name}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <Link
          href={`/tools/${b.slug}`}
          className="btn-gloss btn-glass-dark press-down inline-flex h-11 items-center gap-2 rounded-[var(--radius-btn)] px-5 text-sm font-semibold"
        >
          Read the review
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

function RankRow({ rank, builder: b }: { rank: number; builder: RankedBuilder }) {
  return (
    <li className="group relative flex items-center gap-3 px-4 py-4 transition-colors hover:bg-mint/40 sm:gap-4 sm:px-5">
      <span className="w-5 shrink-0 text-center font-mono text-sm font-bold text-ink-subtle">
        {rank}
      </span>
      <StoreLogo
        name={b.name}
        logoUrl={b.logoUrl}
        themeColor={b.themeColor}
        size="md"
      />
      <div className="min-w-0 flex-1">
        {/* The whole row opens the review; the Visit button sits above it. */}
        <Link
          href={`/tools/${b.slug}`}
          className="font-display text-lg font-semibold text-ink after:absolute after:inset-0 group-hover:text-pine"
        >
          {b.name}
        </Link>
        <p className="font-mono text-[0.65rem] font-semibold tracking-[0.12em] text-emerald-600 uppercase">
          {b.label}
        </p>
        {/* Too cramped to be useful beside the score on phones. */}
        {b.bestFor && (
          <p className="mt-1 hidden truncate text-sm text-ink-muted sm:block">
            {b.bestFor}
          </p>
        )}
      </div>
      {b.score !== null && <ScoreBadge score={b.score} size="sm" />}
      <a
        href={b.tryHref}
        target="_blank"
        rel="sponsored nofollow noopener"
        aria-label={`Visit ${b.name} (opens in a new tab)`}
        className="btn-gloss btn-secondary press-down relative z-10 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-btn)] px-3 text-sm font-semibold"
      >
        <span className="hidden sm:inline">Visit</span>
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    </li>
  );
}
