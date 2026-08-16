import { getSession } from "@/lib/auth/current";
import { listSubscribers } from "@/lib/db/repositories/newsletter";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const subscribers = await listSubscribers();
  const rows = [
    "email,source,confirmed_at,created_at",
    ...subscribers.map((s) =>
      [
        csvEscape(s.email),
        csvEscape(s.source),
        s.confirmedAt?.toISOString() ?? "",
        s.createdAt.toISOString(),
      ].join(","),
    ),
  ];

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="daddypromoos-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
