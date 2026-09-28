import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { CouponGrid } from "@/components/coupon/CouponGrid";
import { toTicketCoupon } from "@/components/coupon/toTicketCoupon";
import { DisclosureLine } from "@/components/marketing/DisclosureLine";
import { FilterBar } from "@/components/marketing/FilterBar";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Pagination } from "@/components/marketing/Pagination";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCategories } from "@/lib/db/repositories/categories";
import {
  listActiveCoupons,
  type CouponSort,
} from "@/lib/db/repositories/coupons";
import { breadcrumbLd, ogImageUrl } from "@/lib/seo/jsonld";

const PAGE_SIZE = 20;

/**
 * Rendered on demand rather than prerendered. Build-time static generation of
 * this route repeatedly exhausted the Supabase transaction pooler and hung past
 * the 300s page timeout, failing the whole deployment. Rendering on request
 * costs one round trip per visit and cannot block a build.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Official Offers — Free Plans, Trials, and Discounts",
  description:
    "Free plans, trials, and official discounts from the tools we review — each links to the brand's own page. Filter by category or sort by newest.",
  alternates: { canonical: "/deals" },
  openGraph: {
    title: "Official Offers | DaddyPromoos",
    images: [ogImageUrl("Official offers", "Free plans, trials, and discounts")],
  },
};

type SearchParams = {
  q?: string;
  category?: string;
  type?: string;
  sort?: string;
  page?: string;
};

const SORTS: CouponSort[] = ["featured", "newest", "expiring", "popular"];

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const sort = SORTS.includes(params.sort as CouponSort)
    ? (params.sort as CouponSort)
    : "featured";
  const type =
    params.type === "code" || params.type === "deal" ? params.type : undefined;

  const [{ coupons, total }, categories] = await Promise.all([
    listActiveCoupons({
      search: params.q,
      categorySlug: params.category,
      type,
      sort,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listCategories(),
  ]);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Offers", href: "/deals" },
        ])}
      />
      <PageHeader
        title="Official offers"
        description={`${total} active ${total === 1 ? "offer" : "offers"} from the tools we review — free plans, trials, and discounts, each linked to the brand's own page.`}
      />
      <Section padding="tight">
        <Container size="wide">
          <DisclosureLine className="mb-6" />
          <Suspense>
            <FilterBar
              searchPlaceholder="Search offers and tools"
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
                  param: "type",
                  label: "Type",
                  emptyValue: "all",
                  options: [
                    { value: "all", label: "All offers" },
                    { value: "code", label: "Codes only" },
                    { value: "deal", label: "Offers without a code" },
                  ],
                },
                {
                  param: "sort",
                  label: "Sort",
                  emptyValue: "featured",
                  options: [
                    { value: "featured", label: "Featured" },
                    { value: "newest", label: "Newest" },
                    { value: "expiring", label: "Expiring soon" },
                    { value: "popular", label: "Most used" },
                  ],
                },
              ]}
            />
          </Suspense>

          {coupons.length === 0 ? (
            <p className="mt-12 text-center text-ink-muted">
              No offers match those filters. Try widening the search.
            </p>
          ) : (
            <CouponGrid
              coupons={coupons.map(toTicketCoupon)}
              className="mt-8"
            />
          )}

          <Pagination
            total={total}
            pageSize={PAGE_SIZE}
            currentPage={page}
            basePath="/deals"
            searchParams={params}
          />
        </Container>
      </Section>
    </>
  );
}
