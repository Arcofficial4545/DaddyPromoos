import { ArrowRight, BadgeCheck } from "lucide-react";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import type { PromoData } from "@/lib/promos/resolve";
import { cn } from "@/lib/utils";

type PromoCardProps = {
  promo: PromoData;
  /** Compact for narrow rails, banner for full-width bands. */
  variant?: "card" | "rail" | "banner";
  className?: string;
};

/**
 * Presentational promo unit. Pure and client-safe (used by the server
 * PromoSlot and the client popup manager). Solid fills only.
 */
/** Outbound promo links open in a new tab and are marked as paid; internal
 * ones (e.g. /build-with-ai) stay plain. */
function externalLinkProps(url: string) {
  return /^https?:\/\//i.test(url)
    ? { target: "_blank", rel: "sponsored nofollow noopener" }
    : {};
}

export function PromoCard({ promo, variant = "card", className }: PromoCardProps) {
  if (promo.type === "newsletter") {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-card)] bg-pine p-6 text-white",
          variant === "banner" &&
            "flex flex-wrap items-center justify-between gap-6 sm:p-8",
          className,
        )}
      >
        <div className={variant === "banner" ? "max-w-md" : ""}>
          <p className="font-display text-lg leading-snug font-bold">
            {promo.payload.title ?? "New reviews and build guides, every week"}
          </p>
          {promo.payload.body && (
            <p className="mt-2 text-sm leading-relaxed text-mint/80">
              {promo.payload.body}
            </p>
          )}
        </div>
        <NewsletterForm source={`promo-${promo.placement}`} className="mt-4" />
      </div>
    );
  }

  // Image banner (e.g. an affiliate program's official creative): the image
  // links to the CTA URL exactly as entered, labelled as an ad.
  if (
    promo.type === "custom-card" &&
    promo.payload.imageUrl &&
    promo.payload.ctaUrl
  ) {
    return (
      <figure className={cn("not-prose", className)}>
        <figcaption className="mb-1.5 text-[0.65rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
          Advertisement
        </figcaption>
        <a
          href={promo.payload.ctaUrl}
          {...externalLinkProps(promo.payload.ctaUrl)}
          className="block overflow-hidden rounded-[var(--radius-card)]"
        >
          {/* A third-party creative, served exactly as the program supplies
              it — not through next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={promo.payload.imageUrl}
            alt={promo.payload.title ?? "Advertisement"}
            loading="lazy"
            className="h-auto w-full"
          />
        </a>
      </figure>
    );
  }

  if (promo.type === "custom-card") {
    return (
      <div
        className={cn(
          "rounded-[var(--radius-card)] border border-mint-200 bg-mint p-6",
          variant === "banner" &&
            "flex flex-wrap items-center justify-between gap-6 sm:p-8",
          className,
        )}
      >
        <div className={variant === "banner" ? "max-w-xl" : ""}>
          <p className="font-display text-lg leading-snug font-bold text-pine">
            {promo.payload.title}
          </p>
          {promo.payload.body && (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {promo.payload.body}
            </p>
          )}
        </div>
        {promo.payload.ctaUrl && (
          <a
            href={promo.payload.ctaUrl}
            {...externalLinkProps(promo.payload.ctaUrl)}
            className="btn-gloss btn-pine press-down mt-4 inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-btn)] px-4 text-sm font-semibold"
          >
            {promo.payload.ctaLabel ?? "Learn more"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>
    );
  }

  // coupon-highlight
  const coupon = promo.coupon;
  if (!coupon) return null;
  const goHref = `/go/${coupon.id}?promo=${promo.id}`;

  if (variant === "banner") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-6 rounded-[var(--radius-card)] bg-pine p-6 text-white sm:p-8",
          className,
        )}
      >
        <div className="flex min-w-0 items-center gap-4">
          <StoreLogo name={coupon.store.name} logoUrl={coupon.store.logoUrl} size="md" />
          <div className="min-w-0">
            <p className="font-mono text-2xl font-bold text-emerald">
              {coupon.discountLabel}
            </p>
            <p className="mt-1 font-display text-lg leading-snug font-semibold">
              {promo.payload.title ?? coupon.title}
            </p>
            {promo.payload.body && (
              <p className="mt-1 text-sm text-mint/80">{promo.payload.body}</p>
            )}
          </div>
        </div>
        <a
          href={goHref}
          target="_blank"
          rel="sponsored nofollow noopener"
          className="btn-gloss btn-primary press-down inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-btn)] px-5 text-sm font-semibold"
        >
          {promo.payload.ctaLabel ?? "See the offer"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] border border-mint-200 bg-mint",
        variant === "rail" ? "p-4" : "p-5",
        className,
      )}
    >
      <p className="text-[0.65rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
        Editor&apos;s pick
      </p>
      <div className="mt-3 flex items-center gap-2.5">
        <StoreLogo name={coupon.store.name} logoUrl={coupon.store.logoUrl} size="sm" />
        <span className="truncate text-sm font-semibold text-pine">
          {coupon.store.name}
        </span>
        {coupon.isVerified && (
          <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
        )}
      </div>
      <p className="mt-3 font-mono text-xl font-bold text-pine">
        {coupon.discountLabel}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{coupon.title}</p>
      <a
        href={goHref}
        target="_blank"
        rel="sponsored nofollow noopener"
        className="btn-gloss btn-primary press-down mt-4 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[var(--radius-btn)] text-sm font-semibold"
      >
        {promo.payload.ctaLabel ?? "See the offer"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}
