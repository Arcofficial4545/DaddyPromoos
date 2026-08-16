import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PostCard } from "@/components/blog/PostCard";
import { FilterBar } from "@/components/marketing/FilterBar";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Pagination } from "@/components/marketing/Pagination";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCategories } from "@/lib/db/repositories/categories";
import { listPublishedPosts } from "@/lib/db/repositories/posts";
import { breadcrumbLd, ogImageUrl } from "@/lib/seo/jsonld";

const PAGE_SIZE = 9;

export const metadata: Metadata = {
  title: "Blog — Reviews, Comparisons, and Buying Guides",
  description:
    "Sharp editorial coverage of AI tools, SaaS, and digital services: hands-on reviews, head-to-head comparisons, and guides to paying less.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "The DaddyPromoos Blog",
    images: [ogImageUrl("The DaddyPromoos blog", "Reviews, comparisons, and buying guides")],
  },
};

type SearchParams = { q?: string; category?: string; page?: string };

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const isFirstUnfiltered = page === 1 && !params.q && !params.category;

  const [{ posts, total }, categories] = await Promise.all([
    listPublishedPosts({
      search: params.q,
      categorySlug: params.category,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listCategories(),
  ]);

  const [featured, ...rest] = posts;
  const gridPosts = isFirstUnfiltered ? rest : posts;

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
        ])}
      />
      <PageHeader
        title="The DaddyPromoos blog"
        description="Reviews, comparisons, and buying guides for AI tools, SaaS, and digital services. We write the way we want to read: opinionated, specific, and honest about the trade-offs."
      />
      <Section padding="tight">
        <Container size="wide">
          <Suspense>
            <FilterBar
              searchPlaceholder="Search articles"
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
              ]}
            />
          </Suspense>

          {posts.length === 0 ? (
            <p className="mt-12 text-center text-ink-muted">
              No articles match that search yet.
            </p>
          ) : (
            <>
              {isFirstUnfiltered && featured && (
                <div className="mt-8">
                  <PostCard post={featured} featured />
                </div>
              )}
              <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {gridPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </>
          )}

          <Pagination
            total={total}
            pageSize={PAGE_SIZE}
            currentPage={page}
            basePath="/blog"
            searchParams={params}
          />
        </Container>
      </Section>
    </>
  );
}
