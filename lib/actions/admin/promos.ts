"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/current";
import {
  createPromo,
  deletePromo,
  updatePromo,
} from "@/lib/db/repositories/promos";
import type { NewPromo } from "@/lib/db/schema";
import { promoSchema } from "@/lib/validators/admin";
import { firstIssue, friendlyDbError, type AdminActionResult } from "./shared";

function toCsvList(value: string): string[] | undefined {
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.startsWith("/"));
  return items.length > 0 ? items : undefined;
}

export async function savePromo(
  id: string | null,
  input: unknown,
): Promise<AdminActionResult> {
  await requireAdmin();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };

  const d = parsed.data;
  const data: NewPromo = {
    name: d.name,
    placement: d.placement,
    type: d.type,
    payload: {
      ...(d.couponId ? { couponId: d.couponId } : {}),
      ...(d.title ? { title: d.title } : {}),
      ...(d.body ? { body: d.body } : {}),
      ...(d.ctaLabel ? { ctaLabel: d.ctaLabel } : {}),
      ...(d.ctaUrl ? { ctaUrl: d.ctaUrl } : {}),
      ...(d.imageUrl ? { imageUrl: d.imageUrl } : {}),
    },
    targetingRules: {
      ...(toCsvList(d.paths) ? { paths: toCsvList(d.paths) } : {}),
      ...(toCsvList(d.excludePaths)
        ? { excludePaths: toCsvList(d.excludePaths) }
        : {}),
      frequencyCap: d.frequencyCap,
      frequencyDays: d.frequencyDays,
      ...(d.placement === "popup-timed" ? { delayMs: d.delayMs } : {}),
    },
    startsAt: d.startsAt,
    endsAt: d.endsAt,
    priority: d.priority,
    isActive: d.isActive,
  };

  try {
    if (id) {
      const row = await updatePromo(id, data);
      if (!row) return { ok: false, message: "Promo not found." };
      revalidatePath("/", "layout");
      return { ok: true, message: "Promo saved.", id: row.id };
    }
    const row = await createPromo(data);
    revalidatePath("/", "layout");
    return { ok: true, message: "Promo created.", id: row.id };
  } catch (err) {
    return { ok: false, message: friendlyDbError(err) };
  }
}

export async function removePromo(id: string): Promise<AdminActionResult> {
  await requireAdmin("admin");
  await deletePromo(id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Promo deleted." };
}
