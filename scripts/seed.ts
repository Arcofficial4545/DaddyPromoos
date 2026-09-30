/**
 * Seed the local SQLite database with development data.
 * Destructive: clears all content tables first. Run: npm run db:seed
 *
 * v2 integrity rules:
 * - Real brands carry honest deal-type offers routed to official pages, plus
 *   any community-submitted codes (left unverified until confirmed).
 * - No fabricated usage stats: click/reveal/vote counts start at zero.
 * - Editorial content (verdict, pros/cons, pricing structure, FAQ) is
 *   research-based analysis, dated via lastReviewedAt.
 */
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// tsx doesn't load Next's env files; pick up .env.local ourselves.
try {
  process.loadEnvFile(".env.local");
} catch {
  // fine — fall back to whatever is already in the environment
}

import { db } from "../lib/db/client-node";
import { hashPassword } from "../lib/auth/password";
import {
  adminUsers,
  authors,
  categories,
  clicks,
  codeFeedback,
  comparisons,
  coupons,
  newsletterSubscribers,
  posts,
  postStores,
  promos,
  settings,
  storeCategories,
  stores,
  type ComparisonCriterion,
  type NewPromo,
  type FaqItem,
  type PricingRow,
  type RatingCriterion,
  type RedeemStep,
  type TiptapDoc,
} from "../lib/db/schema";

const now = Date.now();
const days = (n: number) => new Date(now + n * 86_400_000);
const REVIEWED_AT = new Date(now - 3 * 86_400_000);

/* ------------------------------------------------------------------ */
/* Store SEO copy (shared with scripts/reposition-builder-focus.ts,    */
/* which brings production in line with these values)                 */
/* ------------------------------------------------------------------ */

export const storeSeoTitle = (name: string) =>
  `${name} Review: Pricing, Pros & Cons`;
export const storeSeoDescription = (name: string, tagline: string) =>
  `Independent review of ${name}: verdict, 0–10 score, pricing, pros and cons, and alternatives. ${tagline}`;

/** Pick up a brand asset already fetched to /public (by assets:fetch) so a
 * destructive reseed doesn't blank logos/covers. Returns a public URL or null. */
function diskAsset(dir: string, slug: string, exts: string[]): string | null {
  for (const ext of exts) {
    if (existsSync(path.join(process.cwd(), "public", dir, `${slug}.${ext}`))) {
      return `/${dir}/${slug}.${ext}`;
    }
  }
  return null;
}
const LOGO_EXTS = ["svg", "png", "ico", "jpg", "jpeg", "webp"];
const COVER_EXTS = ["jpg", "jpeg", "png", "webp"];

/* ------------------------------------------------------------------ */
/* Tiptap content helpers                                              */
/* ------------------------------------------------------------------ */

type Node = Record<string, unknown>;

const text = (t: string) => ({ type: "text", text: t });
const p = (...content: Node[]) => ({ type: "paragraph", content });
const pt = (t: string) => p(text(t));
const h2 = (t: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [text(t)],
});
const bullets = (items: string[]) => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [pt(i)] })),
});
const quote = (t: string) => ({ type: "blockquote", content: [pt(t)] });
const couponEmbed = (couponId: string) => ({
  type: "couponEmbed",
  attrs: { couponId },
});
const promoSlot = () => ({
  type: "promoSlot",
  attrs: { placement: "in-content" },
});
const doc = (...content: Node[]): TiptapDoc => ({ type: "doc", content });

/* ------------------------------------------------------------------ */
/* Wipe                                                                */
/* ------------------------------------------------------------------ */

async function wipe() {
  await db.delete(codeFeedback);
  await db.delete(clicks);
  await db.delete(postStores);
  await db.delete(posts);
  await db.delete(promos);
  await db.delete(comparisons);
  await db.delete(coupons);
  await db.delete(storeCategories);
  await db.delete(stores);
  await db.delete(categories);
  await db.delete(authors);
  await db.delete(newsletterSubscribers);
  await db.delete(settings);
  await db.delete(adminUsers);
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

const categorySeed = [
  { name: "AI Tools", slug: "ai-tools", icon: "bot", description: "Assistants, generators, and AI-first products that actually ship value.", sortOrder: 1 },
  { name: "AI IDEs & Coding Agents", slug: "ai-ides-coding-agents", icon: "terminal", description: "AI-native code editors and autonomous coding agents built for developers.", sortOrder: 2 },
  { name: "No-Code / App Builders", slug: "no-code-app-builders", icon: "blocks", description: "Build and launch software without writing every line yourself.", sortOrder: 3 },
  { name: "SaaS", slug: "saas", icon: "cloud", description: "Software subscriptions worth paying for — and paying less for.", sortOrder: 4 },
  { name: "Accounting & Finance", slug: "accounting-finance", icon: "calculator", description: "Bookkeeping, invoicing, and finance stacks for small teams.", sortOrder: 5 },
  { name: "E-commerce", slug: "e-commerce", icon: "shopping-cart", description: "Storefronts, marketplaces, and the tools that power online selling.", sortOrder: 6 },
  { name: "Design", slug: "design", icon: "pen-tool", description: "Design, prototyping, and creative tooling for modern teams.", sortOrder: 7 },
  { name: "Productivity", slug: "productivity", icon: "list-checks", description: "Docs, tasks, and workflow tools that keep teams moving.", sortOrder: 8 },
  { name: "Marketing", slug: "marketing", icon: "megaphone", description: "Copy, campaigns, SEO, and growth tooling.", sortOrder: 9 },
];

/* ------------------------------------------------------------------ */
/* Stores — real brands with full company-page content                 */
/* ------------------------------------------------------------------ */

type StoreSeed = {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  websiteUrl: string;
  rating: number; // editorial score / 2, on the 0–5 scale
  isFeatured?: boolean;
  /** Off-focus brands stay in the catalog but are not published (default true). */
  isActive?: boolean;
  isFictional?: boolean;
  cats: string[];
  // Company page content (omit for fictional demo brands)
  heroSummary?: string;
  verdict?: string;
  editorialScore?: number;
  useItFor?: string;
  skipItIf?: string;
  goodPoints?: string[];
  weakPoints?: string[];
  pricingSummary?: PricingRow[];
  pricingUrl?: string;
  howToRedeem?: RedeemStep[];
  faq?: FaqItem[];
  alternativeSlugs?: string[];
};

const defaultRedeem: RedeemStep[] = [
  { step: 1, text: "Click the offer on this page — it opens the official site in a new tab through our tracked link." },
  { step: 2, text: "No code needed: current promotions on this brand apply automatically on the official pricing or signup page." },
  { step: 3, text: "Pick a plan and check the order summary before paying — the active discount or free tier is shown there." },
];

const storeSeed: StoreSeed[] = [
  /* ------------------------------------------------ Base44 (flagship) */
  {
    name: "Base44",
    slug: "base44",
    tagline: "Build working apps from plain-language prompts.",
    description:
      "Base44 is an AI app-building platform, operated by Wix, that turns plain-language prompts into working web applications with a built-in database, user authentication, and hosting. It targets founders and operators who want functional software without hiring engineers.",
    websiteUrl: "https://base44.com",
    rating: 4.5,
    cats: ["ai-tools", "no-code-app-builders"],
    heroSummary:
      "Base44 is an AI app builder operated by Wix: you describe the product you want in plain language and it assembles a working web app — database, user accounts, and hosting included — that you refine through further prompts. It suits non-technical founders, operators building internal tools, and anyone validating an idea before committing engineering budget.",
    verdict:
      "The most self-contained way to get from an idea to a working, hosted app without touching infrastructure. You trade that convenience for a managed stack you can't fully take with you, so know your exit plan before you build something business-critical on it.",
    editorialScore: 9.0,
    useItFor:
      "Validating product ideas fast, internal tools, and MVPs where shipping this week matters more than owning the stack.",
    skipItIf:
      "You need to self-host, expect heavy custom backend logic, or your team will want to take over the code in a standard repo workflow.",
    goodPoints: [
      "Genuinely all-in-one: database, auth, email, and hosting are built in, so a prompt becomes a usable app without wiring third-party services.",
      "Fast iteration loop — describing a change in plain language and seeing it applied is quicker than any visual builder we cover.",
      "Being operated by Wix gives it more institutional backing than most AI builders in this space.",
      "The free tier is enough to build and share a real prototype before paying anything.",
    ],
    weakPoints: [
      "Credit-metered pricing can burn quickly during heavy iteration — lots of small prompt revisions all consume credits.",
      "Limited exit path: you can't simply self-host the full stack elsewhere, which matters if the prototype becomes the product.",
      "Generated output still needs human review — treat it as a very fast first draft, not finished software.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "Enough message credits to build and share a working prototype." },
      { plan: "Paid tiers", price: "Credit-metered monthly", note: "Higher tiers buy larger monthly credit allowances that reset each month; heavy builders should size up." },
    ],
    pricingUrl: "https://base44.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is there a real free tier?", a: "Yes. You can build and publish a working app on the free plan; it's limited by monthly message credits rather than a time-boxed trial." },
      { q: "How do credits work?", a: "Each prompt or change you ask for consumes credits, and paid plans reset your allowance monthly. Bigger plans mainly mean more credits — check the official pricing page for current numbers." },
      { q: "Do I own what I build?", a: "You own your app's content and data, and can export your data. The platform itself stays managed by Base44 — you can't lift the whole stack onto your own servers." },
      { q: "Can I export the code?", a: "Base44 is a managed platform first: it's built to run your app for you, not to hand over a standalone repository. If a clean code export is a hard requirement, look at Lovable." },
      { q: "Base44 or Lovable?", a: "Base44 is faster to a hosted, working app with zero setup. Lovable produces standard React/Supabase code you keep. Choose by exit plan — see our full comparison for details." },
    ],
    alternativeSlugs: ["lovable", "bubble"],
  },
  /* -------------------------------------------------------- Lovable */
  {
    name: "Lovable",
    slug: "lovable",
    tagline: "The AI full-stack engineer for your next product.",
    description:
      "Lovable generates production-grade React and Supabase applications from conversational prompts, with code you can export and own. It suits product teams that want AI speed now and a standard codebase later.",
    websiteUrl: "https://lovable.dev",
    rating: 4.6,
    isFeatured: true,
    cats: ["ai-tools", "no-code-app-builders", "ai-ides-coding-agents"],
    heroSummary:
      "Lovable is an AI app builder that writes real React front ends and Supabase back ends from a chat conversation. Unlike fully managed builders, its output is a standard codebase you can connect to GitHub and develop like any other project — which makes it the AI builder engineers object to least.",
    verdict:
      "The strongest answer to the lock-in question in this category: you get AI-speed prototyping and leave with code your team can own. Costs climb as usage grows, and you'll still want engineering review before anything customer-facing ships.",
    editorialScore: 9.2,
    useItFor:
      "MVPs that will graduate into a real product, and teams that insist on owning a standard React/Supabase codebase.",
    skipItIf:
      "You want a fully managed platform where hosting, auth, and scaling are somebody else's job forever.",
    goodPoints: [
      "Exports genuine React + Supabase code and syncs to GitHub, so there's a credible path off the platform.",
      "Architecture choices are sensible defaults an engineer can pick up rather than proprietary abstractions.",
      "Conversational iteration is fast, and visual edits let you tweak details directly instead of prompting for every small change.",
      "Free tier is enough to judge output quality on your own idea before paying.",
    ],
    weakPoints: [
      "Credit-based pricing means costs scale with how much you iterate, not how much you ship.",
      "You still need Supabase (and sometimes other services) knowledge once you outgrow the happy path.",
      "Complex, unusual product logic can send the AI in circles — human review remains mandatory.",
    ],
    pricingSummary: [
      { plan: "Free", price: "Free", note: "5 build credits a day (up to 30 a month) plus 20 Cloud credits a month. Checked 24 Sep 2026." },
      { plan: "Pro / Business", price: "Monthly, credit-metered", note: "Adds a monthly credit balance on top of the daily build + Cloud grants; heavy iteration consumes credits. Confirm the live tiers and prices on the official page. Checked 24 Sep 2026." },
    ],
    pricingUrl: "https://lovable.dev/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Do I really own the code?", a: "Yes — projects can sync to your GitHub, and the output is standard React with a Supabase backend, not a proprietary format." },
      { q: "What does the free plan include?", a: "5 build credits a day (up to 30 a month) plus 20 Cloud credits a month — enough to build something real and inspect the code it writes before subscribing." },
      { q: "Do I need to know how to code?", a: "Not to get started. But teams that eventually read and edit the generated code get dramatically more out of it." },
      { q: "Lovable or Base44?", a: "Lovable if the code must be yours; Base44 if you want the most managed, fastest path to a hosted app. Our head-to-head comparison covers the details." },
    ],
    alternativeSlugs: ["base44", "webflow"],
  },
  /* ---------------------------------------------------------- Daraz */
  {
    name: "Daraz",
    slug: "daraz",
    tagline: "South Asia's leading online marketplace.",
    description:
      "Daraz is the dominant online marketplace across Pakistan, Bangladesh, Sri Lanka, and Nepal, carrying everything from electronics to daily essentials. Owned by Alibaba Group, it runs frequent sale events and bank-card partnerships.",
    websiteUrl: "https://www.daraz.pk",
    rating: 3.7,
    isActive: false, // off-focus for an AI-builder site; kept, not published
    isFeatured: true,
    cats: ["e-commerce"],
    heroSummary:
      "Daraz is the largest e-commerce marketplace in South Asia, owned by Alibaba Group, selling electronics, fashion, groceries, and everyday essentials across Pakistan, Bangladesh, Sri Lanka, and Nepal. Its calendar of flash sales and bank partnerships means timing a purchase well genuinely changes what you pay.",
    verdict:
      "For shoppers in its markets, Daraz is usually the widest selection and the most aggressive discounting available — if you buy during sale events and from well-rated sellers. Marketplace quality varies by seller, so the ratings and return policy are your friends.",
    editorialScore: 7.4,
    useItFor:
      "Electronics and household purchases in South Asia, timed around the big sale events (11.11, 12.12, payday sales) and bank-card days.",
    skipItIf:
      "You need guaranteed authenticity on premium brands or same-day delivery reliability — check the seller, not just the listing.",
    goodPoints: [
      "Widest online selection in its markets, from phones to groceries, on one account.",
      "Sale events and bank partnerships produce real, verifiable discounts rather than inflated-then-cut prices on most listings.",
      "The app's vouchers and free-shipping offers are frequent and genuinely usable.",
    ],
    weakPoints: [
      "It's a marketplace: product quality and shipping speed depend heavily on the individual seller.",
      "Customer service on disputes can be slow; returns require patience and documentation.",
    ],
    pricingSummary: [
      { plan: "Shopping", price: "Free to use", note: "Marketplace pricing varies by seller; vouchers and bank offers apply at checkout." },
      { plan: "Sale events", price: "Seasonal", note: "The deepest discounts cluster around 11.11, 12.12, and payday sales — worth waiting for on big-ticket items." },
    ],
    pricingUrl: "https://www.daraz.pk",
    howToRedeem: [
      { step: 1, text: "Open Daraz through the offer on this page — deals and vouchers are applied on the Daraz site or app." },
      { step: 2, text: "Collect any available vouchers on the product or campaign page before checkout." },
      { step: 3, text: "At checkout, confirm the voucher and any bank-card discount are reflected in the order total before paying." },
    ],
    faq: [
      { q: "Are Daraz sale prices real discounts?", a: "During the major events, largely yes — especially with stacked vouchers and bank offers. Compare against the recent price on the listing when in doubt." },
      { q: "Is buying on Daraz safe?", a: "Buying from highly rated sellers and DarazMall listings is reliable; payment is protected. Third-party sellers vary, so check ratings and reviews." },
      { q: "When are the biggest sales?", a: "11.11 and 12.12 are the flagship events, with payday sales monthly and seasonal campaigns in between." },
      { q: "Does Daraz have free shipping?", a: "Frequently, as a promotion — usually with a minimum spend or for app orders. The offer terms at checkout are definitive." },
    ],
    alternativeSlugs: ["shopify"],
  },
  /* -------------------------------------------------------- Sage UK */
  {
    name: "Sage UK",
    slug: "sage-uk",
    tagline: "Accounting software trusted by UK small businesses.",
    description:
      "Sage provides accounting, payroll, and HR software tailored to UK small and mid-sized businesses. Making Tax Digital compliance, solid reporting, and accountant familiarity have kept it a mainstay of British bookkeeping for decades.",
    websiteUrl: "https://www.sage.com/en-gb/",
    rating: 3.9,
    isFeatured: true,
    cats: ["accounting-finance", "saas"],
    heroSummary:
      "Sage is one of the longest-standing names in UK small-business accounting, covering bookkeeping, VAT and Making Tax Digital submissions, payroll, and HR. Its cloud products (Sage Accounting, Sage Payroll) target sole traders through mid-sized companies, and most UK accountants can work in it without a learning curve.",
    verdict:
      "A safe, compliant, accountant-friendly choice for UK businesses — especially where payroll and MTD matter. It's not the slickest interface in the category, and pricing creeps as you add modules, but frequent long free-period promotions soften year-one cost considerably.",
    editorialScore: 7.8,
    useItFor:
      "UK limited companies and sole traders that want MTD-compliant bookkeeping plus payroll under one vendor their accountant already knows.",
    skipItIf:
      "You want the most modern UX or run a US-style business — QuickBooks or newer tools may fit better.",
    goodPoints: [
      "MTD VAT submissions are built in and dependable — compliance is the core competency.",
      "Payroll integration up to mid-sized headcounts under the same vendor.",
      "Deep accountant familiarity in the UK: handover to a bookkeeper is frictionless.",
      "Runs long promotional free periods for new customers on a regular basis.",
    ],
    weakPoints: [
      "Interface feels dated next to newer cloud accounting tools.",
      "Costs add up module by module (accounting + payroll + extras are separate line items).",
    ],
    pricingSummary: [
      { plan: "Sage Accounting", price: "Monthly per tier", note: "Start / Standard / Plus tiers by feature depth; frequent extended free periods for new customers." },
      { plan: "Sage Payroll", price: "Monthly by headcount", note: "Priced per employee band; often discounted heavily for the first months." },
    ],
    pricingUrl: "https://www.sage.com/en-gb/products/",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is Sage MTD-compliant?", a: "Yes — Making Tax Digital VAT submissions are a core, HMRC-recognised feature of Sage Accounting." },
      { q: "Which Sage product do I need?", a: "Sole traders usually start on Accounting Start; most limited companies fit Accounting Standard; Sage 50 targets established businesses with stock and departments." },
      { q: "Does Sage do payroll?", a: "Yes, Sage Payroll is a separate subscription that integrates with Accounting and handles RTI submissions to HMRC." },
      { q: "Is there a free trial?", a: "Sage typically runs free-period promotions for new customers rather than a permanent free tier — check the current offer on the official site." },
    ],
    alternativeSlugs: ["quickbooks"],
  },
  /* --------------------------------------------------------- Notion */
  {
    name: "Notion",
    slug: "notion",
    tagline: "One workspace for docs, wikis, and projects.",
    description:
      "Notion combines documents, databases, and project management in a single flexible workspace, with AI features that draft, summarize, and answer questions across your knowledge base.",
    websiteUrl: "https://www.notion.com",
    rating: 4.4,
    isFeatured: true,
    cats: ["productivity", "saas"],
    heroSummary:
      "Notion is a flexible workspace that blends documents, wikis, databases, and project boards into one tool. Teams use it as their internal knowledge base and lightweight project tracker; its AI layer drafts, summarizes, and answers questions from your own pages.",
    verdict:
      "Still the best single tool for a team's docs-plus-lightweight-projects layer, with a free plan generous enough for personal use forever. It gets slower and less opinionated at scale — big teams need discipline (or a dedicated PM tool) to keep it tidy.",
    editorialScore: 8.8,
    useItFor:
      "Team wikis, internal docs, and flexible databases — the connective tissue between your tools.",
    skipItIf:
      "You need hard project-management structure (dependencies, workload) or blazing performance on huge workspaces.",
    goodPoints: [
      "One tool replaces a wiki, a doc editor, and a light project tracker.",
      "The free plan is genuinely usable long-term for individuals.",
      "Databases with relations are the most approachable no-code data modelling in any mainstream tool.",
      "AI features work on your own content, which is where workspace AI is actually useful.",
    ],
    weakPoints: [
      "Large workspaces get slow and messy without strong conventions.",
      "Offline support remains weak for a tool this central to daily work.",
      "AI is an additional cost consideration on team plans.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "Full personal use; collaboration limits apply." },
      { plan: "Plus / Business", price: "Per member, monthly", note: "Team collaboration, permissions, and larger file limits; AI availability varies by plan — check the official page." },
    ],
    pricingUrl: "https://www.notion.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is Notion really free?", a: "For personal use, yes — the free plan has no time limit. Teams pay per member for collaboration features." },
      { q: "What does Notion AI cost?", a: "AI has been packaged differently over time (add-on vs. bundled by plan). Treat the official pricing page as the source of truth." },
      { q: "Can Notion replace a project-management tool?", a: "For small teams, often yes. For dependency-heavy delivery work, most teams pair it with a dedicated PM tool like ClickUp." },
      { q: "Do startups get discounts?", a: "Notion has run startup programs with credits through accelerators and partners — eligibility rules apply on the official site." },
    ],
    alternativeSlugs: ["clickup", "canva"],
  },
  /* --------------------------------------------------------- Jasper */
  {
    name: "Jasper",
    slug: "jasper",
    tagline: "AI copilot for enterprise marketing teams.",
    description:
      "Jasper helps marketing teams produce on-brand content at scale, with brand-voice controls, campaign workflows, and integrations into the tools marketers already use.",
    websiteUrl: "https://www.jasper.ai",
    rating: 3.8,
    cats: ["ai-tools", "marketing"],
    heroSummary:
      "Jasper is an AI writing platform aimed squarely at marketing teams: brand-voice training, campaign workflows, and collaboration features wrap around the underlying models so output stays on-message across a team, not just for one writer.",
    verdict:
      "Worth it for marketing teams producing serious content volume who need brand consistency across many hands. Solo writers can get much of the raw capability from general-purpose AI tools for less — Jasper's value is the team layer.",
    editorialScore: 7.6,
    useItFor:
      "Marketing teams that need consistent brand voice across lots of content and several contributors.",
    skipItIf:
      "You're a solo writer — general-purpose AI assistants deliver most of the capability at lower cost.",
    goodPoints: [
      "Brand-voice controls genuinely keep multi-author output consistent.",
      "Campaign and workflow features fit how marketing teams actually operate.",
      "Solid integrations with the standard marketing stack.",
    ],
    weakPoints: [
      "Premium pricing relative to general-purpose AI assistants.",
      "Output quality ceiling is set by the same underlying models everyone uses — the differentiation is workflow, not magic.",
    ],
    pricingSummary: [
      { plan: "Creator", price: "Monthly per seat", note: "Single-user tier with core writing features; annual billing is discounted." },
      { plan: "Pro / Business", price: "Per seat, tiered", note: "Adds brand voices, collaboration, and admin controls; business pricing is quote-based." },
    ],
    pricingUrl: "https://www.jasper.ai/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is there a free trial?", a: "Jasper has typically offered a time-boxed trial with a card on file — cancel before it ends to avoid charges. Check current terms on the official page." },
      { q: "What makes Jasper different from a general AI chatbot?", a: "Brand voice, team workflows, and marketing-specific templates. The writing engine is comparable; the wrapper is the product." },
      { q: "Who is Jasper for?", a: "Marketing teams of two or more producing regular content. Solo users usually find better value elsewhere." },
      { q: "Does Jasper integrate with my stack?", a: "It offers browser extensions and integrations with common marketing tools; check the official integrations list for specifics." },
    ],
    alternativeSlugs: ["copy-ai", "grammarly"],
  },
  /* -------------------------------------------------------- Copy.ai */
  {
    name: "Copy.ai",
    slug: "copy-ai",
    tagline: "Automate go-to-market content with AI workflows.",
    description:
      "Copy.ai turns repetitive go-to-market busywork into automated workflows — from prospecting emails to content repurposing — with a free tier to start.",
    websiteUrl: "https://www.copy.ai",
    rating: 3.7,
    cats: ["ai-tools", "marketing"],
    heroSummary:
      "Copy.ai started as an AI copywriting tool and has evolved into a go-to-market automation platform: multi-step AI workflows that research prospects, draft outreach, and repurpose content, aimed at sales and marketing ops rather than individual writers.",
    verdict:
      "The workflow angle is the right idea — automating repeatable GTM tasks beats one-off text generation. Expect setup effort to get reliable results, and evaluate on the free tier before committing to credit-based pricing.",
    editorialScore: 7.3,
    useItFor:
      "Sales and marketing ops automating repeatable content and outreach tasks end-to-end.",
    skipItIf:
      "You just want an occasional writing assistant — the platform's depth (and pricing) is aimed at ops workflows.",
    goodPoints: [
      "Workflow automation goes beyond single-prompt writing into genuinely repeatable processes.",
      "A permanent free tier exists to evaluate real output quality.",
      "Strong templates for common GTM motions (outreach, repurposing, briefs).",
    ],
    weakPoints: [
      "Reliable workflows take real setup and iteration — it's not value out of the box.",
      "Credit/usage pricing is harder to predict than flat seats.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "Limited monthly words/credits — enough to judge quality." },
      { plan: "Paid tiers", price: "Monthly, usage-based", note: "Scale by seats and workflow credits; annual billing discounts. Check the official page for current allowances." },
    ],
    pricingUrl: "https://www.copy.ai/prices",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is the free plan permanent?", a: "Yes, with monthly usage limits rather than a trial clock." },
      { q: "Copy.ai or Jasper?", a: "Copy.ai leans toward GTM workflow automation; Jasper leans toward brand-consistent content production for marketing teams. Pick by the job." },
      { q: "What are workflow credits?", a: "Automated multi-step runs consume credits from a monthly allowance that varies by plan — the official pricing page lists current numbers." },
      { q: "Can it write in my brand voice?", a: "Yes — brand voice and context features exist on paid tiers; quality depends on the examples you feed it." },
    ],
    alternativeSlugs: ["jasper", "zapier"],
  },
  /* --------------------------------------------------------- Bubble */
  {
    name: "Bubble",
    slug: "bubble",
    tagline: "The most established no-code platform for web apps.",
    description:
      "Bubble lets you design, develop, and launch production web applications without code. A mature plugin ecosystem and full database control make it the heavyweight of visual development.",
    websiteUrl: "https://bubble.io",
    rating: 4.1,
    cats: ["no-code-app-builders", "saas"],
    heroSummary:
      "Bubble is the most established visual programming platform for web apps: a drag-and-drop editor over a real database, workflows, and user auth, with a decade of plugins and templates behind it. It sits between simple site builders and AI code generators — you build the logic yourself, visually.",
    verdict:
      "Still the deepest no-code platform for complex app logic, with the ecosystem to prove it. The learning curve is real, workload-based pricing needs watching as you grow, and AI builders now beat it on speed-to-first-version — but not on control.",
    editorialScore: 8.1,
    useItFor:
      "Complex web apps with real business logic where you want visual control over every workflow, not AI guesses.",
    skipItIf:
      "You want the fastest possible first version (AI builders win) or eventual code export (Bubble apps stay on Bubble).",
    goodPoints: [
      "Handles genuinely complex logic, data models, and permissions that simpler builders can't.",
      "Mature ecosystem: plugins, templates, agencies, and a decade of community answers.",
      "Free tier is fully capable for learning and prototyping.",
      "Visual debugging and version control features have matured well.",
    ],
    weakPoints: [
      "Real learning curve — weeks, not hours, to build well.",
      "Workload-unit pricing can be hard to predict for high-traffic apps.",
      "No code export: your app runs on Bubble or not at all.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "Development versions with Bubble branding — fine for learning and prototyping." },
      { plan: "Starter / Growth / Team", price: "Monthly, tiered", note: "Paid tiers add custom domains and workload capacity; annual billing is discounted." },
    ],
    pricingUrl: "https://bubble.io/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Can I export my app's code?", a: "No — Bubble apps run on Bubble's infrastructure. Data export exists; the application itself isn't portable." },
      { q: "Is Bubble hard to learn?", a: "Harder than site builders, easier than programming. Budget a few weeks to become productive on real apps." },
      { q: "Bubble or an AI builder?", a: "AI builders (Base44, Lovable) are faster to a first version; Bubble gives you precise visual control over complex logic. Some founders prototype in AI tools, then rebuild on Bubble when logic outgrows prompts." },
      { q: "What are workload units?", a: "Bubble's capacity metric — heavier server activity consumes more. Most small apps fit their tier; check the pricing page's calculator for yours." },
    ],
    alternativeSlugs: ["base44", "lovable", "webflow"],
  },
  /* -------------------------------------------------------- Webflow */
  {
    name: "Webflow",
    slug: "webflow",
    tagline: "Design and ship professional websites visually.",
    description:
      "Webflow gives designers full control of HTML, CSS, and interactions in a visual canvas, with hosting and a CMS built in — the standard for marketing sites that need to look custom-built.",
    websiteUrl: "https://webflow.com",
    rating: 4.3,
    isFeatured: true,
    cats: ["no-code-app-builders", "design"],
    heroSummary:
      "Webflow is a visual web development platform: designers work on a canvas that maps directly to real HTML and CSS, backed by a built-in CMS and hosting. It's the default choice for marketing sites that need custom-grade design without a front-end team.",
    verdict:
      "The professional's site builder — nothing else pairs this much design control with a real CMS. Pricing across site plans and seats takes reading, and genuine web apps still belong elsewhere, but for marketing sites it remains the benchmark.",
    editorialScore: 8.5,
    useItFor:
      "Marketing and content sites where design fidelity and a proper CMS both matter.",
    skipItIf:
      "You're building an application with user accounts and logic — that's Bubble or an AI builder's job.",
    goodPoints: [
      "Design control that maps to real HTML/CSS — no template ceiling.",
      "Built-in CMS is genuinely good for editorial and marketing content.",
      "Clean, fast hosting with staging included.",
      "The free Starter workspace lets you build (unhosted) sites indefinitely.",
    ],
    weakPoints: [
      "Pricing spans site plans plus workspace seats — totals surprise newcomers.",
      "Not for web apps: logic and user accounts are outside its lane.",
      "The learning curve mirrors learning CSS concepts, just visually.",
    ],
    pricingSummary: [
      { plan: "Starter (free)", price: "No card required", note: "Two staging sites on webflow.io subdomains — build before you pay." },
      { plan: "Site plans", price: "Per site, monthly", note: "Basic/CMS/Business per published site; CMS tier is the sweet spot for content sites. Annual billing discounts apply." },
    ],
    pricingUrl: "https://webflow.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Can I build free on Webflow?", a: "Yes — the Starter workspace includes staging sites on a webflow.io subdomain. You pay when you connect a custom domain." },
      { q: "Webflow or Framer?", a: "Framer is faster from design to published site; Webflow's CMS and structural control are deeper for content-heavy sites. See our stack guide." },
      { q: "Do I need to know CSS?", a: "You don't write it, but you'll absorb its concepts — the canvas mirrors how CSS actually works, which is exactly why the output is clean." },
      { q: "Can Webflow do e-commerce?", a: "Yes for smaller catalogs; large or complex stores are usually better served by Shopify." },
    ],
    alternativeSlugs: ["framer", "bubble", "shopify"],
  },
  /* --------------------------------------------------------- Framer */
  {
    name: "Framer",
    slug: "framer",
    tagline: "Ship stunning sites straight from a design canvas.",
    description:
      "Framer turns a familiar design-tool canvas into published, fast websites with animations that would normally need a developer — plus AI generation to get from blank page to draft in minutes.",
    websiteUrl: "https://www.framer.com",
    rating: 4.2,
    cats: ["design", "no-code-app-builders"],
    heroSummary:
      "Framer is a site builder that feels like a design tool: a Figma-style canvas that publishes directly to fast, animated websites. It's become the go-to for startup marketing pages and portfolios where visual polish and motion matter more than deep CMS structure.",
    verdict:
      "The fastest route from design taste to a live, animated site — genuinely fun to use. Its CMS is lighter than Webflow's and complex content structures will hit its ceiling, so choose it for polish and speed, not editorial depth.",
    editorialScore: 8.4,
    useItFor:
      "Startup landing pages, portfolios, and marketing sites where motion and polish sell the product.",
    skipItIf:
      "Your site is content-heavy with complex CMS needs — Webflow handles that better.",
    goodPoints: [
      "Design-canvas-to-published-site is the smoothest in the category.",
      "Animations and interactions that normally need a developer are point-and-click.",
      "Free plan publishes a real site on a framer.website subdomain.",
      "AI generation gives a genuinely usable first draft to edit.",
    ],
    weakPoints: [
      "CMS is serviceable but shallow next to Webflow for structured content.",
      "Complex multi-language or large-scale sites stretch its intended lane.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "Publish on a framer.website subdomain with Framer branding." },
      { plan: "Site plans", price: "Per site, monthly", note: "Mini/Basic/Pro by pages and features; custom domain from the lowest paid tier. Annual discounts apply." },
    ],
    pricingUrl: "https://www.framer.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is Framer free to publish?", a: "Yes, on a framer.website subdomain with a small badge. Custom domains start on paid site plans." },
      { q: "Framer or Webflow?", a: "Framer for speed and motion on marketing pages; Webflow for content depth and CMS structure. Many teams use both for different properties." },
      { q: "Can I import from Figma?", a: "There's a Figma-to-Framer path via plugin, and the canvas feels immediately familiar to Figma users either way." },
      { q: "Does Framer handle blogs?", a: "Yes — its CMS covers standard blog needs comfortably; it's elaborate multi-type content models where Webflow pulls ahead." },
    ],
    alternativeSlugs: ["webflow", "canva"],
  },
  /* ----------------------------------------------------- QuickBooks */
  {
    name: "QuickBooks",
    slug: "quickbooks",
    tagline: "Small-business accounting that runs itself.",
    description:
      "QuickBooks automates bookkeeping, invoicing, and tax prep for millions of small businesses. Deep bank integrations and accountant familiarity make it the default in North America.",
    websiteUrl: "https://quickbooks.intuit.com",
    rating: 4.0,
    cats: ["accounting-finance", "saas"],
    heroSummary:
      "QuickBooks Online, by Intuit, is the default small-business accounting suite in North America: automated bank feeds, invoicing, expense capture, and tax-ready reports, with payroll available as an add-on. Nearly every US accountant works in it daily.",
    verdict:
      "The pragmatic default for US small businesses — automation is strong and your accountant already knows it. Watch the pricing ladder: intro discounts expire, plan tiers climb, and add-ons (payroll, time tracking) are separate subscriptions.",
    editorialScore: 7.9,
    useItFor:
      "US-based small businesses that want bookkeeping largely automated and accountant-ready.",
    skipItIf:
      "You're UK-based (Sage's HMRC/MTD fit is better) or price-sensitive after intro offers lapse.",
    goodPoints: [
      "Bank-feed automation and receipt capture genuinely reduce bookkeeping hours.",
      "Universal accountant familiarity in North America.",
      "New customers reliably get either a free trial or a multi-month discount.",
    ],
    weakPoints: [
      "Post-promo pricing climbs, and annual increases are routine.",
      "Payroll and other add-ons are separate subscriptions that stack up.",
      "Support quality is inconsistent at busy times of year.",
    ],
    pricingSummary: [
      { plan: "Online tiers", price: "Monthly, tiered", note: "Simple Start through Advanced by feature depth; new customers choose a trial or an intro discount, not both." },
      { plan: "Payroll", price: "Monthly + per employee", note: "Separate add-on subscription in Core/Premium/Elite tiers." },
    ],
    pricingUrl: "https://quickbooks.intuit.com/pricing/",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Trial or discount — which should I pick?", a: "QuickBooks usually makes you choose between a 30-day trial and a multi-month intro discount. If you're already sure, the discount is worth more." },
      { q: "Which tier do I need?", a: "Most service businesses fit Simple Start or Essentials; inventory pushes you to Plus. You can upgrade mid-subscription." },
      { q: "Does QuickBooks include payroll?", a: "No — payroll is a separate add-on billed monthly plus per employee." },
      { q: "QuickBooks or Sage?", a: "US business: QuickBooks. UK business with MTD/HMRC needs: Sage. The accountant you'll work with is a good tiebreaker." },
    ],
    alternativeSlugs: ["sage-uk"],
  },
  /* -------------------------------------------------------- Shopify */
  {
    name: "Shopify",
    slug: "shopify",
    tagline: "The commerce platform behind millions of stores.",
    description:
      "Shopify powers everything from first stores to enterprise brands with hosted storefronts, payments, and a vast app ecosystem. Its famous intro offer makes starting nearly free.",
    websiteUrl: "https://www.shopify.com",
    rating: 4.4,
    cats: ["e-commerce", "saas"],
    heroSummary:
      "Shopify is the leading hosted e-commerce platform: storefront, checkout, payments, and inventory in one subscription, extended by thousands of apps and themes. It scales from a first side-project store to enterprise brands on Shopify Plus.",
    verdict:
      "The safest bet in e-commerce — reliable checkout, enormous ecosystem, and a famously cheap first-months offer to start. Budget realistically for apps and payment fees, which is where the true monthly cost lives.",
    editorialScore: 8.7,
    useItFor:
      "Almost any product business that wants a serious store without owning infrastructure.",
    skipItIf:
      "You mainly sell content/digital subscriptions or need deep custom checkout logic without Plus-level budget.",
    goodPoints: [
      "Checkout reliability and conversion polish that competitors chase.",
      "The intro offer (trial then heavily discounted first months) makes starting nearly free.",
      "App and theme ecosystem covers virtually every need.",
      "Scales cleanly from hobby store to enterprise without replatforming.",
    ],
    weakPoints: [
      "App subscriptions quietly inflate the real monthly cost.",
      "Extra payment fees apply when not using Shopify Payments.",
      "Deep customization of checkout is gated to the expensive Plus tier.",
    ],
    pricingSummary: [
      { plan: "Intro offer", price: "Trial, then discounted first months", note: "Shopify's standing new-merchant offer — the exact structure varies; the signup page states the current one." },
      { plan: "Basic / Shopify / Advanced", price: "Monthly, tiered", note: "Tiers differ on staff accounts, reporting, and fees; annual billing is discounted." },
    ],
    pricingUrl: "https://www.shopify.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "What's the current starter offer?", a: "Shopify almost always runs a short free trial followed by heavily discounted first months. The signup page states the exact current terms." },
      { q: "What will I actually pay monthly?", a: "Plan + apps + payment fees. Many stores end up at roughly double the base plan once essential apps are added — budget for it." },
      { q: "Can I use my own payment provider?", a: "Yes, with additional transaction fees; Shopify Payments avoids those where it's available." },
      { q: "Is Shopify good for digital products?", a: "Workable with apps, but content/subscription-first businesses often fit dedicated platforms better." },
    ],
    alternativeSlugs: ["webflow", "daraz"],
  },
  /* ---------------------------------------------------------- Canva */
  {
    name: "Canva",
    slug: "canva",
    tagline: "Design anything, publish anywhere.",
    description:
      "Canva makes professional design accessible to everyone with templates, brand kits, and AI tools covering social posts to pitch decks. Teams plans add approvals and shared assets.",
    websiteUrl: "https://www.canva.com",
    rating: 4.3,
    cats: ["design", "productivity"],
    heroSummary:
      "Canva is the design tool for people who aren't designers: templates, drag-and-drop editing, brand kits, and a growing AI toolbox covering everything from social graphics to pitch decks and short video. Pro unlocks the full asset library and the automation features that save real hours.",
    verdict:
      "For solo creators and small teams, Pro is among the highest-value subscriptions in this guide — background removal, resizing, and the stock library replace several tools at once. Precision vector and print-production work still belongs in professional design software.",
    editorialScore: 8.6,
    useItFor:
      "Marketing graphics, social content, decks, and everyday design at speed — without a designer.",
    skipItIf:
      "You need precision vector illustration or prepress-grade print output.",
    goodPoints: [
      "Free tier is genuinely capable, not a demo.",
      "Pro's background remover, Magic Resize, and stock library replace multiple paid tools.",
      "Brand kits keep non-designers on brand automatically.",
      "Education and nonprofit programs make Pro-level features free for eligible users.",
    ],
    weakPoints: [
      "Not a precision tool: fine vector control and print production have hard ceilings.",
      "Heavy template usage can make brands look like everyone else's.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "Large template/asset base; watermarked premium assets excluded." },
      { plan: "Pro / Teams", price: "Monthly or annual", note: "Pro is per person; Teams adds shared brand controls and approvals. Trials for Pro are standard — check the current length on the official page." },
    ],
    pricingUrl: "https://www.canva.com/pricing/",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is Canva Free enough?", a: "For occasional use, yes. Pro earns its keep once you use background removal, resizing, or premium assets weekly." },
      { q: "Is there a Pro trial?", a: "Canva regularly offers a free Pro trial for new users — length varies by promotion; the signup flow states the current terms." },
      { q: "Who gets Canva free?", a: "Verified K-12 teachers and eligible nonprofit organizations get premium features free through dedicated programs." },
      { q: "Can teams control brand assets?", a: "Yes — Teams plans add shared brand kits, templates, and approval workflows." },
    ],
    alternativeSlugs: ["framer", "notion"],
  },
  /* ------------------------------------------------------ Grammarly */
  {
    name: "Grammarly",
    slug: "grammarly",
    tagline: "AI writing partner across every app you use.",
    description:
      "Grammarly checks tone, clarity, and correctness everywhere you type, with generative drafting on paid tiers. The browser extension alone saves most knowledge workers hours a month.",
    websiteUrl: "https://www.grammarly.com",
    rating: 4.0,
    cats: ["ai-tools", "productivity"],
    heroSummary:
      "Grammarly is a writing assistant that lives where you already type — browser, email, docs, and desktop apps — correcting grammar, sharpening clarity, and (on paid tiers) rewriting and drafting with AI. Its distribution is the moat: it's simply everywhere you write.",
    verdict:
      "The free tier is the best zero-cost writing upgrade available, full stop. Premium is worth it for people whose writing is their work; casual writers can stay free forever without guilt.",
    editorialScore: 8.0,
    useItFor:
      "Anyone whose credibility rides on written English — email-heavy roles, non-native speakers, content teams.",
    skipItIf:
      "You write rarely, or your organization restricts cloud text processing for confidentiality.",
    goodPoints: [
      "Works across virtually every surface you type on.",
      "Free tier covers correctness basics indefinitely.",
      "Tone and clarity suggestions genuinely improve business writing, not just fix typos.",
    ],
    weakPoints: [
      "Premium's value over free is incremental if you only need correctness.",
      "Cloud processing of everything you type is a real consideration for sensitive work.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "Core correctness and tone detection, unlimited." },
      { plan: "Premium / Business", price: "Monthly or annual", note: "Rewrites, fluency, and generative AI; annual billing is markedly cheaper. Business adds team controls." },
    ],
    pricingUrl: "https://www.grammarly.com/plans",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is free Grammarly actually useful?", a: "Yes — correctness, conciseness, and tone detection are included without time limits." },
      { q: "What does Premium add?", a: "Full-sentence rewrites, fluency and formality adjustments, plagiarism checks, and generative drafting." },
      { q: "Is my text private?", a: "Text is processed in Grammarly's cloud to generate suggestions; review their security documentation if you handle sensitive material." },
      { q: "Does it work in Google Docs and email?", a: "Yes — via browser extension and native integrations across the common writing surfaces." },
    ],
    alternativeSlugs: ["jasper", "notion"],
  },
  /* --------------------------------------------------------- Zapier */
  {
    name: "Zapier",
    slug: "zapier",
    tagline: "Automate work across 7,000+ apps.",
    description:
      "Zapier connects the tools you already use into automated workflows — no code required. AI steps let zaps draft, extract, and decide, not just move data.",
    websiteUrl: "https://zapier.com",
    rating: 4.2,
    cats: ["productivity", "saas"],
    heroSummary:
      "Zapier is the connective tissue of the SaaS world: when something happens in one app, it triggers actions in others — no code required. With the largest integration catalog in the category and newer AI steps, it remains the default way small teams automate the gaps between their tools.",
    verdict:
      "Unmatched integration breadth makes it the safe automation choice, and the free tier proves the concept on your own stack. Task-based pricing punishes chatty automations, so design zaps deliberately once volume grows.",
    editorialScore: 8.3,
    useItFor:
      "Gluing your stack together — leads to CRM, forms to sheets, alerts to chat — without engineering time.",
    skipItIf:
      "You run high-volume or complex data pipelines — dedicated integration platforms get cheaper past a threshold.",
    goodPoints: [
      "The broadest app catalog in automation — if a tool matters, it connects.",
      "Free tier handles simple two-step automations indefinitely.",
      "Multi-step zaps with filters, paths, and AI steps cover surprisingly deep logic.",
    ],
    weakPoints: [
      "Task-based pricing climbs quickly with volume.",
      "Debugging complex zaps is clunkier than code once logic gets deep.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "A monthly task allowance for simple two-step zaps." },
      { plan: "Professional and up", price: "Monthly by task volume", note: "Unlocks multi-step zaps and premium apps; cost scales with tasks — annual billing discounts apply." },
    ],
    pricingUrl: "https://zapier.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "What counts as a task?", a: "Each action a zap performs (not the trigger) consumes a task from your monthly allowance." },
      { q: "Is the free plan enough?", a: "For a handful of simple automations, yes. Multi-step zaps and premium apps require Professional." },
      { q: "Zapier or built-in integrations?", a: "Use native integrations where they exist; Zapier shines for the thousands of pairings vendors never build." },
      { q: "Can zaps use AI?", a: "Yes — AI steps can draft, extract, classify, and route data inside a zap." },
    ],
    alternativeSlugs: ["clickup", "copy-ai"],
  },
  /* -------------------------------------------------------- ClickUp */
  {
    name: "ClickUp",
    slug: "clickup",
    tagline: "One app to replace your project stack.",
    description:
      "ClickUp bundles tasks, docs, goals, and chat into a single project workspace with aggressive pricing. Heavy customization means it fits almost any team's process.",
    websiteUrl: "https://clickup.com",
    rating: 3.9,
    cats: ["productivity", "saas"],
    heroSummary:
      "ClickUp is a project-management platform that tries to replace your whole productivity stack: tasks, docs, whiteboards, goals, and chat under one roof, with extreme configurability and pricing that undercuts the incumbents. The pitch is one subscription instead of four.",
    verdict:
      "The best feature-per-dollar ratio in project management, and the free tier is unusually generous. The flip side of infinite configurability is setup burden and occasional sluggishness — teams that invest in setup love it; teams that don't, drown.",
    editorialScore: 7.7,
    useItFor:
      "Budget-conscious teams that want tasks, docs, and goals consolidated — and will invest a week configuring it properly.",
    skipItIf:
      "You want an opinionated tool that works perfectly out of the box, or top-end performance on huge workspaces.",
    goodPoints: [
      "Free Forever plan with unlimited tasks and members is genuinely unmatched.",
      "Replaces several subscriptions (PM + docs + goals) at one low price.",
      "Custom fields, views, and automations bend to nearly any process.",
    ],
    weakPoints: [
      "Configuration overload — poorly set up workspaces become mazes.",
      "Performance can lag on large, complex workspaces.",
    ],
    pricingSummary: [
      { plan: "Free Forever", price: "No card required", note: "Unlimited tasks and members with storage limits." },
      { plan: "Unlimited / Business", price: "Per user, monthly", note: "Unlocks storage, guests, and advanced views; annual billing is significantly cheaper." },
    ],
    pricingUrl: "https://clickup.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is the free plan really unlimited?", a: "Unlimited tasks and members, yes — with storage and some feature limits that push growing teams to Unlimited." },
      { q: "ClickUp or Notion?", a: "ClickUp for structured project delivery; Notion for docs-first knowledge work. Plenty of teams run both." },
      { q: "Why do people find it overwhelming?", a: "Everything is configurable, so defaults matter less than your setup. Start minimal: one space, a few views, add features as needed." },
      { q: "Does ClickUp have AI?", a: "Yes, as an add-on that drafts, summarizes, and automates within your workspace — priced separately; check the official page." },
    ],
    alternativeSlugs: ["notion", "zapier"],
  },

  /* ============ v3 — AI IDEs & Coding Agents (new category) ========== */
  {
    name: "Cursor",
    slug: "cursor",
    tagline: "The AI-native code editor developers live in.",
    description:
      "Cursor is an AI-first code editor built on VS Code, with codebase-aware chat, fast multi-line autocomplete, and an agent mode that plans and edits across files. It is aimed at professional developers who want AI embedded in a real editor, not bolted on beside it.",
    websiteUrl: "https://cursor.com",
    rating: 4.5,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    heroSummary:
      "Cursor is an AI-first code editor built as a fork of VS Code, so it keeps the extensions, keybindings, and workflow developers already know while wrapping the whole codebase in AI: predictive multi-line edits, a chat that reads your repository, and an agent that plans and applies changes across files. It is built for people who already write code and want the AI to move at their speed.",
    verdict:
      "The strongest AI coding environment for people who already write software — fast, deeply integrated, and genuinely useful on real codebases rather than toy demos. The catch: it assumes real development skill, and the heaviest models run on usage-based billing that can climb if you lean on them all day. It is the wrong tool for a non-developer trying to ship an app from a prompt — that reader is far better served by an app builder like Lovable.",
    editorialScore: 9.0,
    useItFor:
      "Professional and hobbyist developers who want a fast, agentic AI editor working inside a real codebase they own.",
    skipItIf:
      "You can't write code and want to go from idea to a deployed product without touching a repo — an AI app builder (see Lovable) fits you far better.",
    goodPoints: [
      "Built on VS Code, so your extensions, themes, and muscle memory carry over on day one.",
      "Codebase-aware chat and agent mode make multi-file edits that actually respect your project's context.",
      "Tab completion is fast and predicts the next edit, not just the next token — the feature developers miss most when they leave.",
      "Access to frontier models plus MCP, rules, and hooks for teams that want to shape how the AI behaves.",
    ],
    weakPoints: [
      "Assumes you can read and steer code; non-developers will be lost.",
      "Usage-based billing on the strongest models means heavy days can cost more than the flat subscription suggests.",
      "As an editor, it stops at the repo — it doesn't provision a backend or host your app the way an app builder does.",
    ],
    pricingSummary: [
      { plan: "Hobby", price: "Free", note: "No card; limited Agent requests and Tab completions. Pricing verified 2026-07." },
      { plan: "Pro", price: "$16 / month", note: "Extended Agent limits, frontier models, cloud agents, MCPs; heaviest models on usage-based billing. Verified 2026-07." },
      { plan: "Teams", price: "$32 / user / month", note: "Central billing, SSO, agentic code review (Bugbot), analytics. Verified 2026-07." },
    ],
    pricingUrl: "https://cursor.com/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is Cursor free?", a: "There's a free Hobby plan with limited Agent requests and Tab completions — enough to try it. Pro is $16/month for extended limits and frontier models (verified July 2026 on the official pricing page)." },
      { q: "Do I need to know how to code?", a: "Yes. Cursor is an editor for developers; it accelerates people who can already read and steer code. If you can't code and want to ship an app, an app builder like Lovable is the better fit." },
      { q: "Cursor or GitHub Copilot?", a: "Copilot is the incumbent that lives inside many IDEs; Cursor is a dedicated AI editor with a tighter agentic loop and codebase awareness. Developers who want AI at the center of the editor tend to prefer Cursor — see our head-to-head." },
      { q: "Cursor or Windsurf?", a: "Both are AI-native VS Code-style editors racing on the same features. It often comes down to which agent flow feels better to you; our comparison breaks down the differences." },
      { q: "Does it host my app?", a: "No. Cursor edits code in your repository — you still deploy and host it yourself. If you want prompt-to-hosted-app in one place, that's what app builders like Lovable do." },
    ],
    alternativeSlugs: ["windsurf", "github-copilot", "lovable"],
  },
  {
    name: "Google Antigravity",
    slug: "google-antigravity",
    tagline: "Google's agent-first development platform.",
    description:
      "Antigravity is Google's agentic coding environment built around its Gemini models, designed so developers orchestrate AI agents that work across the editor, terminal, and browser rather than editing line by line. It is Google's push into agent-driven software development.",
    websiteUrl: "https://antigravity.google",
    rating: 4.0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    heroSummary:
      "Antigravity is Google's bet that the editor is the wrong center of gravity for AI development. Instead of making you a faster typist, it puts Gemini-powered agents at the middle of the workflow, coordinating work across the editor, terminal, and browser. It is ambitious, genuinely different, and — being new and from Google — moving fast and still proving itself.",
    verdict:
      "The most interesting rethink of the AI development surface right now: if you believe the future is delegating to agents rather than autocompleting lines, Antigravity is built for that world from the ground up, with Google's Gemini models behind it. The catch is maturity — it is newer and less battle-tested than Cursor, the mental model takes adjustment, and as a fast-moving Google product the details will shift. A strong tool to try and watch; not yet the safe default.",
    editorialScore: 8.0,
    useItFor:
      "Developers who want to work agent-first — delegating and reviewing rather than typing — and are comfortable on the frontier with Google's Gemini models.",
    skipItIf:
      "You want a proven, stable AI editor that makes you faster today with no new mental model — Cursor is the safer pick.",
    goodPoints: [
      "Agent-first by design, not an agent bolted onto an editor.",
      "Coordinates work across editor, terminal, and browser.",
      "Backed by Google's Gemini models and Google's infrastructure.",
      "Points at where AI development is plausibly heading.",
    ],
    weakPoints: [
      "New and less proven than the established AI editors.",
      "Agent-first workflow is a genuine mental-model shift to learn.",
      "As a fast-moving Google product, specifics and pricing can change.",
    ],
    pricingSummary: [
      { plan: "Access", price: "See official site", note: "Google has launched Antigravity publicly; check antigravity.google for current availability, tiers, and any usage limits. Verified reachable July 2026; specific pricing not restated here to avoid stale figures." },
    ],
    pricingUrl: "https://antigravity.google",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "What makes Antigravity different?", a: "It's agent-first: rather than a smarter editor, it's built around orchestrating AI agents across the editor, terminal, and browser, powered by Google's Gemini models." },
      { q: "Antigravity or Cursor?", a: "Cursor is the proven AI editor that makes you faster today; Antigravity is Google's newer, agent-first bet on where development is heading. See our comparison for the trade-off." },
      { q: "Which models does it use?", a: "It's built around Google's Gemini models. Check the official site for the current model lineup, since Google updates these frequently." },
      { q: "Is it ready for daily work?", a: "It's public and capable, but newer and less battle-tested than the established editors. Try it alongside your current tool before you commit a critical project." },
    ],
    alternativeSlugs: ["cursor", "devin"],
  },
  {
    name: "Windsurf (now Devin Desktop)",
    slug: "windsurf",
    tagline: "Renamed: Windsurf is now Devin Desktop, under Cognition.",
    description:
      "Windsurf, the AI IDE known for its Cascade agent, has been renamed Devin Desktop under Cognition. Its own site states it plainly: \"Devin Desktop is the new name for Windsurf.\" The change ships as an over-the-air update, so plans, pricing, extensions, and settings carry over, and windsurf.com now redirects to devin.ai/desktop. If you're looking for Windsurf, you want Devin Desktop. Verified July 2026.",
    websiteUrl: "https://devin.ai/desktop",
    rating: 0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    pricingUrl: "https://devin.ai/pricing",
    alternativeSlugs: ["cursor", "devin"],
  },
  {
    name: "GitHub Copilot",
    slug: "github-copilot",
    tagline: "The AI pair programmer, everywhere you already code.",
    description:
      "GitHub Copilot is the incumbent AI coding assistant: inline autocomplete, chat, and agent features that live inside VS Code, JetBrains, Visual Studio, and GitHub itself. Its reach and native IDE integrations make it the default many teams already have.",
    websiteUrl: "https://github.com/features/copilot",
    rating: 4.3,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    heroSummary:
      "GitHub Copilot is the AI coding assistant most developers meet first, because it lives inside the editors and the GitHub workflow they already use — VS Code, JetBrains, Visual Studio, the CLI, and github.com. It does autocomplete, chat, code review, and agent tasks without asking you to change tools, which is both its biggest strength and the reason a dedicated editor can still out-depth it.",
    verdict:
      "The safest, least disruptive way to put capable AI into a team's existing workflow — it's already in your IDE and often already in your GitHub bill. The catch is that meeting you where you are also caps how deep it goes: a purpose-built editor like Cursor feels more tightly integrated, and the newer usage-credit model on paid tiers means heavy agent use can cost beyond the flat fee. For most teams the honest question isn't whether Copilot is good — it is — but whether they need more than good.",
    editorialScore: 8.5,
    useItFor:
      "Teams and individuals who want strong AI assistance inside the IDE and GitHub workflow they already use, with minimal change.",
    skipItIf:
      "You want the deepest possible AI-editor integration and are willing to switch editors for it — Cursor goes further.",
    goodPoints: [
      "Lives in the tools you already run: VS Code, JetBrains, Visual Studio, CLI, and GitHub itself.",
      "Genuinely useful free tier (2,000 completions a month) and student/OSS-maintainer access.",
      "Agent mode, chat, and agentic code review round it out well beyond plain autocomplete.",
      "Enterprise procurement is trivial when you're already a GitHub customer.",
    ],
    weakPoints: [
      "As an assistant bolted onto a host IDE, it feels less unified than a dedicated AI editor.",
      "Paid tiers now include monthly usage credits, so heavy premium-model use can exceed the flat price.",
      "Best experience assumes you're inside the GitHub/Microsoft ecosystem.",
    ],
    pricingSummary: [
      { plan: "Free", price: "$0", note: "2,000 completions/mo plus access to models like Haiku 4.5 and GPT-5 mini. Verified July 2026." },
      { plan: "Pro", price: "$10 / month", note: "Unlimited completions and next-edit suggestions, cloud agent, code review, plus $15 monthly credits. Verified July 2026." },
      { plan: "Pro+", price: "$39 / month", note: "Adds premium models (incl. Opus) and $70 monthly credits. Verified July 2026." },
      { plan: "Business / Enterprise", price: "Per user; contact sales", note: "Org controls, codebase indexing, and custom model options." },
    ],
    pricingUrl: "https://github.com/features/copilot/plans",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is GitHub Copilot free?", a: "There's a real free plan with 2,000 completions a month and chat, plus free Pro access for verified students and open-source maintainers. Pro is $10/month (verified July 2026)." },
      { q: "Copilot or Cursor?", a: "Copilot meets you inside the IDE you already use; Cursor is a dedicated AI editor with deeper, more unified integration. If you won't switch editors, Copilot; if you will, Cursor tends to go further. See our head-to-head." },
      { q: "Does it work outside VS Code?", a: "Yes — JetBrains IDEs, Visual Studio, the command line, and github.com are all supported, which is a big part of its appeal." },
      { q: "What are the monthly credits?", a: "Paid tiers include a credit allowance for premium-model and agent usage ($15 on Pro, $70 on Pro+); heavy use beyond that is billed on top. Confirm current amounts on the plans page." },
      { q: "Is my code used for training?", a: "GitHub documents data-use and privacy controls, with stronger guarantees on Business/Enterprise. Check the current data-handling terms before rolling it out at work." },
    ],
    alternativeSlugs: ["cursor", "claude-code"],
  },
  {
    name: "Claude Code",
    slug: "claude-code",
    tagline: "Anthropic's coding agent, in your terminal.",
    description:
      "Claude Code is Anthropic's agentic coding tool that works from the terminal and IDE extensions, reading and editing your real repository, running commands, and handling multi-step tasks with the Claude models. It targets developers who want an agent inside their existing workflow.",
    websiteUrl: "https://claude.com",
    rating: 0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    pricingUrl: "https://claude.com/pricing",
    alternativeSlugs: ["cursor", "openai-codex"],
  },
  {
    name: "OpenAI Codex",
    slug: "openai-codex",
    tagline: "OpenAI's cloud and CLI coding agent.",
    description:
      "Codex is OpenAI's software-engineering agent that works both as a cloud service and a command-line tool, taking tasks and returning code changes with tests. It is OpenAI's answer to autonomous, delegated coding.",
    websiteUrl: "https://openai.com",
    rating: 0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    alternativeSlugs: ["claude-code", "devin"],
  },
  {
    name: "Devin",
    slug: "devin",
    tagline: "An autonomous AI software engineer, plus the IDE formerly called Windsurf.",
    description:
      "Devin, from Cognition, is an autonomous software engineer that takes a task and plans, writes, tests, and iterates on code with minimal supervision. Cognition also ships Devin Desktop — the IDE previously known as Windsurf — so the agent and the editor now sit in one product line. Verified July 2026.",
    websiteUrl: "https://devin.ai",
    rating: 0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    pricingUrl: "https://devin.ai/pricing",
    alternativeSlugs: ["cursor", "openai-codex"],
  },
  {
    name: "Kiro",
    slug: "kiro",
    tagline: "Spec-driven agentic development, from AWS.",
    description:
      "Kiro is AWS's agentic IDE built around spec-driven development: you describe requirements and it generates specs, design, and code while keeping them in sync. It targets teams that want structure around AI-generated code.",
    websiteUrl: "https://kiro.dev",
    rating: 0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    pricingUrl: "https://kiro.dev/pricing",
    alternativeSlugs: ["cursor", "windsurf"],
  },
  {
    name: "Trae",
    slug: "trae",
    tagline: "ByteDance's adaptive AI IDE.",
    description:
      "Trae is an AI IDE from ByteDance offering agent-driven building, chat, and autocomplete in a familiar editor, and has drawn attention for generous access to frontier models. It is a fast-moving newcomer in the AI-editor race.",
    websiteUrl: "https://trae.ai",
    rating: 0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    alternativeSlugs: ["cursor", "windsurf"],
  },
  {
    name: "Zed",
    slug: "zed",
    tagline: "A blazing-fast editor with AI built in.",
    description:
      "Zed is a high-performance, collaborative code editor written in Rust, with AI assistance and agentic editing integrated natively. Its draw is speed and a clean, native feel for developers who find heavier editors sluggish.",
    websiteUrl: "https://zed.dev",
    rating: 0,
    cats: ["ai-ides-coding-agents", "ai-tools"],
    pricingUrl: "https://zed.dev/pricing",
    alternativeSlugs: ["cursor", "github-copilot"],
  },

  /* ============ v3 — new AI app builders ============================= */
  {
    name: "Bolt.new",
    slug: "bolt-new",
    tagline: "Prompt to full-stack app, in the browser.",
    description:
      "Bolt.new, from StackBlitz, turns prompts into full-stack web apps entirely in the browser, running and editing the code in a live sandbox with instant preview and deploy. It sits between a pure app builder and a coding environment.",
    websiteUrl: "https://bolt.new",
    rating: 4.2,
    cats: ["no-code-app-builders", "ai-tools"],
    heroSummary:
      "Bolt.new, from the StackBlitz team, builds full-stack web apps from a chat prompt and runs them live in the browser — no local setup, instant preview, and a real code sandbox you can edit and deploy. It sits deliberately between an app builder and an editor: more hands-on than a pure builder, far less setup than an IDE.",
    verdict:
      "One of the fastest ways to get a real, running full-stack app out of a prompt, and the in-browser sandbox with live preview is a genuine pleasure for people who like to see and touch the code. The catch is the token/credit model: heavy iteration burns through your allowance, and complex apps still hit the same walls every prompt-to-app tool hits, where you need to understand what was generated to push it further. Closer to Lovable than to a no-code builder — and best for people who don't mind that.",
    editorialScore: 8.3,
    useItFor:
      "Technical and semi-technical builders who want prompt-to-app speed but like to watch, run, and tweak the code live.",
    skipItIf:
      "You want the backend, auth, and hosting fully handled with the least code contact — Lovable leans further in that direction.",
    goodPoints: [
      "Full-stack apps running live in the browser with zero local setup.",
      "A real code sandbox with instant preview — you can read and edit what it generates.",
      "Fast from prompt to something you can click, share, and deploy.",
      "Backed by StackBlitz, whose in-browser dev environment is mature.",
    ],
    weakPoints: [
      "Token/credit consumption adds up quickly during heavy iteration.",
      "Complex or unusual app logic still needs you to understand the generated code.",
      "You more often bring your own backend/services than with a builder that wires them in.",
    ],
    pricingSummary: [
      { plan: "Free", price: "No card required", note: "\"Start building for free\" — a token allowance to try real projects. Confirm current limits on the official pricing page. Verified July 2026." },
      { plan: "Paid tiers", price: "Token/credit-metered", note: "Higher tiers raise your token allowance; heavy iteration consumes tokens. Exact plan names and prices are on the official pricing page — check before subscribing." },
    ],
    pricingUrl: "https://bolt.new/pricing",
    howToRedeem: defaultRedeem,
    faq: [
      { q: "Is Bolt.new free?", a: "Yes, there's a free tier — the site says \"start building for free.\" It's a token allowance; paid tiers raise it. Confirm the current limits and prices on the official pricing page." },
      { q: "Bolt.new or Lovable?", a: "Both turn prompts into full-stack apps. Bolt gives you a live in-browser code sandbox to tinker with; Lovable handles more of the backend and deploy for you. See our head-to-head." },
      { q: "Do I need to code?", a: "Not to start, but Bolt rewards people who can read code — you build faster when you understand what it generates and can nudge it." },
      { q: "Does it deploy my app?", a: "Yes, you can preview and deploy from the browser sandbox; StackBlitz's environment runs the app live as you build." },
    ],
    alternativeSlugs: ["lovable", "v0", "replit"],
  },
  {
    name: "v0",
    slug: "v0",
    tagline: "Vercel's AI for generating UI and app code.",
    description:
      "v0 is Vercel's generative tool that turns prompts and images into React and Tailwind components and, increasingly, full app flows you can ship to Next.js. It excels at getting a polished front end fast.",
    websiteUrl: "https://v0.app",
    rating: 0,
    cats: ["no-code-app-builders", "ai-tools"],
    alternativeSlugs: ["lovable", "bolt-new"],
  },
  {
    name: "Replit",
    slug: "replit",
    tagline: "Cloud IDE plus an AI agent that ships apps.",
    description:
      "Replit is a browser-based development platform that pairs a full cloud IDE with an AI Agent that can build, run, and host applications from a prompt. It removes local setup entirely, which suits learners and fast prototypes.",
    websiteUrl: "https://replit.com",
    rating: 0,
    cats: ["no-code-app-builders", "ai-tools"],
    pricingUrl: "https://replit.com/pricing",
    alternativeSlugs: ["lovable", "bolt-new"],
  },
  {
    name: "Firebase Studio",
    slug: "firebase-studio",
    tagline: "Google's cloud workspace for AI app building.",
    description:
      "Firebase Studio is Google's browser-based environment (the evolution of Project IDX) for building full-stack and AI apps, with Gemini assistance, templates, and one-click paths into Firebase hosting and services. It suits builders already in Google's ecosystem.",
    websiteUrl: "https://firebase.studio",
    rating: 0,
    cats: ["no-code-app-builders", "ai-tools"],
    alternativeSlugs: ["lovable", "replit"],
  },
];

/* ------------------------------------------------------------------ */
/* Coupons — honest deal-type offers on real brands; demo codes only   */
/* on fictional brands.                                                */
/* ------------------------------------------------------------------ */

type CouponSeed = {
  store: string;
  title: string;
  code?: string;
  type: "code" | "deal";
  sourceType?: "official" | "demo";
  discountLabel: string;
  terms: string;
  destinationUrl?: string;
  expiresInDays?: number;
  isVerified?: boolean;
  sortWeight?: number;
};

const couponSeed: CouponSeed[] = [
  // Base44
  { store: "base44", title: "Free plan — build and publish without a card", type: "deal", discountLabel: "FREE PLAN", terms: "Base44's free tier includes monthly message credits to build and share a working app. No card required.", destinationUrl: "https://base44.com/pricing", isVerified: true, sortWeight: 100 },
  { store: "base44", title: "See current Base44 plans and credit allowances", type: "deal", discountLabel: "VIEW PLANS", terms: "Paid tiers are credit-metered and change periodically — the official pricing page is definitive.", destinationUrl: "https://base44.com/pricing", isVerified: true, sortWeight: 90 },
  { store: "base44", title: "Save with annual billing on paid plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Choosing annual billing lowers the effective monthly price of Base44's paid tiers versus paying monthly — the official pricing page states the live rate.", destinationUrl: "https://base44.com/pricing", isVerified: true, sortWeight: 85 },
  { store: "base44", title: "Earn extra credits with referrals", type: "deal", discountLabel: "REFERRAL CREDITS", terms: "Base44's in-app refer-a-friend option grants extra message credits for each successful invite. Credits reset each month, so time invites within your build cycle.", destinationUrl: "https://base44.com", isVerified: false, sortWeight: 70 },
  // Lovable
  { store: "lovable", title: "Free plan — 5 build credits a day", type: "deal", discountLabel: "FREE PLAN", terms: "The free plan includes 5 build credits a day (up to 30 a month) plus 20 Cloud credits a month — enough to build part of your own idea and read the code before paying. Checked against lovable.dev on 24 Sep 2026.", destinationUrl: "https://lovable.dev/pricing", isVerified: true, sortWeight: 100 },
  { store: "lovable", title: "Save with annual billing on paid plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Paid plans are typically cheaper per month when billed annually. The public pricing page didn't state an exact annual rate at our last check, so confirm the current terms on lovable.dev/pricing before you commit.", destinationUrl: "https://lovable.dev/pricing", isVerified: false, sortWeight: 90 },
  { store: "lovable", title: "Student discount with a valid student email", type: "deal", discountLabel: "STUDENT", terms: "Lovable offers a discount for students who verify with a valid student email. Check current eligibility and the exact rate on the official students page. Checked against lovable.dev on 24 Sep 2026.", destinationUrl: "https://lovable.dev/students", isVerified: true, sortWeight: 88 },
  // Daraz
  { store: "daraz", title: "Today's vouchers and flash sales on Daraz", type: "deal", discountLabel: "DAILY DEALS", terms: "Collectable vouchers and rotating flash sales on the Daraz app and site; terms shown per voucher at checkout.", destinationUrl: "https://www.daraz.pk", isVerified: true, sortWeight: 100 },
  { store: "daraz", title: "Bank-card discounts on selected days", type: "deal", discountLabel: "BANK OFFERS", terms: "Partner bank cards get percentage discounts on selected days and categories — see the bank offers page for the current calendar.", destinationUrl: "https://www.daraz.pk", isVerified: true, sortWeight: 90 },
  // Sage UK
  { store: "sage-uk", title: "Current new-customer offer on Sage Accounting", type: "deal", discountLabel: "INTRO OFFER", terms: "Sage regularly runs extended free periods or discounts for new Accounting customers — the official page states the live offer.", destinationUrl: "https://www.sage.com/en-gb/products/", isVerified: true, sortWeight: 100 },
  { store: "sage-uk", title: "Free trial before you commit", type: "deal", discountLabel: "FREE TRIAL", terms: "Sage offers a no-obligation trial period on Accounting for new users; start it from the official site.", destinationUrl: "https://www.sage.com/en-gb/products/", isVerified: true, sortWeight: 90 },
  // Notion
  { store: "notion", title: "Free plan — full personal use, no time limit", type: "deal", discountLabel: "FREE PLAN", terms: "Notion's free plan covers personal use indefinitely; team features are what paid plans add.", destinationUrl: "https://www.notion.com/pricing", isVerified: true, sortWeight: 100 },
  { store: "notion", title: "Startup credits via partner programs", type: "deal", discountLabel: "STARTUP OFFER", terms: "Eligible startups in partnered accelerators can receive Notion credits — eligibility checked on the official page.", destinationUrl: "https://www.notion.com/startups", isVerified: true, sortWeight: 90 },
  { store: "notion", title: "Notion for Education — free Plus for students", type: "deal", discountLabel: "FREE", terms: "Students and educators with an eligible school email can get the Plus plan free — verify on the education page.", destinationUrl: "https://www.notion.com/product/notion-for-education", isVerified: true, sortWeight: 85 },
  // Jasper
  { store: "jasper", title: "Free trial of Jasper for new users", type: "deal", discountLabel: "FREE TRIAL", terms: "Time-boxed trial with a card on file; cancel before it ends to avoid charges. Current length on the official page.", destinationUrl: "https://www.jasper.ai/pricing", isVerified: true, sortWeight: 100 },
  { store: "jasper", title: "Save with annual billing on paid plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Annual billing lowers Jasper's effective monthly price versus monthly — current rates on the official pricing page.", destinationUrl: "https://www.jasper.ai/pricing", isVerified: true, sortWeight: 90 },
  // Copy.ai
  { store: "copy-ai", title: "Free forever plan on Copy.ai", type: "deal", discountLabel: "FREE PLAN", terms: "Permanent free tier with monthly usage limits — enough to judge output quality on your own tasks.", destinationUrl: "https://www.copy.ai/prices", isVerified: true, sortWeight: 100 },
  { store: "copy-ai", title: "Annual billing saving on Pro", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Choosing annual billing reduces the per-month cost of Copy.ai Pro — the official pricing page states the live rate.", destinationUrl: "https://www.copy.ai/prices", isVerified: true, sortWeight: 90 },
  // Bubble
  { store: "bubble", title: "Build free on Bubble's development tier", type: "deal", discountLabel: "FREE TIER", terms: "Full editor access on development versions with Bubble branding; pay when you launch on a custom domain.", destinationUrl: "https://bubble.io/pricing", isVerified: true, sortWeight: 100 },
  { store: "bubble", title: "Annual billing discount on paid plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Bubble's annual billing is cheaper per month than monthly on paid plans — see the official pricing page for current rates.", destinationUrl: "https://bubble.io/pricing", isVerified: true, sortWeight: 90 },
  // Webflow
  { store: "webflow", title: "Starter workspace — two free staging sites", type: "deal", discountLabel: "FREE PLAN", terms: "Build unhosted sites on webflow.io subdomains free; site plans start when you connect a domain.", destinationUrl: "https://webflow.com/pricing", isVerified: true, sortWeight: 100 },
  { store: "webflow", title: "Annual billing discount on site plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Annual billing meaningfully reduces per-month site plan cost — current rates on the official pricing page.", destinationUrl: "https://webflow.com/pricing", isVerified: true, sortWeight: 90 },
  // Framer
  { store: "framer", title: "Publish free on a framer.website subdomain", type: "deal", discountLabel: "FREE PLAN", terms: "The free plan publishes a real site with Framer branding; custom domains start on paid site plans.", destinationUrl: "https://www.framer.com/pricing", isVerified: true, sortWeight: 100 },
  { store: "framer", title: "Annual billing saving on site plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Annual billing reduces Framer's per-month site plan cost versus monthly — current rates on the official pricing page.", destinationUrl: "https://www.framer.com/pricing", isVerified: true, sortWeight: 90 },
  // QuickBooks
  { store: "quickbooks", title: "New-customer offer: trial or intro discount", type: "deal", discountLabel: "INTRO OFFER", terms: "QuickBooks lets new customers choose a 30-day trial or a multi-month discount — not both. Details at signup.", destinationUrl: "https://quickbooks.intuit.com/pricing/", isVerified: true, sortWeight: 100 },
  { store: "quickbooks", title: "Free 30-day trial for new customers", type: "deal", discountLabel: "FREE TRIAL", terms: "New customers can take a 30-day free trial in place of the intro discount — choose one at signup.", destinationUrl: "https://quickbooks.intuit.com/pricing/", isVerified: true, sortWeight: 90 },
  // Shopify
  { store: "shopify", title: "Shopify's standing new-merchant intro offer", type: "deal", discountLabel: "INTRO OFFER", terms: "Short free trial followed by heavily discounted first months — the signup page states the exact current structure.", destinationUrl: "https://www.shopify.com/pricing", isVerified: true, sortWeight: 100 },
  { store: "shopify", title: "Save with annual billing on plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Paying annually lowers Shopify's monthly plan cost compared with monthly billing — the pricing page shows the current saving.", destinationUrl: "https://www.shopify.com/pricing", isVerified: true, sortWeight: 90 },
  // Canva
  { store: "canva", title: "Canva Pro free trial for new users", type: "deal", discountLabel: "FREE TRIAL", terms: "Standard Pro trial for new accounts; length varies by promotion and is shown at signup.", destinationUrl: "https://www.canva.com/pricing/", isVerified: true, sortWeight: 100 },
  { store: "canva", title: "Canva for Education — free for teachers", type: "deal", discountLabel: "FREE", terms: "Verified K-12 teachers and eligible institutions get premium features free.", destinationUrl: "https://www.canva.com/education/", isVerified: true, sortWeight: 90 },
  // Grammarly
  { store: "grammarly", title: "Free plan — correctness and tone, unlimited", type: "deal", discountLabel: "FREE PLAN", terms: "Grammarly's free tier includes core corrections and tone detection everywhere you type.", destinationUrl: "https://www.grammarly.com/plans", isVerified: true, sortWeight: 100 },
  { store: "grammarly", title: "Annual billing saving on Premium", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Annual Premium is markedly cheaper per month than monthly billing — current rates on the plans page.", destinationUrl: "https://www.grammarly.com/plans", isVerified: true, sortWeight: 90 },
  // Zapier
  { store: "zapier", title: "Free plan — automate simple two-step zaps", type: "deal", discountLabel: "FREE PLAN", terms: "A monthly task allowance for two-step automations, free indefinitely.", destinationUrl: "https://zapier.com/pricing", isVerified: true, sortWeight: 100 },
  { store: "zapier", title: "14-day free trial of premium features", type: "deal", discountLabel: "FREE TRIAL", terms: "New accounts can trial Zapier's premium features for 14 days, then drop to the free plan if you don't upgrade.", destinationUrl: "https://zapier.com/pricing", isVerified: true, sortWeight: 90 },
  { store: "zapier", title: "Annual billing saving on paid plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "Annual billing reduces the per-month price of Zapier's paid plans — current rates on the official pricing page.", destinationUrl: "https://zapier.com/pricing", isVerified: true, sortWeight: 85 },
  // ClickUp
  { store: "clickup", title: "Free Forever plan — unlimited tasks and members", type: "deal", discountLabel: "FREE PLAN", terms: "ClickUp's free tier has no member or task caps; storage limits apply.", destinationUrl: "https://clickup.com/pricing", isVerified: true, sortWeight: 100 },
  { store: "clickup", title: "Annual billing saving on paid plans", type: "deal", discountLabel: "ANNUAL SAVING", terms: "ClickUp's annual billing is cheaper per member per month than monthly — the pricing page states the current rate.", destinationUrl: "https://clickup.com/pricing", isVerified: true, sortWeight: 90 },
];

/* ------------------------------------------------------------------ */
/* Review extras (v2) — scorecard, long-form body, starting price.     */
/* Keyed by slug and merged into the store insert. Criteria use the    */
/* niche's five standard axes as data, not hardcoded labels.           */
/* ------------------------------------------------------------------ */

const crit = (
  ease: number,
  power: number,
  output: number,
  price: number,
  support: number,
): RatingCriterion[] => [
  { label: "Ease of use", score: ease },
  { label: "Power & features", score: power },
  { label: "Output quality", score: output },
  { label: "Pricing value", score: price },
  { label: "Support & docs", score: support },
];

type ReviewExtra = {
  startingPriceLabel?: string;
  ratingBreakdown?: RatingCriterion[];
  reviewBody?: TiptapDoc;
};

const reviewExtras: Record<string, ReviewExtra> = {
  "bolt-new": {
    startingPriceLabel: "Free tier · paid is token-metered",
    ratingBreakdown: crit(8.5, 8.0, 8.5, 7.5, 8.0),
    reviewBody: doc(
      h2("What Bolt.new is"),
      pt(
        "Bolt.new, from StackBlitz, turns a chat prompt into a full-stack web app that runs live in your browser. There's no local setup and no waiting: you describe what you want, watch it build in a real code sandbox, click through the running result, edit the code if you like, and deploy. It deliberately sits between a no-code app builder and a coding environment — more hands-on than the former, far less ceremony than the latter.",
      ),
      h2("Where it earns its score"),
      pt(
        "The in-browser experience is the draw. Because StackBlitz has spent years making a full development environment run in the browser, Bolt gives you something most prompt-to-app tools don't: a genuine, editable sandbox with instant preview. For people who like to see the code and nudge it, that transparency builds trust the black-box builders can't. It's fast, it's shareable, and it gets you to a clickable app quickly.",
      ),
      h2("The catch"),
      pt(
        "Bolt runs on a token/credit model, and heavy iteration — the exact loop that makes these tools fun — consumes tokens quickly, so budget for it. And like every prompt-to-app tool, the further you push into complex or unusual logic, the more you need to understand what was generated to keep going. It rewards technical comfort more than a builder that hides the code entirely.",
      ),
      quote(
        "Bolt.new is the prompt-to-app tool for people who want to keep one hand on the code.",
      ),
      h2("Who it's for"),
      pt(
        "Reach for Bolt if you want prompt-to-app speed but like watching and editing the code as it's built. If you'd rather the backend, auth, and hosting were handled with the least code contact possible, Lovable leans further that way — and plenty of builders keep both around. Start on the free tier to see whether the workflow fits before the tokens matter.",
      ),
    ),
  },
  "google-antigravity": {
    startingPriceLabel: "See official site for current access",
    ratingBreakdown: crit(7.5, 8.5, 8.0, 8.0, 7.5),
    reviewBody: doc(
      h2("What Antigravity is"),
      pt(
        "Google's Antigravity starts from a contrarian premise: that making the editor smarter is the wrong goal, because the editor shouldn't be the center of the work at all. Instead it puts Gemini-powered agents in the middle, coordinating across the editor, terminal, and browser, so you spend your time planning, delegating, and reviewing rather than typing line by line. It is Google's serious entry into agent-driven development.",
      ),
      h2("Where it's compelling"),
      pt(
        "If you already feel the shift toward delegating chunks of work to agents, Antigravity is built for that world natively rather than retrofitting it onto an editor. It has Google's models and infrastructure behind it, and it's one of the clearest attempts to answer what development looks like when agents, not files, are the unit of work. That vision is the reason to pay attention.",
      ),
      h2("The catch"),
      pt(
        "It's new. Compared with an established editor like Cursor, it's less battle-tested, the agent-first workflow is a real mental-model adjustment, and as a fast-moving Google product the specifics — including availability and pricing — will keep shifting. That's the normal cost of being early, not a flaw, but it's why this is a tool to try and watch rather than to bet a critical deadline on today.",
      ),
      quote(
        "Antigravity is the most interesting question in AI development right now. Whether it's the answer is still being written.",
      ),
      h2("Who it's for"),
      pt(
        "Try Antigravity if you want to work agent-first and you're comfortable on the frontier with Gemini models. If you want a proven tool that makes you faster this week with no new habits to learn, Cursor is the safer default — run Antigravity alongside it and see which way the wind is blowing. Check antigravity.google for current access, since Google iterates quickly.",
      ),
    ),
  },
  "github-copilot": {
    startingPriceLabel: "Free · Pro from $10/mo",
    ratingBreakdown: crit(9.0, 8.5, 8.5, 8.0, 9.0),
    reviewBody: doc(
      h2("What GitHub Copilot is"),
      pt(
        "GitHub Copilot is the AI coding assistant most developers encounter first, and the reason is distribution rather than novelty: it runs inside the editors and the GitHub workflow they already use. VS Code, JetBrains IDEs, Visual Studio, the command line, and github.com all get the same assistant — inline completions, a chat that can see your code, agentic edits, and code review. You don't adopt Copilot so much as switch it on where you already work.",
      ),
      h2("Where it earns its score"),
      pt(
        "The strength is reach. For a team already living in GitHub, Copilot is the path of least resistance: no new editor, no new vendor, often no new invoice. The free tier is genuinely useful — two thousand completions a month plus chat — and verified students and open-source maintainers get Pro at no cost, which quietly makes it the default for a huge population of developers. On top of completions, the agent mode and agentic code review push it well past the autocomplete tool people remember from a couple of years ago.",
      ),
      pt(
        "Because it is a Microsoft/GitHub product, the enterprise story is easy in the way that matters to buyers: procurement, SSO, org controls, and codebase indexing are all there, and you're negotiating with a vendor you already trust with your source code.",
      ),
      h2("The catch"),
      pt(
        "Meeting you inside your existing IDE is also the ceiling. Copilot is an excellent assistant layered onto a host editor; a purpose-built AI editor like Cursor feels more unified, because the whole tool is designed around the AI rather than hosting it. The other honest note is cost structure: paid tiers now bundle monthly usage credits ($15 on Pro, $70 on Pro+), so leaning hard on premium models and agents can push spend beyond the flat subscription. For most people it won't; for heavy users it can.",
      ),
      quote(
        "Copilot is the safest AI coding decision a team can make. Whether it's the best one depends on whether 'safe and already here' is what you're optimizing for.",
      ),
      h2("Who it's for — and who it isn't"),
      pt(
        "Use Copilot if you want strong AI help with near-zero disruption, especially if your team is already on GitHub. It is not the tool for a non-developer trying to build an app from a prompt — that's an app builder like Lovable — and it's not the deepest AI-editor experience if you're willing to change editors, where Cursor goes further. It is, however, the answer that's hardest to argue with for a working team that just wants good AI in the tools they already have.",
      ),
      h2("Pricing, honestly"),
      pt(
        "Free is real: 2,000 completions a month plus chat, with free Pro for verified students and OSS maintainers. Pro is $10/month for unlimited completions, cloud agent, and code review with $15 of monthly credits; Pro+ is $39/month with premium models and $70 of credits; Max is $100/month. Business and Enterprise are per-user with org controls. All figures verified on the official plans page in July 2026 — confirm at checkout, since the credit model is new and adjusts.",
      ),
    ),
  },
  cursor: {
    startingPriceLabel: "Free tier · Pro from $16/mo",
    ratingBreakdown: crit(9.0, 9.5, 9.0, 8.0, 8.5),
    reviewBody: doc(
      h2("What Cursor is"),
      pt(
        "Cursor is an AI-first code editor built as a fork of VS Code. That single design choice explains most of its appeal: you keep the extensions, keybindings, themes, and muscle memory you already have, and Cursor layers AI over the top of them rather than asking you to learn a new tool. The AI is not a sidebar you occasionally consult — it is woven through the editor as predictive multi-line edits, a chat that has read your whole repository, and an agent that can plan and apply changes across many files at once.",
      ),
      h2("Where it earns its score"),
      pt(
        "The standout is how well the AI understands the project you are actually in. Ask a question and Cursor answers with your files, your types, and your conventions in view, not a generic snippet. Tab completion predicts the next edit you were going to make — often several lines, sometimes in a different file — and it is the feature developers say they miss most the moment they switch back to a plain editor. Agent mode takes this further, carrying out a described task across the codebase while you supervise, which is where the time savings become real rather than novelty.",
      ),
      pt(
        "Because it is VS Code underneath, there is no adoption tax. Teams can move in an afternoon, keep their existing setup, and layer on MCP servers, rules, and hooks to shape how the AI behaves. For a company standardizing on one AI editor, that combination of familiarity and control matters as much as raw model quality.",
      ),
      h2("The catch"),
      pt(
        "Cursor assumes you can read and steer code. It accelerates a developer; it does not replace one. If you can't tell when the agent has gone wrong, you can't use it safely — the tool amplifies judgment you already have rather than supplying it. The other honest caveat is cost: the base subscription is flat, but the heaviest frontier models run on usage-based billing, so a heavy day of agent work can cost more than the sticker price implies. Budget for it, or cap it.",
      ),
      quote(
        "Cursor makes a good developer faster. It does not make a non-developer into one — that is a different tool, and a different review.",
      ),
      h2("Who it's for — and who it isn't"),
      pt(
        "Use Cursor if you write software and want the AI at the center of your editor instead of off to the side. It is, for our money, the strongest tool in its category for that reader. But DaddyPromoos's core audience is founders and builders shipping products, many of whom don't write code — and for them Cursor is the wrong starting point. If you want to go from an idea to a deployed, working app without opening a repository, an AI app builder like Lovable will get you there; Cursor is where you'd graduate once you (or an engineer you hire) own the code.",
      ),
      h2("Pricing, honestly"),
      pt(
        "There is a free Hobby plan with limited Agent requests and Tab completions — genuinely enough to judge whether the workflow clicks for you. Pro is $16/month for extended limits, frontier-model access, and cloud agents, with the strongest models metered on usage. Teams is $32/user/month adding central billing, SSO, and agentic code review. All figures verified on the official pricing page in July 2026; confirm at checkout, since usage-based tools adjust often.",
      ),
    ),
  },
  base44: {
    startingPriceLabel: "Free plan · paid is credit-metered",
    ratingBreakdown: crit(9.5, 8.5, 9.0, 8.5, 9.0),
    reviewBody: doc(
      h2("What Base44 actually is"),
      pt(
        "Base44 is an AI app builder, operated by Wix, that turns a plain-language description into a working web application — database, user authentication, transactional email, and hosting included. You describe the product you want, it assembles a first version, and you refine it by describing changes rather than editing code. The pitch is not \"design a website\" but \"ship functional software without an engineering team,\" and for a specific set of jobs it delivers on that.",
      ),
      h2("Where it earns its score"),
      pt(
        "The standout is how self-contained it is. Most AI builders generate a front end and leave you to wire up a backend; Base44 gives you the whole stack behind one prompt loop. For a founder validating an idea or an operator building an internal tool, that removes the exact friction that usually kills momentum — no Supabase project to configure, no auth to bolt on, no deploy step to learn. The iteration loop is genuinely fast: describing a change and watching it apply beats every visual builder we cover for speed.",
      ),
      pt(
        "Being operated by Wix matters more than it sounds. It buys institutional stability that most AI-builder startups in this category can't offer, which is reassuring if you're putting a real workflow on the platform.",
      ),
      h2("The catch"),
      pt(
        "Pricing is credit-metered, and heavy iteration burns credits quickly — every small revision is a spend. Budget for it or you'll be surprised. The bigger structural point is the exit path: Base44 is a managed platform first, built to run your app for you, not to hand you a standalone repository. You own and can export your data, but you can't lift the whole stack onto your own servers. If a prototype becomes a business-critical product, that's a decision you want to make deliberately, not discover later.",
      ),
      quote(
        "Treat generated output as a very fast first draft, not finished software — it still needs human review before anyone relies on it.",
      ),
      h2("Who should use it"),
      pt(
        "Use Base44 to validate product ideas fast, to build internal tools, and for MVPs where shipping this week beats owning the stack. Skip it if you need to self-host, expect heavy custom backend logic, or your team will want to take the code into a standard repo workflow — in which case Lovable is the more honest fit.",
      ),
    ),
  },
  lovable: {
    startingPriceLabel: "Free tier · paid plans, credit-metered",
    ratingBreakdown: crit(9.0, 9.0, 9.5, 8.5, 9.5),
    reviewBody: doc(
      h2("What Lovable actually is"),
      pt(
        "Lovable is an AI app builder that writes real React front ends and Supabase back ends from a chat conversation. The distinction that defines it: the output is a standard codebase you can connect to GitHub and develop like any other project. It is, in practice, the AI builder that engineers object to least, because what it produces looks like code a competent developer would write rather than a proprietary abstraction.",
      ),
      h2("Where it earns its score"),
      pt(
        "The answer to the lock-in question is the whole point. You get AI-speed prototyping and you leave with a repo your team owns. Architecture choices are sensible defaults an engineer can pick up, not black boxes. Conversational iteration is quick, and visual edits let you adjust details directly instead of prompting for every small change. The free tier is enough to judge output quality on your own idea before you pay anything, which is exactly the evaluation you should run.",
      ),
      h2("The catch"),
      pt(
        "Credit-based pricing means cost scales with how much you iterate, not how much you ship — a product that fights you is a product that costs more. You still need Supabase knowledge (and sometimes other services) once you outgrow the happy path; the code is yours, which also means the maintenance is yours. And complex, unusual product logic can send the AI in circles, so human review stays mandatory before anything customer-facing goes live.",
      ),
      h2("Who should use it"),
      pt(
        "Use Lovable for MVPs that will graduate into a real product and for teams that insist on owning a standard React/Supabase codebase. Skip it if you want a fully managed platform where hosting, auth, and scaling are somebody else's job forever — that's the Base44 trade, and it's a legitimate one.",
      ),
    ),
  },
  "sage-uk": {
    startingPriceLabel: "Paid monthly · frequent new-customer offers",
    ratingBreakdown: crit(7.0, 8.0, 8.0, 7.5, 8.5),
    reviewBody: doc(
      h2("What Sage is for"),
      pt(
        "Sage is one of the longest-standing names in UK small-business accounting: bookkeeping, VAT and Making Tax Digital submissions, payroll, and HR under one vendor. Its cloud products target sole traders through mid-sized companies, and — crucially — most UK accountants can work in it without a learning curve. That familiarity is a feature, not a footnote.",
      ),
      h2("Where it earns its score"),
      pt(
        "Compliance is the core competency. MTD VAT submissions are built in and dependable, payroll integrates up to mid-sized headcounts under the same vendor, and handover to a UK bookkeeper is frictionless. Sage also runs long promotional free periods for new customers on a regular basis, which materially softens year-one cost if you time your start.",
      ),
      h2("The catch"),
      pt(
        "The interface feels dated next to newer cloud accounting tools, and costs add up module by module — accounting, payroll, and extras are separate line items, so the headline price isn't the real price. If your priority is a modern UX or you run a US-style business, QuickBooks or a newer tool may fit better.",
      ),
      h2("Who should use it"),
      pt(
        "Use Sage if you're a UK limited company or sole trader that wants MTD-compliant bookkeeping plus payroll under one vendor your accountant already knows. Skip it if slick software matters more to you than accountant familiarity.",
      ),
    ),
  },
  daraz: {
    startingPriceLabel: "Free to use · marketplace pricing",
    ratingBreakdown: crit(7.5, 7.5, 7.0, 8.5, 6.5),
    reviewBody: doc(
      h2("What Daraz is"),
      pt(
        "Daraz is the largest e-commerce marketplace in South Asia, owned by Alibaba Group, selling electronics, fashion, groceries, and everyday essentials across Pakistan, Bangladesh, Sri Lanka, and Nepal. Its calendar of flash sales and bank partnerships means timing a purchase well genuinely changes what you pay — this is a marketplace where patience is a discount.",
      ),
      h2("Where it earns its score"),
      pt(
        "For shoppers in its markets, Daraz usually offers the widest selection and the most aggressive discounting available — one account covers phones to groceries. The sale events and bank partnerships produce real, verifiable discounts on most listings rather than inflated-then-cut prices, and the app's vouchers and free-shipping offers are frequent and genuinely usable.",
      ),
      h2("The catch"),
      pt(
        "It's a marketplace, so product quality and shipping speed depend heavily on the individual seller. Customer service on disputes can be slow, and returns require patience and documentation. The listing rating and the return policy are your real protection — read them before you buy, especially on premium brands where authenticity varies by seller.",
      ),
      h2("Who should use it"),
      pt(
        "Use Daraz for electronics and household purchases in South Asia, timed around the big sale events (11.11, 12.12, payday sales) and bank-card days. Skip it if you need guaranteed authenticity on premium brands or same-day delivery reliability — check the seller, not just the listing.",
      ),
    ),
  },
  webflow: {
    startingPriceLabel: "Free plan · site plans billed monthly or annual",
    ratingBreakdown: crit(7.5, 9.0, 9.0, 8.0, 8.5),
  },
  framer: {
    startingPriceLabel: "Free plan · paid site plans",
    ratingBreakdown: crit(8.8, 8.0, 8.8, 8.0, 8.0),
  },
  quickbooks: {
    startingPriceLabel: "Paid monthly · new-customer intro offer",
    ratingBreakdown: crit(8.0, 8.5, 8.0, 7.0, 8.0),
  },
};

/* ------------------------------------------------------------------ */
/* Comparisons (v2) — same-category head-to-heads. base44-vs-lovable   */
/* is featured. Criteria written from public info; verify before any   */
/* production publish.                                                  */
/* ------------------------------------------------------------------ */

type ComparisonSeed = {
  slug: string;
  title: string;
  subtitle: string;
  aSlug: string;
  bSlug: string;
  intro: string;
  criteria: ComparisonCriterion[];
  verdictA: string;
  verdictB: string;
  bottomLine: string;
  isFeatured?: boolean;
  seoTitle: string;
  seoDescription: string;
};

export const comparisonSeed: ComparisonSeed[] = [
  {
    slug: "base44-vs-lovable",
    title: "Base44 vs Lovable",
    subtitle: "The AI app-builder decision comes down to one question: do you need to own the code?",
    aSlug: "base44",
    bSlug: "lovable",
    intro:
      "Re-tested July 2026 — verdict updated. Both turn plain-language prompts into working software, and both are strong. They differ on the thing that matters most six months in: what you're left holding. Base44 optimizes for the shortest path to a live, hosted app; Lovable optimizes for not being locked in — and on a re-test with fresh pricing and capability checks on both sides, that ownership gap is the one that still decides it for most people. Here is the honest breakdown.",
    criteria: [
      { label: "Code ownership", aText: "Managed platform — data exports, but no full-stack self-host.", bText: "Exports standard React + Supabase code and syncs to GitHub.", winner: "b", note: "The core difference: Lovable leaves you with a repo; Base44 keeps the stack." },
      { label: "Speed to a hosted app", aText: "Fastest — database, auth, and hosting are built in.", bText: "Fast, but you wire Supabase and deploy the code yourself.", winner: "a" },
      { label: "Free tier", aText: "Free plan builds and publishes a real app.", bText: "Free tier with daily message limits and public projects.", winner: "tie" },
      { label: "Pricing model", aText: "Credit-metered — heavy iteration burns credits.", bText: "Message-metered — cost scales with iteration.", winner: "tie" },
      { label: "Best-fit user", aText: "Non-technical founders shipping this week.", bText: "Teams that will own and extend the codebase.", winner: "tie" },
      { label: "Backing", aText: "Operated by Wix — institutional stability.", bText: "Independent and developer-focused.", winner: "a", note: "Reassurance vs. developer focus — depends what you value." },
    ],
    verdictA:
      "Choose Base44 if you want the fastest path from prompt to a hosted, working app and you're comfortable staying on a managed platform.",
    verdictB:
      "Choose Lovable if owning a standard React/Supabase codebase matters — you get AI speed now and a repo your engineers can take over later.",
    bottomLine:
      "Both turn prompts into working software. Base44 optimizes for the shortest path to something live; Lovable optimizes for not being locked in. Pick by your exit plan, not the demo.",
    seoTitle: "Base44 vs Lovable (2026): Which AI App Builder to Choose",
    seoDescription:
      "A head-to-head on code ownership, speed, pricing, and best-fit user. Base44 is the fastest path to a hosted app; Lovable leaves you with a repo you own.",
  },
  {
    slug: "webflow-vs-framer",
    title: "Webflow vs Framer",
    subtitle: "The higher ceiling versus the faster start — which trade fits your team.",
    aSlug: "webflow",
    bSlug: "framer",
    intro:
      "Webflow and Framer both let designers build and publish real sites without hand-writing code, but they reward different priorities. Webflow gives you a higher ceiling if you invest in learning it; Framer gets you live faster with less friction. The right answer is about how much control you actually need.",
    criteria: [
      { label: "Learning curve", aText: "Steeper — the real CSS box model is exposed.", bText: "Gentler — closer to a design tool.", winner: "b" },
      { label: "Design ceiling", aText: "Very high — pixel control plus CMS depth.", bText: "High and fast — motion and layout shine.", winner: "a", note: "Webflow wins on ceiling; Framer wins on time-to-first-draft." },
      { label: "CMS & structured content", aText: "Mature CMS with references and collections.", bText: "Capable CMS on a simpler model.", winner: "a" },
      { label: "Speed to publish", aText: "Slower to master, powerful once fluent.", bText: "Fastest from blank canvas to live site.", winner: "b" },
      { label: "Free tier", aText: "Two free staging sites on webflow.io.", bText: "Free publish on a framer.website subdomain.", winner: "tie" },
      { label: "Best-fit user", aText: "Teams needing a deep, maintainable site plus CMS.", bText: "Designers wanting a striking site live fast.", winner: "tie" },
    ],
    verdictA:
      "Choose Webflow if you need a deep, maintainable site with a serious CMS and you'll invest the time to learn it.",
    verdictB:
      "Choose Framer if you want a beautiful site published fast and value momentum over maximum control.",
    bottomLine:
      "Webflow rewards the time you put into learning it with a higher ceiling; Framer gets you live faster with less friction. Match the tool to how much control you actually need.",
    seoTitle: "Webflow vs Framer (2026): Which Site Builder Wins",
    seoDescription:
      "Learning curve, design ceiling, CMS, and speed compared. Webflow for a deeper maintainable site; Framer for a striking site published fast.",
  },
  {
    slug: "quickbooks-vs-sage-uk",
    title: "QuickBooks vs Sage",
    subtitle: "For UK small businesses, a modern interface versus the accountant's default.",
    aSlug: "quickbooks",
    bSlug: "sage-uk",
    intro:
      "For a UK small business, both QuickBooks and Sage are safe, MTD-compliant choices — this is not a right-versus-wrong decision. QuickBooks feels more modern; Sage is the entrenched default that nearly every UK accountant already knows, with stronger integrated payroll. Here's how they line up.",
    criteria: [
      { label: "UK compliance (MTD)", aText: "MTD-ready with strong UK VAT support.", bText: "MTD is a core competency; deep UK focus.", winner: "b", note: "Both comply; Sage is the more entrenched UK default." },
      { label: "Interface", aText: "Modern, approachable UX.", bText: "Functional but dated.", winner: "a" },
      { label: "Payroll", aText: "Add-on payroll available.", bText: "Integrated payroll up to mid-size headcount.", winner: "b" },
      { label: "Accountant familiarity (UK)", aText: "Widely supported.", bText: "Ubiquitous among UK accountants.", winner: "b" },
      { label: "Ecosystem & integrations", aText: "Large third-party app marketplace.", bText: "Solid but more traditional.", winner: "a" },
      { label: "Best-fit user", aText: "Modern UK small businesses wanting slick UX.", bText: "UK firms wanting the accountant-default plus payroll.", winner: "tie" },
    ],
    verdictA:
      "Choose QuickBooks if you want the more modern interface and a large integrations marketplace.",
    verdictB:
      "Choose Sage if UK payroll and total accountant familiarity matter most, and you don't mind a more dated UI.",
    bottomLine:
      "Both are safe, compliant choices for UK small businesses. QuickBooks feels more modern; Sage is the entrenched accountant default with stronger integrated payroll. Ask your accountant which they'd rather receive.",
    seoTitle: "QuickBooks vs Sage (2026): Best UK Small-Business Accounting",
    seoDescription:
      "MTD compliance, interface, payroll, and accountant familiarity compared for UK small businesses. QuickBooks for modern UX; Sage for the accountant default.",
  },
  {
    slug: "jasper-vs-copy-ai",
    title: "Jasper vs Copy.ai",
    subtitle: "Enterprise brand control versus the fastest path to first-draft copy.",
    aSlug: "jasper",
    bSlug: "copy-ai",
    intro:
      "Jasper and Copy.ai both generate marketing copy from a prompt, but they aim at different buyers. Jasper leans into brand governance and team workflows; Copy.ai wins on speed, a genuinely useful free tier, and getting a usable draft out fast. Here's how they compare where it counts.",
    criteria: [
      { label: "Brand voice control", aText: "Trainable brand voice and knowledge base for consistent tone.", bText: "Tone presets, lighter brand-memory controls.", winner: "a", note: "Jasper is built for teams policing a house style." },
      { label: "Free tier", aText: "No free plan — trial only.", bText: "Free plan with a monthly word allowance.", winner: "b" },
      { label: "Speed to first draft", aText: "Powerful but heavier interface.", bText: "Fast, template-driven drafting.", winner: "b" },
      { label: "Workflow & automation", aText: "Campaign workflows and team roles.", bText: "Multi-step GTM workflows and automations.", winner: "tie" },
      { label: "Output quality (long-form)", aText: "Strong long-form with brand guardrails.", bText: "Great short-form, thinner on long-form.", winner: "a" },
      { label: "Best-fit user", aText: "Brand and content teams needing consistency.", bText: "Solo marketers and small teams moving fast.", winner: "tie" },
    ],
    verdictA:
      "Choose Jasper if brand consistency, long-form output, and team governance matter more than price.",
    verdictB:
      "Choose Copy.ai if you want a strong free tier and the fastest route from prompt to a usable first draft.",
    bottomLine:
      "Jasper is the team's brand-safe writing platform; Copy.ai is the fast, affordable drafting tool. Pick Jasper for governance, Copy.ai for speed and cost.",
    seoTitle: "Jasper vs Copy.ai (2026): Which AI Copywriter to Choose",
    seoDescription:
      "Brand voice, free tier, speed, and long-form quality compared. Jasper for brand-safe team content; Copy.ai for fast, affordable first drafts.",
  },
  {
    slug: "notion-vs-clickup",
    title: "Notion vs ClickUp",
    subtitle: "A flexible docs-and-databases canvas versus an all-in-one project engine.",
    aSlug: "notion",
    bSlug: "clickup",
    intro:
      "Notion and ClickUp both promise to replace a stack of tools, but they start from opposite ends. Notion is a flexible docs-and-databases canvas you shape yourself; ClickUp is a dense, feature-loaded project-management engine out of the box. The right pick depends on whether you want to build your system or adopt one.",
    criteria: [
      { label: "Docs & knowledge base", aText: "Best-in-class docs and wiki editing.", bText: "Docs exist but are secondary to tasks.", winner: "a" },
      { label: "Project management depth", aText: "Capable via databases; less purpose-built.", bText: "Deep — dependencies, sprints, workloads, goals.", winner: "b" },
      { label: "Learning curve", aText: "Approachable; complexity is opt-in.", bText: "Powerful but can feel overwhelming early.", winner: "a" },
      { label: "Free tier", aText: "Generous free plan for individuals.", bText: "Free plan with unlimited members, capped storage.", winner: "tie" },
      { label: "Customization", aText: "Highly flexible building blocks.", bText: "Extensive views, fields, and automations.", winner: "tie" },
      { label: "Best-fit user", aText: "Teams centering docs, notes, and light tracking.", bText: "Ops-heavy teams running structured projects.", winner: "tie" },
    ],
    verdictA:
      "Choose Notion if documents, wikis, and a flexible workspace you shape yourself are the core need.",
    verdictB:
      "Choose ClickUp if you want deep, ready-made project management with sprints, dependencies, and reporting.",
    bottomLine:
      "Notion is the flexible canvas for docs and light structure; ClickUp is the heavyweight project engine. Choose by whether your team lives in documents or in task pipelines.",
    seoTitle: "Notion vs ClickUp (2026): Which Workspace Tool Wins",
    seoDescription:
      "Docs, project depth, learning curve, and customization compared. Notion for flexible docs and wikis; ClickUp for deep, ready-made project management.",
  },
  {
    slug: "bubble-vs-webflow",
    title: "Bubble vs Webflow",
    subtitle: "Full-stack no-code apps versus best-in-class marketing sites and CMS.",
    aSlug: "bubble",
    bSlug: "webflow",
    intro:
      "Bubble and Webflow both let you build without writing code, but they solve different problems. Bubble builds full-stack web apps with a real database and logic; Webflow builds visually polished marketing sites and content-driven pages. Confusing the two is the most common no-code mistake — here's the clean split.",
    criteria: [
      { label: "App logic & database", aText: "Full workflows, database, and user auth.", bText: "Static and CMS content, no app backend.", winner: "a", note: "Only Bubble builds a real application backend." },
      { label: "Visual design quality", aText: "Functional; design polish takes effort.", bText: "Best-in-class visual and typographic control.", winner: "b" },
      { label: "CMS & marketing pages", aText: "Possible but not its strength.", bText: "Mature CMS built for content sites.", winner: "b" },
      { label: "Scalability & performance", aText: "Scales with plan tiers; can need tuning.", bText: "Fast static hosting for content sites.", winner: "tie" },
      { label: "Learning curve", aText: "Steeper — you're building an app.", bText: "Moderate — closer to a design tool.", winner: "b" },
      { label: "Best-fit user", aText: "Founders building a functional SaaS or tool.", bText: "Teams needing a premium marketing site + CMS.", winner: "tie" },
    ],
    verdictA:
      "Choose Bubble if you're building an actual application — logic, a database, and logged-in users.",
    verdictB:
      "Choose Webflow if you need a beautifully designed marketing site or content platform, not an app backend.",
    bottomLine:
      "Bubble is for building web apps; Webflow is for building web sites. Match the tool to whether you're shipping software or publishing content — many teams end up using both.",
    seoTitle: "Bubble vs Webflow (2026): No-Code App Builder vs Site Builder",
    seoDescription:
      "App logic, design quality, CMS, and scalability compared. Bubble for full-stack no-code apps; Webflow for premium marketing sites and content.",
  },

  /* ==================== v3 — flagship + AI IDE matchups ================ */
  {
    slug: "lovable-vs-cursor",
    title: "Lovable vs Cursor",
    subtitle: "An AI app builder and a professional IDE do different jobs. The honest question is which job is yours.",
    aSlug: "lovable",
    bSlug: "cursor",
    isFeatured: true,
    intro:
      "This is the comparison people mean when they ask whether to use Lovable or Cursor, and an honest answer starts by refusing the premise. These are not two versions of the same tool. Lovable turns a description into a deployed, full-stack application. Cursor is a professional code editor that makes a developer faster inside a repository they already own. Which one wins depends almost entirely on whether you write code.",
    criteria: [
      { label: "Who it's for", aText: "Founders, indie hackers, and SMB builders shipping a product.", bText: "Professional developers working in a real codebase.", winner: "tie", note: "Genuinely different audiences — this row decides every row under it." },
      { label: "Coding knowledge required", aText: "None to start; you describe what you want and refine it.", bText: "Substantial — it accelerates people who can already read and steer code.", winner: "a", note: "For this site's core reader, who mostly doesn't code, that is decisive." },
      { label: "Idea to deployed app", aText: "The whole point: prompts to a running, hosted app.", bText: "Edits code only — you still build the backend, deploy, and host it.", winner: "a" },
      { label: "Backend & hosting", aText: "Supabase backend, auth, and deploy built in.", bText: "Not its job; you wire and host everything yourself.", winner: "a" },
      { label: "Code ownership & export", aText: "Real React/Supabase code you can sync to GitHub.", bText: "It is your repository — total ownership by definition.", winner: "b" },
      { label: "Ceiling & flexibility", aText: "High for conventional apps; unusual logic gets harder.", bText: "Effectively unlimited — a full editor on any codebase.", winner: "b" },
      { label: "Learning curve", aText: "Gentle: describe, review, refine.", bText: "Steep if you can't code; natural if you can.", winner: "a" },
      { label: "Pricing model", aText: "Free tier; paid is credit-metered, so heavy iteration costs credits.", bText: "Free tier; Pro $16/mo, heaviest models billed on usage.", winner: "tie" },
    ],
    verdictA:
      "Choose Lovable if you want to go from an idea to a working, deployed product without a development background — which describes most of the people this site is written for.",
    verdictB:
      "Choose Cursor if you write software for a living. Inside a real codebase it isn't close: Cursor is the better tool, and Lovable isn't trying to be.",
    bottomLine:
      "For DaddyPromoos's core reader — founders and builders shipping a product without a development background — Lovable wins. If you are a professional developer working in a real codebase, Cursor wins, and it isn't close. Both statements are true at once; pick the one that describes you.",
    seoTitle: "Lovable vs Cursor (2026): AI App Builder or AI IDE?",
    seoDescription:
      "Lovable builds and deploys a full app from prompts; Cursor makes developers faster inside a real codebase. Which one wins depends on whether you write code — here is the honest split.",
  },
  {
    slug: "lovable-vs-bolt-new",
    title: "Lovable vs Bolt.new",
    subtitle: "Two prompt-to-app builders that diverge on what happens after the first version works.",
    aSlug: "lovable",
    bSlug: "bolt-new",
    intro:
      "Lovable and Bolt.new are the closest true head-to-head in this category: both take a prompt and hand back a running full-stack web app. The differences show up once the demo works and you have to live with the thing — where the code goes, how the backend is wired, and how much the iteration costs.",
    criteria: [
      { label: "Idea to working app", aText: "Very fast, with backend and deploy handled.", bText: "Very fast, running live in the browser sandbox.", winner: "tie" },
      { label: "Backend story", aText: "Supabase backend and auth wired in as a first-class path.", bText: "You bring your own backend/services more often.", winner: "a" },
      { label: "Code ownership", aText: "Standard React/Supabase code, syncable to GitHub.", bText: "Real code in a StackBlitz sandbox you can export.", winner: "tie" },
      { label: "In-browser editing", aText: "Chat-led with visual edits.", bText: "A genuine in-browser IDE with live preview.", winner: "b", note: "Bolt is closer to an editor; Lovable is closer to a builder." },
      { label: "Best-fit user", aText: "Non-developers shipping a real product.", bText: "Technical users who want to poke the code as it's generated.", winner: "tie" },
      { label: "Free tier", aText: "Daily build credits plus monthly Cloud credits.", bText: "Free tier available; heavier use needs a paid plan.", winner: "tie" },
    ],
    verdictA:
      "Choose Lovable if you want the backend, auth, and deploy handled for you and you'd rather describe changes than edit code.",
    verdictB:
      "Choose Bolt.new if you're comfortable in an editor and want to watch and tweak the code live as it's generated.",
    bottomLine:
      "Both are strong prompt-to-app builders. Lovable does more of the full-stack work for you, which is why it's our pick for non-developers; Bolt.new suits people who want their hands closer to the code.",
    seoTitle: "Lovable vs Bolt.new (2026): Which AI App Builder Wins",
    seoDescription:
      "Backend story, code ownership, in-browser editing, and free tiers compared. Lovable for a handled full-stack path; Bolt.new for live code tinkering.",
  },
  {
    slug: "lovable-vs-v0",
    title: "Lovable vs v0",
    subtitle: "A full-app platform versus the best UI generator in the business.",
    aSlug: "lovable",
    bSlug: "v0",
    intro:
      "This matchup is often framed as a rivalry, but it's really a scope difference. v0 is Vercel's tool for generating excellent React and Tailwind interfaces. Lovable is trying to produce the whole application — interface, backend, auth, and deployment. If you compare them on the front end alone you'll miss the point.",
    criteria: [
      { label: "Scope", aText: "Whole application: UI, backend, auth, hosting.", bText: "Primarily interface and app code you drop into Next.js.", winner: "a", note: "Different scopes — this is the crux." },
      { label: "UI quality from a prompt", aText: "Good and improving.", bText: "Best in class; polished components fast.", winner: "b" },
      { label: "Backend & auth", aText: "Supabase backend wired in.", bText: "You supply it.", winner: "a" },
      { label: "Deploy story", aText: "Publish from the platform.", bText: "Ships naturally into Vercel/Next.js.", winner: "tie" },
      { label: "Best-fit user", aText: "Someone who needs a working product end to end.", bText: "A developer or designer who needs a great front end fast.", winner: "tie" },
    ],
    verdictA:
      "Choose Lovable if you need an actual working product — not just the screens — and you don't want to assemble the backend yourself.",
    verdictB:
      "Choose v0 if you already have (or can build) the rest of the stack and want the fastest route to a beautiful, production-ready front end.",
    bottomLine:
      "v0 makes the best front end; Lovable makes the whole product. For a founder shipping an app, Lovable is the more complete answer — plenty of developers happily use v0 alongside it.",
    seoTitle: "Lovable vs v0 (2026): Full App Platform vs UI Generator",
    seoDescription:
      "Scope, UI quality, backend, and deploy compared. v0 leads on generated interfaces; Lovable delivers the whole working application.",
  },
  {
    slug: "cursor-vs-windsurf",
    title: "Cursor vs Windsurf (now Devin Desktop)",
    subtitle: "The two AI-native editors racing on the same track — one of which just changed its name.",
    aSlug: "cursor",
    bSlug: "windsurf",
    intro:
      "Re-tested July 2026 — updated for a rename. First, the thing most comparisons haven't caught up with: Windsurf is now Devin Desktop, under Cognition. Its own site says so directly (\"Devin Desktop is the new name for Windsurf\"), windsurf.com redirects to devin.ai/desktop, and the change ships as an over-the-air update with plans and extensions carried over. The editor is the same one people know for its Cascade agent — the badge on it changed. With that settled: Cursor and Devin Desktop remain the closest matchup in the category, both AI-native VS Code-style editors with codebase awareness and cross-file agents. Feature lists converge every few months, so the honest deciding factor is which agent flow suits how you work.",
    criteria: [
      { label: "Editor familiarity", aText: "VS Code fork — extensions and keybindings carry over.", bText: "Familiar VS Code-style editing.", winner: "tie" },
      { label: "Agentic editing", aText: "Agent mode plans and applies multi-file changes.", bText: "Cascade agent is the signature feature and very capable.", winner: "tie", note: "Both strong; preference is genuinely personal here." },
      { label: "Autocomplete / next-edit", aText: "Tab prediction is the feature people miss most when they leave.", bText: "Strong completions; fewer people cite it as the reason they stay.", winner: "a" },
      { label: "Momentum & ecosystem", aText: "The category's default with the largest community.", bText: "Strong following; smaller ecosystem.", winner: "a" },
      { label: "Pricing", aText: "Free tier; Pro $16/mo with usage-based frontier models.", bText: "Free tier; paid plans compete closely.", winner: "tie" },
      { label: "Best-fit user", aText: "Developers who want the category default.", bText: "Developers who prefer Cascade's flow.", winner: "tie" },
    ],
    verdictA:
      "Choose Cursor if you want the category's default: the largest community, the strongest tab-completion, and the safest long-term bet.",
    verdictB:
      "Choose Windsurf if Cascade's agent flow clicks for you — it's a genuinely close competitor, not a runner-up.",
    bottomLine:
      "These two are close enough that you should trial both free tiers on your own repository for a day. Cursor is our pick on momentum and completion quality, but a developer who prefers Windsurf isn't wrong.",
    seoTitle: "Cursor vs Windsurf (2026): Which AI IDE Should You Use",
    seoDescription:
      "Agentic editing, autocomplete, ecosystem, and pricing compared. Cursor leads on momentum and tab completion; Windsurf's Cascade is a genuine rival.",
  },
  {
    slug: "cursor-vs-github-copilot",
    title: "Cursor vs GitHub Copilot",
    subtitle: "A dedicated AI editor versus the assistant your team probably already has.",
    aSlug: "cursor",
    bSlug: "github-copilot",
    intro:
      "Copilot is the incumbent: it lives inside the IDEs your team already uses and is often already paid for. Cursor asks you to switch editors in exchange for AI that sits at the centre rather than the side. The trade is disruption versus depth.",
    criteria: [
      { label: "Setup & adoption", aText: "New editor to install (though it's a VS Code fork).", bText: "Plugs into VS Code, JetBrains, Visual Studio you already run.", winner: "b" },
      { label: "Codebase awareness", aText: "Deep — the editor is built around it.", bText: "Good and improving, but bolted onto the host IDE.", winner: "a" },
      { label: "Agentic multi-file edits", aText: "Central to the product.", bText: "Available, generally less tightly integrated.", winner: "a" },
      { label: "Enterprise reach", aText: "Teams tier with SSO and analytics.", bText: "Deep GitHub/enterprise integration and procurement familiarity.", winner: "b" },
      { label: "Pricing", aText: "Free tier; Pro $16/mo (usage-based on top models).", bText: "Free tier for many; paid plans widely bundled already.", winner: "tie" },
      { label: "Best-fit user", aText: "Developers who want AI at the centre of the editor.", bText: "Teams that want AI without changing tools.", winner: "tie" },
    ],
    verdictA:
      "Choose Cursor if you want the deepest AI integration and you're willing to change editors to get it.",
    verdictB:
      "Choose GitHub Copilot if you'd rather not move — it meets your team in the IDE and procurement process you already have.",
    bottomLine:
      "Copilot is the path of least resistance and it's genuinely good. Cursor is the better AI experience if you'll switch editors. For most teams the honest test is a week in each.",
    seoTitle: "Cursor vs GitHub Copilot (2026): Which AI Coding Tool Wins",
    seoDescription:
      "Adoption, codebase awareness, agentic editing, and pricing compared. Copilot fits your existing IDE; Cursor goes deeper if you'll switch.",
  },
  {
    slug: "cursor-vs-google-antigravity",
    title: "Cursor vs Google Antigravity",
    subtitle: "The established leader against Google's agent-first newcomer.",
    aSlug: "cursor",
    bSlug: "google-antigravity",
    intro:
      "Cursor won the AI-editor race by making the editor smarter. Google's Antigravity argues the editor is the wrong unit entirely and puts agents at the centre, working across the editor, terminal, and browser. One is proven; the other is a bet on where this is heading.",
    criteria: [
      { label: "Maturity", aText: "Established, with a large community and steady releases.", bText: "Newer and moving fast; less battle-tested.", winner: "a" },
      { label: "Agent-first design", aText: "Agent mode inside a familiar editor.", bText: "Built from the ground up around orchestrating agents.", winner: "b", note: "A real philosophical difference, not a feature gap." },
      { label: "Model access", aText: "Multiple frontier models.", bText: "Built around Google's Gemini models.", winner: "tie" },
      { label: "Familiarity", aText: "VS Code fork — you already know it.", bText: "New surface and mental model to learn.", winner: "a" },
      { label: "Best-fit user", aText: "Developers wanting a proven, fast AI editor today.", bText: "Developers who want to work agent-first and are happy on the frontier.", winner: "tie" },
    ],
    verdictA:
      "Choose Cursor if you want the proven tool that will make you faster this week with no philosophy to adopt.",
    verdictB:
      "Choose Antigravity if you believe agents — not files — are the future unit of work and you want to build that habit early.",
    bottomLine:
      "Cursor is the safe, excellent default. Antigravity is the more interesting bet, and worth watching closely; today it's the newer, less proven of the two.",
    seoTitle: "Cursor vs Google Antigravity (2026): AI IDE Showdown",
    seoDescription:
      "Maturity, agent-first design, model access, and familiarity compared. Cursor is the proven default; Antigravity is Google's agent-first bet.",
  },
];

/* ------------------------------------------------------------------ */
/* Content builders                                                    */
/*                                                                     */
/* Extracted from main() so scripts/restore-content.ts can reuse the   */
/* exact same content arrays without importing a module that wipes the */
/* database. The array literals below are unchanged.                   */
/* ------------------------------------------------------------------ */

/** Coupon rows are only ever read for their id when embedded in content. */
type OfferRef = { id: string };

export type ContentOffers = {
  base44Offer: OfferRef;
  lovableOffer: OfferRef;
  sageOffer: OfferRef;
  shopifyOffer: OfferRef;
  canvaOffer: OfferRef;
  framerOffer: OfferRef;
};

export function buildPostSeed<C extends { id: string }>(
  deps: ContentOffers & { catBySlug: Map<string, C> },
) {
  const {
    catBySlug,
    base44Offer,
    lovableOffer,
    sageOffer,
    shopifyOffer,
    canvaOffer,
    framerOffer,
  } = deps;

  const postSeed = [
    {
      title: "The best AI app builders in 2026",
      slug: "ai-app-builders-ranked-2026",
      excerpt:
        "We ranked the tools that turn a prompt into a working, deployed app. Lovable is our top pick, with the catch stated plainly, and Bolt, v0, Replit, Base44, and Firebase Studio each get an honest one-line verdict.",
      categoryId: catBySlug.get("no-code-app-builders")!.id,
      tags: ["ai-app-builders", "lovable", "roundup"],
      readingMinutes: 8,
      publishedAt: days(-1),
      relatedStores: ["lovable", "bolt-new", "v0", "replit", "base44", "firebase-studio"],
      content: doc(
        pt("An AI app builder has one job that separates it from every other AI coding tool: it takes a plain description and hands back a working, deployed application, not just code. For founders, indie hackers, and small teams who want to ship a product without a development background, that is the whole game. Here is how the field ranks in 2026, and the catch that comes with each one."),
        h2("Our top pick: Lovable"),
        pt("Lovable wins because it does the most of the job for the person least able to do it themselves. You describe the app, and it produces a real React front end and a Supabase backend with auth, wires them together, and deploys — and the code is standard enough that an engineer you hire later can take it over. That combination, genuinely useful for a non-developer today and not a dead end tomorrow, is why it is our best overall pick."),
        pt("The catch, stated plainly: Lovable is credit-metered, so heavy iteration consumes credits, and very unusual logic still gets harder the further you push it. Neither is a dealbreaker for its intended user, but you should know both before you start. Our full Lovable review goes deep, and the free tier lets you judge it on your own idea first."),
        couponEmbed(lovableOffer.id),
        h2("The rest of the field, ranked"),
        bullets([
          "Bolt.new — the pick for people who want to keep one hand on the code. Prompt to full-stack app in a live in-browser sandbox you can edit. Token-metered, and it rewards technical comfort.",
          "v0 — not really an app builder but the best UI generator there is. Reach for it when you need a beautiful front end fast and can supply the rest of the stack.",
          "Replit — a full cloud IDE plus an AI Agent that builds and hosts. Great for learners and fast prototypes; more editor than builder.",
          "Base44 — the fastest path to a hosted app with the least setup, operated by Wix. Managed rather than exportable, so choose it by your exit plan. Still an honest, accurate pick, just no longer our featured one.",
          "Firebase Studio — Google's cloud workspace for building full-stack and AI apps, strongest if you already live in the Google and Firebase ecosystem.",
        ]),
        promoSlot(),
        h2("How to choose in one question"),
        pt("Do you want the tool to hand you a working product, or hand you code to keep working on? If it is the product, Lovable leads and Base44 is close on speed. If it is the code, Bolt and v0 put you closer to it. Almost everyone reading this wants the product, which is why the ranking looks the way it does."),
        quote("The best AI app builder is the one that gets your specific idea deployed without fighting the way you work. For most people shipping a product, that is Lovable."),
        h2("A note for developers"),
        pt("If you actually write software, an app builder may be the wrong category entirely — you likely want an AI IDE like Cursor instead. We wrote a separate piece on that decision, and a full comparison of Lovable versus Cursor that frames it honestly for both audiences."),
      ),
    },
    {
      title: "The best AI IDEs and coding agents in 2026",
      slug: "best-ai-ides-coding-agents-2026",
      excerpt:
        "For people who write code, the AI is moving into the editor. Cursor leads our ranking, with Devin Desktop (formerly Windsurf), Google Antigravity, GitHub Copilot, and the fast-moving newcomers each placed honestly.",
      categoryId: catBySlug.get("ai-ides-coding-agents")!.id,
      tags: ["ai-ides", "cursor", "roundup"],
      readingMinutes: 8,
      publishedAt: days(-2),
      relatedStores: ["cursor", "windsurf", "google-antigravity", "github-copilot", "kiro", "trae", "zed", "devin"],
      content: doc(
        pt("If you write software for a living, the interesting AI is not the one that builds an app from a prompt — it is the one that lives in your editor and makes you faster inside a real codebase. This category is moving quickly, and one entry even changed its name mid-year. Here is how the AI IDEs and coding agents rank in 2026."),
        h2("Our top pick: Cursor"),
        pt("Cursor leads because it got the fundamentals right and kept them ahead. It is a VS Code fork, so your extensions and muscle memory carry over on day one; its tab completion predicts the next edit rather than the next token, and it is the feature people miss most when they leave; and its agent mode makes multi-file changes that respect your project's context. It has the largest community and the steadiest release cadence, which makes it the safe long-term bet as well as the strong one."),
        pt("The catch: it assumes you can code, and its heaviest models run on usage-based billing that can climb on a busy day. Our full Cursor review covers where that bites."),
        h2("The rest of the field"),
        bullets([
          "Devin Desktop (formerly Windsurf) — the closest competitor to Cursor. Note the rename: Windsurf is now Devin Desktop under Cognition, and windsurf.com redirects there. Same editor, known for its Cascade agent; pick it if that flow suits you.",
          "GitHub Copilot — the incumbent that meets you inside the IDE and GitHub workflow you already use. The least disruptive choice, and often already paid for; less unified than a dedicated AI editor.",
          "Google Antigravity — the most interesting rethink: agent-first rather than editor-first, built on Gemini. Newer and less proven, but the one to watch.",
          "Kiro — AWS's spec-driven agentic IDE, for teams that want structure around AI-generated code.",
          "Trae — ByteDance's fast-moving AI IDE, notable for generous model access.",
          "Zed — a blazing-fast, Rust-built editor with AI baked in, for developers who find heavier editors sluggish.",
        ]),
        promoSlot(),
        h2("How to choose"),
        pt("If you want the proven default, Cursor. If you won't switch editors, Copilot meets you where you are. If you believe agents are the future unit of work, Antigravity is the early bet. We have head-to-heads for the ones people weigh most: Cursor versus Copilot, Cursor versus Devin Desktop, and Cursor versus Antigravity."),
        quote("The best AI IDE is the one whose agent flow feels like help rather than homework. For most developers today, that is Cursor."),
        h2("Not a developer?"),
        pt("If you can't code and you're here to ship a product, none of these are your starting point — you want an AI app builder like Lovable, which goes from a prompt to a deployed app. We wrote a separate guide on which category you actually need."),
      ),
    },
    {
      title: "AI app builder or AI IDE: which do you actually need?",
      slug: "app-builder-or-ai-ide-which-to-use",
      excerpt:
        "The most common expensive mistake in AI tooling is picking the wrong category. Here is the one honest question that sorts it, and where to go once you have your answer.",
      categoryId: catBySlug.get("ai-tools")!.id,
      tags: ["decision", "lovable", "cursor"],
      readingMinutes: 6,
      publishedAt: days(-3),
      relatedStores: ["lovable", "cursor"],
      content: doc(
        pt("People lose weeks and real money by choosing between an AI app builder and an AI IDE without realising they are different categories solving different problems. The tools look similar in a demo — both take a prompt and produce software — and then one of them can't do the thing you actually needed. This is the piece that sorts it out."),
        h2("The one question"),
        pt("Do you write code? Not \"could you learn\" — do you, today, read and steer code comfortably? That single answer decides almost everything, because the two categories are built for opposite sides of it."),
        h2("If you don't code: an AI app builder"),
        pt("An app builder like Lovable takes your description and produces a working, deployed application — front end, backend, auth, hosting — without asking you to open a repository. For a founder or operator who wants a product live, this is the right tool, and the fact that it also leaves you standard code means you are not trapped when you grow. This is where most of the people reading DaddyPromoos should start; our Lovable review and the app-builder roundup go deeper."),
        couponEmbed(lovableOffer.id),
        h2("If you do code: an AI IDE"),
        pt("If you already write software, an app builder will feel like a cage. You want an AI IDE like Cursor: it sits inside a real codebase and makes you dramatically faster at the work you already do, with full control over every line. Handing a professional developer an app builder is like handing a chef a meal kit — it works, but it fights their skill. Our Cursor review and the AI IDE roundup cover the options."),
        h2("The honest edge case"),
        pt("Some people sit in the middle: semi-technical builders who can read code but don't want to write all of it. Tools like Bolt.new are built for exactly that gap, giving you prompt-to-app speed with an editable code sandbox. If that's you, start there and lean whichever way you find yourself pulling."),
        quote("Pick the category before you pick the tool. The category is decided by whether you write code, not by which demo looked cooler."),
        h2("The decision, made"),
        pt("Shipping a product without a dev background: Lovable. Writing software professionally: Cursor. In between and comfortable with code: Bolt. If you're still unsure, our Lovable versus Cursor comparison lays the two worlds side by side and tells each reader, plainly, which one wins for them."),
      ),
    },
    {
      title: "Lovable pricing and credits, explained",
      slug: "lovable-pricing-and-credits-explained",
      excerpt:
        "Lovable runs on credits, not a flat seat price, which trips people up. Here is how the model works and every legitimate way to pay less, from the free tier to the student discount.",
      categoryId: catBySlug.get("no-code-app-builders")!.id,
      tags: ["lovable", "pricing", "guide"],
      readingMinutes: 6,
      publishedAt: days(-4),
      relatedStores: ["lovable"],
      content: doc(
        pt("Lovable does not charge a simple per-seat price. It runs on a credit model, and if you don't understand it going in, the bill can surprise you and the free tier can feel smaller than it is. Here is how it actually works, verified against the official pricing page in July 2026, and every honest way to spend less."),
        h2("How the credits work"),
        pt("The free plan gives you a daily grant of build credits — five a day, up to thirty a month — plus a monthly grant of Cloud credits for hosting and backend features. Building consumes credits by the complexity of the change: a small tweak costs a fraction of a credit, a bigger \"build me this whole page\" costs more, and there is a plan mode that charges a flat one credit per message. Paid tiers add a monthly credit balance on top of those daily grants. The official pricing page is the source of truth for the current numbers, since they adjust."),
        h2("Way one: live on the free tier first"),
        pt("The free plan is not a teaser — those daily build credits are enough to prototype a real idea and decide whether Lovable fits before you pay anything. Spend that allowance validating the concept, not polishing pixels, so the credits go toward answering the question that matters."),
        couponEmbed(lovableOffer.id),
        h2("Way two: the student discount"),
        pt("If you have a valid student email, Lovable offers a student discount — verify eligibility on the official students page. For anyone building while studying, this is the single cheapest way onto a paid plan."),
        promoSlot(),
        h2("Way three: time your credits"),
        pt("Because credits reset on a cycle rather than rolling over indefinitely, the practical trick is to concentrate your building into the part of the cycle you've paid for, instead of letting a fresh grant expire unused. Plan the work, then spend the credits in a focused burst."),
        h2("What not to do"),
        pt("Don't burn credits iterating on tiny cosmetic changes you could make once at the end, and don't upgrade tiers before the free plan has actually shown you a wall. The credit model rewards deliberate building; it punishes aimless prompting."),
        quote("Lovable's credits reward people who know what they want to build. Decide the shape of the thing, then spend."),
        h2("The bottom line"),
        pt("Start free, validate the idea, take the student rate if you qualify, and upgrade only when the credits genuinely run short. Our full Lovable review covers whether it's the right builder for you in the first place."),
      ),
    },
    {
      title: "From prompt to launched product: shipping your first app with Lovable",
      slug: "shipping-your-first-app-with-lovable",
      excerpt:
        "A calm, honest walkthrough of taking an idea to a live app with Lovable, including the exact points where first-timers get stuck and how to get past them.",
      categoryId: catBySlug.get("no-code-app-builders")!.id,
      tags: ["lovable", "workflow", "guide"],
      readingMinutes: 7,
      publishedAt: days(-5),
      relatedStores: ["lovable"],
      content: doc(
        pt("Building your first real app with Lovable is less about clever prompting and more about working in the right order. People who get stuck usually didn't hit a limit of the tool; they skipped a step. Here is the path from idea to a launched product, with the honest snags called out where they happen."),
        h2("1. Describe the app, not the screen"),
        pt("Start by telling Lovable what the app is for and who uses it, not what one page should look like. \"A booking tool where customers pick a slot and pay a deposit\" gives it the shape to build against; \"a page with a calendar\" gets you a calendar and little else. The clearer the job, the better the first version."),
        h2("2. Get the core loop working before the polish"),
        pt("Resist decorating early. Get the one thing the app must do — the booking, the signup, the checkout — working end to end first. This is also where credits are best spent: on the loop that proves the idea, not on colours you'll change anyway."),
        couponEmbed(lovableOffer.id),
        h2("3. Wire up the backend and accounts"),
        pt("This is where first-timers most often stall. Lovable builds on a Supabase backend, so when you add logins or save real data, you're touching a real database. You don't have to master it, but expect a moment where the app stops being a mockup and becomes a system with users and records. Take it slowly and test with a real account."),
        promoSlot(),
        h2("4. Connect a domain and launch"),
        pt("Publishing is the easy part — Lovable deploys for you, and pointing a custom domain is a short step on a paid plan. The honest advice: launch earlier than feels comfortable, with the core loop working and the polish unfinished. A live app with real users teaches you more in a day than another week of prompting."),
        h2("Where beginners actually get stuck"),
        bullets([
          "Asking for everything at once instead of building the core loop first.",
          "Treating the Supabase backend as magic — the moment real data and logins appear, slow down.",
          "Burning credits on cosmetic iteration before the app does its one job.",
          "Waiting for perfect before launching, when real users are the fastest teacher.",
        ]),
        quote("Your first app doesn't need to be impressive. It needs to do one thing, with real users, on a real domain."),
        h2("Then keep going"),
        pt("Once the first app is live, the second is far faster, because you understand the rhythm: describe, build the loop, wire the backend, launch. If you're weighing whether Lovable is the right tool at all, our full review and the app-builder roundup will settle it."),
      ),
    },
    {
      title: "Notion vs ClickUp: how to choose without regretting it",
      slug: "notion-vs-clickup-how-to-choose",
      excerpt:
        "Both promise to replace your whole stack, and they start from opposite ends. Here is how to tell which one fits the way your team actually works.",
      categoryId: catBySlug.get("productivity")!.id,
      tags: ["notion", "clickup", "productivity"],
      readingMinutes: 6,
      publishedAt: days(-1),
      relatedStores: ["notion", "clickup"],
      content: doc(
        pt("Ask ten teams what they use to run their work and half will say Notion, half will say ClickUp, and almost none of them will agree on why. These two tools solve different problems, and most of the frustration people feel comes from picking the one that fights the way they already work."),
        h2("Start with one honest question"),
        pt("Do you live in documents or in tasks? If your team thinks in pages, notes, and shared knowledge, Notion is built around that instinct. If your team thinks in assignments, deadlines, and pipelines, ClickUp was designed for exactly that. Everything else is detail."),
        h2("Where Notion pulls ahead"),
        bullets([
          "Writing and knowledge. Docs, wikis, and notes feel effortless, and people can actually find things later.",
          "Flexibility. You shape the workspace to match your process instead of bending your process to fit the tool.",
          "A gentle start. A new hire can open a page and be useful in minutes.",
        ]),
        h2("Where ClickUp pulls ahead"),
        bullets([
          "Real project management. Dependencies, sprints, workloads, and goals are built in, not bolted on.",
          "Reporting. Managers get the dashboards and rollups they need without exporting anything.",
          "Structure out of the box. You adopt a system on day one rather than building one.",
        ]),
        quote("Pick the tool that matches how your team already thinks, not the one with the longer feature list."),
        h2("Decide it in an afternoon"),
        pt("Give both a real task from this week, not a demo. Move it through Notion, then through ClickUp, and notice which one felt like it was helping and which one felt like homework. Both have free plans that are more than enough to run that test before anyone pays."),
        pt("Once you have made the call, our full comparison lines the two up point by point so you can sanity check your choice."),
      ),
    },
    {
      title: "Jasper vs Copy.ai: which AI writer belongs in your stack",
      slug: "jasper-vs-copy-ai-which-belongs-in-your-stack",
      excerpt:
        "One is built for brand teams that guard a house style. The other gets you a usable draft faster and cheaper. Here is how to tell them apart.",
      categoryId: catBySlug.get("marketing")!.id,
      tags: ["jasper", "copy-ai", "ai-writing"],
      readingMinutes: 6,
      publishedAt: days(-2),
      relatedStores: ["jasper", "copy-ai"],
      content: doc(
        pt("Every marketing team eventually tries an AI writer, and most of them start by arguing about Jasper and Copy.ai. Both turn a short prompt into finished copy. What separates them is who they were built for, and once you see that, the choice gets a lot easier."),
        h2("Jasper is built for brand control"),
        pt("Jasper wants to protect a house style. You can train it on your brand voice, feed it a knowledge base, and hand it to a whole team without the output drifting all over the place. For a company that cares deeply about tone and consistency, that is worth paying for."),
        h2("Copy.ai is built for speed"),
        pt("Copy.ai gets you from a blank page to a usable draft faster than almost anything else, and it has a genuinely useful free plan. For a solo marketer or a small team that needs volume without ceremony, that head start matters more than fine grained brand controls."),
        h2("The honest trade"),
        bullets([
          "Long form and governance: Jasper is the safer bet.",
          "Short form, social, and first drafts at speed: Copy.ai is hard to beat.",
          "Budget and a strong free tier: Copy.ai wins on day one.",
          "A team policing one consistent voice: Jasper earns its price.",
        ]),
        quote("Buy the writer that fits your constraint. If the constraint is brand consistency, buy Jasper. If it is time and money, buy Copy.ai."),
        h2("How to test them fairly"),
        pt("Give both the same real brief, not a clever prompt designed to impress you. Judge the draft you would actually ship, then count how much editing each one needed. That number tells you more than any feature list."),
      ),
    },
    {
      title: "How we score every tool from 0 to 10",
      slug: "how-we-score-every-tool",
      excerpt:
        "A number is only useful if you trust how it was made. Here is exactly what goes into a DaddyPromoos score, and what never does.",
      categoryId: catBySlug.get("ai-tools")!.id,
      tags: ["methodology", "reviews", "trust"],
      readingMinutes: 5,
      publishedAt: days(-3),
      relatedStores: ["base44", "notion", "shopify"],
      content: doc(
        pt("A score is a promise. When we put a number next to a tool, we are telling you we did the work so you do not have to. That only means something if you know how the number was built, so here is the whole method with nothing hidden."),
        h2("We test the tool the way you would use it"),
        pt("We do not score from a feature sheet. We set up a real account, run a real project through it, and pay attention to the moments that actually decide whether you keep a tool or abandon it. The friction, the surprises, and the point where it either delivers or gets in the way."),
        h2("Five things go into the number"),
        bullets([
          "How well it does the core job it promises.",
          "How quickly a new user becomes productive.",
          "Whether the pricing is honest at real usage, not just the teaser tier.",
          "What you own, and how easily you can leave.",
          "How it holds up once the novelty wears off.",
        ]),
        h2("Three things never do"),
        bullets([
          "Whether the company pays us. Affiliate relationships never move a score.",
          "How loud the marketing is.",
          "How much we happen to like the founders.",
        ]),
        quote("If a score cannot survive us publishing the catch alongside the praise, it is not a score worth publishing."),
        h2("Why the verdict always states the catch"),
        pt("Every review names the reason you might walk away, not just the reasons to buy. A tool with an eight and a clearly stated weakness is more useful than a nine with nothing but applause. Honesty is the only thing that makes the number worth reading."),
        pt("When you see a score on this site, that is what stands behind it."),
      ),
    },
    {
      title: "How to read a SaaS pricing page without getting fooled",
      slug: "read-a-saas-pricing-page",
      excerpt:
        "Pricing pages are designed to make one plan look obvious. Here is how to see past the layout and find the number you will actually pay.",
      categoryId: catBySlug.get("saas")!.id,
      tags: ["saas", "pricing", "guide"],
      readingMinutes: 6,
      publishedAt: days(-6),
      relatedStores: ["notion", "zapier", "shopify"],
      content: doc(
        pt("A pricing page is a sales tool, not a price list. The layout, the labels, and the one plan glowing in the middle are all there to steer you. None of that is dishonest, but it does mean the sticker price and the price you end up paying are rarely the same number. Here is how to read one properly."),
        h2("Find the per seat trap first"),
        pt("The headline number is almost always per user, per month, billed annually. Multiply it by your real headcount and your real billing preference before you react to it. A friendly looking figure can quadruple the moment you add the team and choose monthly."),
        h2("Ignore the plan they want you to pick"),
        pt("The middle plan is designed to look like the sensible default. Sometimes it is. Often the tier below does everything you actually need, and the extra features on the popular plan are things you will never open. Start from what you need and work up, not down from what they highlight."),
        promoSlot(),
        h2("Read the limits, not the checkmarks"),
        bullets([
          "Look for caps on records, automations, storage, or calls that turn into upsells later.",
          "Check whether the feature you care about is unlimited or quietly metered.",
          "Find out what happens when you hit a limit, because that is the real price.",
        ]),
        h2("Always check for a current offer"),
        pt("Most vendors run new customer offers, extended trials, and annual discounts that never appear on the page you land on. Two minutes of checking before you commit routinely changes the first year cost by more than you would guess."),
        quote("The price on the page is the opening bid, not the final one."),
        h2("Then start on the right foot"),
        pt("We keep a running feed of current verified offers across the tools we cover, each one checked by a human. Look there before you subscribe to anything, especially before a renewal."),
      ),
    },
    {
      title: "Webflow vs Framer: which site builder should you learn",
      slug: "webflow-vs-framer-which-to-learn",
      excerpt:
        "One rewards the hours you put into it. The other gets you live by the weekend. Here is how to pick the site builder that fits your patience and your project.",
      categoryId: catBySlug.get("design")!.id,
      tags: ["webflow", "framer", "design"],
      readingMinutes: 6,
      publishedAt: days(-7),
      relatedStores: ["webflow", "framer"],
      content: doc(
        pt("Webflow and Framer both let a designer build and publish a real website without writing code, and both are genuinely good. The reason people agonise over the choice is that they reward completely different temperaments. One is a craft you learn. The other is a sprint you finish."),
        h2("Framer is the fast start"),
        pt("If your goal is a striking site live by the weekend, Framer is hard to beat. It feels like a design tool, the motion and layout work is a pleasure, and you spend your time designing rather than learning the machine. For a landing page or a portfolio, that speed is the whole point."),
        couponEmbed(framerOffer.id),
        h2("Webflow is the higher ceiling"),
        pt("Webflow asks more of you. It exposes the real box model, so the learning curve is steeper, but once it clicks you can build almost anything, and the CMS is deep enough to run a serious content site for years. The time you invest comes back to you as control."),
        h2("A simple way to choose"),
        bullets([
          "One striking page, soon: learn Framer.",
          "A content heavy site with a real CMS: learn Webflow.",
          "You will maintain this for years: Webflow rewards the investment.",
          "You want momentum this week: Framer keeps you moving.",
        ]),
        quote("Do not pick the tool with the higher ceiling if you only need one good room."),
        h2("The honest answer"),
        pt("Most people are happier learning Framer first and reaching for Webflow only when a project genuinely outgrows it. Our full comparison lays the two side by side if you want to check that instinct against the detail."),
      ),
    },
    {
      title: "Bubble vs Webflow: the no-code mistake that wastes months",
      slug: "bubble-vs-webflow-avoid-the-mistake",
      excerpt:
        "People lose months by picking the wrong one of these, because they look similar and do completely different jobs. Here is the clean split.",
      categoryId: catBySlug.get("no-code-app-builders")!.id,
      tags: ["bubble", "webflow", "no-code"],
      readingMinutes: 6,
      publishedAt: days(-8),
      relatedStores: ["bubble", "webflow"],
      content: doc(
        pt("The most expensive mistake in no-code is choosing between Bubble and Webflow without understanding that they are not really competitors. They look similar in a demo, and then one of them cannot do the thing you needed, and you have already sunk a month into it."),
        h2("Webflow builds sites"),
        pt("Webflow is for websites. Marketing pages, portfolios, blogs, and content driven experiences, all with beautiful visual control and a strong CMS. What it does not have is an application backend. There is no database of users doing things, no real logic, because that was never the job."),
        h2("Bubble builds apps"),
        pt("Bubble is for software. It gives you a database, user accounts, and workflows, so you can build a tool that people log into and use. In return you accept a steeper learning curve and a design ceiling that takes more effort to reach."),
        h2("Ask yourself one thing"),
        pt("Are you publishing content, or are you building something people log into and operate? If it is content, Webflow. If it is an application with accounts and logic, Bubble. Get that one question right and you save yourself the wasted month."),
        quote("Webflow is a website builder that looks like an app builder. Bubble is an app builder that looks like a website builder. Read the label carefully."),
        h2("And sometimes both"),
        pt("Plenty of teams run their marketing site in Webflow and their product in Bubble, which is a perfectly sensible split. Our comparison breaks down exactly where each one draws the line."),
      ),
    },
    {
      title: "QuickBooks vs Sage: which one your accountant actually wants",
      slug: "quickbooks-vs-sage-what-your-accountant-wants",
      excerpt:
        "For a UK small business this is rarely a right or wrong decision. It is a fit decision, and your accountant already has an opinion. Here is how to weigh it.",
      categoryId: catBySlug.get("accounting-finance")!.id,
      tags: ["quickbooks", "sage", "accounting", "uk"],
      readingMinutes: 6,
      publishedAt: days(-11),
      relatedStores: ["quickbooks", "sage-uk"],
      content: doc(
        pt("If you run a UK small business, both QuickBooks and Sage are safe, compliant choices, and neither one is a mistake. The reason the decision feels hard is that the real deciding factor is not on either feature list. It is who has to work with the numbers after you do."),
        h2("QuickBooks feels modern"),
        pt("QuickBooks has the more approachable interface and a large marketplace of integrations. If you value a clean experience and want your books to feel less like a chore, it makes a strong first impression and then keeps it."),
        h2("Sage is the accountant default"),
        pt("Sage is the tool a huge share of UK accountants already live in, and its integrated payroll is a genuine strength as you grow. The interface is more functional than delightful, but familiarity has real value when someone else has to review your accounts."),
        couponEmbed(sageOffer.id),
        h2("The question that settles it"),
        pt("Ask your accountant which one they would rather receive. If they already work in Sage all day, handing them Sage files removes friction from every conversation you will ever have about money. If you do not have an accountant yet, QuickBooks is the gentler place to start."),
        quote("The best accounting software is the one the person checking your books already knows by heart."),
        h2("Either way, start on an offer"),
        pt("Both vendors run new customer promotions almost constantly, and neither advertises them loudly. Check for a current one before you subscribe, because year one is where the discounts are largest."),
      ),
    },
    {
      title: "Grammarly is worth it, but not for the reason you think",
      slug: "grammarly-worth-it",
      excerpt:
        "Most people buy Grammarly to fix typos. The typo fixing is free. What you actually pay for is something quieter and more valuable.",
      categoryId: catBySlug.get("productivity")!.id,
      tags: ["grammarly", "writing", "review"],
      readingMinutes: 5,
      publishedAt: days(-13),
      relatedStores: ["grammarly", "jasper"],
      content: doc(
        pt("Grammarly has a reputation as a spell checker with a subscription, and if that were all it did, the free tier would be enough for almost everyone. The catch is that the free tier already handles the typos. What you pay for is a different thing entirely."),
        h2("The free tier is genuinely good"),
        pt("Spelling, basic grammar, and obvious punctuation slips are all caught without paying a penny. If your only worry is the occasional mistake in an email, you may never need more than the free plan, and we would rather tell you that than sell you an upgrade."),
        h2("What the paid plan actually buys"),
        bullets([
          "Tone. It flags when a message reads as colder or sharper than you meant, which is worth more than any comma fix.",
          "Clarity. It spots the tangled sentence you stopped being able to see after the third rewrite.",
          "Consistency. Across a team, it keeps the writing sounding like one company rather than ten different people.",
        ]),
        h2("Where it does not belong"),
        pt("Grammarly is a polisher, not a writer. It will not give you ideas or structure, and leaning on it to generate content is asking a proofreader to do an author's job. Pair it with a real drafting tool if that is what you need."),
        quote("Buy Grammarly for the tone check, not the typo check. The typos were always free."),
        h2("Verdict"),
        pt("For anyone who writes to other people for a living, the paid plan quietly earns its keep. For everyone else, the free tier is already most of the value."),
      ),
    },
    {
      title: "Zapier vs doing it by hand: when automation actually pays off",
      slug: "zapier-when-automation-pays-off",
      excerpt:
        "Automating a task feels productive, but some automations cost more time to build than they ever save. Here is how to tell the difference before you start.",
      categoryId: catBySlug.get("productivity")!.id,
      tags: ["zapier", "automation", "productivity"],
      readingMinutes: 6,
      publishedAt: days(-18),
      relatedStores: ["zapier", "notion"],
      content: doc(
        pt("Zapier is the plumbing that connects the tools in a modern stack, and it can save a small team hours every week. It can also swallow an afternoon building a workflow that saves you thirty seconds a month. The tool is excellent. The judgement about when to use it is the hard part."),
        h2("The math that matters"),
        pt("Before you build an automation, estimate two numbers. How long the task takes by hand each time, and how often it happens. A two minute task you do daily is worth automating. A ten minute task you do twice a year almost never is, no matter how satisfying it would feel to remove it."),
        h2("Good candidates"),
        bullets([
          "Anything that moves the same data between two tools on a schedule.",
          "Notifications that people currently forget to send.",
          "Repetitive copy and paste that gets error prone when a tired human does it.",
        ]),
        promoSlot(),
        h2("Bad candidates"),
        bullets([
          "Rare tasks that change shape every time you do them.",
          "Anything that needs real judgement somewhere in the middle.",
          "A process you have never even done by hand, because you do not understand it well enough to automate it yet.",
        ]),
        quote("Automate the boring thing you do every day, not the interesting thing you do once a year."),
        h2("Start small"),
        pt("Zapier's free tier is enough to prove the concept on one or two workflows. Budget for a paid plan only once the automations have earned it, which they will tell you clearly by how often they run."),
      ),
    },
    {
      title: "Shopify for your first store: a calm, honest starter guide",
      slug: "shopify-first-store-starter-guide",
      excerpt:
        "Opening a store is less about the platform and more about the boring decisions around it. Here is a level headed way to start on Shopify without overspending.",
      categoryId: catBySlug.get("e-commerce")!.id,
      tags: ["shopify", "ecommerce", "guide"],
      readingMinutes: 6,
      publishedAt: days(-20),
      relatedStores: ["shopify"],
      content: doc(
        pt("Shopify is the default answer for a first online store, and for good reason. It handles the parts that are genuinely hard, payments, checkout, and hosting, so you can spend your energy on the product and the customer. The trap is spending money on things you do not need yet."),
        h2("Start on the smallest plan that works"),
        pt("The basic plan is enough to launch and make real sales. You do not need the higher tiers until volume or reporting demands them, and you will know clearly when that day comes. Resist the urge to buy capacity you are only hoping to use."),
        couponEmbed(shopifyOffer.id),
        h2("Be careful with apps"),
        pt("The app store is Shopify's greatest strength and its quietest expense. Each app solves a real problem and adds a monthly fee, and a store can accumulate a second rent in add ons without anyone noticing. Install only what a current problem requires, and audit the list every quarter."),
        h2("The theme matters less than you think"),
        pt("A clean free theme with good product photos beats an expensive theme with weak ones every single time. Spend your first hours on photography and product descriptions, not on choosing between two layouts that customers will never consciously notice."),
        quote("Your first store does not need to be impressive. It needs to take payments and tell the truth about the product."),
        h2("Then check for an offer"),
        pt("Shopify runs a standing intro offer for new merchants, so there is rarely a reason to pay full price in the first months. Start there, keep the setup lean, and let real sales fund the upgrades."),
      ),
    },
    {
      title: "The free tier is a strategy, not a gift: how to use it well",
      slug: "how-to-use-free-tiers-well",
      excerpt:
        "Free plans exist to win you over, which is fine, as long as you use them on purpose. Here is how to get real value from a free tier without getting stuck.",
      categoryId: catBySlug.get("saas")!.id,
      tags: ["saas", "free-tier", "guide"],
      readingMinutes: 5,
      publishedAt: days(-25),
      relatedStores: ["notion", "canva", "bubble"],
      content: doc(
        pt("A generous free tier is not charity. It is the smartest marketing a software company can run, because a tool you already use is a tool you are likely to pay for. That is a fair deal, and you can play it well by being deliberate about why you are on the free plan in the first place."),
        h2("Use it to answer one question"),
        pt("The point of a free tier is to find out whether the tool fits the way you work, on your own real task, before any money changes hands. Give it a genuine job, not a toy example, and pay attention to whether it feels like help or friction."),
        h2("Know where the ceiling is"),
        bullets([
          "Find the limit that will eventually stop you, seats, records, or exports, and note it now.",
          "Decide in advance what would make the upgrade worth it, so the moment is a choice and not a surprise.",
          "Keep your data portable, so staying is a decision and never a trap.",
        ]),
        h2("Do not hoard free accounts"),
        pt("Running your real work across five free tiers to avoid one paid plan usually costs more in lost time than the subscription ever would. Free is a way to evaluate, not a permanent architecture."),
        quote("A free tier is a test drive. Enjoy it, learn from it, and know the price of the car before you fall in love."),
        h2("When to pay"),
        pt("Pay the moment the tool has clearly earned it and the free ceiling is slowing you down. That is the tool working as intended, and by then you will have proof it is worth the money."),
      ),
    },
    {
      title: "How to run a free trial so you actually learn something",
      slug: "how-to-run-a-free-trial",
      excerpt:
        "Most free trials get wasted on a quick look and a forgotten reminder. A little structure turns those two weeks into a real decision.",
      categoryId: catBySlug.get("saas")!.id,
      tags: ["saas", "trials", "guide"],
      readingMinutes: 5,
      publishedAt: days(-27),
      relatedStores: ["jasper", "canva"],
      content: doc(
        pt("A free trial is a short window to answer an expensive question, and most of us waste it. We sign up, poke around for ten minutes, get busy, and then either forget to cancel or forget to decide. A little structure changes the outcome completely."),
        h2("Decide what would make it a yes"),
        pt("Before you start, write down the one or two things the tool has to do well for you to pay. A trial without a question is just a tour. A trial with a clear test gives you an answer you can actually trust at the end of it."),
        h2("Front load the real work"),
        pt("Use the tool for something that genuinely matters in the first few days, while your attention is fresh, rather than saving the serious test for a week eleven you will never reach. Give it your real workload early, because that is the only honest test there is."),
        couponEmbed(canvaOffer.id),
        h2("Set the reminder before you set the password"),
        bullets([
          "Note the trial end date the moment you sign up.",
          "Add a reminder two days before, so a decision ends the trial and not a charge.",
          "Cancel first if you are unsure. You can always resubscribe with a clear head.",
        ]),
        quote("A trial is not about whether the tool is impressive. It is about whether it is impressive at your work."),
        h2("Then decide on purpose"),
        pt("At the end, look at your original question and answer it honestly. If it is a yes, start on the best annual or intro price you can find. If it is a no, you have lost nothing but a login."),
      ),
    },
    {
      title: "Monthly or annual: the billing question worth getting right",
      slug: "monthly-or-annual-billing",
      excerpt:
        "Annual billing is cheaper almost everywhere, which is exactly why it is offered. Here is how to take the discount without getting locked into the wrong tool.",
      categoryId: catBySlug.get("saas")!.id,
      tags: ["saas", "billing", "savings"],
      readingMinutes: 5,
      publishedAt: days(-32),
      relatedStores: ["notion", "zapier"],
      content: doc(
        pt("Almost every subscription is cheaper paid annually, often by fifteen or twenty percent. That discount is real money, and it is also a commitment device the vendor is happy to give you. The skill is taking the saving on tools you will keep and avoiding the lock in on tools you are still testing."),
        h2("The rule that works"),
        pt("Pay monthly until a tool has proven itself through at least one real renewal, then switch to annual. The first month or two is when you are most likely to abandon something, and that is exactly the wrong time to prepay for a year."),
        h2("When annual is an easy yes"),
        bullets([
          "The tool is load bearing and the whole team already relies on it.",
          "You have used it happily for months, not days.",
          "The annual saving is meaningful and the vendor is stable.",
        ]),
        h2("When to stay monthly"),
        bullets([
          "You are still working out whether it fits.",
          "Only one person is using it and that person might move on.",
          "The category is changing fast and a better tool may appear soon.",
        ]),
        quote("Take the annual discount on the tools you cannot imagine dropping. Stay monthly on the ones you are still auditioning."),
        h2("A small habit that pays"),
        pt("Put every annual renewal on a calendar a month ahead. That reminder is your chance to ask whether you still use the tool and whether a current offer beats your renewal price, and it routinely saves more than the discount did in the first place."),
      ),
    },
    {
      title: "AI writing tools in 2026: where they help and where they hurt",
      slug: "ai-writing-tools-help-and-hurt",
      excerpt:
        "AI writers are genuinely useful and genuinely overused. Knowing which tasks they lift and which they quietly ruin is the whole skill now.",
      categoryId: catBySlug.get("marketing")!.id,
      tags: ["ai-writing", "jasper", "copy-ai"],
      readingMinutes: 6,
      publishedAt: days(-40),
      relatedStores: ["jasper", "copy-ai", "grammarly"],
      content: doc(
        pt("AI writing tools have stopped being a novelty and become part of the furniture. Used well they remove the worst friction in writing, the blank page and the boring first draft. Used badly they produce fluent, forgettable text that a reader can smell from the first line. The difference is entirely in what you ask them to do."),
        h2("Where they clearly help"),
        bullets([
          "Beating the blank page. A rough first draft you can react to is faster than starting cold.",
          "Volume with a pattern. Product descriptions, variations, and short repetitive copy.",
          "Reworking your own words. Shortening, reordering, and adjusting the tone of text you already wrote.",
        ]),
        h2("Where they quietly hurt"),
        bullets([
          "Anything that needs a real point of view, because an average of the internet has none.",
          "Facts you do not check, since a confident wrong answer reads exactly like a right one.",
          "Your distinctive voice, which is the first thing to vanish when a machine smooths the edges.",
        ]),
        h2("The workflow that works"),
        pt("Let the tool draft, then make it yours. Cut the padding, add the specific detail only you know, and put back the opinion the model averaged away. The goal is writing that could only have come from you, with the tool doing the parts that were never the point."),
        quote("Use AI to remove the friction of writing, not the reason anyone reads it."),
        h2("Pick the right tool for the job"),
        pt("Jasper and Copy.ai lead for marketing copy, while a polisher like Grammarly is better for tightening what you already wrote. Our reviews and comparisons break down which one fits which task, so you spend on the tool that matches your work."),
      ),
    },
    {
      title: "Best AI app builders in 2026: Base44, Lovable, and the field",
      slug: "best-ai-app-builders-2026",
      excerpt:
        "We compare the leading AI app builders on output quality, ownership, and real monthly cost — and explain which kind of founder each one fits.",
      categoryId: catBySlug.get("ai-tools")!.id,
      tags: ["ai", "app-builders", "comparison"],
      readingMinutes: 9,
      publishedAt: days(-4),
      relatedStores: ["base44", "lovable", "bubble", "framer"],
      content: doc(
        pt("A year ago, AI app builders produced demos. Today they produce products. This guide compares the leading platforms on the questions that actually decide the choice: what you get from a prompt, what you own afterwards, and what it costs once you use it seriously."),
        h2("How we evaluate"),
        bullets([
          "Same lens for every platform: how far a plain-language spec gets you, and how much human work remains.",
          "Ownership and exit: what happens when you outgrow the platform or want the code.",
          "Cost structure at real usage, not the teaser price.",
        ]),
        h2("Base44: fastest to a real product"),
        pt("Base44's pitch is completeness: database, auth, and hosting are built in, so a prompt becomes a usable, hosted app with zero wiring. The platform stays managed — you don't take the stack with you — which is exactly the trade that makes it this fast. Our full review covers where that trade bites."),
        couponEmbed(base44Offer.id),
        h2("Lovable: the engineer's choice"),
        pt("Lovable writes real React and Supabase code you can sync to GitHub and own. Architecture decisions are ones a senior engineer would defend. Costs scale with how much you iterate, so the free tier is the right place to judge it on your own idea."),
        couponEmbed(lovableOffer.id),
        promoSlot(),
        h2("The rest of the field"),
        pt("Bubble remains the deepest visual builder with a decade-old ecosystem — slower to a first version, far more precise on complex logic. Framer wins for marketing sites where design fidelity is everything. Neither generates full applications from a prompt the way the top two do."),
        quote("Buy the tool that matches your exit plan: if you will eventually hire engineers, choose a builder that exports code."),
        h2("Verdict"),
        pt("Choose Base44 to validate an idea this week. Choose Lovable if the prototype must become the product your team owns. Both have free tiers — judge them on your own use case before paying."),
      ),
    },
    {
      title: "Base44 vs Lovable: which AI builder should you commit to?",
      slug: "base44-vs-lovable",
      excerpt:
        "Both promise a full-stack app from a prompt. We compare output, pricing structure, lock-in, and who each one is actually for.",
      categoryId: catBySlug.get("ai-tools")!.id,
      tags: ["base44", "lovable", "head-to-head"],
      readingMinutes: 7,
      publishedAt: days(-9),
      relatedStores: ["base44", "lovable"],
      content: doc(
        pt("This is the head-to-head our readers request most. Both platforms turn natural-language prompts into working software, both include auth and hosting, and both charge in the same band. The differences are philosophical — and they decide which one is right for you."),
        h2("Ownership and lock-in"),
        pt("Lovable's defining feature is the export: real React code and a Supabase backend you control, syncable to GitHub. Base44 keeps the stack managed, which is precisely why it's faster to a working app — there is simply less to configure. Decide how much that trade matters before you subscribe."),
        h2("Pricing structure"),
        pt("Both are usage-metered by credits, and both have free tiers that are genuinely enough to evaluate output quality on your own idea. Exact allowances change; check the official pricing pages linked from our reviews."),
        couponEmbed(base44Offer.id),
        couponEmbed(lovableOffer.id),
        h2("Bottom line"),
        pt("Non-technical founder shipping an internal tool or MVP: Base44. Product team that will grow into the codebase: Lovable. Both are the real thing — the wrong choice is the one that fights your exit plan."),
      ),
    },
    {
      title: "How to actually save on SaaS subscriptions in 2026",
      slug: "how-to-save-on-saas-subscriptions",
      excerpt:
        "Software budgets leak through unused seats, forgotten trials, and monthly billing. Here are the levers that reliably cut the bill.",
      categoryId: catBySlug.get("saas")!.id,
      tags: ["saas", "savings", "guide"],
      readingMinutes: 8,
      publishedAt: days(-15),
      relatedStores: ["notion", "zapier", "clickup", "shopify"],
      content: doc(
        pt("Software spend audits keep finding the same thing: a meaningful slice of the budget buys nothing. Unused seats, forgotten trials, monthly billing on tools you've run for years. Here is the playbook we use ourselves."),
        h2("1. Check for a current offer before checkout"),
        pt("Vendors run intro offers, free tiers, and annual discounts constantly — they just don't advertise them on the pricing page you land on. Two minutes of checking before a renewal routinely changes the price."),
        promoSlot(),
        h2("2. Switch to annual, but only after the trial"),
        pt("Annual billing is meaningfully cheaper almost everywhere. The mistake is committing before the team has actually adopted the tool. Run monthly for one renewal cycle, then switch."),
        h2("3. Negotiate at renewal, not at signup"),
        pt("Your leverage peaks when the vendor's churn forecast is on the line. A polite email asking for the new-customer rate works more often than you'd think."),
        h2("4. Audit seats quarterly"),
        bullets([
          "Export the member list from every tool with per-seat pricing.",
          "Cross-reference against your org chart.",
          "Downgrade anyone who hasn't logged in for 60 days.",
        ]),
        h2("5. Use the startup and education programs"),
        pt("Notion, ClickUp, Canva, and most infrastructure vendors run programs worth real money. If you raised recently, joined an accelerator, or work in education, you probably qualify for several."),
        quote("The cheapest subscription is the one you cancel; the second cheapest is the one you started on the right offer."),
        h2("Start here"),
        pt("We keep a feed of current verified offers across these categories, each checked by a human and stamped with its verification date. Check it before any renewal."),
      ),
    },
    {
      title: "Sage UK for small businesses: a practical guide",
      slug: "sage-uk-small-business-guide",
      excerpt:
        "Making Tax Digital made accounting software mandatory for most UK businesses. Here's how to set up Sage properly — and start on the right offer.",
      categoryId: catBySlug.get("accounting-finance")!.id,
      tags: ["sage", "accounting", "uk", "guide"],
      readingMinutes: 6,
      publishedAt: days(-22),
      relatedStores: ["sage-uk", "quickbooks"],
      content: doc(
        pt("If you run a VAT-registered business in the UK, digital record-keeping is no longer optional. Sage has been the default answer for British small businesses for decades, and its cloud products have caught up with that reputation."),
        h2("Which Sage product do you actually need?"),
        bullets([
          "Sage Accounting Start: sole traders and micro businesses that mostly invoice and reconcile.",
          "Sage Accounting Standard: VAT returns, CIS, and multi-user access — the sweet spot for most limited companies.",
          "Sage 50: established businesses with stock, departments, and an accountant who insists on it.",
        ]),
        h2("Setup in an afternoon"),
        pt("Connect your bank feed first — everything else flows from clean transaction data. Then import customers, set your VAT scheme, and let the MTD wizard register with HMRC."),
        couponEmbed(sageOffer.id),
        h2("What it costs, honestly"),
        pt("Sage's list pricing is mid-market, but the vendor runs new-customer promotions almost continuously — often extended free periods. Between the current offer and annual billing, year-one cost typically lands well under list. The official page always states the live terms."),
        h2("The QuickBooks question"),
        pt("QuickBooks is stronger for US-style reporting and has a slicker mobile app. Sage wins on UK payroll integration and accountant familiarity. If your accountant already works in Sage, stay in Sage."),
      ),
    },
    {
      title: "The no-code stack we'd build a startup on in 2026",
      slug: "no-code-startup-stack-2026",
      excerpt:
        "Website, product, automations, and back office — a complete startup stack with zero engineers, chosen tool by tool.",
      categoryId: catBySlug.get("no-code-app-builders")!.id,
      tags: ["no-code", "stack", "startup"],
      readingMinutes: 7,
      publishedAt: days(-29),
      relatedStores: ["webflow", "framer", "bubble", "zapier", "notion"],
      content: doc(
        pt("A two-person team can now ship what took a funded engineering org five years ago. This is the stack we would choose today and why — with free tiers to start on for every layer."),
        h2("Marketing site: Framer or Webflow"),
        pt("Framer gets you from design to published site fastest, with animation tooling that sells a product. Webflow wins when the site is content-heavy and the CMS does the heavy lifting."),
        couponEmbed(framerOffer.id),
        h2("The product itself: Bubble"),
        pt("For a real application with accounts and complex logic you control visually, Bubble's decade of maturity shows. The plugin ecosystem alone saves weeks."),
        h2("Glue: Zapier"),
        pt("Every no-code stack leaks data between tools; Zapier is the plumbing. The free tier proves the concept; budget for Professional once automations multiply."),
        promoSlot(),
        h2("Back office: Notion"),
        pt("Docs, CRM-lite, hiring pipeline, investor updates — one workspace, one subscription, free until your team grows."),
        h2("The honest total"),
        pt("Every layer above has a usable free tier, so the stack costs nothing to assemble and evaluate. Paid tiers land in the low hundreds monthly combined — a functioning software company for the price of a phone bill."),
      ),
    },
    {
      title: "Canva Pro is the best money a solo creator can spend — here's why",
      slug: "canva-pro-review-solo-creators",
      excerpt:
        "Our verdict on Canva Pro: where it replaces a designer, where it doesn't, and how to start on the free trial.",
      categoryId: catBySlug.get("design")!.id,
      tags: ["canva", "design", "review"],
      readingMinutes: 5,
      publishedAt: days(-35),
      relatedStores: ["canva", "grammarly"],
      content: doc(
        pt("Canva's free tier is good enough that paying can feel unnecessary — until you count the hours. For creators producing content weekly, Pro's automation features replace both a stock subscription and a queue of small design tasks."),
        h2("What Pro actually adds"),
        bullets([
          "Brand kits that keep fonts and colors consistent across everything you export.",
          "Background remover and Magic Resize — the two features that alone justify the price for most users.",
          "The full stock library, which quietly replaces a separate stock-photo subscription.",
        ]),
        h2("Where it falls short"),
        pt("Complex vector work and true print production still belong in professional tools. Canva's strength is speed at social and marketing formats, not precision."),
        couponEmbed(canvaOffer.id),
        h2("Verdict"),
        pt("For solo creators and small teams, Pro pays for itself quickly — and the standard free trial means you can verify that claim on your own workload before spending anything."),
      ),
    },
  ];

  return postSeed;
}

export function buildPromoSeed(
  deps: Omit<ContentOffers, "framerOffer">,
): NewPromo[] {
  const { base44Offer, lovableOffer, sageOffer, shopifyOffer, canvaOffer } =
    deps;

  // All off by default: an editorial site shouldn't interrupt readers with
  // popups or put one brand's banner on another brand's page. Switch a
  // placement on deliberately from /admin/promos.
  return [
    {
      name: "Sidebar: Base44 free plan",
      placement: "sidebar",
      type: "coupon-highlight",
      payload: { couponId: base44Offer.id },
      targetingRules: {},
      isActive: false,
      priority: 10,
    },
    {
      name: "Sticky rail: Shopify intro offer",
      placement: "sticky-rail",
      type: "coupon-highlight",
      payload: { couponId: shopifyOffer.id },
      targetingRules: { paths: ["/blog", "/tools"] },
      isActive: false,
      priority: 10,
    },
    {
      name: "In-content: Canva trial",
      placement: "in-content",
      type: "coupon-highlight",
      payload: { couponId: canvaOffer.id },
      targetingRules: {},
      isActive: false,
      priority: 10,
    },
    {
      name: "Timed popup: newsletter",
      placement: "popup-timed",
      type: "newsletter",
      payload: {
        title: "New reviews and build guides, every week",
        body: "One short email a week: new reviews, head-to-heads, and guides for building with AI. No noise, unsubscribe anytime.",
        ctaLabel: "Subscribe",
      },
      targetingRules: { delayMs: 14_000, frequencyCap: 1, frequencyDays: 7, excludePaths: ["/admin"] },
      isActive: false,
      priority: 5,
    },
    {
      name: "Exit intent: Lovable free tier",
      placement: "popup-exit",
      type: "coupon-highlight",
      payload: { couponId: lovableOffer.id },
      targetingRules: { frequencyCap: 1, frequencyDays: 3, excludePaths: ["/admin"] },
      isActive: false,
      priority: 5,
    },
    {
      name: "Home banner: Sage new-customer offer",
      placement: "home-banner",
      type: "coupon-highlight",
      payload: {
        couponId: sageOffer.id,
        title: "Sage Accounting's current new-customer offer",
        body: "UK small businesses: start the tax year on software HMRC actually likes.",
        ctaLabel: "See the offer",
      },
      targetingRules: { paths: ["/"] },
      isActive: false,
      priority: 10,
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  console.log("Wiping existing data...");
  await wipe();

  console.log("Seeding categories...");
  const catRows = await db.insert(categories).values(categorySeed).returning();
  const catBySlug = new Map(catRows.map((c) => [c.slug, c]));

  console.log("Seeding stores...");
  const storeRows = await db
    .insert(stores)
    .values(
      storeSeed.map((s) => ({
        name: s.name,
        slug: s.slug,
        tagline: s.tagline,
        description: s.description,
        websiteUrl: s.websiteUrl,
        // Placeholder until real partner URLs are added through admin.
        affiliateBaseUrl: s.websiteUrl,
        rating: s.rating,
        isFeatured: s.isFeatured ?? false,
        isActive: s.isActive ?? true,
        isFictional: s.isFictional ?? false,
        seoTitle: storeSeoTitle(s.name),
        seoDescription: storeSeoDescription(s.name, s.tagline),
        heroSummary: s.heroSummary ?? null,
        verdict: s.verdict ?? null,
        editorialScore: s.editorialScore ?? null,
        useItFor: s.useItFor ?? null,
        skipItIf: s.skipItIf ?? null,
        goodPoints: s.goodPoints ?? null,
        weakPoints: s.weakPoints ?? null,
        pricingSummary: s.pricingSummary ?? null,
        pricingUrl: s.pricingUrl ?? null,
        howToRedeem: s.howToRedeem ?? null,
        faq: s.faq ?? null,
        alternativeSlugs: s.alternativeSlugs ?? null,
        lastReviewedAt: s.editorialScore ? REVIEWED_AT : null,
        ratingBreakdown: reviewExtras[s.slug]?.ratingBreakdown ?? null,
        reviewBody: reviewExtras[s.slug]?.reviewBody ?? null,
        startingPriceLabel: reviewExtras[s.slug]?.startingPriceLabel ?? null,
        screenshots: null,
        // Pick up assets already fetched by `npm run assets:fetch`.
        logoUrl: diskAsset("logos", s.slug, LOGO_EXTS),
        coverImageUrl: diskAsset("covers", s.slug, COVER_EXTS),
      })),
    )
    .returning();
  const storeBySlug = new Map(storeRows.map((s) => [s.slug, s]));

  await db.insert(storeCategories).values(
    storeSeed.flatMap((s) =>
      s.cats.map((catSlug) => ({
        storeId: storeBySlug.get(s.slug)!.id,
        categoryId: catBySlug.get(catSlug)!.id,
      })),
    ),
  );

  console.log("Seeding coupons (honest offers + community codes)...");
  const couponRows = await db
    .insert(coupons)
    .values(
      couponSeed.map((c) => ({
        storeId: storeBySlug.get(c.store)!.id,
        title: c.title,
        code: c.code ?? null,
        type: c.type,
        sourceType: c.sourceType ?? "official",
        discountLabel: c.discountLabel,
        discountValue: null,
        terms: c.terms,
        destinationUrl: c.destinationUrl ?? null,
        startsAt: days(-30),
        expiresAt: c.expiresInDays !== undefined ? days(c.expiresInDays) : null,
        isVerified: c.isVerified ?? false,
        isExclusive: false,
        isActive: true,
        lastVerifiedAt: c.isVerified ? days(-2) : null,
        // Real numbers only: all usage counters start at zero.
        clickCount: 0,
        revealCount: 0,
        successReports: 0,
        worksCount: 0,
        failsCount: 0,
        sortWeight: c.sortWeight ?? 0,
      })),
    )
    .returning();

  const couponByTitle = new Map(couponRows.map((c) => [c.title, c]));
  const pick = (title: string) => {
    const c = couponByTitle.get(title);
    if (!c) throw new Error(`Seed coupon not found: ${title}`);
    return c;
  };

  const base44Offer = pick("Free plan — build and publish without a card");
  const lovableOffer = pick("Free plan — 5 build credits a day");
  const sageOffer = pick("Current new-customer offer on Sage Accounting");
  const shopifyOffer = pick("Shopify's standing new-merchant intro offer");
  const canvaOffer = pick("Canva Pro free trial for new users");
  const framerOffer = pick("Publish free on a framer.website subdomain");

  console.log("Seeding authors + posts...");
  const authorRows = await db
    .insert(authors)
    .values([
      {
        name: "Abdul Rehman Ch",
        bio: "Founder and CEO of DaddyPromoos. Abdul writes on how we test tools and why every verdict names the catch, not just the praise.",
        role: "Founder & CEO",
      },
      {
        name: "Maya Whitfield",
        bio: "Senior Editor at DaddyPromoos. Maya has covered SaaS pricing, AI tooling, and the business of software for eight years.",
        role: "Senior Editor",
      },
      {
        name: "Haw",
        bio: "Editor at DaddyPromoos. Haw covers no-code, productivity, and the everyday tools small teams actually run on.",
        role: "Editor",
      },
    ])
    .returning();
  const [abdul] = authorRows;
  // The methodology/trust piece is bylined to the founder; everything else
  // rotates across the editorial team so posts read as a real newsroom.
  const authorIdForPost = (slug: string, i: number): string =>
    slug === "how-we-score-every-tool"
      ? abdul.id
      : authorRows[i % authorRows.length].id;

  const postSeed = buildPostSeed({
    catBySlug,
    base44Offer,
    lovableOffer,
    sageOffer,
    shopifyOffer,
    canvaOffer,
    framerOffer,
  });

  // Guard: every post must resolve to an author row that actually exists.
  // Here the authors were just inserted, so this fires only if that insert
  // changes shape; scripts/restore-content.ts runs the same check against
  // rows already in the database, where a missing byline is a real risk.
  const seedAuthorIds = new Set(authorRows.map((a) => a.id));
  for (const [i, post] of postSeed.entries()) {
    const resolved = authorIdForPost(post.slug, i);
    if (!resolved || !seedAuthorIds.has(resolved)) {
      throw new Error(
        `No author row for post "${post.slug}" (resolved: ${resolved ?? "undefined"})`,
      );
    }
  }

  const postRows = await db
    .insert(posts)
    .values(
      postSeed.map((post, i) => ({
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
      })),
    )
    .returning();

  const postBySlug = new Map(postRows.map((p) => [p.slug, p]));
  await db.insert(postStores).values(
    postSeed.flatMap((post) =>
      post.relatedStores.map((slug) => ({
        postId: postBySlug.get(post.slug)!.id,
        storeId: storeBySlug.get(slug)!.id,
      })),
    ),
  );

  console.log("Seeding promos...");
  await db.insert(promos).values(
    buildPromoSeed({
      base44Offer,
      lovableOffer,
      sageOffer,
      shopifyOffer,
      canvaOffer,
    }),
  );

  console.log("Seeding comparisons...");
  const comparisonRows = await db
    .insert(comparisons)
    .values(
      comparisonSeed.map((c) => ({
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
      })),
    )
    .returning();

  console.log("Seeding settings + admin user...");
  await db.insert(settings).values({
    id: "singleton",
    editorPicks: [
      { slug: "lovable", label: "Best overall AI app builder" },
      { slug: "cursor", label: "Best AI IDE" },
      { slug: "notion", label: "Best value" },
    ],
  });

  const adminEmail = (
    process.env.ADMIN_EMAIL ?? "admin@daddypromoos.local"
  ).toLowerCase();
  const adminPassword =
    process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
  await db.insert(adminUsers).values({
    email: adminEmail,
    passwordHash: hashPassword(adminPassword),
    name: "DaddyPromoos Admin",
    role: "admin",
  });

  console.log("");
  console.log("Seed complete.");
  console.log(`  Stores:   ${storeRows.length}`);
  console.log(`  Coupons:  ${couponRows.length}`);
  console.log(`  Compare:  ${comparisonRows.length} (${comparisonRows.filter((c) => c.isFeatured).length} featured)`);
  console.log(`  Posts:    ${postRows.length}`);
  console.log("");
  console.log("Admin login (also set ADMIN_EMAIL / ADMIN_PASSWORD in .env.local):");
  console.log(`  email:    ${adminEmail}`);
  console.log(`  password: ${adminPassword}`);
  console.log("");
}

// Only wipe-and-seed when this file is run directly. Importing it (as
// scripts/restore-content.ts does, to reuse the content arrays) must never
// trigger the destructive main().
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
