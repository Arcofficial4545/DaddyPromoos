/**
 * Restore the content tables that the 2026-08-21 seed run never reached.
 *
 * INSERT ONLY. This script touches exactly four tables — posts, post_stores,
 * promos, comparisons — and contains no delete, truncate or drop. Everything
 * else (stores, coupons, categories, authors, settings, clicks, admin_users)
 * is read-only here: ids are resolved by looking up rows already in the
 * database, never by inserting new ones.
 *
 * It reuses the seed's own content arrays via scripts/seed.ts, which exports
 * them and no longer runs its destructive main() on import.
 *
 * Idempotent: a post/comparison whose slug already exists is skipped, as is a
 * promo whose name already exists. Rows are inserted one at a time so a single
 * bad row names itself instead of failing the whole batch.
 *
 * Run with tsx's env flag (imports are hoisted above the loadEnvFile fallback
 * below, so DATABASE_URL has to be in the environment before tsx starts):
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/restore-content.ts --dry-run
 *   npx tsx --env-file-if-exists=.env.local scripts/restore-content.ts
 */

// tsx doesn't load Next's env files; pick up .env.local ourselves.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fine — fall back to whatever is already in the environment
}

import { db } from "../lib/db/client-node";
import {
  authors,
  categories,
  comparisons,
  coupons,
  posts,
  postStores,
  promos,
  stores,
} from "../lib/db/schema";
import { buildPostSeed, buildPromoSeed, comparisonSeed } from "./seed";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * The seed inserts these three authors in this exact order and bylines posts
 * with `authorRows[i % authorRows.length]`. All three rows carry an identical
 * created_at, so the database cannot report that order back — it is restated
 * here so the rotation reproduces the bylines the seed would have written.
 */
const AUTHOR_ORDER = ["Abdul Rehman Ch", "Maya Whitfield", "Haw"] as const;

/** Coupon titles that post content and promo payloads embed by id. */
const OFFER_TITLES = {
  base44Offer: "Free plan — build and publish without a card",
  lovableOffer: "Free tier — daily messages, real code output",
  sageOffer: "Current new-customer offer on Sage Accounting",
  shopifyOffer: "Shopify's standing new-merchant intro offer",
  canvaOffer: "Canva Pro free trial for new users",
  framerOffer: "Publish free on a framer.website subdomain",
} as const;

async function main() {
  console.log(DRY_RUN ? "DRY RUN — no writes will be made.\n" : "INSERT MODE\n");

  /* ---------------- read what already exists (no writes) ---------------- */
  const [authorRowsAll, categoryRows, storeRows, couponRows] = await Promise.all([
    db.select().from(authors),
    db.select().from(categories),
    db.select().from(stores),
    db.select().from(coupons),
  ]);

  const authorByName = new Map(authorRowsAll.map((a) => [a.name, a]));
  const catBySlug = new Map(categoryRows.map((c) => [c.slug, c]));
  const storeBySlug = new Map(storeRows.map((s) => [s.slug, s]));
  const couponByTitle = new Map(couponRows.map((c) => [c.title, c]));

  /* ------------------------------ guards -------------------------------- */
  // Guard 1: every byline must match a row already in the authors table.
  const missingAuthors = AUTHOR_ORDER.filter((n) => !authorByName.has(n));
  if (missingAuthors.length > 0) {
    throw new Error(
      `No authors row for: ${missingAuthors.join(", ")}. ` +
        `Present: ${authorRowsAll.map((a) => a.name).join(", ") || "(none)"}`,
    );
  }
  const authorRows = AUTHOR_ORDER.map((n) => authorByName.get(n)!);

  // Guard 2: every coupon embedded in content must already exist.
  const offers = {} as Record<keyof typeof OFFER_TITLES, { id: string }>;
  const missingOffers: string[] = [];
  for (const [key, title] of Object.entries(OFFER_TITLES)) {
    const row = couponByTitle.get(title);
    if (!row) missingOffers.push(title);
    else offers[key as keyof typeof OFFER_TITLES] = row;
  }
  if (missingOffers.length > 0) {
    throw new Error(`Coupon not found: ${missingOffers.join(" | ")}`);
  }

  /* ------------------- rebuild the seed's content arrays ---------------- */
  const postSeed = buildPostSeed({ catBySlug, ...offers });
  const promoSeed = buildPromoSeed(offers);

  // Same rotation as the seed: the methodology piece is the founder's, the
  // rest rotate across the editorial team in insert order.
  const authorIdForPost = (slug: string, i: number): string =>
    slug === "how-we-score-every-tool"
      ? authorRows[0].id
      : authorRows[i % authorRows.length].id;

  // Guard 3: every post resolves to an author id that exists.
  const authorIds = new Set(authorRows.map((a) => a.id));
  for (const [i, post] of postSeed.entries()) {
    const resolved = authorIdForPost(post.slug, i);
    if (!resolved || !authorIds.has(resolved)) {
      throw new Error(
        `No author row for post "${post.slug}" (resolved: ${resolved ?? "undefined"})`,
      );
    }
  }

  // Guard 4: every store referenced by a post or comparison must exist.
  const missingStores = new Set<string>();
  for (const post of postSeed) {
    for (const slug of post.relatedStores) {
      if (!storeBySlug.has(slug)) missingStores.add(slug);
    }
  }
  for (const c of comparisonSeed) {
    if (!storeBySlug.has(c.aSlug)) missingStores.add(c.aSlug);
    if (!storeBySlug.has(c.bSlug)) missingStores.add(c.bSlug);
  }
  if (missingStores.size > 0) {
    throw new Error(`Store not found: ${[...missingStores].join(", ")}`);
  }
  console.log("Guards passed: authors, coupons, bylines and stores all resolve.\n");

  /* --------------------- what already exists downstream ----------------- */
  const existingPostSlugs = new Set(
    (await db.select({ slug: posts.slug }).from(posts)).map((r) => r.slug),
  );
  const existingComparisonSlugs = new Set(
    (await db.select({ slug: comparisons.slug }).from(comparisons)).map(
      (r) => r.slug,
    ),
  );
  const existingPromoNames = new Set(
    (await db.select({ name: promos.name }).from(promos)).map((r) => r.name),
  );

  const postsToInsert = postSeed
    .map((post, i) => ({ post, i }))
    .filter(({ post }) => !existingPostSlugs.has(post.slug));
  const comparisonsToInsert = comparisonSeed.filter(
    (c) => !existingComparisonSlugs.has(c.slug),
  );
  const promosToInsert = promoSeed.filter((p) => !existingPromoNames.has(p.name));
  const postStoreLinks = postsToInsert.reduce(
    (n, { post }) => n + post.relatedStores.length,
    0,
  );

  const report = (label: string, would: number, skipped: number) =>
    console.log(
      `  ${label.padEnd(13)} ${String(would).padStart(3)} to insert` +
        (skipped > 0 ? `   (${skipped} already present, skipped)` : ""),
    );

  console.log(DRY_RUN ? "Would insert:" : "Inserting:");
  report("posts", postsToInsert.length, postSeed.length - postsToInsert.length);
  report("post_stores", postStoreLinks, 0);
  report("promos", promosToInsert.length, promoSeed.length - promosToInsert.length);
  report(
    "comparisons",
    comparisonsToInsert.length,
    comparisonSeed.length - comparisonsToInsert.length,
  );
  console.log("");

  if (DRY_RUN) {
    console.log("DRY RUN — nothing was written.");
    return;
  }

  /* ------------------------------ inserts ------------------------------- */
  let insertedPosts = 0;
  let insertedLinks = 0;
  for (const { post, i } of postsToInsert) {
    const [row] = await db
      .insert(posts)
      .values({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        contentJson: post.content,
        authorId: authorIdForPost(post.slug, i),
        categoryId: post.categoryId,
        tags: post.tags,
        status: "published" as const,
        publishedAt: post.publishedAt,
        readingMinutes: post.readingMinutes,
        viewCount: 0, // real numbers only
        seoTitle: post.title,
        seoDescription: post.excerpt,
      })
      .returning();
    insertedPosts++;

    const links = post.relatedStores.map((slug) => ({
      postId: row.id,
      storeId: storeBySlug.get(slug)!.id,
    }));
    if (links.length > 0) {
      await db.insert(postStores).values(links);
      insertedLinks += links.length;
    }
  }
  console.log(`  posts         ${insertedPosts} inserted`);
  console.log(`  post_stores   ${insertedLinks} inserted`);

  let insertedPromos = 0;
  for (const promo of promosToInsert) {
    await db.insert(promos).values(promo);
    insertedPromos++;
  }
  console.log(`  promos        ${insertedPromos} inserted`);

  let insertedComparisons = 0;
  for (const c of comparisonsToInsert) {
    await db.insert(comparisons).values({
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      storeAId: storeBySlug.get(c.aSlug)!.id,
      storeBId: storeBySlug.get(c.bSlug)!.id,
      intro: c.intro,
      criteria: c.criteria,
      verdictA: c.verdictA,
      verdictB: c.verdictB,
      bottomLine: c.bottomLine,
      status: "published" as const,
      isFeatured: c.isFeatured ?? false,
      seoTitle: c.seoTitle,
      seoDescription: c.seoDescription,
    });
    insertedComparisons++;
  }
  console.log(`  comparisons   ${insertedComparisons} inserted`);
  console.log("\nRestore complete.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
