import { cn } from "@/lib/utils";

/**
 * Quiet inline affiliate disclosure (Section 11.4) placed near monetized CTAs
 * on review, comparison, and deals pages. Ink-subtle, body-sm — no badge, no
 * banner.
 */
export function DisclosureLine({ className }: { className?: string }) {
  return (
    <p className={cn("text-sm text-ink-subtle", className)}>
      We may earn a commission if you buy through links on DaddyPromoos. This never
      affects our scores or verdicts.
    </p>
  );
}
