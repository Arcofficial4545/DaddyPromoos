import Link from "next/link";
import {
  BarChart3,
  Eye,
  Mail,
  MousePointerClick,
  Ticket,
  TrendingUp,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ClicksLineChart } from "@/components/admin/charts";
import {
  clicksPerDay,
  countClicksSince,
  recentClicks,
  topCouponsByClicks,
  topStoresByClicks,
} from "@/lib/db/repositories/clicks";
import { countActiveCoupons } from "@/lib/db/repositories/coupons";
import { countSubscribers } from "@/lib/db/repositories/newsletter";
import { formatNumber } from "@/lib/utils";

function dateRanges() {
  const now = Date.now();
  return {
    d7: new Date(now - 7 * 86_400_000),
    d30: new Date(now - 30 * 86_400_000),
  };
}

export default async function AdminDashboardPage() {
  const { d7, d30 } = dateRanges();

  const [
    activeCoupons,
    clicks7,
    clicks30,
    subs,
    perDay,
    topCoupons,
    topStores,
    recent,
  ] = await Promise.all([
    countActiveCoupons(),
    countClicksSince(d7),
    countClicksSince(d30),
    countSubscribers(),
    clicksPerDay(d30),
    topCouponsByClicks(d30, 10),
    topStoresByClicks(d30, 5),
    recentClicks(12),
  ]);

  const kpis = [
    { label: "Active coupons", value: activeCoupons, icon: Ticket },
    { label: "Clicks (7d)", value: clicks7, icon: MousePointerClick },
    { label: "Clicks (30d)", value: clicks30, icon: BarChart3 },
    {
      label: "Top store (30d)",
      value: topStores[0]?.storeName ?? "—",
      icon: TrendingUp,
      isText: true,
    },
    { label: "Newsletter subs", value: subs, icon: Mail },
  ];

  return (
    <>
      <AdminPageHeader
        title="Dashboard"
        description="What's happening across DaddyPromoos right now."
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-[var(--radius-card)] border border-line bg-white p-4"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-ink-subtle">
              <kpi.icon className="h-4 w-4" aria-hidden="true" />
              {kpi.label}
            </div>
            <p className="mt-2 truncate font-mono text-2xl font-bold text-pine">
              {kpi.isText ? kpi.value : formatNumber(Number(kpi.value))}
            </p>
          </div>
        ))}
      </div>

      {/* Chart + top stores */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <h2 className="font-display font-semibold text-pine">
            Redirect clicks, last 30 days
          </h2>
          <div className="mt-4">
            {perDay.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-subtle">
                No clicks recorded yet.
              </p>
            ) : (
              <ClicksLineChart data={perDay} />
            )}
          </div>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <h2 className="font-display font-semibold text-pine">
            Top stores (30d)
          </h2>
          <ul className="mt-4 space-y-3">
            {topStores.length === 0 && (
              <li className="text-sm text-ink-subtle">No data yet.</li>
            )}
            {topStores.map((store, i) => (
              <li
                key={store.storeId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="font-mono text-xs text-ink-subtle">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium text-ink">
                    {store.storeName}
                  </span>
                </span>
                <span className="font-mono font-semibold text-pine">
                  {formatNumber(store.clicks)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Top coupons + recent clicks */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <h2 className="font-display font-semibold text-pine">
            Top 10 coupons (30d)
          </h2>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle">
                <th className="pb-2 font-medium">Coupon</th>
                <th className="pb-2 font-medium">Store</th>
                <th className="pb-2 text-right font-medium">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {topCoupons.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-ink-subtle">
                    No data yet.
                  </td>
                </tr>
              )}
              {topCoupons.map((coupon) => (
                <tr key={coupon.couponId} className="border-b border-line last:border-0">
                  <td className="max-w-56 truncate py-2 pr-3 font-medium text-ink">
                    {coupon.title}
                  </td>
                  <td className="py-2 pr-3 text-ink-muted">{coupon.storeName}</td>
                  <td className="py-2 text-right font-mono font-semibold text-pine">
                    {formatNumber(coupon.clicks)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-pine">
              Recent clicks
            </h2>
            <Link
              href="/admin/analytics"
              className="text-sm font-medium text-emerald-600 hover:underline"
            >
              Full analytics
            </Link>
          </div>
          <ul className="mt-4 space-y-2.5">
            {recent.length === 0 && (
              <li className="text-sm text-ink-subtle">No clicks yet.</li>
            )}
            {recent.map((click) => (
              <li key={click.id} className="flex items-center gap-2 text-sm">
                <Eye className="h-3.5 w-3.5 shrink-0 text-ink-subtle" aria-hidden="true" />
                <span className="truncate text-ink-muted">
                  <span className="font-medium text-ink">
                    {click.couponTitle ?? "Deleted coupon"}
                  </span>
                  {click.storeName ? ` · ${click.storeName}` : ""}
                  {click.path ? ` · from ${click.path}` : ""}
                </span>
                <span className="ml-auto shrink-0 font-mono text-xs text-ink-subtle">
                  {click.createdAt.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
