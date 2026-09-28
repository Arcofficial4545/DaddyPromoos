import Link from "next/link";
import { ExternalLink } from "lucide-react";

type ScoreCardProps = {
  score: number | null;
  toolName: string;
  /** Tracked /go destination for the primary CTA. */
  goHref: string;
  /** When true, hides the "Ways to start" secondary CTA. */
  hideStartCta?: boolean;
};

const R = 52;
const CIRC = 2 * Math.PI * R;

/**
 * The editorial Score Card (Section 7.2). A large mono numeral inside a thin
 * emerald arc (= score/10), the "DaddyPromoos score" label, a link to the
 * methodology, and the primary "Visit {tool}" CTA. Null score → "Review in
 * progress" so the page still works as a profile.
 */
export function ScoreCard({
  score,
  toolName,
  goHref,
  hideStartCta,
}: ScoreCardProps) {
  const pct = score !== null ? Math.max(0, Math.min(1, score / 10)) : 0;

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-center shadow-sm">
      {score !== null ? (
        <div className="relative mx-auto h-32 w-32">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="var(--color-line-strong)"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke="var(--color-emerald)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-4xl font-bold tracking-tight text-pine">
              {score.toFixed(1)}
            </span>
            <span className="font-mono text-[0.6rem] tracking-wider text-ink-subtle">
              / 10
            </span>
          </div>
        </div>
      ) : (
        <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-dashed border-line-strong">
          <span className="px-4 text-sm font-medium text-ink-subtle">
            Review in progress
          </span>
        </div>
      )}

      <p className="mt-4 font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
        {score !== null ? "DaddyPromoos score" : "Not yet scored"}
      </p>
      <Link
        href="/how-we-review"
        className="mt-1 inline-block text-xs font-medium text-emerald-600 hover:underline"
      >
        How we review &rarr;
      </Link>

      <a
        href={goHref}
        target="_blank"
        rel="sponsored noopener"
        className="btn-gloss btn-primary press-down mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] text-sm font-semibold"
      >
        Visit {toolName}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
      {!hideStartCta && (
        <a
          href="#get-started"
          className="mt-2 flex h-10 w-full items-center justify-center rounded-[var(--radius-btn)] border border-line text-sm font-medium text-ink-muted transition-colors hover:border-emerald-600 hover:text-pine"
        >
          Ways to start
        </a>
      )}
    </div>
  );
}
