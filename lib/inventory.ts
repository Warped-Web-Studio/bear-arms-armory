import type { inventory } from "@/db/schema";
export type InventoryRecord = typeof inventory.$inferSelect;
export const inventoryStatuses = ["available", "on_hold", "sold"] as const;
export type InventoryStatus = (typeof inventoryStatuses)[number];
export const statusLabels: Record<InventoryStatus, string> = {
  available: "Available",
  on_hold: "On hold",
  sold: "Sold",
};
export const MAX_INVENTORY_ITEMS = 5000;

// Prices are stored as whole cents so no rounding happens between edits.
export function displayPrice(priceCents: number | null) {
  if (priceCents === null) return "Call for price";
  return (priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: priceCents % 100 ? 2 : 0,
  });
}

// Accepts what a spreadsheet or an admin actually types: "1,299", "$1299.00", "1299".
export function parsePriceCents(value: string): number | null | undefined {
  const cleaned = value.trim().replace(/^\$/, "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return undefined;
  return Math.round(Number(cleaned) * 100);
}

export function priceInput(priceCents: number | null) {
  return priceCents === null ? "" : (priceCents / 100).toFixed(2);
}

// Items without a stock number still need a stable identity for duplicate checks.
export function duplicateKey(item: {
  sku: string | null;
  name: string;
  manufacturer: string;
}) {
  const normalize = (value: string) =>
    value.toLowerCase().replace(/\s+/g, " ").trim();
  return item.sku
    ? `sku:${normalize(item.sku)}`
    : `item:${normalize(item.name)}|${normalize(item.manufacturer)}`;
}
