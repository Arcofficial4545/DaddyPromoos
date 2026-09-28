import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { FilterBar } from "@/components/marketing/FilterBar";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Pagination } from "@/components/marketing/Pagination";
import { StoreCard } from "@/components/marketing/StoreCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCategories } from "@/lib/db/repositories/categories";
import {
  listActiveStores,
  type StoreSort,
} from "@/lib/db/repositories/stores";
import { breadcrumbLd, itemListLd, ogImageUrl } from "@/lib/seo/jsonld";

const PAGE_SIZE = 24;

export const metadata: Metadata = {
  title: "All Tools — AI App Builders, Coding Tools, and More",
  description:
    "Every tool on DaddyPromoos: AI app builders, AI coding tools, and the software founders use to ship, with independent reviews and 0–10 scores.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "All Tools | DaddyPromoos",
    images: [ogImageUrl("All tools", "Reviewed, scored, and priced")],
  },
};

type SearchParams = {
  q?: string;
  category?: string;
  sort?: string;
  page?: string;
};

const SORTS: StoreSort[] = ["popular", "newest", "rating", "name"];

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort = SORTS.includes(params.sort as StoreSort)
    ? (params.sort as StoreSort)
    : "popular";

  const [{ stores, total }, categories] = await Promise.all([
    listActiveStores({
      search: params.q,
      categorySlug: params.category,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listCategories(),
  ]);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", href: "/" },
            { name: "Tools", href: "/tools" },
          ]),
          itemListLd(
            stores.map((s) => ({ name: s.name, href: `/tools/${s.slug}` })),
          ),
        ]}
      />
      <PageHeader
        title="All tools"
        description="Every product we cover, with independent editorial scores and links to each tool's official pricing."
      />
      <Section padding="tight">
        <Container size="wide">
          <Suspense>
            <FilterBar
              searchPlaceholder="Search tools"
              selects={[
                {
                  param: "category",
                  label: "Category",
                  emptyValue: "all",
                  options: [
                    { value: "all", label: "All categories" },
                    ...categories.map((c) => ({
                      value: c.slug,
                      label: c.name,
                    })),
                  ],
                },
                {
                  param: "sort",
                  label: "Sort",
                  emptyValue: "popular",
                  options: [
                    { value: "popular", label: "Most popular" },
                    { value: "newest", label: "Newest" },
                    { value: "rating", label: "Highest rated" },
                    { value: "name", label: "A to Z" },
                  ],
                },
              ]}
            />
          </Suspense>

          {stores.length === 0 ? (
            <p className="mt-12 text-center text-ink-muted">
              No tools match those filters yet. Try clearing the search.
            </p>
          ) : (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stores.map((store) => (
                <StoreCard key={store.id} store={store} />
              ))}
            </div>
          )}

          <Pagination
            total={total}
            pageSize={PAGE_SIZE}
            currentPage={page}
            basePath="/tools"
            searchParams={params}
          />
        </Container>
      </Section>
    </>
  );
}
