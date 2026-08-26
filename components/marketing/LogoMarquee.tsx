import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";

export type LogoMarqueeItem = { name: string; logoUrl: string | null };

/**
 * Seamless logo marquee (Section 6). Each mark sits on a white rounded tile
 * with a hairline border; opacity lifts on hover, the whole track pauses on
 * hover, and it holds a static row under `prefers-reduced-motion` (both via the
 * shared `.marquee-track` rules in globals.css). Alt text is the brand name.
 *
 * A brand with no `logoUrl` falls back to its name set as a wordmark. This used
 * to filter those rows out, which made a missing asset invisible — the tool
 * just vanished from the strip with no image request to notice in devtools.
 */
export function LogoMarquee({
  logos,
  caption = "TOOLS WE COVER",
}: {
  logos: LogoMarqueeItem[];
  caption?: string;
}) {
  const items = logos;
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Tools we cover"
      className="overflow-hidden border-y border-line bg-white py-8"
    >
      <Container size="wide">
        <p className="mb-6 font-mono text-xs tracking-[0.2em] text-ink-subtle uppercase">
          {caption}
        </p>
      </Container>
      <div
        className="marquee-track"
        style={{ "--marquee-duration": "50s" } as React.CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0 items-center"
            aria-hidden={copy === 1}
          >
            {items.map((logo, i) => (
              <span
                key={`${copy}-${i}`}
                className={cn(
                  "mx-4 inline-flex h-14 items-center justify-center opacity-70 transition-opacity hover:opacity-100",
                  logo.logoUrl ? "w-16" : "px-1",
                )}
              >
                {logo.logoUrl ? (
                  <Image
                    src={logo.logoUrl}
                    alt={logo.name}
                    width={44}
                    height={26}
                    unoptimized={/\.(svg|ico)$/i.test(logo.logoUrl)}
                    className="max-h-[26px] w-auto object-contain"
                  />
                ) : (
                  <span className="font-display text-sm font-semibold whitespace-nowrap text-ink">
                    {logo.name}
                  </span>
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
