"use server";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { inventory, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { countInventory, getBusiness } from "@/lib/data";
import { duplicateKey, MAX_INVENTORY_ITEMS } from "@/lib/inventory";
import {
  importPayloadSchema,
  planImport,
  type ImportPlan,
} from "@/lib/inventory-import";
import {
  inventoryPrice,
  inventorySchema,
  type InventoryInput,
} from "@/lib/validation";
import { MAX_WORKBOOK_BYTES, readWorkbook, SpreadsheetError } from "@/lib/xlsx";
import type { SaveState } from "./actions";

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin", "layout");
}

export async function saveInventoryItem(
  _previous: SaveState,
  form: FormData,
): Promise<SaveState> {
  await requireAdmin();
  const price = inventoryPrice(form.get("price"));
  if (!price.ok)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: { price: [price.message] },
    };
  const parsed = inventorySchema.safeParse({
    ...Object.fromEntries(form),
    priceCents: price.priceCents,
    sku: String(form.get("sku") || "").trim() || null,
    published: form.get("published") === "on",
  });
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  const existing = form.get("id");
  if (existing && !z.uuid().safeParse(existing).success)
    return { ok: false, message: "This item could not be found." };
  const id = existing ? String(existing) : crypto.randomUUID();
  try {
    if (existing) {
      const updated = await getDb()
        .update(inventory)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(inventory.id, id))
        .returning({ id: inventory.id });
      if (!updated.length)
        return {
          ok: false,
          message: "This item no longer exists. Return to the list.",
        };
    } else {
      if ((await countInventory()) >= MAX_INVENTORY_ITEMS)
        return {
          ok: false,
          message:
            "The inventory list is full. Remove items you no longer stock, then add this one.",
        };
      await getDb()
        .insert(inventory)
        .values({ ...parsed.data, id });
    }
    refresh();
    return { ok: true, message: "Item saved.", id };
  } catch (error) {
    return { ok: false, message: writeFailure(error, "save this item") };
  }
}

export async function deleteInventoryItem(
  _previous: SaveState,
  form: FormData,
): Promise<SaveState> {
  await requireAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success || form.get("confirm") !== "on")
    return { ok: false, message: "Confirm deletion to continue." };
  try {
    await getDb().delete(inventory).where(eq(inventory.id, id.data));
    refresh();
    return { ok: true, message: "Item deleted." };
  } catch {
    return {
      ok: false,
      message: "We couldn’t delete this item. Please try again.",
    };
  }
}

// Visibility is a setting, never a deletion. Existing records stay untouched.
export async function setInventoryVisible(
  _previous: SaveState,
  form: FormData,
): Promise<SaveState> {
  await requireAdmin();
  const show = form.get("showInventory") === "on";
  try {
    const business = { ...(await getBusiness()), showInventory: show };
    await getDb()
      .insert(settings)
      .values({ id: 1, business })
      .onConflictDoUpdate({
        target: settings.id,
        set: { business, updatedAt: new Date() },
      });
    refresh();
    return {
      ok: true,
      message: show
        ? "Inventory is now shown on the website."
        : "Inventory is now hidden. Your items are still saved.",
    };
  } catch {
    return {
      ok: false,
      message: "We couldn’t change this setting. Please try again.",
    };
  }
}

export type ImportPreview = {
  ok: boolean;
  message: string;
  plan?: ImportPlan;
  newCount?: number;
  matchCount?: number;
};

// Step one: read and check the spreadsheet. Nothing is written yet.
export async function previewInventoryImport(
  _previous: ImportPreview,
  form: FormData,
): Promise<ImportPreview> {
  await requireAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || !file.size)
    return { ok: false, message: "Choose a spreadsheet to upload." };
  if (file.size > MAX_WORKBOOK_BYTES)
    return {
      ok: false,
      message: "This spreadsheet is too large. Upload a file under 3 MB.",
    };
  let plan: ImportPlan;
  try {
    const workbook = readWorkbook(Buffer.from(await file.arrayBuffer()));
    plan = planImport(workbook.rows, workbook.truncated);
  } catch (error) {
    if (error instanceof SpreadsheetError)
      return { ok: false, message: error.message };
    console.error("Spreadsheet could not be read.");
    return {
      ok: false,
      message:
        "We couldn’t read this spreadsheet. Save it again as .xlsx and try once more.",
    };
  }
  if (!plan.mapped.length)
    return {
      ok: false,
      message:
        "We couldn’t find a column of item names. Give the first row headings such as Name, Manufacturer, Category, Caliber and Price, then upload again.",
    };
  if (!plan.items.length)
    return {
      ok: false,
      message: "No items could be read from this spreadsheet.",
      plan,
    };
  try {
    const known = await existingKeys();
    const matchCount = plan.items.filter((item) => known.has(item.key)).length;
    return {
      ok: true,
      message: "Check the preview below, then confirm the import.",
      plan,
      newCount: plan.items.length - matchCount,
      matchCount,
    };
  } catch {
    return {
      ok: false,
      message:
        "We couldn’t check your current inventory. Please try again in a moment.",
    };
  }
}

// Step two: write, only after the client confirms. Nothing is ever deleted.
export async function confirmInventoryImport(
  _previous: SaveState,
  form: FormData,
): Promise<SaveState> {
  await requireAdmin();
  let payload;
  try {
    payload = importPayloadSchema.parse(JSON.parse(String(form.get("items"))));
  } catch {
    return {
      ok: false,
      message:
        "The preview is no longer valid. Upload the spreadsheet again to start over.",
    };
  }
  if (form.get("confirm") !== "on")
    return { ok: false, message: "Tick the confirmation box to import." };
  try {
    const known = await existingKeys();
    const inserts: (InventoryInput & { id: string })[] = [];
    const updates: (InventoryInput & { id: string })[] = [];
    const used = new Set<string>();
    for (const { data } of payload.items) {
      const key = duplicateKey(data);
      if (used.has(key)) continue;
      used.add(key);
      const match = known.get(key);
      if (!match) inserts.push({ ...data, id: crypto.randomUUID() });
      else if (payload.mode === "update") updates.push({ ...data, id: match });
    }
    if (known.size + inserts.length > MAX_INVENTORY_ITEMS)
      return {
        ok: false,
        message: `This import would take the inventory past ${MAX_INVENTORY_ITEMS.toLocaleString("en-US")} items. Split the spreadsheet or remove items you no longer stock.`,
      };
    if (!inserts.length && !updates.length)
      return {
        ok: true,
        message:
          "Every item in this spreadsheet is already in your inventory. Nothing was changed.",
      };
    await writeImport(inserts, updates);
    refresh();
    const added = inserts.length
      ? `${inserts.length.toLocaleString("en-US")} item${inserts.length === 1 ? "" : "s"} added`
      : "";
    const changed = updates.length
      ? `${updates.length.toLocaleString("en-US")} item${updates.length === 1 ? "" : "s"} updated`
      : "";
    return {
      ok: true,
      message: `${[added, changed].filter(Boolean).join(" and ")}. Nothing else was changed.`,
    };
  } catch (error) {
    return { ok: false, message: writeFailure(error, "import these items") };
  }
}

async function existingKeys() {
  const rows = await getDb()
    .select({
      id: inventory.id,
      sku: inventory.sku,
      name: inventory.name,
      manufacturer: inventory.manufacturer,
    })
    .from(inventory)
    .limit(MAX_INVENTORY_ITEMS);
  const keys = new Map<string, string>();
  for (const row of rows) keys.set(duplicateKey(row), row.id);
  return keys;
}

// neon-http has no interactive transactions, but db.batch sends every
// statement in one. Rows go in as a few multi-row statements rather than
// thousands of round trips.
async function writeImport(
  inserts: (InventoryInput & { id: string })[],
  updates: (InventoryInput & { id: string })[],
) {
  const db = getDb();
  const statements = [
    ...chunk(inserts, 200).map((batch) => db.insert(inventory).values(batch)),
    ...chunk(updates, 200).map((batch) =>
      db.execute(sql`update ${inventory} as target set
        name = source.name,
        manufacturer = source.manufacturer,
        category = source.category,
        caliber = source.caliber,
        price_cents = source.price_cents,
        status = source.status,
        sku = source.sku,
        description = source.description,
        updated_at = now()
      from (values ${sql.join(
        batch.map(
          (item) =>
            sql`(${item.id}::text, ${item.name}::text, ${item.manufacturer}::text,
              ${item.category}::text, ${item.caliber}::text, ${item.priceCents}::integer,
              ${item.status}::inventory_status, ${item.sku}::text, ${item.description}::text)`,
        ),
        sql`, `,
      )}) as source(id, name, manufacturer, category, caliber, price_cents, status, sku, description)
      where target.id = source.id`),
    ),
  ];
  if (statements.length === 1) await statements[0];
  else await db.batch(statements as [(typeof statements)[number]]);
}

function chunk<T>(items: T[], size: number) {
  const groups: T[][] = [];
  for (let at = 0; at < items.length; at += size)
    groups.push(items.slice(at, at + size));
  return groups;
}

// Turn the one database error the client can actually fix into plain advice.
function writeFailure(error: unknown, action: string) {
  const detail = error instanceof Error ? error.message : "";
  if (/inventory_sku_unique|duplicate key/i.test(detail))
    return "Two items share the same stock number. Give each item its own stock number, or leave it blank.";
  return `We couldn’t ${action}. Please try again.`;
}
