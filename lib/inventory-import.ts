import { z } from "zod";
import { duplicateKey, parsePriceCents } from "./inventory";
import { inventorySchema, type InventoryInput } from "./validation";

// One preview round-trip carries the parsed rows back to the server, so the
// batch has to stay a sensible size for a single request.
export const MAX_IMPORT_ITEMS = 2000;
export const PREVIEW_ROWS = 20;
export const MAX_REPORTED_ISSUES = 50;

// Spreadsheet headings vary by shop and by point-of-sale export. Matching is
// done on letters and digits only, so "Item #", "item#" and "ITEM NO." agree.
const FIELD_HEADERS: Record<string, string[]> = {
  name: [
    "name",
    "itemname",
    "item",
    "title",
    "product",
    "productname",
    "model",
    "modelname",
    "gun",
    "firearm",
  ],
  manufacturer: ["manufacturer", "make", "brand", "mfg", "mfr", "maker"],
  category: [
    "category",
    "type",
    "itemtype",
    "producttype",
    "class",
    "department",
    "group",
  ],
  caliber: [
    "caliber",
    "calibre",
    "cal",
    "gauge",
    "chambering",
    "calibergauge",
    "calgauge",
  ],
  price: [
    "price",
    "retailprice",
    "retail",
    "saleprice",
    "salesprice",
    "ourprice",
    "listprice",
    "msrp",
    "sellingprice",
  ],
  sku: [
    "sku",
    "stocknumber",
    "stockno",
    "stock",
    "itemnumber",
    "itemno",
    "itemid",
    "partnumber",
    "partno",
    "upc",
  ],
  status: ["status", "availability", "available", "instock", "instockstatus"],
  quantity: [
    "quantity",
    "qty",
    "onhand",
    "qtyonhand",
    "quantityonhand",
    "count",
  ],
  description: [
    "description",
    "itemdescription",
    "notes",
    "details",
    "comments",
    "remarks",
    "longdescription",
  ],
};
// Serial numbers identify individual firearms and must never reach a website.
const BLOCKED_HEADERS = [
  "serial",
  "serialnumber",
  "serialno",
  "serialnum",
  "sn",
];

const STATUS_WORDS: Record<string, "available" | "on_hold" | "sold"> = {
  available: "available",
  instock: "available",
  in: "available",
  yes: "available",
  y: "available",
  active: "available",
  true: "available",
  new: "available",
  sold: "sold",
  soldout: "sold",
  outofstock: "sold",
  out: "sold",
  no: "sold",
  n: "sold",
  inactive: "sold",
  false: "sold",
  onhold: "on_hold",
  hold: "on_hold",
  pending: "on_hold",
  layaway: "on_hold",
  reserved: "on_hold",
  deposit: "on_hold",
};

export function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export type ImportItem = { row: number; key: string; data: InventoryInput };
export type ImportIssue = { row: number; message: string };
export type ImportPlan = {
  mapped: { field: string; header: string }[];
  ignoredColumns: string[];
  blockedColumns: string[];
  items: ImportItem[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
  dataRows: number;
  truncated: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  name: "Item name",
  manufacturer: "Manufacturer",
  category: "Category",
  caliber: "Caliber or gauge",
  price: "Price",
  sku: "Stock number",
  status: "Availability",
  quantity: "Quantity",
  description: "Description",
};

export function mapColumns(header: string[]) {
  const mapped: { field: string; header: string; at: number }[] = [];
  const ignoredColumns: string[] = [];
  const blockedColumns: string[] = [];
  const taken = new Set<string>();
  header.forEach((raw, at) => {
    const label = raw.trim();
    if (!label) return;
    const normalized = normalizeHeader(label);
    if (BLOCKED_HEADERS.includes(normalized)) {
      blockedColumns.push(label);
      return;
    }
    const field = Object.keys(FIELD_HEADERS).find(
      (candidate) =>
        !taken.has(candidate) && FIELD_HEADERS[candidate].includes(normalized),
    );
    if (field) {
      taken.add(field);
      mapped.push({ field, header: label, at });
    } else ignoredColumns.push(label);
  });
  return { mapped, ignoredColumns, blockedColumns };
}

function readStatus(
  value: string,
  quantity: string,
  row: number,
  warnings: ImportIssue[],
) {
  if (value) {
    const word = STATUS_WORDS[normalizeHeader(value)];
    if (word) return word;
    warnings.push({
      row,
      message: `Availability “${value}” wasn’t recognised. Imported as Available.`,
    });
    return "available" as const;
  }
  if (quantity) {
    const amount = Number(quantity.replace(/,/g, ""));
    if (Number.isFinite(amount)) return amount > 0 ? "available" : "sold";
    warnings.push({
      row,
      message: `Quantity “${quantity}” isn’t a number. Imported as Available.`,
    });
  }
  return "available" as const;
}

// Everything here happens before any database write. The result is what the
// client sees in the preview and confirms.
export function planImport(rows: string[][], truncated = false): ImportPlan {
  const headerAt = rows.findIndex((row) => row.some((cell) => cell.trim()));
  const empty = {
    mapped: [],
    ignoredColumns: [],
    blockedColumns: [],
    items: [],
    errors: [],
    warnings: [],
    dataRows: 0,
    truncated,
  };
  if (headerAt < 0) return empty;
  const { mapped, ignoredColumns, blockedColumns } = mapColumns(rows[headerAt]);
  const columns = Object.fromEntries(mapped.map((c) => [c.field, c.at]));
  if (columns.name === undefined)
    return { ...empty, ignoredColumns, blockedColumns };
  const cell = (row: string[], field: string) =>
    (columns[field] === undefined ? "" : (row[columns[field]] ?? "")).trim();

  const items: ImportItem[] = [];
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const seen = new Map<string, number>();
  let dataRows = 0;
  for (let index = headerAt + 1; index < rows.length; index++) {
    const source = rows[index];
    const row = index + 1;
    if (!source.some((value) => value.trim())) continue;
    dataRows++;
    if (items.length >= MAX_IMPORT_ITEMS) continue;
    const name = cell(source, "name");
    if (!name) {
      errors.push({ row, message: "No item name, so this row was skipped." });
      continue;
    }
    const priceCents = parsePriceCents(cell(source, "price"));
    if (priceCents === undefined) {
      errors.push({
        row,
        message: `Price “${cell(source, "price")}” isn’t an amount such as 1299 or 1299.99.`,
      });
      continue;
    }
    const parsed = inventorySchema.safeParse({
      name,
      manufacturer: cell(source, "manufacturer"),
      category: cell(source, "category"),
      caliber: cell(source, "caliber"),
      priceCents,
      status: readStatus(
        cell(source, "status"),
        cell(source, "quantity"),
        row,
        warnings,
      ),
      sku: cell(source, "sku") || null,
      description: cell(source, "description"),
      published: true,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      errors.push({
        row,
        message: `${FIELD_LABELS[String(issue.path[0])] || "This row"}: ${issue.message}`,
      });
      continue;
    }
    const key = duplicateKey(parsed.data);
    const earlier = seen.get(key);
    if (earlier) {
      warnings.push({
        row,
        message: `Repeats row ${earlier} in this spreadsheet, so it was left out.`,
      });
      continue;
    }
    seen.set(key, row);
    items.push({ row, key, data: parsed.data });
  }
  if (dataRows > MAX_IMPORT_ITEMS)
    errors.push({
      row: 0,
      message: `Only the first ${MAX_IMPORT_ITEMS.toLocaleString("en-US")} items can be imported at once. Split the spreadsheet and import the rest afterwards.`,
    });
  return {
    mapped: mapped.map(({ field, header }) => ({ field, header })),
    ignoredColumns,
    blockedColumns,
    items,
    errors,
    warnings,
    dataRows,
    truncated,
  };
}

// The preview hands the parsed rows back to the browser, so the confirmation
// step re-validates them instead of trusting what comes back.
export const importPayloadSchema = z.object({
  items: z
    .array(z.object({ row: z.number().int().min(0), data: inventorySchema }))
    .min(1)
    .max(MAX_IMPORT_ITEMS),
  mode: z.enum(["skip", "update"]),
});

export function fieldLabel(field: string) {
  return FIELD_LABELS[field] || field;
}
