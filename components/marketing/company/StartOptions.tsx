import { ExternalLink } from "lucide-react";
import type { CouponWithStore } from "@/lib/db/repositories/coupons";
import { cn } from "@/lib/utils";

type StartOptionsProps = {
  offers: CouponWithStore[];
  /** Prefix each offer with its tool name (lists spanning several tools). */
  showStore?: boolean;
  /** Render as ended offers: muted, no outbound link. */
  ended?: boolean;
  className?: string;
};

/**
 * A tool's official offers — free plans, trials, education discounts — as an
 * editorial list for review, comparison, category, and article pages.
 *
 * Deliberately not the coupon-ticket UI: these pages are editorial, so each
 * offer reads as a line of fact with the brand's own domain named as the
 * source. Links go through the tracked /go redirect (rel="sponsored"). The
 * ticket UI stays on /deals.
 */
export function StartOptions({
  offers,
  showStore = false,
  ended = false,
  className,
}: StartOptionsProps) {
  if (offers.length === 0) return null;

  return (
    <ul className={cn("divide-y divide-line border-y border-line", className)}>
      {offers.map((offer) => {
        const source = sourceDomain(offer);
        return (
          <li
            key={offer.id}
            className={cn(
              "flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-8",
              ended && "opacity-60",
            )}
          >
            <div className="min-w-0">
              <p className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-emerald-600 uppercase">
                {showStore
                  ? `${offer.store.name} · ${offer.discountLabel}`
                  : offer.discountLabel}
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-ink">
                {offer.title}
              </p>
              {offer.terms && (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {offer.terms}
                </p>
              )}
              {offer.type === "code" && offer.code && !ended && (
                <p className="mt-2 text-sm text-ink-muted">
                  Code:{" "}
                  <span className="rounded border border-dashed border-emerald-600 bg-mint px-1.5 py-0.5 font-mono font-semibold text-pine">
                    {offer.code}
                  </span>
                </p>
              )}
            </div>

            {ended ? (
              <span className="shrink-0 font-mono text-xs tracking-widest text-ink-subtle uppercase">
                Ended
              </span>
            ) : (
              <a
                href={`/go/${offer.id}`}
                target="_blank"
                rel="sponsored noopener"
                className="btn-gloss btn-secondary press-down inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-[var(--radius-btn)] px-4 text-sm font-semibold"
              >
                {source ? `Open on ${source}` : `Visit ${offer.store.name}`}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The brand domain an offer lands on, e.g. "lovable.dev". */
function sourceDomain(offer: CouponWithStore): string | null {
  try {
    return new URL(offer.destinationUrl ?? offer.store.websiteUrl).hostname.replace(
      /^www\./,
      "",
    );
  } catch {
    return null;
  }
}
