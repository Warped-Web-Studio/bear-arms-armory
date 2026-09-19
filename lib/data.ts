import "server-only";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lte,
  ne,
  or,
  gt,
  inArray,
} from "drizzle-orm";
import { getDb } from "@/db";
import { content, inventory, settings } from "@/db/schema";
import { defaultBusiness } from "./business";
import { storeClock, type ContentKind, type ContentRecord } from "./content";
import type { InventoryRecord } from "./inventory";
import { businessSchema } from "./validation";
export async function getBusiness() {
  if (!process.env.DATABASE_URL) return defaultBusiness;
  const rows = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.id, 1))
    .limit(1);
  return rows[0]
    ? businessSchema.parse({ ...defaultBusiness, ...rows[0].business })
    : defaultBusiness;
}
const newest = [
  desc(content.startsOn),
  desc(content.createdAt),
  desc(content.id),
];
export async function getPublicContent(page = 1) {
  const empty = {
    weekly: undefined as ContentRecord | undefined,
    monthly: undefined as ContentRecord | undefined,
    archive: [] as ContentRecord[],
    hasMore: false,
    events: [] as ContentRecord[],
    announcements: [] as ContentRecord[],
    unavailable: false,
  };
  if (!process.env.DATABASE_URL) return empty;
  const db = getDb(),
    clock = storeClock();
  try {
    const active = (kind: ContentKind) =>
      db
        .select()
        .from(content)
        .where(
          and(
            eq(content.kind, kind),
            eq(content.published, true),
            lte(content.startsOn, clock.date),
            gte(content.endsOn, clock.date),
          ),
        )
        .orderBy(...newest);
    const [week, month, events, announcements] = await Promise.all([
      active("weekly").limit(1),
      active("monthly").limit(1),
      db
        .select()
        .from(content)
        .where(
          and(
            eq(content.kind, "event"),
            eq(content.published, true),
            or(
              gt(content.endsOn, clock.date),
              and(
                eq(content.endsOn, clock.date),
                gte(content.endTime, clock.time),
              ),
            ),
          ),
        )
        .orderBy(asc(content.startsOn), asc(content.startTime))
        .limit(30),
      active("announcement").limit(10),
    ]);
    const archive = await db
      .select()
      .from(content)
      .where(
        and(
          inArray(content.kind, ["weekly", "monthly"]),
          eq(content.published, true),
          lte(content.startsOn, clock.date),
          week[0] ? ne(content.id, week[0].id) : undefined,
          month[0] ? ne(content.id, month[0].id) : undefined,
        ),
      )
      .orderBy(...newest)
      .limit(13)
      .offset((page - 1) * 12);
    return {
      weekly: week[0],
      monthly: month[0],
      events,
      announcements,
      archive: archive.slice(0, 12),
      hasMore: archive.length > 12,
      unavailable: false,
    };
  } catch {
    console.error("Public content could not be loaded.");
    return { ...empty, unavailable: true };
  }
}
// Inventory is informational. The public list is only read when the client has
// switched it on; turning it off never touches the records themselves.
export const PUBLIC_INVENTORY_LIMIT = 300;
export async function getPublicInventory(visible: boolean) {
  const empty = { items: [] as InventoryRecord[], hasMore: false };
  if (!visible || !process.env.DATABASE_URL) return empty;
  try {
    // One extra row tells us whether to say the list is partial, so a long
    // inventory is never silently cut off.
    const rows = await getDb()
      .select()
      .from(inventory)
      .where(eq(inventory.published, true))
      .orderBy(asc(inventory.category), asc(inventory.name))
      .limit(PUBLIC_INVENTORY_LIMIT + 1);
    return {
      items: rows.slice(0, PUBLIC_INVENTORY_LIMIT),
      hasMore: rows.length > PUBLIC_INVENTORY_LIMIT,
    };
  } catch {
    console.error("Inventory could not be loaded.");
    return empty;
  }
}
export async function listInventory(page = 1) {
  return getDb()
    .select()
    .from(inventory)
    .orderBy(asc(inventory.category), asc(inventory.name), asc(inventory.id))
    .limit(51)
    .offset((page - 1) * 50);
}
export async function countInventory() {
  const rows = await getDb()
    .select({ total: count() })
    .from(inventory)
    .limit(1);
  return rows[0]?.total ?? 0;
}
export async function listContent(kind: ContentKind, page = 1) {
  return getDb()
    .select()
    .from(content)
    .where(eq(content.kind, kind))
    .orderBy(...newest)
    .limit(26)
    .offset((page - 1) * 25);
}
