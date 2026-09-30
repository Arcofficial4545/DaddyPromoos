import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import type { SpotlightItem } from "@/lib/picks";
import { cn } from "@/lib/utils";

/**
 * A full-width product banner: the product's tagline, who it suits, our
 * score, and a button to the product beside the review link. The copy comes
 * from the review — never discount or sale wording (Base44's terms), and
 * nothing that says a vendor sponsors us. Lays out by its own width
 * (container queries), so the same banner fits a page band or an article.
 */
export function ProductSpotlight({
  item,
  tone = "light",
  className,
}: {
  item: SpotlightItem;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";

  return (
    <aside
      aria-label={`Spotlight: ${item.name}`}
      className={cn(
        "@container relative isolate overflow-hidden rounded-[var(--radius-card)] border",
        dark ? "border-pine-700 bg-pine text-white" : "border-mint-200 bg-mint text-ink",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-24 -z-10 h-80 w-80 rounded-full bg-emerald/25 blur-3xl"
      />

      <div className="grid gap-5 p-6 sm:p-8 @xl:grid-cols-[auto_1fr] @xl:items-center @xl:gap-x-6 @4xl:grid-cols-[auto_1fr_auto] @4xl:gap-x-10">
        {/* White tile so dark logos stay visible on either tone. */}
        <span className="inline-flex w-fit rounded-2xl bg-white p-2 shadow-sm">
          <StoreLogo name={item.name} logoUrl={item.logoUrl} size="lg" />
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={cn(
                "font-mono text-[0.65rem] font-semibold tracking-[0.2em] uppercase",
                dark ? "text-emerald" : "text-emerald-600",
              )}
            >
              Spotlight
            </span>
            <span className="font-display font-semibold">{item.name}</span>
            {item.score !== null && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 font-mono text-xs",
                  dark
                    ? "border-white/20 text-mint/85"
                    : "border-emerald/40 bg-white text-pine",
                )}
              >
                {item.score.toFixed(1)}/10 in our review
              </span>
            )}
          </div>
          <p className="mt-2 font-display text-2xl leading-tight font-bold tracking-tight text-balance @2xl:text-3xl">
            {item.tagline}
          </p>
          {item.bestFor && (
            <p
              className={cn(
                "mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed",
                dark ? "text-mint/80" : "text-ink-muted",
              )}
            >
              <span className={cn("font-semibold", dark ? "text-white" : "text-ink")}>
                Best for:
              </span>{" "}
              {item.bestFor}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 @xl:col-start-2 @4xl:col-start-auto @4xl:flex-col">
          <a
            href={item.tryHref}
            target="_blank"
            rel="sponsored nofollow noopener"
            className="btn-gloss btn-primary press-down inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-5 text-sm font-semibold whitespace-nowrap"
          >
            Try {item.name}
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
          <Link
            href={`/tools/${item.slug}`}
            className={cn(
              "btn-gloss press-down inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-5 text-sm font-semibold whitespace-nowrap",
              dark ? "btn-glass-dark" : "btn-secondary",
            )}
          >
            Read our review
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </aside>
  );
}
