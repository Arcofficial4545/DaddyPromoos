import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, Minus } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { ArticleRenderer } from "@/components/blog/ArticleRenderer";
import type { TiptapNode } from "@/components/blog/tiptap";
import { DisclosureLine } from "@/components/marketing/DisclosureLine";
import { CtaBand } from "@/components/marketing/company/CtaBand";
import { FaqAccordion } from "@/components/marketing/company/FaqAccordion";
import { MobileCtaBar } from "@/components/marketing/company/MobileCtaBar";
import { PricingTable } from "@/components/marketing/company/PricingTable";
import { ScoreCard } from "@/components/marketing/company/ScoreCard";
import { ScorecardBars } from "@/components/marketing/company/ScorecardBars";
import { ScreenshotsStrip } from "@/components/marketing/company/ScreenshotsStrip";
import { StartOptions } from "@/components/marketing/company/StartOptions";
import { StickyNav } from "@/components/marketing/company/StickyNav";
import { VerdictBox } from "@/components/marketing/company/VerdictBox";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getComparisonForPair,
  listPublishedComparisonsForStore,
} from "@/lib/db/repositories/comparisons";
import { listCouponsForStore } from "@/lib/db/repositories/coupons";
import { listPostsForStore } from "@/lib/db/repositories/posts";
import {
  getStoreBySlug,
  getStoresBySlugs,
  hasCompleteReview,
} from "@/lib/db/repositories/stores";
import {
  breadcrumbLd,
  faqLd,
  ogImageUrl,
  ogReviewImageUrl,
  productLd,
  reviewLd,
} from "@/lib/seo/jsonld";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;
export const dynamicParams = true;

// Rendered on-demand, then cached via `revalidate` (v3-01) — keeps the build
// from querying the DB for every page as the roster grows.
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) return { title: "Tool not found" };
  const hasReview = hasCompleteReview(store);
  const title =
    store.seoTitle ??
    (hasReview
      ? `${store.name} Review: Pricing, Pros & Cons`
      : `${store.name} — Profile and Pricing`);
  const description =
    store.seoDescription ??
    (hasReview
      ? `Our independent ${store.name} review: verdict, 0–10 score, pricing, pros and cons, and alternatives. ${store.tagline}`
      : `${store.name} profile, pricing, and official offers. ${store.tagline}`);
  return {
    title,
    description,
    alternates: { canonical: `/tools/${store.slug}` },
    openGraph: {
      title,
      description,
      images: [
        store.ogImageUrl ??
          (hasReview
            ? ogReviewImageUrl(store.name, store.editorialScore)
            : ogImageUrl(store.name, store.tagline)),
      ],
    },
  };
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const store = await getStoreBySlug(slug);
  if (!store) notFound();

  const [{ active, expired }, guides, comparisons] = await Promise.all([
    listCouponsForStore(store.id),
    listPostsForStore(store.id, 4),
    listPublishedComparisonsForStore(store.id),
  ]);
  const hasReview = hasCompleteReview(store);
  const alternatives = store.alternativeSlugs?.length
    ? await getStoresBySlugs(store.alternativeSlugs)
    : [];
  const altCompare = await Promise.all(
    alternatives.map((a) => getComparisonForPair(store.id, a.id)),
  );
  const hasCoverage = guides.length > 0 || comparisons.length > 0;

  const bestDeal = active[0] ?? null;
  const goHref = bestDeal
    ? `/go/${bestDeal.id}`
    : store.affiliateBaseUrl ?? store.websiteUrl;

  const gallery = store.screenshots?.length
    ? store.screenshots
    : store.coverImageUrl
      ? [store.coverImageUrl]
      : [];

  // Sticky-nav sections, in Section 7.3 order, built from available content.
  const anchors: { id: string; label: string }[] = [];
  if (hasReview) anchors.push({ id: "overview", label: "Overview" });
  if (store.ratingBreakdown?.length)
    anchors.push({ id: "scorecard", label: "Scorecard" });
  if (store.pricingSummary?.length)
    anchors.push({ id: "pricing", label: "Pricing" });
  if (store.goodPoints?.length && store.weakPoints?.length)
    anchors.push({ id: "pros-cons", label: "Pros & cons" });
  if (alternatives.length > 0)
    anchors.push({ id: "alternatives", label: "Alternatives" });
  if (hasCoverage) anchors.push({ id: "guides", label: "Guides" });
  if (active.length > 0)
    anchors.push({ id: "get-started", label: "Get started" });
  if (store.faq?.length) anchors.push({ id: "faq", label: "FAQ" });

  const jsonLdItems = [
    productLd(store, active),
    breadcrumbLd([
      { name: "Home", href: "/" },
      { name: "Tools", href: "/tools" },
      { name: store.name, href: `/tools/${store.slug}` },
    ]),
  ];
  if (hasReview) jsonLdItems.push(reviewLd(store, "DaddyPromoos editor"));
  if (store.faq?.length) jsonLdItems.push(faqLd(store.faq));

  return (
    <>
      <JsonLd data={jsonLdItems} />

      {/* ============================================ Masthead (7/5) */}
      <section id="masthead" className="border-b border-line">
        <Container size="wide" className="py-8 lg:py-10">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-subtle">
            <Link href="/tools" className="hover:text-pine">
              Tools
            </Link>
            {store.categories[0] && (
              <>
                <span className="mx-2" aria-hidden="true">
                  /
                </span>
                <Link
                  href={`/categories/${store.categories[0].slug}`}
                  className="hover:text-pine"
                >
                  {store.categories[0].name}
                </Link>
              </>
            )}
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <span className="text-ink">{store.name}</span>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="flex items-start gap-4">
                <StoreLogo
                  name={store.name}
                  logoUrl={store.logoUrl}
                  themeColor={store.themeColor}
                  size="lg"
                />
                <div className="min-w-0">
                  <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                    {store.name}
                  </h1>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {store.categories.map((cat) => (
                      <Link key={cat.id} href={`/categories/${cat.slug}`}>
                        <Badge className="transition-colors hover:bg-mint">
                          {cat.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <p className="mt-5 max-w-xl text-body-lg leading-relaxed text-ink-muted">
                {store.heroSummary ?? store.tagline}
              </p>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-ink-subtle">
                {store.lastReviewedAt && (
                  <span>Reviewed &amp; updated {formatDate(store.lastReviewedAt)}</span>
                )}
                {store.startingPriceLabel && (
                  <span className="text-pine">{store.startingPriceLabel}</span>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <ScoreCard
                score={store.editorialScore}
                toolName={store.name}
                goHref={goHref}
                hideStartCta={active.length === 0}
              />
              <DisclosureLine className="mt-3 text-center text-xs" />
            </div>
          </div>
        </Container>
      </section>

      {anchors.length > 1 && <StickyNav items={anchors} />}

      <Container size="wide" className="py-12 lg:py-16">
        <div className="mx-auto max-w-3xl space-y-16">
          {/* -------------------------------------------- Overview */}
          {hasReview && store.verdict && (
            <section id="overview" className="scroll-mt-28 space-y-8">
              <VerdictBox verdict={store.verdict} />

              {gallery.length > 0 && (
                <div>
                  <h2 className="font-mono text-xs font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                    A look at {store.name}
                  </h2>
                  <div className="mt-4">
                    <ScreenshotsStrip images={gallery} alt={store.name} />
                  </div>
                </div>
              )}

              {store.reviewBody && (
                <div className="prose-review">
                  <ArticleRenderer
                    doc={store.reviewBody as unknown as TiptapNode}
                    coupons={new Map()}
                  />
                </div>
              )}

              {/* Best for / Not for */}
              {store.useItFor && store.skipItIf && (
                <div className="grid gap-5 border-t border-line pt-6 sm:grid-cols-2">
                  <div>
                    <p className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-success uppercase">
                      Best for
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                      {store.useItFor}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                      Not for
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                      {store.skipItIf}
                    </p>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* -------------------------------------------- Scorecard */}
          {store.ratingBreakdown?.length ? (
            <section id="scorecard" className="scroll-mt-28">
              <SectionHeader kicker="SCORECARD" title="How it scores" />
              <div className="mt-6">
                <ScorecardBars criteria={store.ratingBreakdown} />
              </div>
            </section>
          ) : null}

          {/* -------------------------------------------- Pricing */}
          {store.pricingSummary?.length && store.pricingUrl && store.lastReviewedAt ? (
            <section id="pricing" className="scroll-mt-28">
              <SectionHeader kicker="PRICING" title={`${store.name} pricing`} />
              <div className="mt-6">
                <PricingTable
                  rows={store.pricingSummary}
                  pricingUrl={store.pricingUrl}
                  brandName={store.name}
                  lastReviewedAt={store.lastReviewedAt}
                />
              </div>
            </section>
          ) : null}

          {/* -------------------------------------------- Pros & cons */}
          {store.goodPoints?.length && store.weakPoints?.length ? (
            <section id="pros-cons" className="scroll-mt-28">
              <SectionHeader kicker="THE TRADE-OFFS" title="Pros & cons" />
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                <ul className="space-y-3">
                  {store.goodPoints.map((p, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-sm leading-relaxed text-ink-muted"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                        aria-hidden="true"
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-3">
                  {store.weakPoints.map((p, i) => (
                    <li
                      key={i}
                      className="flex gap-2.5 text-sm leading-relaxed text-ink-muted"
                    >
                      <Minus
                        className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle"
                        aria-hidden="true"
                      />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {/* -------------------------------------------- Alternatives */}
          {alternatives.length > 0 && (
            <section id="alternatives" className="scroll-mt-28">
              <SectionHeader
                kicker="ALTERNATIVES"
                title={`If ${store.name} isn't the fit`}
              />
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {alternatives.map((alt, i) => (
                  <div
                    key={alt.id}
                    className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center gap-2.5">
                      <StoreLogo
                        name={alt.name}
                        logoUrl={alt.logoUrl}
                        themeColor={alt.themeColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-display font-semibold text-ink">
                          <Link
                            href={`/tools/${alt.slug}`}
                            className="hover:text-pine"
                          >
                            {alt.name}
                          </Link>
                        </p>
                        {alt.editorialScore !== null && (
                          <p className="font-mono text-xs text-ink-subtle">
                            {alt.editorialScore.toFixed(1)} / 10
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-muted">
                      {alt.tagline}
                    </p>
                    {altCompare[i] && (
                      <Link
                        href={`/compare/${altCompare[i]!.slug}`}
                        className="mt-3 text-sm font-medium text-emerald-600 hover:underline"
                      >
                        Compare with {alt.name} &rarr;
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---------------------------------- Guides & comparisons */}
          {hasCoverage && (
            <section id="guides" className="scroll-mt-28">
              <SectionHeader
                kicker="GUIDES"
                title={`${store.name} guides & comparisons`}
              />
              <div className="mt-6 grid gap-8 sm:grid-cols-2">
                {guides.length > 0 && (
                  <CoverageList
                    heading="Guides"
                    links={guides.map((p) => ({
                      title: p.title,
                      href: `/blog/${p.slug}`,
                    }))}
                  />
                )}
                {comparisons.length > 0 && (
                  <CoverageList
                    heading="Head-to-heads"
                    links={comparisons.map((c) => ({
                      title: c.title,
                      href: `/compare/${c.slug}`,
                    }))}
                  />
                )}
              </div>
            </section>
          )}

          {/* -------------------------------------------- Get started */}
          {active.length > 0 && (
            <section id="get-started" className="scroll-mt-28">
              <SectionHeader
                kicker="GET STARTED"
                title={`Ways to start with ${store.name}`}
              />
              <DisclosureLine className="mt-2" />
              <StartOptions offers={active} className="mt-6" />
              {expired.length > 0 && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-muted hover:text-pine">
                    Ended offers ({expired.length})
                  </summary>
                  <StartOptions offers={expired} ended className="mt-4" />
                </details>
              )}
            </section>
          )}

          {/* -------------------------------------------- Profile fallback */}
          {!hasReview && (
            <section className="scroll-mt-28">
              <SectionHeader kicker="ABOUT" title={`About ${store.name}`} />
              <p className="mt-4 leading-relaxed text-ink-muted">
                {store.description}
              </p>
            </section>
          )}

          {/* -------------------------------------------- FAQ */}
          {store.faq?.length ? (
            <section id="faq" className="scroll-mt-28">
              <SectionHeader
                kicker="FAQ"
                title={`Quick answers about ${store.name}`}
              />
              <div className="mt-6">
                <FaqAccordion items={store.faq} />
              </div>
            </section>
          ) : null}
        </div>
      </Container>

      <CtaBand
        brandName={store.name}
        logoUrl={store.logoUrl}
        visitUrl={goHref}
        closingLine={
          store.pricingSummary?.some((p) =>
            p.price.toLowerCase().includes("free"),
          )
            ? `Try ${store.name} free before you commit`
            : `See what ${store.name} has to offer`
        }
      />

      <MobileCtaBar
        toolName={store.name}
        score={store.editorialScore}
        goHref={goHref}
      />
    </>
  );
}

function CoverageList({
  heading,
  links,
}: {
  heading: string;
  links: { title: string; href: string }[];
}) {
  return (
    <div>
      <p className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
        {heading}
      </p>
      <ul className="mt-3 space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group inline-flex items-start gap-1.5 text-sm font-semibold text-pine hover:text-emerald-600"
            >
              {link.title}
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
        {kicker}
      </p>
      <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">
        {title}
      </h2>
    </div>
  );
}
