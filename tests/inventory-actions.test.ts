import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getDb: vi.fn(),
  revalidatePath: vi.fn(),
  getBusiness: vi.fn(),
  countInventory: vi.fn(async () => 0),
}));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ getDb: mocks.getDb }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/data", () => ({
  getBusiness: mocks.getBusiness,
  countInventory: mocks.countInventory,
}));
import {
  confirmInventoryImport,
  deleteInventoryItem,
  previewInventoryImport,
  saveInventoryItem,
  setInventoryVisible,
} from "@/app/admin/inventory-actions";
import { defaultBusiness } from "@/lib/business";
import { MAX_INVENTORY_ITEMS } from "@/lib/inventory";
import { workbook } from "./workbook-fixture";

const initial = { message: "", ok: false };
const emptyPreview = { message: "", ok: false };
const spreadsheet = (buffer: Buffer, name = "inventory.xlsx") => {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(buffer)], name));
  return form;
};
// Nothing in the inventory yet unless a test says otherwise.
function stubInventory(rows: Record<string, unknown>[] = []) {
  const insert = vi.fn().mockResolvedValue([]);
  const execute = vi.fn().mockResolvedValue([]);
  const batch = vi.fn().mockResolvedValue([]);
  mocks.getDb.mockReturnValue({
    select: () => ({ from: () => ({ limit: async () => rows }) }),
    insert: () => ({ values: insert }),
    execute,
    batch,
  });
  return { insert, execute, batch };
}
beforeEach(() => {
  mocks.requireAdmin.mockResolvedValue({ id: "admin" });
  mocks.getBusiness.mockResolvedValue({ ...defaultBusiness });
  mocks.countInventory.mockResolvedValue(0);
});

it.each([
  saveInventoryItem,
  deleteInventoryItem,
  setInventoryVisible,
  confirmInventoryImport,
])("checks authorization before touching the database", async (action) => {
  mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
  await expect(action(initial, new FormData())).rejects.toThrow("Unauthorized");
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("checks authorization before reading an uploaded spreadsheet", async () => {
  mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
  await expect(
    previewInventoryImport(emptyPreview, spreadsheet(workbook([["Name"]]))),
  ).rejects.toThrow("Unauthorized");
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("saves a new item and refreshes the public page", async () => {
  const { insert } = stubInventory();
  const form = new FormData();
  form.set("name", "Model 70");
  form.set("manufacturer", "Winchester");
  form.set("price", "$1,299.00");
  form.set("status", "available");
  form.set("published", "on");
  const result = await saveInventoryItem(initial, form);
  expect(result.ok).toBe(true);
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "Model 70",
      priceCents: 129_900,
      sku: null,
      published: true,
    }),
  );
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
});

it("refuses to add another item once the inventory is full", async () => {
  const { insert } = stubInventory();
  mocks.countInventory.mockResolvedValue(MAX_INVENTORY_ITEMS);
  const form = new FormData();
  form.set("name", "Model 70");
  const result = await saveInventoryItem(initial, form);
  expect(result.ok).toBe(false);
  expect(result.message).toContain("inventory list is full");
  expect(insert).not.toHaveBeenCalled();
});

it("rejects a price that is not an amount, without writing", async () => {
  const form = new FormData();
  form.set("name", "Model 70");
  form.set("price", "about nine hundred");
  const result = await saveInventoryItem(initial, form);
  expect(result.ok).toBe(false);
  expect(result.errors?.price?.[0]).toContain("1299.99");
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("requires an explicit confirmation before deleting", async () => {
  const form = new FormData();
  form.set("id", "00000000-0000-4000-8000-000000000001");
  expect((await deleteInventoryItem(initial, form)).ok).toBe(false);
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it.each([true, false])(
  "changes only the visibility setting and keeps every record: %s",
  async (show) => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const remove = vi.fn();
    mocks.getDb.mockReturnValue({
      insert: () => ({ values }),
      delete: remove,
    });
    const form = new FormData();
    if (show) form.set("showInventory", "on");
    const result = await setInventoryVisible(initial, form);
    expect(result.ok).toBe(true);
    expect(values).toHaveBeenCalledWith({
      id: 1,
      business: { ...defaultBusiness, showInventory: show },
    });
    expect(remove).not.toHaveBeenCalled();
  },
);

it("previews a spreadsheet without writing anything", async () => {
  stubInventory();
  const result = await previewInventoryImport(
    emptyPreview,
    spreadsheet(
      workbook([
        ["Name", "Manufacturer", "Price"],
        ["Model 70", "Winchester", "1299"],
        ["10/22", "Ruger", "349"],
      ]),
    ),
  );
  expect(result.ok).toBe(true);
  expect(result.plan?.items).toHaveLength(2);
  expect(result.newCount).toBe(2);
  expect(result.matchCount).toBe(0);
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});

it("counts items already in the inventory as matches, not new", async () => {
  stubInventory([
    { id: "existing", sku: null, name: "Model 70", manufacturer: "Winchester" },
  ]);
  const result = await previewInventoryImport(
    emptyPreview,
    spreadsheet(
      workbook([
        ["Name", "Manufacturer"],
        ["Model 70", "Winchester"],
        ["10/22", "Ruger"],
      ]),
    ),
  );
  expect(result.newCount).toBe(1);
  expect(result.matchCount).toBe(1);
});

it.each([
  ["a file that is not a spreadsheet", Buffer.from("plain text")],
  [
    "an old .xls workbook",
    Buffer.concat([
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
      Buffer.alloc(100),
    ]),
  ],
])("explains %s in plain language and writes nothing", async (_l, buffer) => {
  const result = await previewInventoryImport(
    emptyPreview,
    spreadsheet(buffer),
  );
  expect(result.ok).toBe(false);
  expect(result.message).toMatch(/xlsx/i);
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("asks for headings when the sheet has no recognisable name column", async () => {
  const result = await previewInventoryImport(
    emptyPreview,
    spreadsheet(
      workbook([
        ["Bin", "Cost"],
        ["Rack 3", "900"],
      ]),
    ),
  );
  expect(result.ok).toBe(false);
  expect(result.message).toContain("column of item names");
  expect(mocks.getDb).not.toHaveBeenCalled();
});

const payload = (
  items: { name: string; sku?: string | null }[],
  mode: "skip" | "update" = "skip",
) => {
  const form = new FormData();
  form.set("confirm", "on");
  form.set(
    "items",
    JSON.stringify({
      mode,
      items: items.map((data, index) => ({ row: index + 2, data })),
    }),
  );
  return form;
};

it("will not import until the confirmation box is ticked", async () => {
  const form = payload([{ name: "Model 70" }]);
  form.delete("confirm");
  const result = await confirmInventoryImport(initial, form);
  expect(result.ok).toBe(false);
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("rejects a tampered or stale preview payload", async () => {
  const form = new FormData();
  form.set("confirm", "on");
  form.set("items", '{"mode":"skip","items":[{"row":2,"data":{"name":""}}]}');
  expect((await confirmInventoryImport(initial, form)).ok).toBe(false);
  expect(mocks.getDb).not.toHaveBeenCalled();
});

it("adds new items in one batch and leaves existing ones untouched by default", async () => {
  const { insert, execute, batch } = stubInventory([
    { id: "existing", sku: null, name: "Model 70", manufacturer: "" },
  ]);
  const result = await confirmInventoryImport(
    initial,
    payload([{ name: "Model 70" }, { name: "10/22" }]),
  );
  expect(result.ok).toBe(true);
  expect(result.message).toContain("1 item added");
  expect(insert).toHaveBeenCalledWith([
    expect.objectContaining({ name: "10/22" }),
  ]);
  expect(execute).not.toHaveBeenCalled();
  expect(batch).not.toHaveBeenCalled();
});

it("updates matching items only when the client asks for it", async () => {
  const { insert, execute, batch } = stubInventory([
    { id: "existing", sku: "W-1", name: "Old name", manufacturer: "" },
  ]);
  const result = await confirmInventoryImport(
    initial,
    payload([{ name: "Model 70", sku: "W-1" }, { name: "10/22" }], "update"),
  );
  expect(result.ok).toBe(true);
  expect(result.message).toBe(
    "1 item added and 1 item updated. Nothing else was changed.",
  );
  expect(insert).toHaveBeenCalledOnce();
  expect(execute).toHaveBeenCalledOnce();
  expect(batch).toHaveBeenCalledOnce();
});

it("changes nothing when every item is already in the inventory", async () => {
  const { insert, execute } = stubInventory([
    { id: "existing", sku: null, name: "Model 70", manufacturer: "" },
  ]);
  const result = await confirmInventoryImport(
    initial,
    payload([{ name: "Model 70" }]),
  );
  expect(result.ok).toBe(true);
  expect(result.message).toContain("Nothing was changed");
  expect(insert).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
});

it("never deletes during an import", async () => {
  const remove = vi.fn();
  mocks.getDb.mockReturnValue({
    select: () => ({ from: () => ({ limit: async () => [] }) }),
    insert: () => ({ values: vi.fn().mockResolvedValue([]) }),
    delete: remove,
    execute: vi.fn(),
    batch: vi.fn(),
  });
  await confirmInventoryImport(initial, payload([{ name: "Model 70" }]));
  expect(remove).not.toHaveBeenCalled();
});

it("turns a duplicate stock number into advice the client can act on", async () => {
  mocks.getDb.mockReturnValue({
    select: () => ({ from: () => ({ limit: async () => [] }) }),
    insert: () => ({
      values: vi
        .fn()
        .mockRejectedValue(
          new Error(
            'duplicate key value violates unique constraint "inventory_sku_unique"',
          ),
        ),
    }),
  });
  const result = await confirmInventoryImport(
    initial,
    payload([{ name: "Model 70", sku: "W-1" }]),
  );
  expect(result.ok).toBe(false);
  expect(result.message).toContain("own stock number");
  expect(result.message).not.toContain("constraint");
});

it("keeps database failure details away from the client", async () => {
  mocks.getDb.mockImplementation(() => {
    throw new Error("postgres://user:secret@host/db");
  });
  const result = await confirmInventoryImport(
    initial,
    payload([{ name: "Model 70" }]),
  );
  expect(result.ok).toBe(false);
  expect(result.message).not.toContain("secret");
});
