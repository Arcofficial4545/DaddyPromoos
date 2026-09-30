import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { PageHeader } from "@/components/marketing/PageHeader";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { listPublishedComparisons } from "@/lib/db/repositories/comparisons";
import { listPublishedPostsBySlugs } from "@/lib/db/repositories/posts";
import { getStoresBySlugs } from "@/lib/db/repositories/stores";
import { TOP_BUILDERS } from "@/lib/picks";
import { breadcrumbLd, ogImageUrl } from "@/lib/seo/jsonld";
import { cn } from "@/lib/utils";

/**
 * Rendered on demand, with the DB reads in a `"use cache"` function — the
 * same pattern as the homepage, so building the site never waits on the
 * Supabase pooler for this route.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Build Your First App With AI: A Founder's Guide",
  description:
    "Which AI app builder fits your idea, what the credits really cost, and how to get a first version live — an independent guide for founders who don't write code.",
  alternates: { canonical: "/build-with-ai" },
  openGraph: {
    title: "Build Your First App With AI | DaddyPromoos",
    images: [ogImageUrl("Build your first app with AI", "A founder's guide")],
  },
};

const GUIDE_SLUGS = {
  chooser: "app-builder-or-ai-ide-which-to-use",
  roundup: "ai-app-builders-ranked-2026",
  lovablePricing: "lovable-pricing-and-credits-explained",
  firstApp: "shipping-your-first-app-with-lovable",
} as const;

/** Head-to-heads linked from step 2, in this order (unpublished ones drop). */
const BUILDER_COMPARISON_SLUGS = [
  "base44-vs-lovable",
  "lovable-vs-bolt-new",
  "lovable-vs-v0",
  "bubble-vs-webflow",
];
const IDE_COMPARISON_SLUG = "lovable-vs-cursor";

const GUIDE_UPDATED = "30 September 2026";

/**
 * Plan facts for step 3, each checked against the vendor's official pricing
 * page on the date given. Change a date and its facts together — never one
 * without the other. Plan facts only: no discount or sale wording.
 */
const PLAN_FACTS: Record<string, { checked: string; facts: string[] }> = {
  lovable: {
    checked: "24 September 2026",
    facts: [
      "Free plan: 5 build credits a day, up to 30 a month, plus 20 Cloud credits a month for hosting and backend features.",
      "Paid plans add a monthly credit balance on top of the same daily and monthly grants.",
      "Daily build credits don't roll over; monthly plan credits expire two months after they're issued.",
    ],
  },
  base44: {
    checked: "29 September 2026",
    facts: [
      "Free plan: 25 message credits and 100 integration credits a month, up to 5 apps, with sign-in and a database included.",
      "Paid plans (Starter, Builder, Pro, Elite) raise both monthly allowances; in-app code edits start on Starter.",
      "Two-way GitHub sync starts on the Builder plan.",
    ],
  },
};

type GuideLink = { title: string; href: string };

async function getGuideData() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86_400 });

  const [stores, posts, comparisons] = await Promise.all([
    getStoresBySlugs(TOP_BUILDERS.map((b) => b.slug)),
    listPublishedPostsBySlugs(Object.values(GUIDE_SLUGS)),
    listPublishedComparisons(),
  ]);

  // The same ranking and labels as the homepage; a builder without a
  // published score and verdict drops out rather than showing half a card.
  const builders = TOP_BUILDERS.flatMap(({ slug, label }) => {
    const s = stores.find((row) => row.slug === slug);
    if (!s || s.editorialScore === null || !s.verdict) return [];
    return [
      {
        name: s.name,
        slug: s.slug,
        logoUrl: s.logoUrl,
        themeColor: s.themeColor,
        label,
        score: s.editorialScore,
        verdict: s.verdict,
        bestFor: s.useItFor,
        skipItIf: s.skipItIf,
        // The store's affiliate URL, exactly as stored, else its website.
        goHref: s.affiliateBaseUrl || s.websiteUrl,
        // A citation of the official pricing page, not an affiliate link.
        pricingHref: s.pricingUrl || s.websiteUrl,
      },
    ];
  });
  if (builders.length === 0) return null;

  const post = (slug: string): GuideLink | null => {
    const p = posts.find((row) => row.slug === slug);
    return p ? { title: p.title, href: `/blog/${p.slug}` } : null;
  };
  const comparison = (slug: string): GuideLink | null => {
    const c = comparisons.find((row) => row.slug === slug);
    return c ? { title: c.title, href: `/compare/${c.slug}` } : null;
  };

  return {
    builders,
    guides: {
      chooser: post(GUIDE_SLUGS.chooser),
      roundup: post(GUIDE_SLUGS.roundup),
      lovablePricing: post(GUIDE_SLUGS.lovablePricing),
      firstApp: post(GUIDE_SLUGS.firstApp),
    },
    ideComparison: comparison(IDE_COMPARISON_SLUG),
    base44Comparison: comparison("base44-vs-lovable"),
    builderComparisons: BUILDER_COMPARISON_SLUGS.map(comparison),
  };
}

type GuideBuilder = NonNullable<
  Awaited<ReturnType<typeof getGuideData>>
>["builders"][number];

export default async function BuildWithAiPage() {
  const data = await getGuideData();
  if (!data) notFound();
  const { builders, guides, ideComparison, base44Comparison, builderComparisons } =
    data;

  const lovable = builders.find((b) => b.slug === "lovable");
  const base44 = builders.find((b) => b.slug === "base44");
  const priced = builders.filter((b) => PLAN_FACTS[b.slug]);

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", href: "/" },
          { name: "Build with AI", href: "/build-with-ai" },
        ])}
      />

      <PageHeader
        meta={
          <p className="mb-3 font-mono text-xs font-semibold tracking-[0.2em] text-mint/70 uppercase">
            Build with AI · Founder&apos;s guide
          </p>
        }
        title="Build your first app with AI"
        description="Which AI app builder fits your idea, what it really costs, and how to get a first version live — written for founders who don't write code, and honest about the catch."
      >
        <p className="mt-5 font-mono text-xs text-mint/60">
          Updated {GUIDE_UPDATED} · Plan details checked against each
          builder&apos;s official pricing page
        </p>
      </PageHeader>

      <Section>
        <Container className="max-w-3xl space-y-14">
          <p className="text-body-lg leading-relaxed text-ink-muted">
            You no longer need to write code to put a first version of your
            product in front of real users. You do need to pick the right AI
            builder, understand how it charges, and work in the right order.
            This guide covers all three, in four steps.
          </p>

          {/* ------------------------------------------------------- 1 */}
          <Step n={1} title="Decide what kind of tool you need">
            <p>
              AI tools for building software split into two groups.{" "}
              <strong className="text-ink">App builders</strong> — Lovable,
              Base44, Bolt.new, v0 — turn a plain-language description into a
              working app, with the backend and hosting handled for you.{" "}
              <strong className="text-ink">AI coding tools</strong> — Cursor,
              GitHub Copilot, and the coding agents — make someone who already
              writes code faster inside a codebase they own.
            </p>
            <p>
              If you don&apos;t write code, you want an app builder. If you do,
              you&apos;ll probably use both: a builder to reach a first version
              fast, and a coding tool once the product needs a developer&apos;s
              hands.
            </p>
            <ReadNext links={[guides.chooser, ideComparison]} />
          </Step>

          {/* ------------------------------------------------------- 2 */}
          <Step n={2} title="Pick the builder that fits your idea">
            <p>
              Every builder here turns a description into a working app. They
              differ in who ends up owning the code, how much is managed for
              you, and how they charge. Ranked by our review scores:
            </p>

            <ol className="space-y-4">
              {builders.map((b, i) => (
                <BuilderCard key={b.slug} builder={b} rank={i + 1} />
              ))}
            </ol>

            {lovable && base44 && (
              <div className="rounded-[var(--radius-card)] border border-line bg-mint p-6">
                <h3 className="font-display text-lg font-semibold text-ink">
                  {lovable.name} or {base44.name}?
                </h3>
                <p className="mt-2">
                  Pick <strong className="text-ink">{lovable.name}</strong>{" "}
                  if you want a working app now and your code in GitHub on any
                  plan — the right default for most people who don&apos;t
                  code.
                </p>
                <p className="mt-2">
                  Pick <strong className="text-ink">{base44.name}</strong>{" "}
                  if you&apos;d rather have the database, sign-in, email, and
                  hosting managed in one place, and GitHub sync from its Builder
                  plan up is fine.
                </p>
                <div className="mt-3">
                  <ReadNext links={[base44Comparison]} />
                </div>
              </div>
            )}

            <p>
              Weighing two others? Our head-to-heads cover code ownership,
              backend, pricing, and who each tool suits:
            </p>
            <ReadNext
              links={[
                ...builderComparisons.filter(
                  (c) => c?.href !== base44Comparison?.href,
                ),
                guides.roundup,
              ]}
            />
          </Step>

          {/* ------------------------------------------------------- 3 */}
          <Step n={3} title="Understand the credits before you pay">
            <p>
              Most AI builders charge in credits: each change you ask for
              spends some, so your bill follows how much you iterate — not how
              much you ship.
              {priced.length > 0 &&
                ` Here is what the ${priced.map((b) => b.name).join(" and ")} plans include, as of our last check:`}
            </p>

            {priced.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {priced.map((b) => {
                  const plan = PLAN_FACTS[b.slug];
                  return (
                    plan && (
                      <PlanFacts
                        key={b.slug}
                        builder={b}
                        checked={plan.checked}
                        facts={plan.facts}
                      />
                    )
                  );
                })}
              </div>
            )}

            <p>
              Plans change — confirm the current details on the official
              pricing page before you pay. The practical move: spend a few days
              of free credits building one real flow from your own idea, and
              watch what each change costs before you choose a plan.
            </p>
            <ReadNext links={[guides.lovablePricing]} />
          </Step>

          {/* ------------------------------------------------------- 4 */}
          <Step n={4} title="Build and ship a first version">
            <p>
              Founders who get stuck rarely hit a limit of the tool — they work
              in the wrong order. Keep it small, and keep it in sequence:
            </p>
            <ol className="list-decimal space-y-2.5 pl-5 marker:font-mono marker:text-emerald-600">
              <li>
                Write down, in one sentence, the job your app does and who it is
                for. Describe that — not a single screen.
              </li>
              <li>
                Get that one flow working end to end — the booking, the signup,
                the checkout — before any polish.
              </li>
              <li>
                Get your code into GitHub as early as your builder allows, so it
                lives somewhere you control.
              </li>
              <li>
                When sign-in and real data arrive, slow down. Have someone who
                reads code check the authentication and database access rules
                before real users sign up.
              </li>
              <li>
                Launch earlier than feels comfortable, to a handful of real
                users, and change one thing at a time.
              </li>
            </ol>
            <ReadNext links={[guides.firstApp]} />
          </Step>
        </Container>
      </Section>

      {/* ------------------------------------------------ Closing call */}
      <Section tone="pine" padding="tight">
        <Container className="flex flex-col items-center text-center">
          <h2 className="max-w-xl font-display text-3xl font-bold text-white">
            Ready to build your first version?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-mint/85">
            Pick the builder that fits, start on its free plan, and build one
            real flow from your own idea before you pay for anything.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            {builders.slice(0, 2).map((b, i) => (
              <a
                key={b.slug}
                href={b.goHref}
                target="_blank"
                rel="sponsored nofollow noopener"
                className={cn(
                  "btn-gloss press-down inline-flex h-12 items-center gap-2 rounded-[var(--radius-btn)] px-6 text-sm font-semibold",
                  i === 0 ? "btn-primary" : "btn-glass-dark",
                )}
              >
                Try {b.name}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ))}
          </div>
          <Link
            href="/compare"
            className="mt-5 text-sm font-semibold text-mint/85 underline-offset-4 hover:text-white hover:underline"
          >
            Or compare them side by side
          </Link>
          <p className="mt-6 max-w-lg text-xs leading-relaxed text-mint/50">
            DaddyPromoos is an independent publisher. Product names and marks
            belong to their respective owners.
          </p>
        </Container>
      </Section>
    </>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`step-${n}`} className="scroll-mt-28">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-sm font-bold text-emerald-600">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-4 leading-relaxed text-ink-muted">
        {children}
      </div>
    </section>
  );
}

/** One ranked builder: score, verdict, who it suits, when to skip it. */
function BuilderCard({ builder: b, rank }: { builder: GuideBuilder; rank: number }) {
  const top = rank === 1;
  return (
    <li
      className={cn(
        "rounded-[var(--radius-card)] border bg-white p-5 text-ink-muted shadow-xs sm:p-6",
        top ? "border-emerald ring-1 ring-emerald/40" : "border-line",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 font-mono text-sm font-bold text-ink-subtle">
          #{rank}
        </span>
        <StoreLogo
          name={b.name}
          logoUrl={b.logoUrl}
          themeColor={b.themeColor}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-display text-lg font-semibold text-ink">
            {b.name}
            {top && (
              <span className="rounded-full bg-emerald px-2 py-0.5 font-mono text-[0.6rem] font-bold tracking-[0.15em] text-pine-900 uppercase">
                Top pick
              </span>
            )}
          </p>
          <p className="font-mono text-xs text-emerald-600">{b.label}</p>
        </div>
        <span className="shrink-0 font-mono text-2xl font-bold text-pine">
          {b.score.toFixed(1)}
          <span className="text-xs font-normal text-ink-subtle">/10</span>
        </span>
      </div>

      <p className="mt-4 leading-relaxed text-ink">{b.verdict}</p>

      {(b.bestFor || b.skipItIf) && (
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          {b.bestFor && (
            <div>
              <dt className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                Best for
              </dt>
              <dd className="mt-1 leading-relaxed">{b.bestFor}</dd>
            </div>
          )}
          {b.skipItIf && (
            <div>
              <dt className="font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                Skip it if
              </dt>
              <dd className="mt-1 leading-relaxed">{b.skipItIf}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={b.goHref}
          target="_blank"
          rel="sponsored nofollow noopener"
          className={cn(
            "btn-gloss press-down inline-flex h-10 items-center gap-2 rounded-[var(--radius-btn)] px-4 text-sm font-semibold",
            top ? "btn-primary" : "btn-pine",
          )}
        >
          Try {b.name}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <Link
          href={`/tools/${b.slug}`}
          className="btn-gloss btn-secondary press-down inline-flex h-10 items-center gap-2 rounded-[var(--radius-btn)] px-4 text-sm font-semibold"
        >
          Read the review
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

/** A builder's plan facts, with the date they were checked and the source. */
function PlanFacts({
  builder: b,
  checked,
  facts,
}: {
  builder: GuideBuilder;
  checked: string;
  facts: string[];
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5">
      <div className="flex items-center gap-2.5">
        <StoreLogo
          name={b.name}
          logoUrl={b.logoUrl}
          themeColor={b.themeColor}
          size="sm"
        />
        <p className="font-display font-semibold text-ink">{b.name}</p>
      </div>
      <ul className="mt-4 flex-1 space-y-2.5 text-sm">
        {facts.map((fact) => (
          <li key={fact} className="flex gap-2.5">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
            <span>{fact}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-subtle">
        Checked {checked} on{" "}
        <a
          href={b.pricingHref}
          target="_blank"
          rel="nofollow noopener"
          className="font-medium text-pine underline decoration-emerald underline-offset-4 hover:text-emerald-600"
        >
          {b.name}&apos;s pricing page
        </a>
      </p>
    </div>
  );
}

/** "Read next" links; missing guides (null) are skipped. */
function ReadNext({ links }: { links: (GuideLink | null)[] }) {
  const items = links.filter((l): l is GuideLink => l !== null);
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="group inline-flex items-center gap-1.5 text-sm font-semibold text-pine hover:text-emerald-600"
          >
            {link.title}
            <ArrowRight
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
