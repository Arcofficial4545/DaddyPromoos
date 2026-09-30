import type { Store } from "@/lib/db/schema";

/**
 * Editorial picks the database has no ordered field for: stores.is_featured is
 * an unordered flag that also drives directory sorting, and settings is a
 * fixed-column row. Pure module (type-only DB import), so client components
 * can use the helpers too.
 */

/** Our AI app builder ranking, best first, with the label each carries on the
 * homepage and in the build-with-ai guide. Keep the order in line with the
 * review scores. */
export const TOP_BUILDERS: readonly { slug: string; label: string }[] = [
  { slug: "lovable", label: "Best overall" },
  { slug: "base44", label: "Best all-in-one" },
  { slug: "bolt-new", label: "Best for hands-on builders" },
  { slug: "bubble", label: "Best for complex logic" },
];

/** Products eligible for the rotating spotlight banners, with their relative
 * odds of being drawn: Lovable leads, Base44 next, the rest share equally. */
export const SPOTLIGHT_WEIGHTS: Readonly<Record<string, number>> = {
  lovable: 4,
  base44: 3,
  "bolt-new": 1,
  cursor: 1,
  bubble: 1,
  webflow: 1,
  shopify: 1,
  notion: 1,
  canva: 1,
  zapier: 1,
};

export type SpotlightItem = {
  name: string;
  slug: string;
  logoUrl: string | null;
  score: number | null;
  tagline: string;
  /** The review's "Best for" line. */
  bestFor: string | null;
  /** The store's affiliate URL exactly as stored, else its website. */
  tryHref: string;
  weight: number;
};

/** Spotlight candidates from a list of stores: listed slugs only, and only
 * active stores with a score and a tagline to headline the banner. */
export function toSpotlightPool(stores: readonly Store[]): SpotlightItem[] {
  return stores.flatMap((s) => {
    const weight = SPOTLIGHT_WEIGHTS[s.slug];
    if (!weight || !s.isActive || s.editorialScore === null || !s.tagline) {
      return [];
    }
    return [
      {
        name: s.name,
        slug: s.slug,
        logoUrl: s.logoUrl,
        score: s.editorialScore,
        tagline: s.tagline,
        bestFor: s.useItFor,
        tryHref: s.affiliateBaseUrl || s.websiteUrl,
        weight,
      },
    ];
  });
}

/** Up to `count` distinct items, each draw weighted by `weight`. Random on
 * every call — per request on the server, or after mount in the browser. */
export function pickWeighted<T extends { weight: number }>(
  items: readonly T[],
  count: number,
): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    let index = pool.findIndex((item) => (roll -= item.weight) < 0);
    if (index === -1) index = pool.length - 1;
    picked.push(pool.splice(index, 1)[0]);
  }
  return picked;
}
