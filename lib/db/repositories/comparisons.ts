import "server-only";
import { and, asc, desc, eq, or } from "drizzle-orm";
import { db } from "../client";
import { comparisons, type Comparison, type NewComparison } from "../schema";
import { getStoresByIds, type StoreWithMeta } from "./stores";

export type ComparisonWithStores = Comparison & {
  storeA: StoreWithMeta;
  storeB: StoreWithMeta;
};

/** Attach both stores (with meta) to comparison rows; drop any with a
 * missing/inactive store so public pages never render a broken matchup.
 * Admin passes `activeOnly: false` so a matchup stays editable after one of
 * its tools is deactivated. */
async function attachStores(
  rows: Comparison[],
  { activeOnly = true }: { activeOnly?: boolean } = {},
): Promise<ComparisonWithStores[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.flatMap((r) => [r.storeAId, r.storeBId]))];
  const stores = await getStoresByIds(ids);
  const byId = new Map(
    stores.filter((s) => !activeOnly || s.isActive).map((s) => [s.id, s]),
  );

  const out: ComparisonWithStores[] = [];
  for (const row of rows) {
    const storeA = byId.get(row.storeAId);
    const storeB = byId.get(row.storeBId);
    if (storeA && storeB) out.push({ ...row, storeA, storeB });
  }
  return out;
}

/* ------------------------------- Public ------------------------------- */

export async function listPublishedComparisons(): Promise<
  ComparisonWithStores[]
> {
  const rows = await db
    .select()
    .from(comparisons)
    .where(eq(comparisons.status, "published"))
    .orderBy(desc(comparisons.isFeatured), asc(comparisons.title));
  return attachStores(rows);
}

export async function getFeaturedComparison(): Promise<ComparisonWithStores | null> {
  const rows = await db
    .select()
    .from(comparisons)
    .where(
      and(
        eq(comparisons.status, "published"),
        eq(comparisons.isFeatured, true),
      ),
    )
    .orderBy(desc(comparisons.updatedAt))
    .limit(1);
  const [withStores] = await attachStores(rows);
  return withStores ?? null;
}

export async function getComparisonBySlug(
  slug: string,
): Promise<ComparisonWithStores | null> {
  const row = await db.query.comparisons.findFirst({
    where: and(
      eq(comparisons.slug, slug),
      eq(comparisons.status, "published"),
    ),
  });
  if (!row) return null;
  const [withStores] = await attachStores([row]);
  return withStores ?? null;
}

/** Published comparisons that include a given tool, flagship first. */
export async function listPublishedComparisonsForStore(
  storeId: string,
): Promise<ComparisonWithStores[]> {
  const rows = await db
    .select()
    .from(comparisons)
    .where(
      and(
        eq(comparisons.status, "published"),
        or(eq(comparisons.storeAId, storeId), eq(comparisons.storeBId, storeId)),
      ),
    )
    .orderBy(desc(comparisons.isFeatured), asc(comparisons.title));
  return attachStores(rows);
}

/** Published comparison slugs (sitemap + static params). */
export async function listPublishedComparisonSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: comparisons.slug })
    .from(comparisons)
    .where(eq(comparisons.status, "published"));
  return rows.map((r) => r.slug);
}

/** A published comparison covering this pair, in either order (for the
 * "Compare with {Alt}" link on a product page). */
export async function getComparisonForPair(
  storeIdA: string,
  storeIdB: string,
): Promise<Comparison | null> {
  const row = await db.query.comparisons.findFirst({
    where: and(
      eq(comparisons.status, "published"),
      or(
        and(
          eq(comparisons.storeAId, storeIdA),
          eq(comparisons.storeBId, storeIdB),
        ),
        and(
          eq(comparisons.storeAId, storeIdB),
          eq(comparisons.storeBId, storeIdA),
        ),
      ),
    ),
  });
  return row ?? null;
}

/* ------------------------------- Admin ------------------------------- */

export async function adminListComparisons(): Promise<ComparisonWithStores[]> {
  const rows = await db
    .select()
    .from(comparisons)
    .orderBy(desc(comparisons.updatedAt));
  return attachStores(rows, { activeOnly: false });
}

export async function adminGetComparison(
  id: string,
): Promise<Comparison | null> {
  const row = await db.query.comparisons.findFirst({
    where: eq(comparisons.id, id),
  });
  return row ?? null;
}

export async function createComparison(
  data: NewComparison,
): Promise<Comparison> {
  const [row] = await db.insert(comparisons).values(data).returning();
  return row;
}

export async function updateComparison(
  id: string,
  data: Partial<NewComparison>,
): Promise<Comparison | null> {
  const [row] = await db
    .update(comparisons)
    .set(data)
    .where(eq(comparisons.id, id))
    .returning();
  return row ?? null;
}

export async function deleteComparison(id: string): Promise<void> {
  await db.delete(comparisons).where(eq(comparisons.id, id));
}
