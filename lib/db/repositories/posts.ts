import "server-only";
import { and, count, desc, eq, inArray, like, lte, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  authors,
  categories,
  posts,
  postStores,
  type Author,
  type Category,
  type NewPost,
  type Post,
} from "../schema";

export type PostWithMeta = Post & {
  author: Author;
  category: Category | null;
};

function isPublished() {
  return and(
    eq(posts.status, "published"),
    lte(posts.publishedAt, new Date()),
  );
}

async function withMeta(rows: Post[]): Promise<PostWithMeta[]> {
  if (rows.length === 0) return [];
  const authorIds = [...new Set(rows.map((p) => p.authorId))];
  const categoryIds = [
    ...new Set(rows.map((p) => p.categoryId).filter((c): c is string => !!c)),
  ];

  const [authorRows, categoryRows] = await Promise.all([
    db.select().from(authors).where(inArray(authors.id, authorIds)),
    categoryIds.length > 0
      ? db.select().from(categories).where(inArray(categories.id, categoryIds))
      : Promise.resolve([]),
  ]);

  const authorMap = new Map(authorRows.map((a) => [a.id, a]));
  const categoryMap = new Map(categoryRows.map((c) => [c.id, c]));

  return rows.map((p) => ({
    ...p,
    author: authorMap.get(p.authorId)!,
    category: p.categoryId ? (categoryMap.get(p.categoryId) ?? null) : null,
  }));
}

export async function listPublishedPosts(opts?: {
  categorySlug?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ posts: PostWithMeta[]; total: number }> {
  const { categorySlug, search, limit = 12, offset = 0 } = opts ?? {};
  const conditions = [isPublished()];

  if (categorySlug) {
    const cat = await db.query.categories.findFirst({
      where: eq(categories.slug, categorySlug),
    });
    if (!cat) return { posts: [], total: 0 };
    conditions.push(eq(posts.categoryId, cat.id));
  }

  if (search) {
    const term = `%${search.replace(/[%_]/g, "")}%`;
    conditions.push(or(like(posts.title, term), like(posts.excerpt, term)));
  }

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(posts)
      .where(where)
      .orderBy(desc(posts.publishedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(posts).where(where),
  ]);

  return { posts: await withMeta(rows), total };
}

export async function getPublishedPostBySlug(
  slug: string,
): Promise<PostWithMeta | null> {
  const row = await db.query.posts.findFirst({
    where: and(eq(posts.slug, slug), isPublished()),
  });
  if (!row) return null;
  const [post] = await withMeta([row]);
  return post;
}

/** Published posts by slug, in the order asked for. Unknown or unpublished
 * slugs are skipped, so a hand-picked guide list never links to a 404. */
export async function listPublishedPostsBySlugs(
  slugs: string[],
): Promise<PostWithMeta[]> {
  if (slugs.length === 0) return [];
  const rows = await db
    .select()
    .from(posts)
    .where(and(inArray(posts.slug, slugs), isPublished()));
  const bySlug = new Map((await withMeta(rows)).map((p) => [p.slug, p]));
  return slugs
    .map((slug) => bySlug.get(slug))
    .filter((p): p is PostWithMeta => p !== undefined);
}

export async function listAllPublishedPostSlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(isPublished());
  return rows.map((r) => r.slug);
}

export async function listRelatedStoreIds(postId: string): Promise<string[]> {
  const rows = await db
    .select({ storeId: postStores.storeId })
    .from(postStores)
    .where(eq(postStores.postId, postId));
  return rows.map((r) => r.storeId);
}

export async function listPostsForStore(
  storeId: string,
  limit = 3,
): Promise<PostWithMeta[]> {
  const postIds = (
    await db
      .select({ postId: postStores.postId })
      .from(postStores)
      .where(eq(postStores.storeId, storeId))
  ).map((r) => r.postId);
  if (postIds.length === 0) return [];

  const rows = await db
    .select()
    .from(posts)
    .where(and(inArray(posts.id, postIds), isPublished()))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
  return withMeta(rows);
}

export async function incrementViewCount(postId: string): Promise<void> {
  await db
    .update(posts)
    .set({ viewCount: sql`${posts.viewCount} + 1` })
    .where(eq(posts.id, postId));
}

/* ------------------------------- Admin ------------------------------- */

export async function adminListPosts(): Promise<PostWithMeta[]> {
  const rows = await db.select().from(posts).orderBy(desc(posts.updatedAt));
  return withMeta(rows);
}

export async function adminGetPost(id: string): Promise<PostWithMeta | null> {
  const row = await db.query.posts.findFirst({ where: eq(posts.id, id) });
  if (!row) return null;
  const [post] = await withMeta([row]);
  return post;
}

export async function createPost(
  data: NewPost,
  relatedStoreIds: string[] = [],
): Promise<Post> {
  const [row] = await db.insert(posts).values(data).returning();
  if (relatedStoreIds.length > 0) {
    await db
      .insert(postStores)
      .values(relatedStoreIds.map((storeId) => ({ postId: row.id, storeId })));
  }
  return row;
}

export async function updatePost(
  id: string,
  data: Partial<NewPost>,
  relatedStoreIds?: string[],
): Promise<Post | null> {
  const [row] = await db
    .update(posts)
    .set(data)
    .where(eq(posts.id, id))
    .returning();
  if (!row) return null;
  if (relatedStoreIds) {
    await db.delete(postStores).where(eq(postStores.postId, id));
    if (relatedStoreIds.length > 0) {
      await db
        .insert(postStores)
        .values(relatedStoreIds.map((storeId) => ({ postId: id, storeId })));
    }
  }
  return row;
}

export async function deletePost(id: string): Promise<void> {
  await db.delete(posts).where(eq(posts.id, id));
}

export async function listAuthors(): Promise<Author[]> {
  return db.select().from(authors);
}
