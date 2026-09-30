"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile sticky bottom bar (Section 7.14): score + "Visit {tool}" that slides
 * in once the masthead (id=`watchId`) has scrolled out of view.
 */
export function MobileCtaBar({
  toolName,
  score,
  goHref,
  watchId = "masthead",
}: {
  toolName: string;
  score: number | null;
  goHref: string;
  watchId?: string;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(watchId);
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [watchId]);

  return (
    <div
      aria-hidden={!show}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white p-3 shadow-lg transition-transform duration-300 md:hidden",
        show ? "translate-y-0" : "translate-y-full",
      )}
    >
      <div className="flex items-center gap-3">
        {score !== null && (
          <span className="shrink-0 font-mono text-lg font-bold text-pine">
            {score.toFixed(1)}
            <span className="text-xs text-ink-subtle">/10</span>
          </span>
        )}
        <a
          href={goHref}
          target="_blank"
          rel="sponsored nofollow noopener"
          tabIndex={show ? 0 : -1}
          className="btn-gloss btn-primary press-down flex h-11 flex-1 items-center justify-center gap-2 rounded-[var(--radius-btn)] text-sm font-semibold"
        >
          Visit {toolName}
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
