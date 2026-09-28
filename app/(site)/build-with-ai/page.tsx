import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cacheLife } from "next/cache";
import { ArrowRight, Check, ExternalLink, Minus } from "lucide-react";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import { DisclosureLine } from "@/components/marketing/DisclosureLine";
import { PageHeader } from "@/components/marketing/PageHeader";
import { CtaBand } from "@/components/marketing/company/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { listPublishedComparisonsForStore } from "@/lib/db/repositories/comparisons";
import { listCouponsForStore } from "@/lib/db/repositories/coupons";
import { listPublishedPostsBySlugs } from "@/lib/db/repositories/posts";
import {
  getStoreBySlug,
  getStoresBySlugs,
} from "@/lib/db/repositories/stores";
import { breadcrumbLd, ogImageUrl } from "@/lib/seo/jsonld";

/**
 * Rendered on demand, with the DB reads in a `"use cache"` function — the
 * same pattern as the homepage, so building the site never waits on the
 * Supabase pooler for this route.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Build Your First App With AI: A Founder's Guide",
  description:
    "Which AI app builder to start with, what the credits really cost, and how to get a first version live — an independent guide for founders who don't write code.",
  alternates: { canonical: "/build-with-ai" },
  openGraph: {
    title: "Build Your First App With AI | DaddyPromoos",
    images: [ogImageUrl("Build your first app with AI", "A founder's guide")],
  },
};

const PICK_SLUG = "lovable";
const ALTERNATIVE_SLUGS = ["bolt-new", "v0", "base44", "replit"];
const GUIDE_SLUGS = {
  chooser: "app-builder-or-ai-ide-which-to-use",
  pricing: "lovable-pricing-and-credits-explained",
  firstApp: "shipping-your-first-app-with-lovable",
  roundup: "ai-app-builders-ranked-2026",
} as const;

/** When the plan facts in step 3 were last checked against lovable.dev/pricing.
 * Change this date and those facts together — never one without the other. */
const PRICING_CHECKED = "24 September 2026";

type GuideLink = { title: string; href: string };

async function getGuideData() {
  "use cache";
  cacheLife({ stale: 60, revalidate: 3600, expire: 86_400 });

  const pick = await getStoreBySlug(PICK_SLUG);
  if (!pick) return null;

  const [alternatives, posts, comparisons, { active }] = await Promise.all([
    getStoresBySlugs(ALTERNATIVE_SLUGS),
    listPublishedPostsBySlugs(Object.values(GUIDE_SLUGS)),
    listPublishedComparisonsForStore(pick.id),
    listCouponsForStore(pick.id),
  ]);

  const post = (slug: string): GuideLink | null => {
    const p = posts.find((row) => row.slug === slug);
    return p ? { title: p.title, href: `/blog/${p.slug}` } : null;
  };
  const comparisonWith = (slug: string): GuideLink | null => {
    const c = comparisons.find(
      (row) => row.storeA.slug === slug || row.storeB.slug === slug,
    );
    return c ? { title: c.title, href: `/compare/${c.slug}` } : null;
  };

  // The lead offer is the free plan; the pricing link prefers the offer that
  // lands on the official pricing page.
  const lead = active[0] ?? null;
  const pricingOffer =
    active.find((c) => c.destinationUrl?.includes("/pricing")) ?? lead;
  const fallbackUrl = pick.affiliateBaseUrl ?? pick.websiteUrl;

  return {
    pick: {
      name: pick.name,
      slug: pick.slug,
      logoUrl: pick.logoUrl,
      themeColor: pick.themeColor,
      score: pick.editorialScore,
      verdict: pick.verdict,
      weakPoints: pick.weakPoints ?? [],
      skipItIf: pick.skipItIf,
      goHref: lead ? `/go/${lead.id}` : fallbackUrl,
      pricingHref: pricingOffer ? `/go/${pricingOffer.id}` : fallbackUrl,
    },
    guides: {
      chooser: post(GUIDE_SLUGS.chooser),
      pricing: post(GUIDE_SLUGS.pricing),
      firstApp: post(GUIDE_SLUGS.firstApp),
      roundup: post(GUIDE_SLUGS.roundup),
    },
    ideComparison: comparisonWith("cursor"),
    builderComparisons: comparisons
      .filter((c) => c.storeA.slug !== "cursor" && c.storeB.slug !== "cursor")
      .map((c) => ({ title: c.title, href: `/compare/${c.slug}` })),
    alternatives: alternatives
      .filter((a) => a.editorialScore !== null && a.verdict)
      .map((a) => ({
        name: a.name,
        slug: a.slug,
        logoUrl: a.logoUrl,
        themeColor: a.themeColor,
        score: a.editorialScore,
        verdict: a.verdict,
        comparison: comparisonWith(a.slug),
      })),
  };
}

export default async function BuildWithAiPage() {
  const data = await getGuideData();
  if (!data) notFound();
  const { pick, guides, ideComparison, builderComparisons, alternatives } =
    data;

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
        description="Which AI app builder to start with, what it really costs, and how to get a first version live — written for founders who don't write code, and honest about the catch."
      >
        <p className="mt-5 font-mono text-xs text-mint/60">
          Updated {PRICING_CHECKED} · {pick.name} pricing checked against its
          official pricing page
        </p>
      </PageHeader>

      <Section>
        <Container className="max-w-3xl space-y-14">
          <div className="space-y-4">
            <DisclosureLine />
            <p className="text-body-lg leading-relaxed text-ink-muted">
              You no longer need to write code to put a first version of your
              product in front of real users. You do need to pick the right AI
              builder, understand how it charges, and work in the right order.
              This guide covers all three, in four steps.
            </p>
          </div>

          {/* ------------------------------------------------------- 1 */}
          <Step n={1} title="Decide what kind of tool you need">
            <p>
              AI tools for building software split into two groups.{" "}
              <strong className="text-ink">App builders</strong> — Lovable,
              Bolt.new, v0, Base44 — turn a plain-language description into a
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
          <Step n={2} title={`Pick your builder — our pick is ${pick.name}`}>
            <p>
              For a founder without a development background, {pick.name} does
              the most of the job: you describe the app, and it writes a React
              front end and a Supabase backend, wires up sign-in and data, and
              deploys it. The code is standard enough that a developer you hire
              later can take it over instead of starting again. Useful today,
              not a dead end tomorrow — that is why it&apos;s our top pick.
            </p>

            <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 text-ink-muted shadow-sm">
              <div className="flex items-center gap-3">
                <StoreLogo
                  name={pick.name}
                  logoUrl={pick.logoUrl}
                  themeColor={pick.themeColor}
                  size="md"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold text-ink">
                    {pick.name}
                  </p>
                  <p className="font-mono text-xs text-ink-subtle">
                    Our top pick for non-developers
                  </p>
                </div>
                {pick.score !== null && (
                  <span className="font-mono text-2xl font-bold text-pine">
                    {pick.score.toFixed(1)}
                    <span className="text-xs font-normal text-ink-subtle">
                      /10
                    </span>
                  </span>
                )}
              </div>

              {pick.verdict && (
                <p className="mt-4 leading-relaxed text-ink">{pick.verdict}</p>
              )}

              {pick.weakPoints.length > 0 && (
                <>
                  <p className="mt-5 font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                    The catch
                  </p>
                  <ul className="mt-2 space-y-2">
                    {pick.weakPoints.map((point) => (
                      <li key={point} className="flex gap-2.5 text-sm leading-relaxed">
                        <Minus
                          className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle"
                          aria-hidden="true"
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {pick.skipItIf && (
                <>
                  <p className="mt-5 font-mono text-[0.7rem] font-semibold tracking-[0.15em] text-ink-subtle uppercase">
                    Skip it if
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed">
                    {pick.skipItIf}
                  </p>
                </>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={pick.goHref}
                  target="_blank"
                  rel="sponsored noopener"
                  className="btn-gloss btn-primary press-down inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-5 text-sm font-semibold"
                >
                  Try {pick.name} free
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link
                  href={`/tools/${pick.slug}`}
                  className="btn-gloss btn-secondary press-down inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius-btn)] px-5 text-sm font-semibold"
                >
                  Read the full review
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <DisclosureLine className="mt-3 text-xs" />
            </div>

            {builderComparisons.length > 0 && (
              <>
                <p>
                  Weighing it against another builder? Our head-to-heads cover
                  code ownership, backend, pricing, and who each tool suits:
                </p>
                <ReadNext links={builderComparisons} />
              </>
            )}
          </Step>

          {/* ------------------------------------------------------- 3 */}
          <Step n={3} title="Understand the credits before you pay">
            <p>
              {pick.name} charges in credits. Most changes you ask for cost
              credits based on how complex they are, so your bill follows how
              much you iterate — not how much you ship. As of our last check:
            </p>
            <ul className="space-y-2.5">
              {[
                "Free plan: 5 build credits a day, up to 30 a month, plus 20 Cloud credits a month for hosting and backend features.",
                "Paid plans: a monthly credit balance on top of the same daily and monthly grants.",
                "Expiry: daily build credits don't roll over; monthly plan credits expire two months after they're issued; top-up credits last 12 months.",
                "Students: a student discount is available with a valid student email.",
              ].map((fact) => (
                <li key={fact} className="flex gap-2.5">
                  <Check
                    className="mt-1 h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-ink-subtle">
              Checked on {PRICING_CHECKED}. Plans change — confirm the current
              details on{" "}
              <a
                href={pick.pricingHref}
                target="_blank"
                rel="sponsored noopener"
                className="font-medium text-pine underline decoration-emerald underline-offset-4 hover:text-emerald-600"
              >
                {pick.name}&apos;s official pricing page
              </a>{" "}
              before you pay.
            </p>
            <p>
              The practical move: spend a few days of free credits building one
              real flow from your own idea, and watch what each change costs
              before you choose a plan.
            </p>
            <ReadNext links={[guides.pricing]} />
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
                Connect GitHub early, so the code lives somewhere you control
                from day one.
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
            <ReadNext links={[guides.firstApp, guides.roundup]} />
          </Step>
        </Container>
      </Section>

      {/* ------------------------------------------- If it isn't the fit */}
      {alternatives.length > 0 && (
        <Section tone="mint">
          <Container size="wide">
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-ink-subtle uppercase">
              Alternatives
            </p>
            <h2 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink">
              If {pick.name} isn&apos;t the fit
            </h2>
            <p className="mt-2 max-w-2xl text-ink-muted">
              No builder is right for everyone. These are the ones we&apos;d
              look at next, with our verdict on each.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {alternatives.map((alt) => (
                <div
                  key={alt.slug}
                  className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5"
                >
                  <div className="flex items-center gap-2.5">
                    <StoreLogo
                      name={alt.name}
                      logoUrl={alt.logoUrl}
                      themeColor={alt.themeColor}
                      size="sm"
                    />
                    <p className="min-w-0 flex-1 truncate font-display font-semibold text-ink">
                      {alt.name}
                    </p>
                    {alt.score !== null && (
                      <span className="font-mono text-sm font-bold text-pine">
                        {alt.score.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-ink-muted">
                    {alt.verdict}
                  </p>
                  <Link
                    href={alt.comparison?.href ?? `/tools/${alt.slug}`}
                    className="mt-4 text-sm font-semibold text-emerald-600 hover:underline"
                  >
                    {alt.comparison
                      ? `${alt.comparison.title} →`
                      : `Read the ${alt.name} review →`}
                  </Link>
                </div>
              ))}
            </div>
          </Container>
        </Section>
      )}

      <CtaBand
        brandName={pick.name}
        logoUrl={pick.logoUrl}
        visitUrl={pick.goHref}
        closingLine={`Start on ${pick.name}'s free plan — 5 build credits a day, enough to test your own idea before you pay.`}
      />
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
