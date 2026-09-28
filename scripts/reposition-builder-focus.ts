/**
 * Bring production content in line with the site's focus: independent reviews
 * of AI app builders and coding tools, not a deals feed. Companion to the code
 * changes that removed the deals framing (title, nav, homepage, review pages).
 *
 * UPDATE-FIRST, one delete. What it does:
 *   1. Deactivates the off-focus brands (Daraz, Sage UK, QuickBooks, Shopify).
 *      Reversible: flip is_active back on in /admin/stores.
 *   2. Rewrites store SEO titles/descriptions still on the old seeded
 *      "Review, Deals, and Pricing" pattern. Hand-edited ones are left alone.
 *   3. Corrects stale Lovable facts (the old message-based pricing model) in
 *      the store row, its coupons, and the Base44-vs-Lovable post, and dates
 *      the check. Every fact was checked against lovable.dev/pricing on
 *      24 Sep 2026.
 *   4. Replaces the invented bylines ("Maya Whitfield", "Haw") with the house
 *      byline "DaddyPromoos Editorial": one row is renamed, the other's posts
 *      are moved onto it and the empty row is deleted — the only delete here.
 *   5. Unpublishes (status → draft) the posts and comparison about the
 *      deactivated brands. Nothing is deleted; republish from admin.
 *   6. Switches off every promo placement and the popup kill-switch, and
 *      replaces any deals wording in the site settings.
 *
 * Idempotent: each step only touches rows still in the old state, so a second
 * run reports nothing to do. All writes run in one transaction — all or none.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/reposition-builder-focus.ts            # dry run
 *   npx tsx --env-file-if-exists=.env.local scripts/reposition-builder-focus.ts --apply    # write
 */

// tsx doesn't load Next's env files; pick up .env.local ourselves.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fine — fall back to whatever is already in the environment
}

import { eq, inArray } from "drizzle-orm";
import { db } from "../lib/db/client-node";
import {
  authors,
  comparisons,
  coupons,
  posts,
  promos,
  settings,
  stores,
} from "../lib/db/schema";
import {
  FOUNDER_BIO,
  HOUSE_BYLINE,
  HOUSE_BYLINE_BIO,
  storeSeoDescription,
  storeSeoTitle,
} from "./seed";

const APPLY = process.argv.includes("--apply");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Op = { label: string; run: (tx: Tx) => Promise<unknown> };

/* ------------------------------------------------------------------ */
/* What changes                                                        */
/* ------------------------------------------------------------------ */

const OFF_FOCUS_STORES = ["daraz", "sage-uk", "quickbooks", "shopify"];
const OFF_FOCUS_POSTS = [
  "quickbooks-vs-sage-what-your-accountant-wants",
  "sage-uk-small-business-guide",
  "shopify-first-store-starter-guide",
];
const OFF_FOCUS_COMPARISONS = ["quickbooks-vs-sage-uk"];

/** Invented bylines. No such people work on the site. */
const INVENTED_AUTHORS = ["Maya Whitfield", "Haw"];

/** When the Lovable facts below were checked against lovable.dev/pricing. */
const LOVABLE_CHECKED_AT = new Date("2026-09-24T12:00:00Z");

/** Exact-text corrections for Lovable content, applied to every string in the
 * store row's JSON fields and in post bodies. */
const LOVABLE_TEXT_FIXES: [from: string, to: string][] = [
  ["Message-based pricing means costs scale", "Credit-based pricing means costs scale"],
  ["Message-based pricing means cost scales", "Credit-based pricing means cost scales"],
  [
    "visual edits let you tweak details without spending prompts.",
    "visual edits let you tweak details directly instead of prompting for every small change.",
  ],
  [
    "visual edits let you adjust details without spending messages on trivia.",
    "visual edits let you adjust details directly instead of prompting for every small change.",
  ],
  [
    "A daily message allowance and public projects — enough to build",
    "5 build credits a day (up to 30 a month) plus 20 Cloud credits a month — enough to build",
  ],
  [
    "Both are usage-metered — Base44 by credits, Lovable by messages — and both have free tiers",
    "Both are usage-metered by credits, and both have free tiers",
  ],
];

const LOVABLE_FREE_OFFER = {
  oldTitle: "Free tier — daily messages, real code output",
  title: "Free plan — 5 build credits a day",
  discountLabel: "FREE PLAN",
  terms:
    "The free plan includes 5 build credits a day (up to 30 a month) plus 20 Cloud credits a month — enough to build part of your own idea and read the code before paying. Checked against lovable.dev on 24 Sep 2026.",
};
const STUDENT_OFFER_TITLE = "Student discount with a valid student email";
const CHECKED_NOTE = "Checked 24 Sep 2026.";
const CHECKED_TERMS = "Checked against lovable.dev on 24 Sep 2026.";
/** The Free plan row, restated from lovable.dev/pricing. Project visibility
 * is left out: the pricing page doesn't state it. */
const FREE_PLAN_NOTE = `5 build credits a day (up to 30 a month) plus 20 Cloud credits a month. ${CHECKED_NOTE}`;

/** Drop any old "Verified <date>." stamp and end with the current check. */
const restamp = (text: string, stamp: string) =>
  text.includes(stamp)
    ? text
    : `${text.replace(/\s*Verified [A-Z][a-z]+ \d{4}\.$/, "").trimEnd()} ${stamp}`;

const SETTINGS_COPY = {
  seoDefaultTitle:
    "DaddyPromoos — Independent reviews of AI app builders and coding tools",
  seoDefaultDescription:
    "Independent, scored reviews of the AI app builders and coding tools founders use to ship software — researched against official docs and pricing.",
  footerTagline:
    "Independent reviews of the AI app builders and coding tools founders use to ship — the verdict states the catch, not just the praise.",
};
const DEALS_WORDING = /\b(deals?|coupons?)\b/i;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Apply exact-text fixes to every string inside a JSON value. Returns the
 * new value and which fixes matched; the input is not mutated. */
function fixText<T>(
  value: T,
  fixes: [string, string][],
): { value: T; hits: string[] } {
  const hits = new Set<string>();
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      let out = v;
      for (const [from, to] of fixes) {
        if (out.includes(from)) {
          out = out.split(from).join(to);
          hits.add(from);
        }
      }
      return out;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(
        Object.entries(v).map(([k, inner]) => [k, walk(inner)]),
      );
    }
    return v;
  };
  return { value: walk(value) as T, hits: [...hits] };
}

const short = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n)}…` : s);

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

async function plan(): Promise<Op[]> {
  const ops: Op[] = [];
  const [storeRows, authorRows, postRows, comparisonRows, promoRows, settingsRow] =
    await Promise.all([
      db.select().from(stores),
      db.select().from(authors),
      db
        .select({
          id: posts.id,
          slug: posts.slug,
          status: posts.status,
          authorId: posts.authorId,
          contentJson: posts.contentJson,
        })
        .from(posts),
      db
        .select({ id: comparisons.id, slug: comparisons.slug, status: comparisons.status })
        .from(comparisons),
      db.select().from(promos),
      db.query.settings.findFirst(),
    ]);

  /* 1. Off-focus brands ------------------------------------------------ */
  for (const s of storeRows) {
    if (OFF_FOCUS_STORES.includes(s.slug) && s.isActive) {
      ops.push({
        label: `store ${s.slug}: deactivate`,
        run: (tx) => tx.update(stores).set({ isActive: false }).where(eq(stores.id, s.id)),
      });
    }
  }

  /* 2. Store SEO copy still on the seeded deals pattern ---------------- */
  for (const s of storeRows) {
    const set: Partial<typeof stores.$inferInsert> = {};
    if (s.seoTitle === `${s.name} Review, Deals, and Pricing`) {
      set.seoTitle = storeSeoTitle(s.name);
    }
    if (
      s.seoDescription?.startsWith(
        `Honest editorial review of ${s.name} plus current verified offers.`,
      )
    ) {
      set.seoDescription = storeSeoDescription(s.name, s.tagline);
    }
    if (Object.keys(set).length > 0) {
      ops.push({
        label: `store ${s.slug}: SEO → "${set.seoTitle ?? s.seoTitle}"`,
        run: (tx) => tx.update(stores).set(set).where(eq(stores.id, s.id)),
      });
    }
  }

  /* 3. Lovable facts ----------------------------------------------------- */
  const lovable = storeRows.find((s) => s.slug === "lovable");
  if (!lovable) throw new Error('No store with slug "lovable".');

  // Pricing rows: restate the Free plan from the official page and date every
  // row. Structural rather than text-matched, so it works on the live wording.
  const pricingSummary = lovable.pricingSummary?.map((row) =>
    row.plan === "Free"
      ? { ...row, price: "Free", note: FREE_PLAN_NOTE }
      : { ...row, note: restamp(row.note ?? "", CHECKED_NOTE) },
  );
  const pricingChanged =
    JSON.stringify(pricingSummary) !== JSON.stringify(lovable.pricingSummary);
  const fields = {
    goodPoints: lovable.goodPoints,
    weakPoints: lovable.weakPoints,
    faq: lovable.faq,
    pricingSummary,
    reviewBody: lovable.reviewBody,
  };
  const fixedFields = fixText(fields, LOVABLE_TEXT_FIXES);
  const undated =
    lovable.lastReviewedAt?.getTime() !== LOVABLE_CHECKED_AT.getTime();
  if (fixedFields.hits.length > 0 || pricingChanged || undated) {
    const hits = [...fixedFields.hits.map((h) => short(h, 48))];
    if (pricingChanged) {
      hits.push("pricing rows restated from lovable.dev and dated (drops unconfirmed \"public projects\")");
    }
    if (undated) {
      hits.push(
        `lastReviewedAt ${lovable.lastReviewedAt?.toISOString().slice(0, 10) ?? "(none — pricing table hidden)"} → 2026-09-24`,
      );
    }
    ops.push({
      label: `store lovable: correct ${hits.length} stale fact(s) and date the check (24 Sep 2026)\n      - ${hits.join("\n      - ")}`,
      run: (tx) =>
        tx
          .update(stores)
          .set({ ...fixedFields.value, lastReviewedAt: LOVABLE_CHECKED_AT })
          .where(eq(stores.id, lovable.id)),
    });
  }

  const lovableCoupons = await db
    .select()
    .from(coupons)
    .where(eq(coupons.storeId, lovable.id));
  for (const c of lovableCoupons) {
    if (c.title === LOVABLE_FREE_OFFER.oldTitle) {
      ops.push({
        label: `coupon "${c.title}" → "${LOVABLE_FREE_OFFER.title}" (credits model, dated)`,
        run: (tx) =>
          tx
            .update(coupons)
            .set({
              title: LOVABLE_FREE_OFFER.title,
              discountLabel: LOVABLE_FREE_OFFER.discountLabel,
              terms: LOVABLE_FREE_OFFER.terms,
            })
            .where(eq(coupons.id, c.id)),
      });
    }
    if (c.title === STUDENT_OFFER_TITLE && !c.terms.includes(CHECKED_TERMS)) {
      ops.push({
        label: `coupon "${c.title}": date the check (24 Sep 2026)`,
        run: (tx) =>
          tx
            .update(coupons)
            .set({ terms: restamp(c.terms, CHECKED_TERMS) })
            .where(eq(coupons.id, c.id)),
      });
    }
  }

  for (const p of postRows) {
    const fixed = fixText(p.contentJson, LOVABLE_TEXT_FIXES);
    if (fixed.hits.length > 0) {
      ops.push({
        label: `post ${p.slug}: correct ${fixed.hits.length} stale Lovable fact(s)`,
        run: (tx) =>
          tx.update(posts).set({ contentJson: fixed.value }).where(eq(posts.id, p.id)),
      });
    }
  }

  /* 4. Bylines ------------------------------------------------------------ */
  const invented = authorRows.filter((a) => INVENTED_AUTHORS.includes(a.name));
  let house = authorRows.find((a) => a.name === HOUSE_BYLINE) ?? null;
  const toRemove = [...invented];
  if (!house && toRemove.length > 0) {
    // Reuse the first invented row as the house byline: its posts keep their
    // author id, only the name, role, and bio change.
    house = toRemove.shift()!;
    const target = house;
    const count = postRows.filter((p) => p.authorId === target.id).length;
    ops.push({
      label: `author "${target.name}" → "${HOUSE_BYLINE}" (${count} post(s) keep this row)`,
      run: (tx) =>
        tx
          .update(authors)
          .set({ name: HOUSE_BYLINE, role: "Editorial team", bio: HOUSE_BYLINE_BIO })
          .where(eq(authors.id, target.id)),
    });
  }
  for (const a of toRemove) {
    const houseId = house!.id;
    const count = postRows.filter((p) => p.authorId === a.id).length;
    ops.push({
      label: `author "${a.name}": move ${count} post(s) to "${HOUSE_BYLINE}", then delete the row`,
      run: async (tx) => {
        await tx.update(posts).set({ authorId: houseId }).where(eq(posts.authorId, a.id));
        await tx.delete(authors).where(eq(authors.id, a.id));
      },
    });
  }
  const founder = authorRows.find((a) => a.name === "Abdul Rehman Ch");
  if (founder?.bio.includes("how we test tools")) {
    ops.push({
      label: `author "Abdul Rehman Ch": bio says "how we test tools" → "how we research and score tools"`,
      run: (tx) => tx.update(authors).set({ bio: FOUNDER_BIO }).where(eq(authors.id, founder.id)),
    });
  }

  /* 5. Unpublish coverage of the deactivated brands --------------------- */
  const postIds = postRows
    .filter((p) => OFF_FOCUS_POSTS.includes(p.slug) && p.status === "published")
    .map((p) => ({ id: p.id, slug: p.slug }));
  if (postIds.length > 0) {
    ops.push({
      label: `posts → draft: ${postIds.map((p) => p.slug).join(", ")}`,
      run: (tx) =>
        tx.update(posts).set({ status: "draft" }).where(inArray(posts.id, postIds.map((p) => p.id))),
    });
  }
  const comparisonIds = comparisonRows
    .filter((c) => OFF_FOCUS_COMPARISONS.includes(c.slug) && c.status === "published")
    .map((c) => ({ id: c.id, slug: c.slug }));
  if (comparisonIds.length > 0) {
    ops.push({
      label: `comparisons → draft: ${comparisonIds.map((c) => c.slug).join(", ")}`,
      run: (tx) =>
        tx
          .update(comparisons)
          .set({ status: "draft" })
          .where(inArray(comparisons.id, comparisonIds.map((c) => c.id))),
    });
  }

  /* 6. Promos, popups, settings copy ----------------------------------- */
  const activePromos = promoRows.filter((p) => p.isActive);
  if (activePromos.length > 0) {
    ops.push({
      label: `promos → off: ${activePromos.map((p) => `"${p.name}"`).join(", ")}`,
      run: (tx) =>
        tx
          .update(promos)
          .set({ isActive: false })
          .where(inArray(promos.id, activePromos.map((p) => p.id))),
    });
  }
  if (settingsRow) {
    const set: Partial<typeof settings.$inferInsert> = {};
    if (settingsRow.popupRules.popupsEnabled) {
      set.popupRules = { ...settingsRow.popupRules, popupsEnabled: false };
    }
    for (const key of ["seoDefaultTitle", "seoDefaultDescription", "footerTagline"] as const) {
      if (DEALS_WORDING.test(settingsRow[key])) set[key] = SETTINGS_COPY[key];
    }
    if (Object.keys(set).length > 0) {
      ops.push({
        label: `settings: ${Object.keys(set)
          .map((k) => (k === "popupRules" ? "popups off" : `${k} rewritten (had deals wording)`))
          .join("; ")}`,
        run: (tx) => tx.update(settings).set(set).where(eq(settings.id, settingsRow.id)),
      });
    }
  }

  return ops;
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  console.log(APPLY ? "APPLY — writing in one transaction.\n" : "DRY RUN — nothing will be written. Pass --apply to write.\n");

  const ops = await plan();
  if (ops.length === 0) {
    console.log("Nothing to do: production is already repositioned.");
    return;
  }

  console.log(`${ops.length} change(s):`);
  for (const op of ops) console.log(`  • ${op.label}`);
  console.log("");

  if (!APPLY) {
    console.log("DRY RUN — nothing was written.");
    return;
  }

  await db.transaction(async (tx) => {
    for (const op of ops) await op.run(tx);
  });
  console.log("Done. Redeploy (or wait out the page caches, up to an hour) to see every page updated.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
