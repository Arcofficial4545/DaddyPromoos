import { Card } from "@/components/ui/Card";

type VerdictCardProps = {
  verdict: string;
  score: number;
  lastReviewedAt: Date;
  useItFor: string;
  skipItIf: string;
  authorName?: string;
};

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function VerdictCard({
  verdict,
  score,
  lastReviewedAt,
  useItFor,
  skipItIf,
  authorName = "DaddyPromoos editor",
}: VerdictCardProps) {
  return (
    <Card tone="mint" className="p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8">
        {/* Score stamp */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <span className="font-mono text-4xl font-bold tracking-tight text-pine sm:text-5xl">
            {score.toFixed(1)}
          </span>
          <span className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
            / 10
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-base leading-relaxed font-medium text-ink sm:text-lg">
            {verdict}
          </p>
          <p className="mt-3 text-xs text-ink-subtle">
            Reviewed as of {formatMonthYear(lastReviewedAt)} by {authorName}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 border-t border-pine/10 pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold tracking-wide text-success uppercase">
            Use it for
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {useItFor}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-warning uppercase">
            Skip it if
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {skipItIf}
          </p>
        </div>
      </div>
    </Card>
  );
}
