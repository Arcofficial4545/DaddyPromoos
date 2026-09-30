import type { PricingRow } from "@/lib/db/schema";

type PricingTableProps = {
  rows: PricingRow[];
  pricingUrl: string;
  brandName: string;
  lastReviewedAt: Date;
};

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function PricingTable({
  rows,
  pricingUrl,
  brandName,
  lastReviewedAt,
}: PricingTableProps) {
  return (
    <div>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-mint">
              <th className="px-4 py-3 text-left font-semibold text-pine">
                Plan
              </th>
              <th className="px-4 py-3 text-left font-semibold text-pine">
                Price
              </th>
              <th className="px-4 py-3 text-left font-semibold text-pine">
                Our take
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 1 ? "bg-black/[0.02]" : "bg-white"}
              >
                <td className="px-4 py-3 font-mono font-medium text-ink">
                  {row.plan}
                </td>
                <td className="px-4 py-3 text-ink-muted">{row.price}</td>
                <td className="px-4 py-3 text-ink-muted">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-ink-subtle">
        Pricing as of {formatMonthYear(lastReviewedAt)}.{" "}
        Plans and credit allowances change often —{" "}
        <a
          href={pricingUrl}
          target="_blank"
          rel="nofollow noopener"
          className="font-medium text-pine underline hover:text-emerald-600"
        >
          check the official {brandName} pricing page
        </a>{" "}
        before committing.
      </p>
    </div>
  );
}
