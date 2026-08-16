/**
 * Brand-asset fetcher (Section 6). Shared by `scripts/fetch-brand-assets.ts`
 * (run via tsx) and the admin "Refetch brand assets" server action.
 *
 * For a store's public homepage it parses the <head> for a logo (SVG icon →
 * apple-touch-icon → /favicon.svg → /favicon.ico), the og:image cover, and the
 * theme-color. If the site blocks us or has no usable mark, it falls back to
 * Google's keyless favicon service. Nothing is hotlinked at runtime: assets are
 * downloaded to /public and the returned URLs are local.
 *
 * Marks are used nominatively to identify the brands DaddyPromoos covers. Delete
 * the file and the letter-tile fallback returns automatically.
 */
import * as cheerio from "cheerio";
import fs from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TIMEOUT = 10_000;
const LOGO_DIR = path.join(process.cwd(), "public", "logos");
const COVER_DIR = path.join(process.cwd(), "public", "covers");
const LOGO_EXTS = ["svg", "png", "ico", "jpg", "jpeg", "webp"];

export type BrandAssetResult = {
  slug: string;
  logoUrl: string | null;
  logoSource: string;
  coverImageUrl: string | null;
  themeColor: string | null;
  detail: string;
};

function extFromContentType(ct: string, url: string): string | null {
  const c = ct.toLowerCase();
  if (c.includes("svg")) return "svg";
  if (c.includes("png")) return "png";
  if (c.includes("icon") || c.includes("x-icon")) return "ico";
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  if (c.includes("webp")) return "webp";
  // Fall back to the URL extension.
  const m = url.split("?")[0].match(/\.(svg|png|ico|jpe?g|webp)$/i);
  if (m) return m[1].toLowerCase().replace("jpeg", "jpg");
  return null;
}

async function getText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function getBinary(
  url: string,
): Promise<{ buf: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 70) return null; // too small to be a real asset
    return { buf, contentType: res.headers.get("content-type") ?? "" };
  } catch {
    return null;
  }
}

/** Best-effort PNG dimensions for the result table. */
function pngSize(buf: Buffer): string | null {
  if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w && h) return `${w}x${h}`;
  }
  return null;
}

async function removeExisting(dir: string, slug: string): Promise<void> {
  await Promise.all(
    LOGO_EXTS.map((ext) =>
      fs.rm(path.join(dir, `${slug}.${ext}`), { force: true }),
    ),
  );
}

/** Ordered list of logo candidate URLs parsed from the page <head>. */
function logoCandidates($: cheerio.CheerioAPI, base: string): string[] {
  const abs = (href: string | undefined) => {
    if (!href) return null;
    try {
      return new URL(href, base).toString();
    } catch {
      return null;
    }
  };
  const out: (string | null)[] = [];

  // 1. Explicit SVG icon.
  $('link[rel~="icon"][type="image/svg+xml"]').each((_, el) => {
    out.push(abs($(el).attr("href")));
  });
  // 2. Any icon link pointing at an .svg.
  $('link[rel~="icon"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && /\.svg(\?|$)/i.test(href)) out.push(abs(href));
  });
  // 3. apple-touch-icon, largest first.
  const apple = $('link[rel~="apple-touch-icon"], link[rel~="apple-touch-icon-precomposed"]')
    .toArray()
    .map((el) => ({
      href: $(el).attr("href"),
      size: parseInt($(el).attr("sizes")?.split("x")[0] ?? "0", 10) || 0,
    }))
    .sort((a, b) => b.size - a.size);
  for (const a of apple) out.push(abs(a.href));
  // 4. Any remaining icon link (png/ico).
  $('link[rel~="icon"]').each((_, el) => {
    out.push(abs($(el).attr("href")));
  });
  // 5. Root fallbacks.
  out.push(abs("/favicon.svg"));
  out.push(abs("/favicon.ico"));

  // De-dupe, keep order.
  return [...new Set(out.filter((u): u is string => !!u))];
}

export async function fetchBrandAssets(store: {
  slug: string;
  websiteUrl: string;
}): Promise<BrandAssetResult> {
  const { slug, websiteUrl } = store;
  await fs.mkdir(LOGO_DIR, { recursive: true });
  await fs.mkdir(COVER_DIR, { recursive: true });

  const result: BrandAssetResult = {
    slug,
    logoUrl: null,
    logoSource: "FAILED",
    coverImageUrl: null,
    themeColor: null,
    detail: "",
  };

  const html = await getText(websiteUrl);
  let candidates: string[] = [];
  let ogImage: string | null = null;

  if (html) {
    const $ = cheerio.load(html);
    candidates = logoCandidates($, websiteUrl);
    result.themeColor =
      $('meta[name="theme-color"]').attr("content")?.trim() || null;
    const og =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content");
    if (og) {
      try {
        ogImage = new URL(og, websiteUrl).toString();
      } catch {
        /* ignore malformed og:image */
      }
    }
  }

  // ---- Logo: walk candidates, then Google favicon as last resort. ----
  for (const url of candidates) {
    const bin = await getBinary(url);
    if (!bin) continue;
    const ext = extFromContentType(bin.contentType, url);
    if (!ext) continue;
    await removeExisting(LOGO_DIR, slug);
    await fs.writeFile(path.join(LOGO_DIR, `${slug}.${ext}`), bin.buf);
    result.logoUrl = `/logos/${slug}.${ext}`;
    result.logoSource = url.includes("favicon.ico")
      ? "favicon.ico"
      : ext === "svg"
        ? "head-svg"
        : "head-icon";
    result.detail = pngSize(bin.buf) ?? `${ext} ${bin.buf.byteLength}b`;
    break;
  }

  if (!result.logoUrl) {
    let domain = slug;
    try {
      domain = new URL(websiteUrl).hostname;
    } catch {
      /* keep slug */
    }
    const bin = await getBinary(
      `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    );
    if (bin) {
      await removeExisting(LOGO_DIR, slug);
      await fs.writeFile(path.join(LOGO_DIR, `${slug}.png`), bin.buf);
      result.logoUrl = `/logos/${slug}.png`;
      result.logoSource = "google-favicon";
      result.detail = pngSize(bin.buf) ?? `png ${bin.buf.byteLength}b`;
    }
  }

  // ---- Cover: og:image → /public/covers. ----
  if (ogImage) {
    const bin = await getBinary(ogImage);
    if (bin) {
      const ext = extFromContentType(bin.contentType, ogImage) ?? "jpg";
      const coverExt = ext === "ico" ? "jpg" : ext;
      await fs.rm(path.join(COVER_DIR, `${slug}.jpg`), { force: true });
      await fs.rm(path.join(COVER_DIR, `${slug}.png`), { force: true });
      await fs.rm(path.join(COVER_DIR, `${slug}.webp`), { force: true });
      await fs.writeFile(path.join(COVER_DIR, `${slug}.${coverExt}`), bin.buf);
      result.coverImageUrl = `/covers/${slug}.${coverExt}`;
    }
  }

  return result;
}
