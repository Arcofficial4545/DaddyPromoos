import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../client";
import {
  categories,
  coupons,
  storeCategories,
  stores,
  type NewStore,
  type Store,
} from "../schema";

export type StoreSort = "newest" | "popular" | "rating" | "name";

export type StoreWithMeta = Store & {
  categories: { id: string; name: string; slug: string }[];
  activeCouponCount: number;
  bestDiscountLabel: string | null;
};

/**
 * A store review renders only when it has a verdict, a score, and at least
 * two good AND two weak points (cons are mandatory — no cons, no review).
 */
export function hasCompleteReview(store: Store): boolean {
  return (
    !!store.verdict &&
    store.editorialScore !== null &&
    Array.isArray(store.goodPoints) &&
    store.goodPoints.length >= 2 &&
    Array.isArray(store.weakPoints) &&
    store.weakPoints.length >= 2
  );
}

async function attachMeta(rows: Store[]): Promise<StoreWithMeta[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((s) => s.id);

  const liveCoupon = and(
    inArray(coupons.storeId, ids),
    eq(coupons.isActive, true),
    or(isNull(coupons.expiresAt), gt(coupons.expiresAt, new Date())),
  );

  const cats = await db
    .select({
      storeId: storeCategories.storeId,
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
    })
    .from(storeCategories)
    .innerJoin(categories, eq(storeCategories.categoryId, categories.id))
    .where(inArray(storeCategories.storeId, ids));

  // Active-coupon count and the best discount label in one grouped pass — this
  // used to be two queries, the second of which pulled every live coupon row
  // just to take the top label per store in JS. The label is the first row
  // under the same `discount_value desc` ordering, so selection is unchanged.
  //
  // Sequential, but NOT because concurrent queries are unsafe — an earlier
  // version of this comment claimed postgres.js pipelining crosses parameters,
  // and that is measurably false (see the notes on the parameter-crossing
  // investigation). `next build` does intermittently hit parameter crossing,
  // but the homepage's own 11-query Promise.all is equally exposed, so keeping
  // these two serial is not a fix for it. It just isn't worth one more
  // in-flight query until that race is understood.
  const couponMeta = await db
    .select({
      storeId: coupons.storeId,
      activeCount: count(),
      bestLabel: sql<
        string | null
      >`(array_agg(${coupons.discountLabel} order by ${coupons.discountValue} desc))[1]`,
    })
    .from(coupons)
    .where(liveCoupon)
    .groupBy(coupons.storeId);

  const metaByStore = new Map(couponMeta.map((m) => [m.storeId, m]));
  const catsByStore = new Map<string, StoreWithMeta["categories"]>();
  for (const c of cats) {
    const list = catsByStore.get(c.storeId) ?? [];
    list.push({ id: c.id, name: c.name, slug: c.slug });
    catsByStore.set(c.storeId, list);
  }

  return rows.map((s) => ({
    ...s,
    categories: catsByStore.get(s.id) ?? [],
    activeCouponCount: metaByStore.get(s.id)?.activeCount ?? 0,
    bestDiscountLabel: metaByStore.get(s.id)?.bestLabel ?? null,
  }));
}

export async function listActiveStores(opts?: {
  search?: string;
  categorySlug?: string;
  sort?: StoreSort;
  limit?: number;
  offset?: number;
}): Promise<{ stores: StoreWithMeta[]; total: number }> {
  const { search, categorySlug, sort = "popular", limit = 24, offset = 0 } =
    opts ?? {};

  const conditions = [eq(stores.isActive, true)];

  if (search) {
    const term = `%${search.replace(/[%_]/g, "")}%`;
    const searchCond = or(like(stores.name, term), like(stores.tagline, term));
    if (searchCond) conditions.push(searchCond);
  }

  if (categorySlug) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, categorySlug),
    });
    if (!cat) return { stores: [], total: 0 };
    const storeIds = (
      await db
        .select({ storeId: storeCategories.storeId })
        .from(storeCategories)
        .where(eq(storeCategories.categoryId, cat.id))
    ).map((r) => r.storeId);
    if (storeIds.length === 0) return { stores: [], total: 0 };
    conditions.push(inArray(stores.id, storeIds));
  }

  const where = and(...conditions);

  const orderBy =
    sort === "newest"
      ? [desc(stores.createdAt)]
      : sort === "rating"
        ? [desc(stores.rating), asc(stores.name)]
        : sort === "name"
          ? [asc(stores.name)]
          : [desc(stores.isFeatured), desc(stores.rating), asc(stores.name)];

  const [rows, [{ total }]] = await Promise.all([
    db.select().from(stores).where(where).orderBy(...orderBy).limit(limit).offset(offset),
    db.select({ total: count() }).from(stores).where(where),
  ]);

  return { stores: await attachMeta(rows), total };
}

export async function listFeaturedStores(limit = 6): Promise<StoreWithMeta[]> {
  const rows = await db
    .select()
    .from(stores)
    .where(and(eq(stores.isActive, true), eq(stores.isFeatured, true)))
    .orderBy(desc(stores.rating))
    .limit(limit);
  return attachMeta(rows);
}

export async function getStoreBySlug(
  slug: string,
): Promise<StoreWithMeta | null> {
  const row = await db.query.stores.findFirst({
    where: and(eq(stores.slug, slug), eq(stores.isActive, true)),
  });
  if (!row) return null;
  const [withMeta] = await attachMeta([row]);
  return withMeta;
}

/** Active, non-fictional store slugs (sitemap + static params). */
export async function listAllStoreSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: stores.slug })
    .from(stores)
    .where(and(eq(stores.isActive, true), eq(stores.isFictional, false)));
  return rows.map((r) => r.slug);
}

/** Stores that have a complete published review (for /reviews, /compare). */
export async function listReviewedStores(): Promise<StoreWithMeta[]> {
  const rows = await db
    .select()
    .from(stores)
    .where(and(eq(stores.isActive, true), eq(stores.isFictional, false)))
    .orderBy(desc(stores.editorialScore));
  const complete = rows.filter(hasCompleteReview);
  return attachMeta(complete);
}

/** Fetch several stores by id, with meta (for comparisons). */
export async function getStoresByIds(
  ids: string[],
): Promise<StoreWithMeta[]> {
  if (ids.length === 0) return [];
  const rows = await db.select().from(stores).where(inArray(stores.id, ids));
  return attachMeta(rows);
}

/** Fetch several stores by slug (for the alternatives section). */
export async function getStoresBySlugs(
  slugs: string[],
): Promise<StoreWithMeta[]> {
  if (slugs.length === 0) return [];
  const rows = await db
    .select()
    .from(stores)
    .where(and(inArray(stores.slug, slugs), eq(stores.isActive, true)));
  const withMeta = await attachMeta(rows);
  // Preserve the requested order.
  const bySlug = new Map(withMeta.map((s) => [s.slug, s]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((s): s is StoreWithMeta => s !== undefined);
}

/* ------------------------------- Admin ------------------------------- */

export async function adminListStores(): Promise<StoreWithMeta[]> {
  const rows = await db.select().from(stores).orderBy(asc(stores.name));
  return attachMeta(rows);
}

export async function adminGetStore(id: string): Promise<StoreWithMeta | null> {
  const row = await db.query.stores.findFirst({ where: eq(stores.id, id) });
  if (!row) return null;
  const [withMeta] = await attachMeta([row]);
  return withMeta;
}

export async function createStore(
  data: NewStore,
  categoryIds: string[] = [],
): Promise<Store> {
  const [row] = await db.insert(stores).values(data).returning();
  if (categoryIds.length > 0) {
    await db
      .insert(storeCategories)
      .values(categoryIds.map((categoryId) => ({ storeId: row.id, categoryId })));
  }
  return row;
}

export async function updateStore(
  id: string,
  data: Partial<NewStore>,
  categoryIds?: string[],
): Promise<Store | null> {
  const [row] = await db
    .update(stores)
    .set(data)
    .where(eq(stores.id, id))
    .returning();
  if (!row) return null;
  if (categoryIds) {
    await db.delete(storeCategories).where(eq(storeCategories.storeId, id));
    if (categoryIds.length > 0) {
      await db
        .insert(storeCategories)
        .values(categoryIds.map((categoryId) => ({ storeId: id, categoryId })));
    }
  }
  return row;
}

export async function deleteStore(id: string): Promise<void> {
  await db.delete(stores).where(eq(stores.id, id));
}
