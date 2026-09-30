"use client";

import { useEffect, useState } from "react";
import { pickWeighted, type SpotlightItem } from "@/lib/picks";
import { ProductSpotlight } from "./ProductSpotlight";

/**
 * ProductSpotlight for cached (ISR) pages: SSR shows `initial`, then the
 * browser draws a fresh weighted pick after mount, so the banner changes on
 * every reload without re-rendering the page.
 */
export function RotatingSpotlight({
  items,
  initial,
  tone,
  className,
}: {
  items: SpotlightItem[];
  initial: SpotlightItem;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [item, setItem] = useState(initial);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const [next] = pickWeighted(items, 1);
      if (next) setItem(next);
    });
    return () => cancelAnimationFrame(frame);
  }, [items]);

  return <ProductSpotlight item={item} tone={tone} className={className} />;
}
