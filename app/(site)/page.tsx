import Link from "next/link";
import { cacheLife } from "next/cache";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { CouponGrid } from "@/components/coupon/CouponGrid";
import type { TicketCoupon } from "@/components/coupon/CouponTicket";
import { toTicketCoupon } from "@/components/coupon/toTicketCoupon";
import { CategoryIcon } from "@/components/marketing/CategoryIcon";
import { Hero } from "@/components/marketing/hero/Hero";
import { LogoMarquee } from "@/components/marketing/LogoMarquee";
import { NewsletterForm } from "@/components/marketing/NewsletterForm";
import {
  FeaturedComparison,
  type Matchup,
} from "@/components/marketing/home/FeaturedComparison";
import {
  RotatingReviews,
  type ReviewItem,
} from "@/components/marketing/home/RotatingReviews";
import { Reveal } from "@/components/motion/Reveal";
import { PromoSlot } from "@/components/promo/PromoSlot";
import { listPublishedComparisons } from "@/lib/db/repositories/comparisons";
import { listCategories } from "@/lib/db/repositories/categories";
import {
  countActiveCoupons,
  listActiveCoupons,
} from "@/lib/db/repositories/coupons";
import { listPublishedPosts } from "@/lib/db/repositories/posts";
import { listReviewedStores } from "@/lib/db/repositories/stores";
import { formatDate } from "@/lib/utils";

/**
 * Rendered on demand rather than prerendered. Build-time static generation of
 * this route exhausted all three 300s attempts and failed the deployment: the
 * seven-query fan-out below starves the Supabase transaction pooler, and
 * postgres.js has no query timeout, so a starved query hangs indefinitely.
 * `getHomeData`'s `"use cache"` still absorbs the round trips at runtime.
 */
export const dynamic = "force-dynamic";

/** Everything the homepage reads from the DB, already narrowed to what the
 * components render. Marked `"use cache"` so the fan-out below runs once per
 * revalidate window rather than once per render — ISR only covers the built
 * page, so without this every dev request and every regeneration paid for the
 * full set of round trips again.
 *
 * `cacheLife` is the single cache config for this route. The route segment
 * `export const revalidate = 3600` that used to sit alongside it was
 * redundant: `cacheLife` sets the entry's explicit revalidate/expire/stale and
 * Next propagates those up to the route, which is why the build route table
 * reports an expire of 1d — a value the segment config cannot express.
 *
 * Per-visit rotation of the hero chips, head-to-head band, and reviews happens
 * client-side in the browser, so caching here costs no variety.
 */
async function getHomeData() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86_400 });

  const [
    { coupons: featuredCoupons },
    couponCount,
    categories,
    { posts: latestPosts },
    reviewedStores,
    comparisons,
  ] = await Promise.all([
    listActiveCoupons({ sort: "featured", limit: 4 }),
    countActiveCoupons(),
    listCategories(),
    listPublishedPosts({ limit: 2 }),
    listReviewedStores(),
    listPublishedComparisons(),
  ]);

  // Slim data pools handed to the client components, which pick their random
  // selection on mount (keeps the page cacheable and the payload small).
  const reviewItems: ReviewItem[] = reviewedStores.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    categoryName: s.categories[0]?.name ?? null,
    logoUrl: s.logoUrl,
    themeColor: s.themeColor,
    editorialScore: s.editorialScore,
    verdict: s.verdict,
    updatedLabel: s.lastReviewedAt ? formatDate(s.lastReviewedAt) : null,
  }));

  const matchups: Matchup[] = comparisons.map((c) => ({
    title: c.title,
    subtitle: c.subtitle,
    slug: c.slug,
    storeAName: c.storeA.name,
    storeBName: c.storeB.name,
    criteria: c.criteria.map((r) => ({ label: r.label, winner: r.winner })),
  }));

  // Floating hero chips: the Hero pins the first entry (our flagship) and
  // shuffles the rest. Lovable's card and the featured Lovable-vs-Cursor VS
  // chip go first so the flagship is always visible; everything else rotates.
  const scored = reviewedStores.filter((s) => s.editorialScore !== null);
  const heroCards = [
    ...scored.filter((s) => s.slug === "lovable"),
    ...scored.filter((s) => s.slug !== "lovable"),
  ].map((s) => ({
    name: s.name,
    score: s.editorialScore as number,
    logoUrl: s.logoUrl,
  }));
  // comparisons[0] is the featured matchup (DB orders isFeatured first), so the
  // VS chips already lead with Lovable vs Cursor.
  const heroVsChips = comparisons.map((c) => ({
    a: c.storeA.name,
    b: c.storeB.name,
    slug: c.slug,
  }));

  // Quick tags stay deterministic (a fast path in, no need to rotate).
  const quickTags = [
    ...(comparisons[0]
      ? [
          {
            label: comparisons[0].title,
            href: `/compare/${comparisons[0].slug}`,
          },
        ]
      : []),
    ...categories
      .slice(0, 3)
      .map((c) => ({ label: c.name, href: `/categories/${c.slug}` })),
  ];

  return {
    featuredCoupons: featuredCoupons.map(toTicketCoupon) as TicketCoupon[],
    couponCount,
    categories,
    // Drop `contentJson` and friends — the cards render only these fields, and
    // the full Tiptap body would otherwise be serialized into the cache entry.
    posts: latestPosts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      publishedAt: p.publishedAt,
      readingMinutes: p.readingMinutes,
      categoryName: p.category?.name ?? null,
    })),
    reviewItems,
    matchups,
    heroCards,
    heroVsChips,
    quickTags,
    toolsReviewed: reviewedStores.length,
    comparisonsCount: comparisons.length,
  };
}

/** Kicker + left-aligned title, with an optional trailing link. */
function SectionHead({
  kicker,
  title,
  description,
  href,
  linkLabel,
}: {
  kicker: string;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
          {kicker}
        </p>
        <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-xl text-ink-muted">{description}</p>
        )}
      </div>
      {href && linkLabel && (
        <Button href={href} variant="secondary" size="sm">
          {linkLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export default async function HomePage() {
  const {
    featuredCoupons,
    couponCount,
    categories,
    posts: latestPosts,
    reviewItems,
    matchups,
    heroCards,
    heroVsChips,
    quickTags,
    toolsReviewed,
    comparisonsCount,
  } = await getHomeData();

  return (
    <>
      <Hero
        toolsReviewed={toolsReviewed}
        comparisonsCount={comparisonsCount}
        dealsCount={couponCount}
        cards={heroCards}
        vsChips={heroVsChips}
        quickTags={quickTags}
      />

      <LogoMarquee
        logos={reviewItems.map((s) => ({
          name: s.name,
          logoUrl: s.logoUrl,
        }))}
      />

      <Container size="wide" className="mt-10">
        <PromoSlot placement="home-banner" path="/" />
      </Container>

      {/* ============================================= Latest reviews (rows) */}
      {reviewItems.length > 0 && (
        <Section>
          <Container size="wide">
            <Reveal>
              <SectionHead
                kicker="Latest reviews"
                title="Read the trade-offs first"
                description="Independent, scored editorial coverage — the verdict states the catch, not just the praise."
                href="/reviews"
                linkLabel="All reviews"
              />
            </Reveal>
            <RotatingReviews reviews={reviewItems} />
          </Container>
        </Section>
      )}

      {/* ==================================== Featured comparison (pine band) */}
      <FeaturedComparison matchup={matchups[0] ?? null} />

      {/* ------------------------------------------- Browse by category (rows) */}
      <Section>
        <Container size="wide">
          <Reveal>
            <SectionHead
              kicker="Categories"
              title="Browse by what you're shopping for"
            />
          </Reveal>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="group flex items-center gap-4 py-4 transition-colors hover:bg-mint/40"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-pine">
                    <CategoryIcon name={category.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold text-ink group-hover:text-pine">
                      {category.name}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {category.description}
                    </p>
                  </div>
                  <span className="hidden shrink-0 font-mono text-xs text-ink-subtle sm:block">
                    {category.storeCount}{" "}
                    {category.storeCount === 1 ? "tool" : "tools"}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-pine"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ============================================= Deals strip (secondary) */}
      <Section tone="mint" padding="tight">
        <Container size="wide">
          <SectionHead
            kicker="Deals"
            title="A few worth grabbing"
            href="/deals"
            linkLabel="All deals"
          />
          <CouponGrid
            coupons={featuredCoupons}
            className="mt-6"
          />
        </Container>
      </Section>

      {/* ------------------------------------------ From the blog (2 wide) */}
      {latestPosts.length > 0 && (
        <Section>
          <Container size="wide">
            <Reveal>
              <SectionHead
                kicker="From the blog"
                title="Have a look at our latest articles"
                href="/blog"
                linkLabel="All articles"
              />
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {latestPosts.map((post, i) => (
                <Reveal key={post.id} delay={i * 0.08}>
                  <Card
                    interactive
                    className="relative flex h-full flex-col p-6 sm:p-7"
                  >
                    <p className="font-mono text-xs text-ink-subtle">
                      {post.publishedAt ? formatDate(post.publishedAt) : ""}
                      {post.categoryName ? ` · ${post.categoryName}` : ""}
                      {` · ${post.readingMinutes} min read`}
                    </p>
                    <h3 className="mt-3 font-display text-2xl leading-snug font-semibold text-ink">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="after:absolute after:inset-0"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-3 line-clamp-3 text-ink-muted">
                      {post.excerpt}
                    </p>
                    <p className="mt-auto pt-5 text-sm font-semibold text-pine">
                      Read article
                    </p>
                  </Card>
                </Reveal>
              ))}
            </div>
          </Container>
        </Section>
      )}

      {/* ---------------------------------------------- Newsletter band */}
      <Section tone="pine" padding="default">
        <Container className="flex flex-col items-center text-center">
          <Reveal>
            <h2 className="max-w-xl font-display text-3xl font-bold text-white">
              The tools worth your money
            </h2>
            <p className="mx-auto mt-3 max-w-md text-mint/85">
              One email a week — the latest reviews, comparisons, and deals
              worth knowing about. No noise, unsubscribe anytime.
            </p>
            <div className="mt-7 flex justify-center">
              <NewsletterForm source="home-band" />
            </div>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
