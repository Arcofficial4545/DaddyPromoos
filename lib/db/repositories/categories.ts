import "server-only";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "../client";
import {
  categories,
  storeCategories,
  stores,
  type Category,
  type NewCategory,
} from "../schema";

export type CategoryWithCount = Category & { storeCount: number };

/** Categories with a count of their *active* tools — a deactivated tool no
 * longer counts, so a category it emptied shows 0 and can be hidden. */
export async function listCategories(): Promise<CategoryWithCount[]> {
  const rows = await db
    .select({
      category: categories,
      storeCount: count(stores.id),
    })
    .from(categories)
    .leftJoin(storeCategories, eq(storeCategories.categoryId, categories.id))
    .leftJoin(
      stores,
      and(eq(stores.id, storeCategories.storeId), eq(stores.isActive, true)),
    )
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  return rows.map((r) => ({ ...r.category, storeCount: r.storeCount }));
}

export async function getCategoryBySlug(
  slug: string,
): Promise<Category | null> {
  const row = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
  });
  return row ?? null;
}

export async function listAllCategorySlugs(): Promise<string[]> {
  const rows = await db.select({ slug: categories.slug }).from(categories);
  return rows.map((r) => r.slug);
}

/* ------------------------------- Admin ------------------------------- */

export async function adminGetCategory(id: string): Promise<Category | null> {
  const row = await db.query.categories.findFirst({
    where: eq(categories.id, id),
  });
  return row ?? null;
}

export async function createCategory(data: NewCategory): Promise<Category> {
  const [row] = await db.insert(categories).values(data).returning();
  return row;
}

export async function updateCategory(
  id: string,
  data: Partial<NewCategory>,
): Promise<Category | null> {
  const [row] = await db
    .update(categories)
    .set(data)
    .where(eq(categories.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCategory(id: string): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}
