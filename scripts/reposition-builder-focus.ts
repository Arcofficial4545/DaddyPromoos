/**
 * Bring production content in line with the site's focus: a review site for
 * AI app builders (Lovable first, Base44 second) that also covers business
 * software — not a deals feed. Companion to the code changes that removed the
 * deals framing and added the featured-builders band.
 *
 * UPDATES ONLY (plus one insert if the Base44 vs Lovable comparison is
 * missing). Nothing is deleted. What it does:
 *   1. Hides Daraz. Every other brand stays live.
 *   2. Rewrites store SEO titles/descriptions still on the old seeded
 *      "Review, Deals, and Pricing" pattern. Hand-edited ones are left alone.
 *   3. Hides every offer row for Lovable and Base44 (Base44's terms forbid
 *      promoting its discounts; Lovable issues no codes).
 *   4. Sets Base44's affiliate URL, exactly as issued by Impact.
 *   5. Corrects stale Lovable facts (the old message-based pricing model) and
 *      dates the check, so Lovable's pricing table shows. Checked against
 *      lovable.dev on 24 Sep 2026.
 *   6. Updates the Base44 review (facts and pricing from base44.com only,
 *      checked 29 Sep 2026) and the Base44 vs Lovable comparison (facts from
 *      lovable.dev and base44.com only; no testing claims).
 *   7. Switches off the six seeded promos (named) and the popup kill-switch, and
 *      replaces deals wording in the site settings.
 * Authors are not touched.
 *
 * Idempotent: each step only touches rows not yet in the target state, so a
 * second run reports nothing to do. All writes run in one transaction.
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
  comparisons,
  coupons,
  posts,
  promos,
  settings,
  stores,
  type ComparisonCriterion,
  type FaqItem,
  type PricingRow,
} from "../lib/db/schema";
import { storeSeoDescription, storeSeoTitle } from "./seed";

const APPLY = process.argv.includes("--apply");

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Op = { label: string; run: (tx: Tx) => Promise<unknown> };

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */

const HIDDEN_STORES = ["daraz"];
const NO_OFFER_STORES = ["lovable", "base44"];

/** The seeded promos to switch off, by name. Named rather than "all active"
 * so a banner added later from /admin/promos is never touched. */
const OLD_PROMOS = [
  "Sidebar: Base44 free plan",
  "Sticky rail: Shopify intro offer",
  "In-content: Canva trial",
  "Timed popup: newsletter",
  "Exit intent: Lovable free tier",
  "Home banner: Sage new-customer offer",
];

/** Exactly as issued by Impact. Never add or change parameters. */
const BASE44_AFFILIATE_URL =
  "https://base44.pxf.io/c/7686269/2049275/25619?trafcat=lp";

const LOVABLE_CHECKED_AT = new Date("2026-09-24T12:00:00Z");
const BASE44_CHECKED_AT = new Date("2026-09-29T12:00:00Z");

/* ---- Lovable: exact-text corrections (old message-based model) ---- */
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
const LOVABLE_CHECKED_NOTE = "Checked 24 Sep 2026.";
/** Project visibility is left out: lovable.dev/pricing doesn't state it. */
const LOVABLE_FREE_NOTE = `5 build credits a day (up to 30 a month) plus 20 Cloud credits a month. ${LOVABLE_CHECKED_NOTE}`;

/* ---- Base44 review: facts and pricing from base44.com only --------- */
const BASE44_REVIEW = {
  verdict:
    "The most self-contained way to get from an idea to a working, hosted app without touching infrastructure. The backend stays on Base44's managed platform and two-way GitHub sync starts on the Builder plan, so know your exit plan before you build something business-critical on it.",
  useItFor:
    "Validating product ideas fast, internal tools, and MVPs where shipping this week matters more than where the code lives.",
  skipItIf:
    "You want your code in GitHub from day one on the free or entry plan, or you need full control over where the backend runs.",
  startingPriceLabel: "Free plan · paid plans add more monthly credits",
  goodPoints: [
    "Genuinely all-in-one: database, authentication, email, integrations, and hosting are built in, so a prompt becomes a usable app without wiring up third-party services.",
    "Changes are described in plain language instead of built by hand, which keeps iteration fast for people who don't code.",
    "Operated by Wix, which gives it more institutional backing than most AI builders in this category.",
    "The free plan (25 message credits a month, up to 5 apps) is enough to try a real idea before paying.",
  ],
  weakPoints: [
    "Credit-metered pricing: heavy iteration spends message credits quickly, so budget for revisions.",
    "Two-way GitHub sync starts on the Builder plan, and the backend runs on Base44 — plan your exit path before a prototype becomes the product.",
    "Generated output still needs human review — treat it as a very fast first draft, not finished software.",
  ],
  pricingSummary: [
    {
      plan: "Free",
      price: "$0",
      note: "25 message credits and 100 integration credits a month, up to 5 apps, with authentication and a database included.",
    },
    {
      plan: "Starter",
      price: "$16/mo, billed annually",
      note: "100 message credits and 2,000 integration credits a month, your own custom domain, and in-app code edits.",
    },
    {
      plan: "Builder",
      price: "$40/mo, billed annually",
      note: "More monthly credits, plus two-way GitHub sync.",
    },
    {
      plan: "Pro and Elite",
      price: "$80 and $160/mo, billed annually",
      note: "Larger monthly credit allowances; Elite adds premium support.",
    },
  ] satisfies PricingRow[],
  pricingUrl: "https://base44.com/pricing",
  faq: [
    {
      q: "Is there a free plan?",
      a: "Yes. The free plan includes 25 message credits and 100 integration credits a month, and up to 5 apps.",
    },
    {
      q: "How do credits work?",
      a: "Every plan comes with a monthly allowance of message credits and integration credits, and paid plans raise both. Check the official pricing page for current numbers.",
    },
    {
      q: "Where does my app run?",
      a: "On Base44: the database, authentication, email, and hosting are built into the platform and managed for you.",
    },
    {
      q: "Can I get the code?",
      a: "Yes, on paid plans. Starter adds in-app code edits, and two-way GitHub sync requires the Builder plan or higher.",
    },
    {
      q: "Base44 or Lovable?",
      a: "Lovable is our default pick for most non-coders, because GitHub sync is available on every plan. Base44 fits best when you want the database, sign-in, email, and hosting managed in one place. Our head-to-head comparison covers the details.",
    },
  ] satisfies FaqItem[],
};
/** Review-body sentences that implied hands-on testing or claims base44.com
 * doesn't support. */
const BASE44_BODY_FIXES: [from: string, to: string][] = [
  [
    "Most AI builders generate a front end and leave you to wire up a backend; Base44 gives you the whole stack behind one prompt loop.",
    "Base44 gives you the whole stack — database, authentication, email, and hosting — behind one prompt loop.",
  ],
  [
    "The iteration loop is genuinely fast: describing a change and watching it apply beats every visual builder we cover for speed.",
    "The iteration loop is built for speed: you describe a change instead of making it by hand.",
  ],
  [
    "Base44 is a managed platform first, built to run your app for you, not to hand you a standalone repository. You own and can export your data, but you can't lift the whole stack onto your own servers. If a prototype becomes a business-critical product, that's a decision you want to make deliberately, not discover later.",
    "Base44 is a managed platform first, built to run your app's backend and hosting for you. Two-way GitHub sync is available from the Builder plan up. If a prototype becomes a business-critical product, plan how it would move deliberately, not discover it later.",
  ],
  [
    "and for MVPs where shipping this week beats owning the stack. Skip it if you need to self-host, expect heavy custom backend logic, or your team will want to take the code into a standard repo workflow — in which case Lovable is the more honest fit.",
    "and for MVPs where shipping this week matters more than where the code lives. If you want your code in GitHub on any plan, Lovable is the more natural fit.",
  ],
];

/* ---- Base44 vs Lovable: facts from lovable.dev and base44.com only - */
const COMPARISON_SLUG = "base44-vs-lovable";
const COMPARISON = {
  subtitle:
    "Two strong AI app builders. The choice comes down to what you want managed for you, and what you want to keep.",
  intro:
    "Both turn plain-language prompts into working apps, and both have free plans. They differ in what they manage for you and what you walk away with. Base44 bundles the database, sign-in, email, and hosting into one managed platform; Lovable pairs the same prompt-to-app speed with code you can sync to GitHub on any plan. This comparison uses only what each company publishes on its own site.",
  criteria: [
    {
      label: "Getting your code",
      aText: "Two-way GitHub sync from the Builder plan up; in-app code edits from Starter.",
      bText: "Two-way GitHub sync on every plan, plus direct code download.",
      winner: "b",
      note: "Lovable hands you the code on any plan; on Base44 it starts with a paid plan.",
    },
    {
      label: "What's built in",
      aText: "Database, authentication, email, integrations, and hosting.",
      bText: "Building and hosting on Lovable Cloud, from one credit balance.",
      winner: "a",
      note: "Base44 lists more managed services out of the box.",
    },
    {
      label: "Free plan",
      aText: "25 message credits and 100 integration credits a month, up to 5 apps.",
      bText: "5 build credits a day (up to 30 a month) plus 20 Cloud credits a month.",
      winner: "tie",
    },
    {
      label: "Paid plans",
      aText: "Starter, Builder, Pro, and Elite raise the monthly credit allowances.",
      bText: "Paid plans add a monthly credit balance on top of the free grants.",
      winner: "tie",
    },
    {
      label: "Best fit",
      aText: "Non-coders who want the whole backend managed in one place.",
      bText: "Non-coders who want a working app now and the code within reach later.",
      winner: "tie",
    },
  ] satisfies ComparisonCriterion[],
  verdictA:
    "Choose Base44 if you want the database, sign-in, email, and hosting managed in one place, and GitHub sync on a paid plan is fine.",
  verdictB:
    "Choose Lovable if you want a working app now and your code in GitHub on any plan — the right default for most non-coders.",
  bottomLine:
    "For most non-coders, Lovable is the default pick: it gets you to a working app quickly and keeps the code within reach on every plan. Base44 is the better fit when you'd rather have every backend service managed for you — internal tools and quick prototypes especially.",
  seoTitle: "Base44 vs Lovable (2026): Which AI App Builder to Choose",
  seoDescription:
    "Getting your code, what's built in, free plans, and paid plans compared using each company's own published details. Lovable for most non-coders; Base44 when you want everything managed.",
};

/* ---- Settings -------------------------------------------------------- */
const SETTINGS_COPY = {
  seoDefaultTitle: "DaddyPromoos — AI app builder and SaaS reviews",
  seoDefaultDescription:
    "Reviews and head-to-head comparisons of AI app builders, coding tools and business software.",
  footerTagline:
    "Independent reviews of AI app builders, coding tools and business software — the verdict states the catch, not just the praise.",
};
const BANNED_WORDING = /\b(deals?|coupons?|promo codes?|verified|sav(e|es|ing))\b/i;

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

/** Key order ignored: Postgres jsonb stores object keys in its own order, so
 * a value read back never stringifies exactly like the literal it came from. */
const canonical = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(canonical)
    : v !== null && typeof v === "object" && !(v instanceof Date)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical((v as Record<string, unknown>)[k])]),
        )
      : v;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const short = (s: string, n = 56) => (s.length > n ? `${s.slice(0, n)}…` : s);
const bullets = (items: string[]) => items.map((i) => `\n      - ${i}`).join("");

/** Drop any old "Verified <Month> <year>." stamp and end with the current one. */
const restamp = (text: string, stamp: string) =>
  text.includes(stamp)
    ? text
    : `${text.replace(/\s*Verified [A-Z][a-z]+ \d{4}\.$/, "").trimEnd()} ${stamp}`;

/* ------------------------------------------------------------------ */
/* Plan                                                                */
/* ------------------------------------------------------------------ */

async function plan(): Promise<Op[]> {
  const ops: Op[] = [];
  const [storeRows, couponRows, postRows, comparisonRows, promoRows, settingsRow] =
    await Promise.all([
      db.select().from(stores),
      db.select().from(coupons),
      db
        .select({ id: posts.id, slug: posts.slug, contentJson: posts.contentJson })
        .from(posts),
      db.select().from(comparisons),
      db.select().from(promos),
      db.query.settings.findFirst(),
    ]);

  const bySlug = new Map(storeRows.map((s) => [s.slug, s]));
  const lovable = bySlug.get("lovable");
  const base44 = bySlug.get("base44");
  if (!lovable) throw new Error('No store with slug "lovable".');
  if (!base44) throw new Error('No store with slug "base44" — create it in /admin/stores first.');

  /* 1. Hidden brands ------------------------------------------------- */
  for (const slug of HIDDEN_STORES) {
    const s = bySlug.get(slug);
    if (s?.isActive) {
      ops.push({
        label: `store ${slug}: hide (is_active → false)`,
        run: (tx) => tx.update(stores).set({ isActive: false }).where(eq(stores.id, s.id)),
      });
    }
  }

  /* 2. Store SEO copy still on the seeded deals pattern -------------- */
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
        label: `store ${s.slug}: SEO title → "${set.seoTitle ?? s.seoTitle}"`,
        run: (tx) => tx.update(stores).set(set).where(eq(stores.id, s.id)),
      });
    }
  }

  /* 3. Hide Lovable and Base44 offer rows ---------------------------- */
  const noOfferIds = NO_OFFER_STORES.map((slug) => bySlug.get(slug)?.id);
  const visibleOffers = couponRows.filter(
    (c) => noOfferIds.includes(c.storeId) && c.isActive,
  );
  if (visibleOffers.length > 0) {
    const name = (c: (typeof couponRows)[number]) =>
      `${c.storeId === lovable.id ? "Lovable" : "Base44"}: "${c.title}"`;
    ops.push({
      label: `offers → hidden (${visibleOffers.length}):${bullets(visibleOffers.map(name))}`,
      run: (tx) =>
        tx
          .update(coupons)
          .set({ isActive: false })
          .where(inArray(coupons.id, visibleOffers.map((c) => c.id))),
    });
  }

  /* 4. Base44 affiliate URL ----------------------------------------- */
  if (base44.affiliateBaseUrl !== BASE44_AFFILIATE_URL) {
    ops.push({
      label: `store base44: affiliate URL "${base44.affiliateBaseUrl ?? ""}" → "${BASE44_AFFILIATE_URL}"`,
      run: (tx) =>
        tx
          .update(stores)
          .set({ affiliateBaseUrl: BASE44_AFFILIATE_URL })
          .where(eq(stores.id, base44.id)),
    });
  }

  /* 5. Lovable facts + review date ----------------------------------- */
  const lovablePricing = lovable.pricingSummary?.map((row) =>
    row.plan === "Free"
      ? { ...row, price: "Free", note: LOVABLE_FREE_NOTE }
      : { ...row, note: restamp(row.note ?? "", LOVABLE_CHECKED_NOTE) },
  );
  const lovableFixed = fixText(
    {
      goodPoints: lovable.goodPoints,
      weakPoints: lovable.weakPoints,
      faq: lovable.faq,
      pricingSummary: lovablePricing,
      reviewBody: lovable.reviewBody,
    },
    LOVABLE_TEXT_FIXES,
  );
  const lovableChanges = lovableFixed.hits.map((h) => `text: ${short(h)}`);
  if (!same(lovablePricing, lovable.pricingSummary)) {
    lovableChanges.push('pricing rows restated from lovable.dev and dated (drops unconfirmed "public projects")');
  }
  if (lovable.lastReviewedAt?.getTime() !== LOVABLE_CHECKED_AT.getTime()) {
    lovableChanges.push(
      `review date ${lovable.lastReviewedAt?.toISOString().slice(0, 10) ?? "(none — pricing table hidden)"} → 2026-09-24`,
    );
  }
  if (lovableChanges.length > 0) {
    ops.push({
      label: `store lovable: ${lovableChanges.length} correction(s)${bullets(lovableChanges)}`,
      run: (tx) =>
        tx
          .update(stores)
          .set({ ...lovableFixed.value, lastReviewedAt: LOVABLE_CHECKED_AT })
          .where(eq(stores.id, lovable.id)),
    });
  }
  for (const p of postRows) {
    const fixed = fixText(p.contentJson, LOVABLE_TEXT_FIXES);
    if (fixed.hits.length > 0) {
      ops.push({
        label: `post ${p.slug}: ${fixed.hits.length} stale Lovable fact(s)${bullets(fixed.hits.map((h) => short(h)))}`,
        run: (tx) => tx.update(posts).set({ contentJson: fixed.value }).where(eq(posts.id, p.id)),
      });
    }
  }

  /* 6a. Base44 review ------------------------------------------------ */
  const base44Body = fixText(base44.reviewBody, BASE44_BODY_FIXES);
  const base44Set: Partial<typeof stores.$inferInsert> = {};
  const base44Changes: string[] = [];
  for (const key of [
    "verdict",
    "useItFor",
    "skipItIf",
    "startingPriceLabel",
    "goodPoints",
    "weakPoints",
    "pricingSummary",
    "pricingUrl",
    "faq",
  ] as const) {
    if (!same(base44[key], BASE44_REVIEW[key])) {
      Object.assign(base44Set, { [key]: BASE44_REVIEW[key] });
      base44Changes.push(key);
    }
  }
  if (base44Body.hits.length > 0) {
    base44Set.reviewBody = base44Body.value;
    base44Changes.push(
      ...base44Body.hits.map((h) => `review body: ${short(h)}`),
    );
  }
  if (base44.lastReviewedAt?.getTime() !== BASE44_CHECKED_AT.getTime()) {
    base44Set.lastReviewedAt = BASE44_CHECKED_AT;
    base44Changes.push(
      `review date ${base44.lastReviewedAt?.toISOString().slice(0, 10) ?? "(none — pricing table hidden)"} → 2026-09-29`,
    );
  }
  if (base44Changes.length > 0) {
    ops.push({
      label: `store base44: review updated from base44.com (${base44Changes.length})${bullets(base44Changes)}`,
      run: (tx) => tx.update(stores).set(base44Set).where(eq(stores.id, base44.id)),
    });
  }

  /* 6b. Base44 vs Lovable comparison --------------------------------- */
  const existing = comparisonRows.find((c) => c.slug === COMPARISON_SLUG);
  if (!existing) {
    ops.push({
      label: `comparison ${COMPARISON_SLUG}: create (Base44 vs Lovable, published)`,
      run: (tx) =>
        tx.insert(comparisons).values({
          slug: COMPARISON_SLUG,
          title: "Base44 vs Lovable",
          storeAId: base44.id,
          storeBId: lovable.id,
          status: "published",
          ...COMPARISON,
        }),
    });
  } else {
    if (existing.storeAId !== base44.id || existing.storeBId !== lovable.id) {
      throw new Error(
        `${COMPARISON_SLUG} is not Base44 (A) vs Lovable (B); refusing to rewrite its criteria.`,
      );
    }
    const set: Partial<typeof comparisons.$inferInsert> = {};
    for (const key of Object.keys(COMPARISON) as (keyof typeof COMPARISON)[]) {
      if (!same(existing[key], COMPARISON[key])) {
        Object.assign(set, { [key]: COMPARISON[key] });
      }
    }
    if (existing.status !== "published") set.status = "published";
    if (Object.keys(set).length > 0) {
      ops.push({
        label: `comparison ${COMPARISON_SLUG}: update ${Object.keys(set).join(", ")} (drops "Re-tested July 2026"; facts from both vendors' sites)`,
        run: (tx) =>
          tx.update(comparisons).set(set).where(eq(comparisons.id, existing.id)),
      });
    }
  }

  /* 7. Promos, popups, settings copy -------------------------------- */
  const activePromos = promoRows.filter(
    (p) => p.isActive && OLD_PROMOS.includes(p.name),
  );
  if (activePromos.length > 0) {
    ops.push({
      label: `promos → off (${activePromos.length}):${bullets(activePromos.map((p) => p.name))}`,
      run: (tx) =>
        tx
          .update(promos)
          .set({ isActive: false })
          .where(inArray(promos.id, activePromos.map((p) => p.id))),
    });
  }
  if (settingsRow) {
    const set: Partial<typeof settings.$inferInsert> = {};
    const notes: string[] = [];
    if (settingsRow.popupRules.popupsEnabled) {
      set.popupRules = { ...settingsRow.popupRules, popupsEnabled: false };
      notes.push("popups kill-switch → off");
    }
    for (const key of ["seoDefaultTitle", "seoDefaultDescription", "footerTagline"] as const) {
      if (BANNED_WORDING.test(settingsRow[key])) {
        set[key] = SETTINGS_COPY[key];
        notes.push(`${key}: "${short(settingsRow[key], 40)}" → "${short(SETTINGS_COPY[key], 40)}"`);
      }
    }
    if (notes.length > 0) {
      ops.push({
        label: `settings:${bullets(notes)}`,
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
  console.log(
    APPLY
      ? "APPLY — writing in one transaction.\n"
      : "DRY RUN — nothing will be written. Pass --apply to write.\n",
  );

  const ops = await plan();
  if (ops.length === 0) {
    console.log("Nothing to do: production already matches.");
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
