import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/current";
import { exportClicksSince } from "@/lib/db/repositories/clicks";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const range = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("range")) || 30));
  const since = new Date(Date.now() - range * 86_400_000);
  const clicks = await exportClicksSince(since);

  const rows = [
    "created_at,coupon,store,path,referer,country",
    ...clicks.map((c) =>
      [
        c.createdAt.toISOString(),
        csvEscape(c.couponTitle ?? ""),
        csvEscape(c.storeName ?? ""),
        csvEscape(c.path),
        csvEscape(c.referer ?? ""),
        csvEscape(c.country ?? ""),
      ].join(","),
    ),
  ];

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daddypromoos-clicks-${range}d.csv"`,
    },
  });
}
