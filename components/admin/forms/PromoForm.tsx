"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { savePromo } from "@/lib/actions/admin/promos";
import type { Promo, PromoPlacement, PromoType } from "@/lib/db/schema";
import type { PromoData } from "@/lib/promos/resolve";
import {
  CheckboxField,
  Field,
  inputClasses,
  selectClasses,
  SubmitButton,
  textareaClasses,
} from "@/components/admin/fields";
import { PromoCard } from "@/components/promo/PromoCard";
import { toDatetimeLocal } from "./utils";

export type PromoCouponOption = {
  id: string;
  title: string;
  storeName: string;
  storeSlug: string;
  storeLogoUrl: string | null;
  discountLabel: string;
  isVerified: boolean;
};

type FormValues = {
  name: string;
  placement: PromoPlacement;
  type: PromoType;
  couponId: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  imageUrl: string;
  paths: string;
  excludePaths: string;
  frequencyCap: number;
  frequencyDays: number;
  delayMs: number;
  startsAt: string;
  endsAt: string;
  priority: number;
  isActive: boolean;
};

const PLACEMENTS: { value: PromoPlacement; label: string }[] = [
  { value: "sidebar", label: "Sidebar (store pages)" },
  { value: "sticky-rail", label: "Sticky rail (articles)" },
  { value: "in-content", label: "In-content (blog posts)" },
  { value: "popup-timed", label: "Timed popup" },
  { value: "popup-exit", label: "Exit-intent popup" },
  { value: "home-banner", label: "Home banner" },
];

export function PromoForm({
  promo,
  coupons,
}: {
  promo: Promo | null;
  coupons: PromoCouponOption[];
}) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: promo?.name ?? "",
      placement: promo?.placement ?? "sidebar",
      type: promo?.type ?? "coupon-highlight",
      couponId: promo?.payload.couponId ?? "",
      title: promo?.payload.title ?? "",
      body: promo?.payload.body ?? "",
      ctaLabel: promo?.payload.ctaLabel ?? "",
      ctaUrl: promo?.payload.ctaUrl ?? "",
      imageUrl: promo?.payload.imageUrl ?? "",
      paths: promo?.targetingRules.paths?.join(", ") ?? "",
      excludePaths: promo?.targetingRules.excludePaths?.join(", ") ?? "",
      frequencyCap: promo?.targetingRules.frequencyCap ?? 1,
      frequencyDays: promo?.targetingRules.frequencyDays ?? 7,
      delayMs: promo?.targetingRules.delayMs ?? 12_000,
      startsAt: toDatetimeLocal(promo?.startsAt),
      endsAt: toDatetimeLocal(promo?.endsAt),
      priority: promo?.priority ?? 0,
      isActive: promo?.isActive ?? true,
    },
  });

  const values = watch();
  const isPopup =
    values.placement === "popup-timed" || values.placement === "popup-exit";

  // Live preview: build a synthetic PromoData from current form state.
  const previewCoupon = coupons.find((c) => c.id === values.couponId);
  const previewData: PromoData = {
    id: promo?.id ?? "preview",
    placement: values.placement,
    type: values.type,
    payload: {
      ...(values.title ? { title: values.title } : {}),
      ...(values.body ? { body: values.body } : {}),
      ...(values.ctaLabel ? { ctaLabel: values.ctaLabel } : {}),
      ...(values.ctaUrl ? { ctaUrl: values.ctaUrl } : {}),
      ...(values.imageUrl ? { imageUrl: values.imageUrl } : {}),
    },
    targetingRules: {},
    coupon: previewCoupon
      ? {
          id: previewCoupon.id,
          title: previewCoupon.title,
          code: null,
          type: "deal",
          discountLabel: previewCoupon.discountLabel,
          terms: "",
          expiresAt: null,
          isVerified: previewCoupon.isVerified,
          isExclusive: false,
          clickCount: 0,
          lastVerifiedAt: null,
          worksCount: 0,
          failsCount: 0,
          store: {
            id: "preview",
            name: previewCoupon.storeName,
            slug: previewCoupon.storeSlug,
            logoUrl: previewCoupon.storeLogoUrl,
          },
        }
      : null,
  };

  const previewReady =
    values.type !== "coupon-highlight" || previewCoupon !== undefined;

  async function onSubmit(formValues: FormValues) {
    const result = await savePromo(promo?.id ?? null, formValues);
    toast(result.message);
    if (result.ok) router.push("/admin/promos");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-5 rounded-[var(--radius-card)] border border-line bg-white p-6">
        <Field label="Internal name" htmlFor="promo-name">
          <input id="promo-name" className={inputClasses} {...register("name")} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Placement" htmlFor="promo-placement">
            <select id="promo-placement" className={selectClasses} {...register("placement")}>
              {PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Type" htmlFor="promo-type">
            <select id="promo-type" className={selectClasses} {...register("type")}>
              <option value="coupon-highlight">Coupon highlight</option>
              <option value="custom-card">Custom card</option>
              <option value="newsletter">Newsletter capture</option>
            </select>
          </Field>
        </div>

        {values.type === "coupon-highlight" && (
          <Field label="Coupon" htmlFor="promo-coupon">
            <select id="promo-coupon" className={selectClasses} {...register("couponId")}>
              <option value="">Pick a coupon</option>
              {coupons.map((coupon) => (
                <option key={coupon.id} value={coupon.id}>
                  {coupon.storeName} — {coupon.discountLabel} — {coupon.title}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title (optional)" htmlFor="promo-title">
            <input id="promo-title" className={inputClasses} {...register("title")} />
          </Field>
          <Field label="CTA label (optional)" htmlFor="promo-cta">
            <input id="promo-cta" className={inputClasses} {...register("ctaLabel")} />
          </Field>
        </div>

        <Field label="Body (optional)" htmlFor="promo-body">
          <textarea id="promo-body" rows={2} className={textareaClasses} {...register("body")} />
        </Field>

        {values.type === "custom-card" && (
          <Field label="CTA URL" htmlFor="promo-cta-url">
            <input
              id="promo-cta-url"
              type="url"
              placeholder="https://... or /tools/..."
              className={inputClasses}
              {...register("ctaUrl")}
            />
          </Field>
        )}

        {values.type === "custom-card" && (
          <Field
            label="Banner image URL (optional)"
            htmlFor="promo-image-url"
            hint="Turns the card into an image banner linking to the CTA URL. For an affiliate banner, paste the creative's image src here and its link, unchanged, as the CTA URL. Never use a popup placement for it."
          >
            <input
              id="promo-image-url"
              type="url"
              placeholder="https://..."
              className={inputClasses}
              {...register("imageUrl")}
            />
          </Field>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Show on paths" htmlFor="promo-paths" hint="Comma-separated prefixes, e.g. /blog, /tools. Empty = everywhere.">
            <input id="promo-paths" className={inputClasses} {...register("paths")} />
          </Field>
          <Field label="Never on paths" htmlFor="promo-exclude" hint="e.g. /admin">
            <input id="promo-exclude" className={inputClasses} {...register("excludePaths")} />
          </Field>
        </div>

        {isPopup && (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Frequency cap" htmlFor="promo-cap" hint="Max views per visitor.">
              <input
                id="promo-cap"
                type="number"
                min={1}
                max={20}
                className={inputClasses}
                {...register("frequencyCap", { valueAsNumber: true })}
              />
            </Field>
            <Field label="Cap window (days)" htmlFor="promo-days">
              <input
                id="promo-days"
                type="number"
                min={1}
                max={90}
                className={inputClasses}
                {...register("frequencyDays", { valueAsNumber: true })}
              />
            </Field>
            {values.placement === "popup-timed" && (
              <Field label="Delay (ms)" htmlFor="promo-delay">
                <input
                  id="promo-delay"
                  type="number"
                  min={0}
                  step={500}
                  className={inputClasses}
                  {...register("delayMs", { valueAsNumber: true })}
                />
              </Field>
            )}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Starts" htmlFor="promo-starts">
            <input id="promo-starts" type="datetime-local" className={inputClasses} {...register("startsAt")} />
          </Field>
          <Field label="Ends" htmlFor="promo-ends">
            <input id="promo-ends" type="datetime-local" className={inputClasses} {...register("endsAt")} />
          </Field>
          <Field label="Priority" htmlFor="promo-priority" hint="Higher wins.">
            <input
              id="promo-priority"
              type="number"
              min={0}
              max={100}
              className={inputClasses}
              {...register("priority", { valueAsNumber: true })}
            />
          </Field>
        </div>

        <CheckboxField label="Active" {...register("isActive")} />

        <div className="flex items-center gap-3 border-t border-line pt-5">
          <SubmitButton pending={isSubmitting}>
            {promo ? "Save promo" : "Create promo"}
          </SubmitButton>
          <button
            type="button"
            onClick={() => router.push("/admin/promos")}
            className="text-sm font-medium text-ink-muted hover:text-pine"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* --------------------------------------------- Live preview */}
      <div>
        <div className="sticky top-6 rounded-[var(--radius-card)] border border-line bg-mint/40 p-5">
          <p className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
            Live preview — {PLACEMENTS.find((p) => p.value === values.placement)?.label}
          </p>
          <div className="mt-4">
            {previewReady ? (
              <PromoCard
                promo={previewData}
                variant={
                  values.placement === "home-banner"
                    ? "banner"
                    : values.placement === "sticky-rail"
                      ? "rail"
                      : "card"
                }
              />
            ) : (
              <p className="py-10 text-center text-sm text-ink-subtle">
                Pick a coupon to preview.
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
