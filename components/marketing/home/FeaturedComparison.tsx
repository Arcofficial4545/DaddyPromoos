import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";

export type MatchupSide = {
  name: string;
  slug: string;
  logoUrl: string | null;
  themeColor: string | null;
  score: number | null;
};

export type Matchup = {
  title: string;
  subtitle: string;
  slug: string;
  a: MatchupSide;
  b: MatchupSide;
  /** "Choose {A} if…" */
  verdictA: string;
  /** "Choose {B} if…" */
  verdictB: string;
  criteria: { label: string; winner: "a" | "b" | "tie" }[];
};

/** "Choose Lovable if you want…" → "You want…" (the label already says it). */
function withoutChoosePrefix(text: string, name: string): string {
  const prefix = `Choose ${name} if `;
  if (!text.toLowerCase().startsWith(prefix.toLowerCase())) return text;
  const rest = text.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * The homepage "head-to-head" band. The page picks a different published
 * comparison on every request, so this shows one matchup per visit: both
 * tools with their scores, when to choose each, and the criteria rows with
 * the winner marked on its side. Server-rendered and SEO-visible.
 */
export function FeaturedComparison({ matchup }: { matchup: Matchup | null }) {
  if (!matchup) return null;
  const { a, b } = matchup;
  const verdicts = [
    { side: a, text: matchup.verdictA },
    { side: b, text: matchup.verdictB },
  ].filter((v) => v.text);

  return (
    <Section tone="pine">
      <Container size="wide">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-mint/70 uppercase">
              Head-to-head
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {matchup.title}
            </h2>
            {matchup.subtitle && (
              <p className="mt-3 max-w-lg text-body-lg text-mint/85">
                {matchup.subtitle}
              </p>
            )}

            {verdicts.length > 0 && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {verdicts.map(({ side, text }) => (
                  <div
                    key={side.slug}
                    className="rounded-[var(--radius-card)] border border-white/10 bg-white/[0.04] p-4"
                  >
                    <p className="font-mono text-[0.65rem] font-semibold tracking-[0.15em] text-emerald uppercase">
                      Choose {side.name} if
                    </p>
                    <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-mint/85">
                      {withoutChoosePrefix(text, side.name)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={`/compare/${matchup.slug}`}
                className="btn-gloss btn-primary press-down inline-flex h-11 items-center gap-2 rounded-[var(--radius-btn)] px-6 text-sm font-semibold"
              >
                See the full comparison
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/compare"
                className="text-sm font-semibold text-mint/85 underline-offset-4 hover:text-white hover:underline"
              >
                All comparisons
              </Link>
            </div>
          </div>

          {/* Scoreboard: A on the left, B on the right, criteria between. */}
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-white/15 bg-white/[0.04]">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-white/10 p-5">
              <SideHeader side={a} />
              <span className="rounded-full border border-white/15 px-2.5 py-1 font-mono text-[0.65rem] font-bold tracking-widest text-emerald">
                VS
              </span>
              <SideHeader side={b} alignEnd />
            </div>
            {matchup.criteria.slice(0, 5).map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center border-b border-white/10 px-3 py-3 text-sm last:border-0 sm:grid-cols-[4.5rem_1fr_4.5rem]"
              >
                <Mark result={row.winner === "a" ? "win" : row.winner === "tie" ? "tie" : "none"} name={a.name} />
                <span className="text-center text-white/85">{row.label}</span>
                <Mark result={row.winner === "b" ? "win" : row.winner === "tie" ? "tie" : "none"} name={b.name} />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}

function SideHeader({ side, alignEnd }: { side: MatchupSide; alignEnd?: boolean }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${alignEnd ? "flex-row-reverse text-right" : ""}`}
    >
      <StoreLogo
        name={side.name}
        logoUrl={side.logoUrl}
        themeColor={side.themeColor}
        size="sm"
      />
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-white sm:text-base">
          {side.name}
        </p>
        {side.score !== null && (
          <p className="font-mono text-xs text-mint/60">
            {side.score.toFixed(1)}/10
          </p>
        )}
      </div>
    </div>
  );
}

function Mark({ result, name }: { result: "win" | "tie" | "none"; name: string }) {
  if (result === "win") {
    return (
      <span className="flex justify-center">
        <Check className="h-4 w-4 text-emerald" aria-hidden="true" />
        <span className="sr-only">{name} wins</span>
      </span>
    );
  }
  if (result === "tie") {
    return <span className="text-center font-mono text-xs text-mint/60">Tie</span>;
  }
  return (
    <span className="text-center text-white/25" aria-hidden="true">
      —
    </span>
  );
}
