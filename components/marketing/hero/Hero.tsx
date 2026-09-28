"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useLenis } from "lenis/react";
import { Search } from "lucide-react";
import { useReducedMotion } from "@/components/motion/useReducedMotion";
import { useMediaQuery } from "@/components/motion/useMediaQuery";
import { HeroGridCanvas } from "./HeroGridCanvas";

gsap.registerPlugin(ScrollTrigger);

/** Fisher–Yates shuffle over a copy — never mutate the source array. */
function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type HeroCard = {
  name: string;
  score: number;
  logoUrl: string | null;
};

export type HeroQuickTag = { label: string; href: string };
export type HeroVs = { a: string; b: string; slug: string };

type HeroProps = {
  toolsReviewed: number;
  comparisonsCount: number;
  cards: HeroCard[];
  vsChips: HeroVs[];
  /** Deep links rendered as the quick-tag row under the search bar. */
  quickTags: HeroQuickTag[];
};

/** Positions + entrance/parallax hooks for the floating evidence chips.
 * Four slots — balanced around the centered content without crowding.
 *
 * Each slot owns its scroll-parallax tween rather than the timeline hard-coding
 * all four: how many slots render depends on the data (one chip per scored tool
 * and per published comparison, capped at four), so with no comparisons
 * published only `a` and `b` exist and tweens for `c`/`d` would target nothing.
 */
const FLOAT_SLOTS = [
  {
    key: "a",
    className: "absolute top-[18%] left-[4%] -rotate-3 idle-float",
    parallax: { yPercent: -40, rotate: 6 },
  },
  {
    key: "b",
    className:
      "absolute top-[22%] right-[4%] rotate-2 idle-float [--float-duration:8s]",
    parallax: { yPercent: -30, rotate: -6 },
  },
  {
    key: "c",
    className:
      "absolute bottom-[28%] left-[6%] rotate-1 idle-float [--float-duration:9s]",
    parallax: { yPercent: -52, rotate: 4 },
  },
  {
    key: "d",
    className:
      "absolute bottom-[18%] right-[5%] -rotate-2 idle-float [--float-duration:7.5s]",
    parallax: { yPercent: -24, rotate: -5 },
  },
];

/** The hook: independent research, a real score, and a reader who leaves
 * ready to build. "Researched" not "Tested": every verdict on this site is
 * desk research against official docs and pricing, not a hands-on lab test.
 * Claiming otherwise is a compliance problem with the brands we cover. */
const HEADLINE: { word: string; accent?: boolean }[] = [
  { word: "Researched." },
  { word: "Scored." },
  { word: "Ready", accent: true },
  { word: "to", accent: true },
  { word: "build.", accent: true },
];

export function Hero({ cards, vsChips, quickTags }: HeroProps) {
  const scope = useRef<HTMLDivElement>(null);
  const cardsLayerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const reducedMotion = useReducedMotion();
  const isTouch = useMediaQuery("(pointer: coarse)", true);
  const lenis = useLenis();

  // "/" focuses the search — command-bar behavior, standard and accessible.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Rotate the floating chips per visit in the browser: SSR renders a stable
  // first slice (no hydration mismatch), then we reshuffle on mount so the
  // cached page still looks different on every refresh — with no DB hit.
  // The first entry is the pinned flagship (Lovable card / Lovable-vs-Cursor
  // chip): always shown. The remaining slot rotates on each visit.
  const [pickedCards, setPickedCards] = useState(() => cards.slice(0, 2));
  const [pickedVs, setPickedVs] = useState(() => vsChips.slice(0, 2));
  useEffect(() => {
    const pin = <T,>(items: T[], n: number) =>
      items.length <= 1
        ? items.slice(0, n)
        : [items[0], ...shuffle(items.slice(1)).slice(0, n - 1)];
    setPickedCards(pin(cards, 2));
    setPickedVs(pin(vsChips, 2));
  }, [cards, vsChips]);

  // Interleave score chips and VS chips, then drop into the fixed slots.
  const floatItems: React.ReactNode[] = [];
  const maxLen = Math.max(pickedCards.length, pickedVs.length);
  for (let i = 0; i < maxLen; i++) {
    if (pickedCards[i]) floatItems.push(<HeroScoreChip card={pickedCards[i]} />);
    if (pickedVs[i]) floatItems.push(<HeroVsChip vs={pickedVs[i]} />);
  }
  const floats = floatItems.slice(0, FLOAT_SLOTS.length);
  // The reshuffle above preserves length, so this is stable after mount and
  // safe as an animation dependency.
  const floatCount = floats.length;

  // Lenis drives ScrollTrigger's update loop. Kept out of the animation effect
  // below: `lenis` is undefined on the first client render and only becomes
  // available once SmoothScroll mounts ReactLenis, so depending on it there
  // would rebuild every tween a second time. It also needs its own teardown —
  // the listener is not part of the GSAP context.
  useEffect(() => {
    if (!lenis || reducedMotion) return;
    lenis.on("scroll", ScrollTrigger.update);
    return () => lenis.off("scroll", ScrollTrigger.update);
  }, [lenis, reducedMotion]);

  useGSAP(
    () => {
      if (reducedMotion) return;

      // Kinetic headline: masked word rise, staggered.
      gsap.fromTo(
        ".hero-word-inner",
        { yPercent: 115 },
        {
          yPercent: 0,
          duration: 0.9,
          ease: "power4.out",
          stagger: 0.07,
          delay: 0.15,
        },
      );

      // Supporting content fades up after the headline.
      gsap.fromTo(
        ".hero-rise",
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.09,
          delay: 0.55,
        },
      );

      // Floating evidence chips drift in.
      gsap.fromTo(
        ".hero-float",
        { opacity: 0, scale: 0.92, y: 26 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 1,
          ease: "power3.out",
          stagger: 0.14,
          delay: 0.7,
        },
      );

      // Parallax out on scroll.
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: scope.current,
          start: "top top",
          end: "bottom top",
          scrub: 0.6,
        },
      });
      tl.to(".hero-content", { yPercent: -14, opacity: 0.25 }, 0);
      // Only the slots that actually rendered — anything beyond `floatCount`
      // has no element and GSAP would warn that the target was not found.
      for (const slot of FLOAT_SLOTS.slice(0, floatCount)) {
        tl.to(`.hero-float-${slot.key}`, slot.parallax, 0);
      }

      // Mouse parallax on the chip layer.
      if (!isTouch && cardsLayerRef.current) {
        const xTo = gsap.quickTo(cardsLayerRef.current, "x", {
          duration: 0.7,
          ease: "power3.out",
        });
        const yTo = gsap.quickTo(cardsLayerRef.current, "y", {
          duration: 0.7,
          ease: "power3.out",
        });
        const onMove = (e: MouseEvent) => {
          xTo((e.clientX / window.innerWidth - 0.5) * -24);
          yTo((e.clientY / window.innerHeight - 0.5) * -16);
        };
        window.addEventListener("mousemove", onMove, { passive: true });
        return () => window.removeEventListener("mousemove", onMove);
      }
    },
    {
      scope,
      dependencies: [reducedMotion, isTouch, floatCount],
      // useGSAP already runs the callback inside a gsap.context() scoped to
      // `scope`, but with a non-empty dependency array it defers the revert to
      // unmount — so every re-run stacked another copy of these tweens on top
      // of the live ones. This reverts the context before each re-run.
      revertOnUpdate: true,
    },
  );

  return (
    <section
      ref={scope}
      className="relative isolate -mt-[76px] flex min-h-svh flex-col overflow-hidden bg-pine text-white sm:-mt-[80px]"
    >
      <HeroGridCanvas className="absolute inset-0 -z-10 h-full w-full" />

      {/* Floating evidence chips (decorative, desktop only) */}
      <div
        ref={cardsLayerRef}
        className="absolute inset-0 -z-[5] hidden lg:block"
        aria-hidden="true"
      >
        {floats.map((chip, i) => (
          <div
            key={i}
            className={`hero-float hero-float-${FLOAT_SLOTS[i].key} ${FLOAT_SLOTS[i].className}`}
          >
            {chip}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="hero-content mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 pt-20 pb-24 text-center sm:px-6">
        {/* Eyebrow: a live capsule tag, not plain text */}
        <p className="hero-rise inline-flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-1.5 font-mono text-xs tracking-[0.18em] text-mint/85 uppercase">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="tag-pulse absolute inline-flex h-full w-full rounded-full bg-emerald/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
          </span>
          Independent reviews · scored 0–10
        </p>

        <h1 className="mt-7 text-h1 font-bold text-balance sm:text-[2.75rem] lg:text-5xl">
          {HEADLINE.map(({ word, accent }, i) => (
            <span
              key={i}
              className={`inline-block overflow-hidden pb-1 align-bottom${
                i < HEADLINE.length - 1 ? " mr-[0.28em]" : ""
              }`}
            >
              <span
                className={`hero-word-inner inline-block will-change-transform ${accent ? "text-emerald" : ""}`}
              >
                {word}
              </span>
            </span>
          ))}
        </h1>

        <p className="hero-rise mt-6 max-w-xl text-body-lg text-mint/85">
          Independent reviews of the AI app builders and coding tools founders
          use to ship software &mdash; researched against official docs and
          pricing, scored 0&ndash;10, with the catch stated up front.
        </p>

        {/* Command-style search */}
        <form
          action="/search"
          role="search"
          className="hero-rise mt-9 w-full max-w-xl"
        >
          <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-lg focus-within:shadow-[0_0_0_3px_rgba(30,198,119,0.45),var(--shadow-lg)]">
            <Search
              className="ml-2.5 h-5 w-5 shrink-0 text-ink-subtle"
              aria-hidden="true"
            />
            <label htmlFor="hero-search" className="sr-only">
              Search tools, reviews, and comparisons
            </label>
            <input
              ref={searchRef}
              id="hero-search"
              name="q"
              type="search"
              placeholder="Search tools, reviews, comparisons"
              className="h-11 w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-subtle"
              autoComplete="off"
            />
            <kbd
              className="hidden shrink-0 rounded-md border border-line px-2 py-1 font-mono text-xs text-ink-subtle sm:block"
              aria-hidden="true"
            >
              /
            </kbd>
            <button
              type="submit"
              className="btn-gloss btn-primary press-down inline-flex h-11 shrink-0 items-center rounded-xl px-5 text-sm font-semibold"
            >
              Search
            </button>
          </div>
        </form>

        {/* Quick tags — real deep links, the fast path in */}
        {quickTags.length > 0 && (
          <div className="hero-rise mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="font-mono text-[0.65rem] tracking-[0.18em] text-mint/50 uppercase">
              Start with
            </span>
            {quickTags.map((tag) => (
              <Link
                key={tag.href}
                href={tag.href}
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium text-mint/85 transition-colors hover:border-emerald hover:text-white"
              >
                {tag.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Discreet scroll cue (replaces the retired ticker marquee) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2"
        aria-hidden="true"
      >
        <span className="font-mono text-[0.6rem] tracking-[0.3em] text-mint/40 uppercase">
          Scroll
        </span>
        <span className="scroll-cue block h-7 w-px bg-white/30" />
      </div>
    </section>
  );
}

function HeroScoreChip({ card }: { card: HeroCard }) {
  return (
    <div className="flex w-52 items-center gap-3 rounded-2xl border border-white/10 bg-white/95 p-3 shadow-xl backdrop-blur-sm">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
        {card.logoUrl ? (
          <Image
            src={card.logoUrl}
            alt=""
            width={28}
            height={28}
            unoptimized={/\.(svg|ico)$/i.test(card.logoUrl)}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="font-display text-sm font-bold text-pine">
            {card.name.charAt(0)}
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-ink">
          {card.name}
        </p>
        <p className="font-mono text-[0.65rem] text-ink-subtle">
          DaddyPromoos score
        </p>
      </div>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald font-mono text-xs font-bold text-pine">
        {card.score.toFixed(1)}
      </span>
    </div>
  );
}

function HeroVsChip({ vs }: { vs: HeroVs }) {
  return (
    <Link
      href={`/compare/${vs.slug}`}
      className="group flex items-center gap-2 rounded-full border border-white/10 bg-pine/90 px-4 py-2.5 shadow-xl backdrop-blur-sm transition-colors hover:bg-pine"
    >
      <span className="font-mono text-xs font-bold whitespace-nowrap text-white">
        {vs.a}
      </span>
      <span className="font-mono text-[0.65rem] font-bold text-emerald uppercase">
        vs
      </span>
      <span className="font-mono text-xs font-bold whitespace-nowrap text-white">
        {vs.b}
      </span>
    </Link>
  );
}
