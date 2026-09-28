import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { StartOptions } from "@/components/marketing/company/StartOptions";
import { ComparisonTable } from "@/components/marketing/company/ComparisonTable";
import { ScoreCard } from "@/components/marketing/company/ScoreCard";
import { DisclosureLine } from "@/components/marketing/DisclosureLine";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getComparisonBySlug,
} from "@/lib/db/repositories/comparisons";
import { listCouponsForStore } from "@/lib/db/repositories/coupons";
import type { StoreWithMeta } from "@/lib/db/repositories/stores";
import { breadcrumbLd, ogVsImageUrl, SITE_NAME, SITE_URL } from "@/lib/seo/jsonld";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;
export const dynamicParams = true;

// Rendered on-demand, then cached via `revalidate` (v3-01).
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await getComparisonBySlug(slug);
  if (!c) return { title: "Comparison not found" };
  const title = c.seoTitle ?? `${c.title} — Head-to-Head Comparison`;
  const description = c.seoDescription ?? c.subtitle;
  return {
    title,
    description,
    alternates: { canonical: `/compare/${c.slug}` },
    openGraph: {
      title,
      description,
      images: [
        ogVsImageUrl(
          c.storeA.name,
          c.storeB.name,
          c.storeA.editorialScore,
          c.storeB.editorialScore,
        ),
      ],
    },
  };
}

function goHrefFor(store: StoreWithMeta, couponId: string | null): string {
  return couponId
    ? `/go/${couponId}`
    : store.affiliateBaseUrl ?? store.websiteUrl;
}

export default async function ComparisonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const c = await getComparisonBySlug(slug);
  if (!c) notFound();

  const { storeA, storeB } = c;
  const [aCoupons, bCoupons] = await Promise.all([
    listCouponsForStore(storeA.id),
    listCouponsForStore(storeB.id),
  ]);
  const goA = goHrefFor(storeA, aCoupons.active[0]?.id ?? null);
  const goB = goHrefFor(storeB, bCoupons.active[0]?.id ?? null);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    description: c.subtitle,
    url: `${SITE_URL}/compare/${c.slug}`,
    datePublished: c.createdAt.toISOString(),
    dateModified: c.updatedAt.toISOString(),
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    about: [storeA.name, storeB.name],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: [storeA, storeB].map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      url: `${SITE_URL}/tools/${s.slug}`,
    })),
  };

  return (
    <>
      <JsonLd
        data={[
          articleLd,
          itemListLd,
          breadcrumbLd([
            { name: "Home", href: "/" },
            { name: "Compare", href: "/compare" },
            { name: c.title, href: `/compare/${c.slug}` },
          ]),
        ]}
      />

      {/* ================================================= Masthead */}
      <section className="border-b border-line">
        <Container size="wide" className="py-10 lg:py-12">
          <nav aria-label="Breadcrumb" className="text-sm text-ink-subtle">
            <Link href="/compare" className="hover:text-pine">
              Compare
            </Link>
            <span className="mx-2" aria-hidden="true">
              /
            </span>
            <span className="text-ink">{c.title}</span>
          </nav>

          <div className="mt-6 flex items-center justify-center gap-5 sm:gap-8">
            <MastheadSide store={storeA} />
            <span
              className="font-mono text-xl font-bold text-ink-subtle"
              aria-hidden="true"
            >
              VS
            </span>
            <MastheadSide store={storeB} />
          </div>

          <h1 className="mt-6 text-center font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            {c.title}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-center text-body-lg leading-relaxed text-ink-muted">
            {c.subtitle}
          </p>
          <p className="mt-4 text-center font-mono text-xs text-ink-subtle">
            Updated {formatDate(c.updatedAt)}
          </p>

          <div className="mx-auto mt-8 grid max-w-2xl gap-4 sm:grid-cols-2">
            <ScoreCard
              score={storeA.editorialScore}
              toolName={storeA.name}
              goHref={goA}
              hideStartCta
            />
            <ScoreCard
              score={storeB.editorialScore}
              toolName={storeB.name}
              goHref={goB}
              hideStartCta
            />
          </div>
          <DisclosureLine className="mt-4 text-center text-xs" />
        </Container>
      </section>

      <Container size="wide" className="py-12 lg:py-16">
        <div className="mx-auto max-w-4xl space-y-14">
          {/* Quick verdict */}
          <section>
            <div className="grid gap-4 sm:grid-cols-2">
              <QuickVerdict
                store={storeA}
                text={c.verdictA}
                goHref={goA}
              />
              <QuickVerdict
                store={storeB}
                text={c.verdictB}
                goHref={goB}
              />
            </div>
          </section>

          {/* Intro */}
          {c.intro && (
            <section>
              <p className="text-body-lg leading-relaxed text-ink-muted">
                {c.intro}
              </p>
            </section>
          )}

          {/* The table */}
          <section>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
              Side by side
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink">
              {storeA.name} vs {storeB.name}, row by row
            </h2>
            <div className="mt-6">
              <ComparisonTable comparison={c} />
            </div>
          </section>

          {/* Cross-links + each tool's official offers */}
          <section className="grid gap-8 sm:grid-cols-2">
            <ToolColumn
              store={storeA}
              coupons={aCoupons.active.slice(0, 2)}
            />
            <ToolColumn
              store={storeB}
              coupons={bCoupons.active.slice(0, 2)}
            />
          </section>
        </div>
      </Container>

      {/* Bottom line — the one pine statement band */}
      {c.bottomLine && (
        <Section tone="pine">
          <Container size="wide">
            <div className="mx-auto max-w-3xl text-center">
              <p className="font-mono text-xs font-semibold tracking-[0.2em] text-mint/70 uppercase">
                The bottom line
              </p>
              <p className="mt-3 text-2xl leading-relaxed font-medium text-white sm:text-3xl">
                {c.bottomLine}
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href={goA}
                  target="_blank"
                  rel="sponsored noopener"
                  className="btn-gloss btn-primary press-down inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-6 text-sm font-semibold"
                >
                  Visit {storeA.name}
                </a>
                <a
                  href={goB}
                  target="_blank"
                  rel="sponsored noopener"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] border border-white/25 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Visit {storeB.name}
                </a>
              </div>
            </div>
          </Container>
        </Section>
      )}
    </>
  );
}

function MastheadSide({ store }: { store: StoreWithMeta }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <StoreLogo
        name={store.name}
        logoUrl={store.logoUrl}
        themeColor={store.themeColor}
        size="lg"
      />
      <Link
        href={`/tools/${store.slug}`}
        className="text-sm font-semibold text-ink hover:text-pine"
      >
        {store.name}
      </Link>
    </div>
  );
}

function QuickVerdict({
  store,
  text,
  goHref,
}: {
  store: StoreWithMeta;
  text: string;
  goHref: string;
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-line bg-mint p-6">
      <p className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-emerald-600 uppercase">
        Choose {store.name} if
      </p>
      <p className="mt-2 flex-1 text-body-lg leading-relaxed font-medium text-ink">
        {text}
      </p>
      <a
        href={goHref}
        target="_blank"
        rel="sponsored noopener"
        className="btn-gloss btn-pine press-down mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--radius-btn)] text-sm font-semibold"
      >
        Visit {store.name}
      </a>
    </div>
  );
}

function ToolColumn({
  store,
  coupons,
}: {
  store: StoreWithMeta;
  coupons: Awaited<ReturnType<typeof listCouponsForStore>>["active"];
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <StoreLogo
          name={store.name}
          logoUrl={store.logoUrl}
          themeColor={store.themeColor}
          size="sm"
        />
        <Link
          href={`/tools/${store.slug}`}
          className="group inline-flex items-center gap-1 font-display font-semibold text-ink hover:text-pine"
        >
          Read the full {store.name} review
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
      <StartOptions offers={coupons} className="mt-4" />
    </div>
  );
}
