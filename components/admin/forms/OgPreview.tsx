"use client";

import { useEffect, useState } from "react";

type OgPreviewProps = {
  title: string;
  description: string;
  slug: string;
};

/**
 * Social-share preview for the blog editor: renders the real /og image
 * (debounced so typing doesn't hammer the endpoint) plus the link text the
 * way social cards show it.
 */
export function OgPreview({ title, description, slug }: OgPreviewProps) {
  const [debouncedTitle, setDebouncedTitle] = useState(title);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTitle(title), 700);
    return () => clearTimeout(timer);
  }, [title]);

  const imgSrc = `/og?title=${encodeURIComponent(debouncedTitle || "Untitled post")}`;

  return (
    <div>
      <p className="mb-1.5 block text-sm font-medium text-ink">
        Share preview
      </p>
      <div className="overflow-hidden rounded-xl border border-line">
        {/* eslint-disable-next-line @next/next/no-img-element -- live preview of a dynamic endpoint; next/image would cache stale renders */}
        <img
          src={imgSrc}
          alt="Open Graph preview"
          width={600}
          height={315}
          className="aspect-[1200/630] w-full bg-pine object-cover"
        />
        <div className="border-t border-line bg-mint/40 px-3 py-2">
          <p className="font-mono text-[0.65rem] tracking-wide text-ink-subtle uppercase">
            daddypromoos.com/blog/{slug || "post-slug"}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-ink">
            {debouncedTitle || "Untitled post"}
          </p>
          <p className="line-clamp-2 text-xs text-ink-muted">
            {description || "The excerpt or SEO description appears here."}
          </p>
        </div>
      </div>
    </div>
  );
}
