import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

// No `export const runtime` here: "nodejs" is already the default for route
// handlers, and the segment config is rejected once `experimental.useCache`
// is on (see next.config.ts).

const PINE = "#0d4029";
const EMERALD = "#1ec677";
const MINT = "#ecf9ee";
const WHITE = "#ffffff";

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 18, height: 44, backgroundColor: EMERALD, borderRadius: 4 }} />
      <div style={{ fontSize: 40, fontWeight: 700, color: WHITE, letterSpacing: "-0.02em" }}>
        DaddyPromoos
      </div>
    </div>
  );
}

function ScoreDisc({ score, size = 200 }: { score: string; size?: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 999,
        border: `10px solid ${EMERALD}`,
        color: WHITE,
        fontSize: size * 0.42,
        fontWeight: 700,
      }}
    >
      {score}
    </div>
  );
}

const frame = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column" as const,
  justifyContent: "space-between" as const,
  backgroundColor: PINE,
  padding: "72px 80px",
  fontFamily: "sans-serif",
};

/**
 * Dynamic Open Graph images. Variants (Section 13):
 *  - default: /og?title=&subtitle=
 *  - review:  /og?variant=review&title={name}&score={x}
 *  - vs:      /og?variant=vs&a={A}&b={B}&sa={x}&sb={y}
 * Solid pine, emerald accent, no gradients, no emoji.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const variant = searchParams.get("variant");

  if (variant === "review") {
    const name = (searchParams.get("title") ?? "DaddyPromoos").slice(0, 60);
    const score = (searchParams.get("score") ?? "").slice(0, 4);
    return new ImageResponse(
      (
        <div style={frame}>
          <Wordmark />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
              <div style={{ fontSize: 30, color: EMERALD, fontWeight: 700, letterSpacing: "0.08em" }}>
                REVIEW
              </div>
              <div style={{ fontSize: 84, fontWeight: 700, color: WHITE, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
                {name}
              </div>
            </div>
            {score ? <ScoreDisc score={score} /> : null}
          </div>
          <div style={{ fontSize: 24, color: MINT, opacity: 0.7 }}>
            DaddyPromoos score · independent editorial review
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  if (variant === "vs") {
    const a = (searchParams.get("a") ?? "A").slice(0, 30);
    const b = (searchParams.get("b") ?? "B").slice(0, 30);
    const sa = (searchParams.get("sa") ?? "").slice(0, 4);
    const sb = (searchParams.get("sb") ?? "").slice(0, 4);
    const Col = ({ nm, sc }: { nm: string; sc: string }) => (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, flex: 1 }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: WHITE, textAlign: "center", letterSpacing: "-0.02em" }}>
          {nm}
        </div>
        {sc ? <ScoreDisc score={sc} size={160} /> : null}
      </div>
    );
    return new ImageResponse(
      (
        <div style={frame}>
          <Wordmark />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32 }}>
            <Col nm={a} sc={sa} />
            <div style={{ fontSize: 64, fontWeight: 700, color: EMERALD }}>VS</div>
            <Col nm={b} sc={sb} />
          </div>
          <div style={{ fontSize: 24, color: MINT, opacity: 0.7 }}>
            Head-to-head · DaddyPromoos comparison
          </div>
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const title = (searchParams.get("title") ?? "DaddyPromoos").slice(0, 120);
  const subtitle = (searchParams.get("subtitle") ?? "").slice(0, 160);

  return new ImageResponse(
    (
      <div style={frame}>
        <Wordmark />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: title.length > 60 ? 56 : 68,
              fontWeight: 700,
              color: WHITE,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 30, color: MINT, opacity: 0.85, maxWidth: 900 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 24, color: MINT, opacity: 0.7 }}>
            Independent reviews of AI app builders and coding tools
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: EMERALD,
              color: "#071f15",
              fontSize: 22,
              fontWeight: 700,
              padding: "12px 28px",
              borderRadius: 999,
            }}
          >
            daddypromoos
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
