import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { FilterBar } from "@/components/marketing/FilterBar";
import { ScoreBadge } from "@/components/marketing/company/ScoreBadge";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCategories } from "@/lib/db/repositories/categories";
import { getSettings } from "@/lib/db/repositories/settings";
import {
  getStoresBySlugs,
  listReviewedStores,
  type StoreWithMeta,
} from "@/lib/db/repositories/stores";
import { breadcrumbLd, itemListLd, ogImageUrl } from "@/lib/seo/jsonld";
import { formatDate } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Reviews — Every Verdict, Earned",
  description:
    "Independent, research-based reviews of AI tools and SaaS. Every review carries a DaddyPromoos score and a verdict that states the catch, not just the praise.",
  alternates: { canonical: "/reviews" },
  openGraph: {
    title: "Reviews — DaddyPromoos",
    description: "Independent editorial reviews of the tools that matter.",
    images: [ogImageUrl("Reviews", "Every verdict, earned")],
  },
};

type SearchParams = { q?: string; category?: string; sort?: string };

function sortStores(stores: StoreWithMeta[], sort: string): StoreWithMeta[] {
  const copy = [...stores];
  if (sort === "updated") {
    copy.sort(
      (a, b) =>
        (b.lastReviewedAt?.getTime() ?? 0) - (a.lastReviewedAt?.getTime() ?? 0),
    );
  } else if (sort === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    copy.sort((a, b) => (b.editorialScore ?? 0) - (a.editorialScore ?? 0));
  }
  return copy;
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const [all, categories, settings] = await Promise.all([
    listReviewedStores(),
    listCategories(),
    getSettings(),
  ]);

  // Editor's picks (up to 3) resolved from settings slugs.
  const pickSlugs = settings.editorPicks.map((p) => p.slug);
  const pickStores = pickSlugs.length
    ? await getStoresBySlugs(pickSlugs)
    : [];
  const pickBySlug = new Map(pickStores.map((s) => [s.slug, s]));
  const picks = settings.editorPicks
    .map((p) => ({ label: p.label, store: pickBySlug.get(p.slug) }))
    .filter((p): p is { label: string; store: StoreWithMeta } => !!p.store);

  // Filter + sort the main list.
  const q = params.q?.trim().toLowerCase();
  const category = params.category;
  const sort = params.sort ?? "score";
  let list = all;
  if (category)
    list = list.filter((s) => s.categories.some((c) => c.slug === category));
  if (q)
    list = list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.verdict?.toLowerCase().includes(q) ?? false),
    );
  list = sortStores(list, sort);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", href: "/" },
            { name: "Reviews", href: "/reviews" },
          ]),
          itemListLd(
            list.map((s) => ({ name: s.name, href: `/tools/${s.slug}` })),
          ),
        ]}
      />

      {/* Masthead */}
      <Container size="wide" className="pt-12 pb-8 lg:pt-16">
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
          Reviews
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Every verdict, earned
        </h1>
        <p className="mt-4 max-w-2xl text-body-lg leading-relaxed text-ink-muted">
          Research-based reviews with a clear score and a verdict that states
          the catch — not just the praise. See{" "}
          <Link
            href="/how-we-review"
            className="font-medium text-pine underline decoration-emerald decoration-2 underline-offset-4 hover:text-emerald-600"
          >
            how we review
          </Link>
          .
        </p>
        <p className="mt-4 font-mono text-sm text-ink-subtle">
          {all.length} tools reviewed · updated continuously
        </p>
      </Container>

      {/* Editor's picks */}
      {picks.length > 0 && (
        <Container size="wide" className="pb-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map(({ label, store }) => (
              <Link
                key={store.id}
                href={`/tools/${store.slug}`}
                className="group flex flex-col rounded-[var(--radius-card)] border border-line bg-mint p-5 transition-shadow hover:shadow-md"
              >
                <p className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-emerald-600 uppercase">
                  {label}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <StoreLogo
                    name={store.name}
                    logoUrl={store.logoUrl}
                    themeColor={store.themeColor}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold text-ink">
                      {store.name}
                    </p>
                    {store.editorialScore !== null && (
                      <p className="font-mono text-xs text-ink-subtle">
                        {store.editorialScore.toFixed(1)} / 10
                      </p>
                    )}
                  </div>
                </div>
                {store.verdict && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                    {store.verdict}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </Container>
      )}

      {/* Controls + list */}
      <Section padding="tight">
        <Container size="wide">
          <Suspense>
            <FilterBar
              searchPlaceholder="Search reviews"
              selects={[
                {
                  param: "category",
                  label: "Category",
                  emptyValue: "all",
                  options: [
                    { value: "all", label: "All categories" },
                    ...categories.map((c) => ({ value: c.slug, label: c.name })),
                  ],
                },
                {
                  param: "sort",
                  label: "Sort",
                  emptyValue: "score",
                  options: [
                    { value: "score", label: "Score" },
                    { value: "updated", label: "Recently updated" },
                    { value: "name", label: "A to Z" },
                  ],
                },
              ]}
            />
          </Suspense>

          {list.length === 0 ? (
            <p className="mt-12 text-center text-ink-muted">
              No reviews match those filters yet.
            </p>
          ) : (
            <ul className="mt-8 divide-y divide-line border-y border-line">
              {list.map((store) => (
                <li key={store.id}>
                  <Link
                    href={`/tools/${store.slug}`}
                    className="group flex items-center gap-4 py-5 transition-colors hover:bg-mint/40 sm:gap-5"
                  >
                    <StoreLogo
                      name={store.name}
                      logoUrl={store.logoUrl}
                      themeColor={store.themeColor}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-display text-lg font-semibold text-ink group-hover:text-pine">
                          {store.name}
                        </span>
                        {store.categories[0] && (
                          <Badge>{store.categories[0].name}</Badge>
                        )}
                      </div>
                      {store.verdict && (
                        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                          {store.verdict}
                        </p>
                      )}
                      {store.lastReviewedAt && (
                        <p className="mt-1.5 font-mono text-xs text-ink-subtle">
                          Updated {formatDate(store.lastReviewedAt)}
                        </p>
                      )}
                    </div>
                    {store.editorialScore !== null && (
                      <ScoreBadge score={store.editorialScore} />
                    )}
                    <ArrowRight
                      className="hidden h-4 w-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-pine sm:block"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>
    </>
  );
}
