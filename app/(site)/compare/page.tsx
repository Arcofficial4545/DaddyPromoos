import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { VsCard } from "@/components/marketing/company/VsCard";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getFeaturedComparison,
  listPublishedComparisons,
  type ComparisonWithStores,
} from "@/lib/db/repositories/comparisons";
import { breadcrumbLd, itemListLd, ogImageUrl } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Compare — Head-to-Head Tool Matchups",
  description:
    "Honest, criteria-by-criteria comparisons of the tools people actually weigh against each other. See which wins on the dimensions that matter to you.",
  alternates: { canonical: "/compare" },
  openGraph: {
    title: "Compare Tools — DaddyPromoos",
    description: "Head-to-head matchups scored on the criteria that matter.",
    images: [ogImageUrl("Compare", "Head-to-head, criteria by criteria")],
  },
};

function categoryOf(c: ComparisonWithStores): { name: string; slug: string } {
  return c.storeA.categories[0] ?? { name: "Other", slug: "other" };
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [featured, all] = await Promise.all([
    getFeaturedComparison(),
    listPublishedComparisons(),
  ]);

  const rest = all.filter((c) => c.id !== featured?.id);

  // Category chips are built from the matchups that actually appear in the
  // grid below (the featured one is shown separately), so a chip never leads
  // to an empty "no matchups yet" view.
  const catMap = new Map<string, string>();
  for (const c of rest) {
    const cat = categoryOf(c);
    catMap.set(cat.slug, cat.name);
  }
  const cats = [...catMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const filtered = category
    ? rest.filter((c) => categoryOf(c).slug === category)
    : rest;

  // Group the (filtered) rest by category.
  const groups = new Map<string, ComparisonWithStores[]>();
  for (const c of filtered) {
    const name = categoryOf(c).name;
    groups.set(name, [...(groups.get(name) ?? []), c]);
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", href: "/" },
            { name: "Compare", href: "/compare" },
          ]),
          itemListLd(
            all.map((c) => ({ name: c.title, href: `/compare/${c.slug}` })),
          ),
        ]}
      />

      <Container size="wide" className="pt-12 pb-8 lg:pt-16">
        <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
          Head-to-head
        </p>
        <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          The matchups worth making
        </h1>
        <p className="mt-4 max-w-2xl text-body-lg leading-relaxed text-ink-muted">
          Criteria-by-criteria comparisons of the tools people actually weigh
          against each other — with a clear winner per row and a bottom line you
          can act on.
        </p>
      </Container>

      {/* Featured matchup */}
      {featured && (
        <Container size="wide" className="pb-8">
          <VsCard comparison={featured} featured />
        </Container>
      )}

      <Section padding="tight">
        <Container size="wide">
          {cats.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <FilterChip href="/compare" active={!category}>
                All
              </FilterChip>
              {cats.map(([slug, name]) => (
                <FilterChip
                  key={slug}
                  href={`/compare?category=${slug}`}
                  active={category === slug}
                >
                  {name}
                </FilterChip>
              ))}
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="mt-12 text-center text-ink-muted">
              No matchups in this category yet.
            </p>
          ) : (
            <div className="mt-8 space-y-12">
              {[...groups.entries()].map(([name, items]) => (
                <div key={name}>
                  <h2 className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
                    {name}
                  </h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((c) => (
                      <VsCard key={c.id} comparison={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-emerald bg-mint text-pine"
          : "border-line text-ink-muted hover:border-emerald-600 hover:text-pine",
      )}
    >
      {children}
    </Link>
  );
}
