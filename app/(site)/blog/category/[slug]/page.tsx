import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { PostCard } from "@/components/blog/PostCard";
import { PageHeader } from "@/components/marketing/PageHeader";
import { Pagination } from "@/components/marketing/Pagination";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCategoryBySlug,
} from "@/lib/db/repositories/categories";
import { listPublishedPosts } from "@/lib/db/repositories/posts";
import { breadcrumbLd } from "@/lib/seo/jsonld";

const PAGE_SIZE = 9;

export const revalidate = 300;

// Rendered on-demand, then cached via `revalidate` (v3-01).
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: `${category.name} — Articles and Guides`,
    description: `Reviews, comparisons, and guides about ${category.name.toLowerCase()} from the DaddyPromoos editorial team.`,
    alternates: { canonical: `/blog/category/${category.slug}` },
  };
}

export default async function BlogCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const page = Math.max(1, Number(pageParam) || 1);
  const { posts, total } = await listPublishedPosts({
    categorySlug: slug,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: category.name, href: `/blog/category/${category.slug}` },
        ])}
      />
      <PageHeader
        title={`${category.name} articles`}
        description={category.description}
      />
      <Section padding="tight">
        <Container size="wide">
          {posts.length === 0 ? (
            <p className="mt-4 text-ink-muted">
              No articles in this category yet — they&apos;re coming.
            </p>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
          <Pagination
            total={total}
            pageSize={PAGE_SIZE}
            currentPage={page}
            basePath={`/blog/category/${slug}`}
          />
        </Container>
      </Section>
    </>
  );
}
