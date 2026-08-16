import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileText, Store as StoreIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { CouponGrid } from "@/components/coupon/CouponGrid";
import { toTicketCoupon } from "@/components/coupon/toTicketCoupon";
import { FilterBar } from "@/components/marketing/FilterBar";
import { PageHeader } from "@/components/marketing/PageHeader";
import { StoreCard } from "@/components/marketing/StoreCard";
import { listActiveCoupons } from "@/lib/db/repositories/coupons";
import { listPublishedPosts } from "@/lib/db/repositories/posts";
import { listActiveStores } from "@/lib/db/repositories/stores";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Search",
  description: "Search stores, coupons, and articles across DaddyPromoos.",
  alternates: { canonical: "/search" },
  robots: { index: false },
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [storeResults, couponResults, postResults] = query
    ? await Promise.all([
        listActiveStores({ search: query, limit: 9 }),
        listActiveCoupons({ search: query, limit: 10 }),
        listPublishedPosts({ search: query, limit: 6 }),
      ])
    : [null, null, null];

  const totalResults =
    (storeResults?.total ?? 0) +
    (couponResults?.total ?? 0) +
    (postResults?.total ?? 0);

  return (
    <>
      <PageHeader
        title="Search DaddyPromoos"
        description={
          query
            ? `${totalResults} ${totalResults === 1 ? "result" : "results"} for "${query}"`
            : "Find stores, coupon codes, and articles."
        }
      />
      <Section padding="tight">
        <Container size="wide">
          <div className="max-w-xl">
            <Suspense>
              <FilterBar searchPlaceholder="Search stores, coupons, articles" />
            </Suspense>
          </div>

          {!query && (
            <p className="mt-12 text-ink-muted">
              Start typing to search across everything we cover.
            </p>
          )}

          {query && totalResults === 0 && (
            <p className="mt-12 text-ink-muted">
              Nothing matched &ldquo;{query}&rdquo;. Try a shorter term or a
              brand name.
            </p>
          )}

          {couponResults && couponResults.coupons.length > 0 && (
            <div className="mt-10">
              <h2 className="text-h4 font-bold text-pine">Coupons</h2>
              <CouponGrid
                coupons={couponResults.coupons.map(toTicketCoupon)}
                className="mt-5"
                animated={false}
              />
            </div>
          )}

          {storeResults && storeResults.stores.length > 0 && (
            <div className="mt-12">
              <h2 className="flex items-center gap-2 text-h4 font-bold text-pine">
                <StoreIcon className="h-5 w-5" aria-hidden="true" />
                Stores
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {storeResults.stores.map((store) => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            </div>
          )}

          {postResults && postResults.posts.length > 0 && (
            <div className="mt-12">
              <h2 className="flex items-center gap-2 text-h4 font-bold text-pine">
                <FileText className="h-5 w-5" aria-hidden="true" />
                Articles
              </h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {postResults.posts.map((post) => (
                  <Card key={post.id} interactive className="relative p-5">
                    <p className="text-xs text-ink-subtle">
                      {post.publishedAt ? formatDate(post.publishedAt) : ""}
                    </p>
                    <h3 className="mt-2 font-display text-lg leading-snug font-semibold text-ink">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="after:absolute after:inset-0"
                      >
                        {post.title}
                      </Link>
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-muted">
                      {post.excerpt}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
