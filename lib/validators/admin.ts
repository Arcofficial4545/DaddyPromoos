import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers, hyphens.");

const optionalUrl = z
  .union([z.url({ error: "Enter a full URL (https://...)" }), z.literal("")])
  .transform((v) => (v === "" ? null : v));

const optionalText = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v === "" ? null : v));

const optionalLongText = z
  .string()
  .trim()
  .max(3000)
  .transform((v) => (v === "" ? null : v));

/** Newline-separated textarea → trimmed string[] (empty lines dropped). */
const lines = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean),
  );

/** JSON textarea → parsed value, or null when blank; friendly error on bad JSON. */
const jsonOrNull = z.string().default("").transform((s, ctx) => {
  const t = s.trim();
  if (!t) return null;
  try {
    return JSON.parse(t) as unknown;
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid JSON — check the format." });
    return z.NEVER;
  }
});

const optionalScore = z
  .union([z.coerce.number().min(0).max(10), z.literal("")])
  .transform((v) => (v === "" ? null : v));

export const storeSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug,
  tagline: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
  websiteUrl: z.url({ error: "Enter a full URL (https://...)" }),
  affiliateBaseUrl: optionalUrl,
  logoUrl: optionalUrl,
  rating: z.coerce.number().min(0).max(5).default(0),
  isFeatured: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  seoTitle: optionalText,
  seoDescription: optionalText,
  categoryIds: z.array(z.uuid()).default([]),
  /* ------------------------------ Review (v2) ------------------------------ */
  editorialScore: optionalScore,
  heroSummary: optionalLongText,
  verdict: optionalLongText,
  useItFor: optionalLongText,
  skipItIf: optionalLongText,
  startingPriceLabel: optionalText,
  pricingUrl: optionalUrl,
  goodPoints: lines,
  weakPoints: lines,
  screenshots: lines,
  alternativeSlugs: z.array(z.string().trim().min(1)).max(3).default([]),
  ratingBreakdown: jsonOrNull,
  pricingSummary: jsonOrNull,
  faq: jsonOrNull,
  reviewBody: jsonOrNull,
  /** Manual override; the action sets "now" when a review exists and this is blank. */
  lastReviewedAt: z.string().transform((v) => (v ? new Date(v) : null)),
});

export const couponSchema = z
  .object({
    storeId: z.uuid({ error: "Pick a store." }),
    title: z.string().trim().min(4).max(200),
    type: z.enum(["code", "deal"]),
    code: z
      .string()
      .trim()
      .max(60)
      .transform((v) => (v === "" ? null : v.toUpperCase())),
    discountLabel: z.string().trim().min(2).max(40),
    discountValue: z
      .union([z.coerce.number().min(0), z.literal("")])
      .transform((v) => (v === "" ? null : v)),
    terms: z.string().trim().max(2000).default(""),
    destinationUrl: optionalUrl,
    startsAt: z
      .string()
      .transform((v) => (v ? new Date(v) : null)),
    expiresAt: z
      .string()
      .transform((v) => (v ? new Date(v) : null)),
    isVerified: z.coerce.boolean().default(false),
    isExclusive: z.coerce.boolean().default(false),
    isActive: z.coerce.boolean().default(true),
    sortWeight: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((data) => data.type === "deal" || (data.code && data.code.length > 0), {
    message: "Code-type coupons need a code.",
    path: ["code"],
  });

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug,
  description: z.string().trim().max(500).default(""),
  icon: z.string().trim().min(2).max(40).default("tag"),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const postSchema = z.object({
  title: z.string().trim().min(4).max(200),
  slug,
  excerpt: z.string().trim().max(500).default(""),
  contentJson: z.object({ type: z.literal("doc") }).passthrough(),
  coverImageUrl: optionalUrl,
  authorId: z.uuid(),
  categoryId: z
    .union([z.uuid(), z.literal("")])
    .transform((v) => (v === "" ? null : v)),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().transform((v) => (v ? new Date(v) : null)),
  readingMinutes: z.coerce.number().int().min(1).max(90).default(3),
  seoTitle: optionalText,
  seoDescription: optionalText,
  relatedStoreIds: z.array(z.uuid()).default([]),
});

export const promoSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    placement: z.enum([
      "sidebar",
      "sticky-rail",
      "in-content",
      "popup-timed",
      "popup-exit",
      "home-banner",
    ]),
    type: z.enum(["coupon-highlight", "custom-card", "newsletter"]),
    couponId: z
      .union([z.uuid(), z.literal("")])
      .transform((v) => (v === "" ? undefined : v)),
    title: z.string().trim().max(160).default(""),
    body: z.string().trim().max(600).default(""),
    ctaLabel: z.string().trim().max(40).default(""),
    ctaUrl: optionalUrl,
    /** Custom-card banner image (e.g. an affiliate program's creative). */
    imageUrl: optionalUrl,
    paths: z.string().trim().max(500).default(""),
    excludePaths: z.string().trim().max(500).default(""),
    frequencyCap: z.coerce.number().int().min(1).max(20).default(1),
    frequencyDays: z.coerce.number().int().min(1).max(90).default(7),
    delayMs: z.coerce.number().int().min(0).max(120_000).default(12_000),
    startsAt: z.string().transform((v) => (v ? new Date(v) : null)),
    endsAt: z.string().transform((v) => (v ? new Date(v) : null)),
    priority: z.coerce.number().int().min(0).max(100).default(0),
    isActive: z.coerce.boolean().default(true),
  })
  .refine(
    (data) => data.type !== "coupon-highlight" || !!data.couponId,
    { message: "Coupon-highlight promos need a coupon.", path: ["couponId"] },
  );

export const comparisonSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    slug,
    subtitle: z.string().trim().max(300).default(""),
    storeAId: z.uuid({ error: "Pick the first tool." }),
    storeBId: z.uuid({ error: "Pick the second tool." }),
    intro: z.string().trim().max(4000).default(""),
    criteria: z.string().default("").transform((s, ctx) => {
      const t = s.trim();
      if (!t) return [];
      try {
        return JSON.parse(t) as unknown[];
      } catch {
        ctx.addIssue({ code: "custom", message: "Criteria: invalid JSON." });
        return z.NEVER;
      }
    }),
    verdictA: z.string().trim().max(800).default(""),
    verdictB: z.string().trim().max(800).default(""),
    bottomLine: z.string().trim().max(1000).default(""),
    status: z.enum(["draft", "published"]),
    isFeatured: z.coerce.boolean().default(false),
    seoTitle: optionalText,
    seoDescription: optionalText,
  })
  .refine((d) => d.storeAId !== d.storeBId, {
    message: "Pick two different tools.",
    path: ["storeBId"],
  });

export const settingsSchema = z.object({
  siteName: z.string().trim().min(2).max(80),
  seoDefaultTitle: z.string().trim().min(2).max(160),
  seoDefaultDescription: z.string().trim().min(2).max(300),
  footerTagline: z.string().trim().min(2).max(300),
  disclosureText: z.string().trim().min(2).max(600),
  popupsEnabled: z.coerce.boolean().default(true),
  globalCooldownHours: z.coerce.number().int().min(0).max(720).default(24),
  defaultDelayMs: z.coerce.number().int().min(0).max(120_000).default(12_000),
  socialX: optionalUrl,
  socialLinkedin: optionalUrl,
  socialYoutube: optionalUrl,
});

export type StoreInput = z.input<typeof storeSchema>;
export type CouponInput = z.input<typeof couponSchema>;
export type CategoryInput = z.input<typeof categorySchema>;
export type PostInput = z.input<typeof postSchema>;
export type PromoInput = z.input<typeof promoSchema>;
export type SettingsInput = z.input<typeof settingsSchema>;
export type ComparisonInput = z.input<typeof comparisonSchema>;
