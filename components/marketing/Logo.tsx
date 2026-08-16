import { cn } from "@/lib/utils";

/**
 * Brand mark — "the Proof Tile".
 *
 * A deep-pine squircle carrying a geometric white P whose counter holds an
 * emerald checkmark: proof built into the letter itself. Solid tile means the
 * mark reads identically on light and dark surfaces, down to favicon size.
 */
export function LogoMark({
  className,
  id = "pp",
}: {
  className?: string;
  /** Unique per-instance prefix so multiple inline copies don't clash gradient ids. */
  id?: string;
}) {
  const grad = `${id}-logo-tile`;
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={grad}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#155c3c" />
          <stop offset="0.55" stopColor="#0d4029" />
          <stop offset="1" stopColor="#092b1c" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill={`url(#${grad})`} />
      {/* hairline inner edge so the tile keeps definition on dark surfaces */}
      <rect
        x="0.5"
        y="0.5"
        width="47"
        height="47"
        rx="13.5"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.08"
      />
      {/* Bold P — stem + bowl, drawn as one rounded stroke */}
      <path
        d="M16 38V11h8.5a8.5 8.5 0 0 1 0 17H16"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Emerald checkmark in the P's open lower-right space — the "proof" */}
      <path
        d="M25.5 33.2l3.4 3.4 7.6-8.2"
        fill="none"
        stroke="#1ec677"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full lockup: mark + wordmark. The emerald full stop echoes the site voice
 * ("Proof first. Price second.") — every claim ends with a verified period.
 */
export function Logo({
  name = "DaddyPromoos",
  tone = "dark",
  className,
  markClassName,
  wordmarkClassName,
  id,
}: {
  name?: string;
  /** "dark" = pine wordmark for light surfaces, "light" = white for dark surfaces. */
  tone?: "dark" | "light";
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  id?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark id={id} className={markClassName} />
      <span
        className={cn(
          "font-display text-xl font-bold tracking-tight transition-colors",
          tone === "light" ? "text-white" : "text-pine",
          wordmarkClassName,
        )}
      >
        {name}
        <span className="text-emerald">.</span>
      </span>
    </span>
  );
}
