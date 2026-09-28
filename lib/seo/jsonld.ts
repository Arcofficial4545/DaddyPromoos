import type { Category, Coupon, Store } from "@/lib/db/schema";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const SITE_NAME = "DaddyPromoos";

type JsonLdObject = Record<string, unknown>;

export function organizationLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/og?title=${encodeURIComponent(SITE_NAME)}`,
    description:
      "Independent reviews of the AI app builders and coding tools founders use to ship software.",
  };
}

export function websiteLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(
  items: { name: string; href: string }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  };
}

/**
 * Store JSON-LD. Real offers only (`sourceType === "official"`); never emits
 * AggregateRating — editorial opinion is expressed via Review LD instead.
 */
export function storeLd(store: Store, activeCoupons: Coupon[]): JsonLdObject {
  const officialOffers = activeCoupons.filter(
    (c) => c.sourceType === "official",
  );
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    url: `${SITE_URL}/tools/${store.slug}`,
    description: store.tagline,
    makesOffer: officialOffers.slice(0, 20).map((coupon) => ({
      "@type": "Offer",
      name: coupon.title,
      url: `${SITE_URL}/tools/${store.slug}`,
      availability: "https://schema.org/InStock",
      ...(coupon.expiresAt
        ? { validThrough: coupon.expiresAt.toISOString() }
        : {}),
    })),
  };
}

/**
 * Product JSON-LD (Section 7): brand, image, and one Offer per active official
 * deal. No AggregateRating — the editorial opinion is a single Review node.
 */
export function productLd(store: Store, activeCoupons: Coupon[]): JsonLdObject {
  const official = activeCoupons.filter((c) => c.sourceType === "official");
  const image = store.coverImageUrl
    ? `${SITE_URL}${store.coverImageUrl}`
    : ogImageUrl(store.name, store.tagline);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: store.name,
    description: store.tagline,
    image,
    brand: { "@type": "Brand", name: store.name },
    url: `${SITE_URL}/tools/${store.slug}`,
    offers: official.slice(0, 20).map((coupon) => ({
      "@type": "Offer",
      name: coupon.title,
      url: `${SITE_URL}/tools/${store.slug}`,
      availability: "https://schema.org/InStock",
      ...(coupon.expiresAt
        ? { validThrough: coupon.expiresAt.toISOString() }
        : {}),
    })),
  };
}

/** Editorial review LD — rendered only when the store has a full review. */
export function reviewLd(store: Store, authorName: string): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": "Organization",
      name: store.name,
      url: store.websiteUrl,
    },
    author: { "@type": "Person", name: authorName },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    reviewRating: {
      "@type": "Rating",
      ratingValue: store.editorialScore,
      bestRating: 10,
      worstRating: 0,
    },
    ...(store.lastReviewedAt
      ? { datePublished: store.lastReviewedAt.toISOString().slice(0, 10) }
      : {}),
    reviewBody: store.verdict ?? "",
  };
}

/** FAQPage LD from a store's FAQ items. */
export function faqLd(items: { q: string; a: string }[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function itemListLd(
  items: { name: string; href: string }[],
): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: `${SITE_URL}${item.href}`,
    })),
  };
}

export function articleLd(post: {
  title: string;
  slug: string;
  excerpt: string;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string;
  category: Category | null;
}): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    url: `${SITE_URL}/blog/${post.slug}`,
    ...(post.publishedAt
      ? { datePublished: post.publishedAt.toISOString() }
      : {}),
    dateModified: post.updatedAt.toISOString(),
    // The house byline ("DaddyPromoos Editorial") is the publication, not a
    // person — marking it up as a Person would claim an individual author.
    author: post.authorName.startsWith(SITE_NAME)
      ? { "@type": "Organization", name: post.authorName, url: SITE_URL }
      : { "@type": "Person", name: post.authorName },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    ...(post.category ? { articleSection: post.category.name } : {}),
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };
}

export function ogImageUrl(title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title });
  if (subtitle) params.set("subtitle", subtitle);
  return `${SITE_URL}/og?${params.toString()}`;
}

/** Review OG card variant — pine bg, name, big mono score disc. */
export function ogReviewImageUrl(
  name: string,
  score: number | null,
): string {
  const params = new URLSearchParams({ variant: "review", title: name });
  if (score !== null) params.set("score", score.toFixed(1));
  return `${SITE_URL}/og?${params.toString()}`;
}

/** VS OG card variant — two names and both scores. */
export function ogVsImageUrl(
  a: string,
  b: string,
  scoreA: number | null,
  scoreB: number | null,
): string {
  const params = new URLSearchParams({ variant: "vs", a, b });
  if (scoreA !== null) params.set("sa", scoreA.toFixed(1));
  if (scoreB !== null) params.set("sb", scoreB.toFixed(1));
  return `${SITE_URL}/og?${params.toString()}`;
}
