import Link from "next/link";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StoreLogo } from "@/components/coupon/StoreLogo";
import type { StoreWithMeta } from "@/lib/db/repositories/stores";

export function StoreCard({ store }: { store: StoreWithMeta }) {
  return (
    <Card interactive className="relative p-5">
      <div className="flex items-start gap-3.5">
        <StoreLogo name={store.name} logoUrl={store.logoUrl} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold text-ink">
            <Link
              href={`/tools/${store.slug}`}
              className="after:absolute after:inset-0"
            >
              {store.name}
            </Link>
          </h3>
          <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">
            {store.tagline}
          </p>
        </div>
        {store.rating > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink">
            <Star
              className="h-4 w-4 fill-emerald text-emerald"
              aria-hidden="true"
            />
            {store.rating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {store.bestDiscountLabel && (
          <Badge variant="emerald" className="font-mono">
            {store.bestDiscountLabel}
          </Badge>
        )}
        {store.categories.slice(0, 2).map((cat) => (
          <Badge key={cat.id} variant="outline">
            {cat.name}
          </Badge>
        ))}
      </div>
    </Card>
  );
}
