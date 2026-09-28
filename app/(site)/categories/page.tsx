import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { CategoryIcon } from "@/components/marketing/CategoryIcon";
import { PageHeader } from "@/components/marketing/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { listCategories } from "@/lib/db/repositories/categories";
import { breadcrumbLd, itemListLd, ogImageUrl } from "@/lib/seo/jsonld";

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Browse Tools by Category",
  description:
    "AI app builders, AI coding tools, and the software founders use to ship — reviewed, scored, and organized by category.",
  alternates: { canonical: "/categories" },
  openGraph: {
    title: "Categories | DaddyPromoos",
    images: [ogImageUrl("Browse by category")],
  },
};

export default async function CategoriesPage() {
  // Categories with no active tools would render as dead ends.
  const categories = (await listCategories()).filter((c) => c.storeCount > 0);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", href: "/" },
            { name: "Categories", href: "/categories" },
          ]),
          itemListLd(
            categories.map((c) => ({
              name: c.name,
              href: `/categories/${c.slug}`,
            })),
          ),
        ]}
      />
      <PageHeader
        title="Browse by category"
        description="Every tool we cover, organized by what you're building."
      />
      <Section>
        <Container size="wide">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Card key={category.id} interactive className="relative p-5">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-mint text-pine">
                  <CategoryIcon name={category.icon} className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold text-ink">
                  <Link
                    href={`/categories/${category.slug}`}
                    className="after:absolute after:inset-0"
                  >
                    {category.name}
                  </Link>
                </h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">
                  {category.description}
                </p>
                <p className="mt-3 text-xs font-medium text-ink-subtle">
                  {category.storeCount}{" "}
                  {category.storeCount === 1 ? "tool" : "tools"}
                </p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
