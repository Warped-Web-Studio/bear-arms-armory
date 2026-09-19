import { expect, it } from "vitest";
import {
  importPayloadSchema,
  MAX_IMPORT_ITEMS,
  mapColumns,
  planImport,
} from "@/lib/inventory-import";

const header = [
  "Name",
  "Manufacturer",
  "Category",
  "Caliber",
  "Price",
  "Availability",
];
const plan = (rows: string[][]) => planImport([header, ...rows]);

it("reads a straightforward sheet into database-ready items", () => {
  const result = plan([
    ["Model 70", "Winchester", "Rifles", ".308 Win", "$1,299.00", "In stock"],
    ["10/22", "Ruger", "Rifles", "22 LR", "349", "Sold"],
  ]);
  expect(result.errors).toEqual([]);
  expect(result.items.map((item) => item.data)).toEqual([
    {
      name: "Model 70",
      manufacturer: "Winchester",
      category: "Rifles",
      caliber: ".308 Win",
      priceCents: 129_900,
      status: "available",
      sku: null,
      description: "",
      imageUrl: "",
      imageAlt: "",
      published: true,
    },
    expect.objectContaining({
      name: "10/22",
      priceCents: 34_900,
      status: "sold",
    }),
  ]);
  expect(result.items.map((item) => item.row)).toEqual([2, 3]);
});

it.each([
  [["Item", "Make", "Type", "Gauge", "MSRP", "Qty"], "Qty"],
  [
    ["Model", "Brand", "Department", "Chambering", "Retail Price", "On Hand"],
    "On Hand",
  ],
  [
    ["ITEM NAME", "mfg.", "Product Type", "Cal.", "Our Price", "quantity"],
    "quantity",
  ],
])("recognises the headings a shop actually uses: %j", (headings) => {
  const { mapped } = mapColumns(headings);
  expect(mapped.map((column) => column.field)).toEqual([
    "name",
    "manufacturer",
    "category",
    "caliber",
    "price",
    "quantity",
  ]);
});

it("reports unrecognised columns instead of failing, and never imports serial numbers", () => {
  const result = planImport([
    ["Name", "Serial Number", "Vendor Cost", "Bin Location", "Price"],
    ["Model 70", "AB12345", "900", "Rack 3", "1299"],
  ]);
  expect(result.blockedColumns).toEqual(["Serial Number"]);
  expect(result.ignoredColumns).toEqual(["Vendor Cost", "Bin Location"]);
  expect(result.items).toHaveLength(1);
  expect(JSON.stringify(result.items)).not.toContain("AB12345");
});

it("stops with no items when there is no column of names", () => {
  const result = planImport([
    ["Vendor Cost", "Bin"],
    ["900", "Rack 3"],
  ]);
  expect(result.items).toEqual([]);
  expect(result.mapped).toEqual([]);
  expect(result.ignoredColumns).toEqual(["Vendor Cost", "Bin"]);
});

it("explains each bad row by its spreadsheet row number and keeps the good ones", () => {
  const result = plan([
    ["", "Winchester", "Rifles", "", "1299", ""],
    ["Good item", "Ruger", "Rifles", "", "1299", ""],
    ["Bad price", "Ruger", "Rifles", "", "about $900", ""],
    ["x".repeat(200), "Ruger", "Rifles", "", "", ""],
  ]);
  expect(result.items.map((item) => item.data.name)).toEqual(["Good item"]);
  expect(result.errors).toEqual([
    { row: 2, message: "No item name, so this row was skipped." },
    {
      row: 4,
      message: "Price “about $900” isn’t an amount such as 1299 or 1299.99.",
    },
    { row: 5, message: expect.stringContaining("Item name:") },
  ]);
});

it("skips blank rows and counts only real ones", () => {
  const result = plan([
    ["", "", "", "", "", ""],
    ["Model 70", "Winchester", "", "", "", ""],
    ["   ", "", "", "", "", ""],
  ]);
  expect(result.dataRows).toBe(1);
  expect(result.items).toHaveLength(1);
  expect(result.errors).toEqual([]);
});

it.each([
  ["In Stock", "", "available"],
  ["sold out", "", "sold"],
  ["Layaway", "", "on_hold"],
  ["", "3", "available"],
  ["", "0", "sold"],
])(
  "reads availability %j / quantity %j as %s",
  (availability, quantity, status) => {
    const result = planImport([
      ["Name", "Availability", "Qty"],
      ["Model 70", availability, quantity],
    ]);
    expect(result.items[0].data.status).toBe(status);
    expect(result.warnings).toEqual([]);
  },
);

it("keeps an item with an odd availability value and says what it did", () => {
  const result = planImport([
    ["Name", "Availability"],
    ["Model 70", "Ask Dave"],
  ]);
  expect(result.items[0].data.status).toBe("available");
  expect(result.warnings).toEqual([
    {
      row: 2,
      message:
        "Availability “Ask Dave” wasn’t recognised. Imported as Available.",
    },
  ]);
});

it("leaves out rows that repeat an earlier row of the same spreadsheet", () => {
  const result = planImport([
    ["Name", "Manufacturer", "SKU"],
    ["Model 70", "Winchester", "W-1"],
    ["model 70", "winchester", "w-1"],
    ["Model 70", "Winchester", "W-2"],
  ]);
  expect(result.items.map((item) => item.data.sku)).toEqual(["W-1", "W-2"]);
  expect(result.warnings).toEqual([
    {
      row: 3,
      message: "Repeats row 2 in this spreadsheet, so it was left out.",
    },
  ]);
});

it("uses the first non-empty row as the headings", () => {
  const result = planImport([
    ["", "", ""],
    ["Name", "Price", ""],
    ["Model 70", "1299", ""],
  ]);
  expect(result.items.map((item) => item.data.name)).toEqual(["Model 70"]);
  expect(result.items[0].row).toBe(3);
});

it("caps a very long spreadsheet and says the rest must come separately", () => {
  const rows = Array.from({ length: MAX_IMPORT_ITEMS + 5 }, (_, index) => [
    `Item ${index}`,
    "",
    "",
    "",
    "",
    "",
  ]);
  const result = plan(rows);
  expect(result.items).toHaveLength(MAX_IMPORT_ITEMS);
  expect(result.dataRows).toBe(MAX_IMPORT_ITEMS + 5);
  expect(result.errors[0].message).toContain("first 2,000 items");
});

it("re-checks the payload handed back from the preview", () => {
  const good = {
    mode: "skip",
    items: [{ row: 2, data: { name: "Model 70" } }],
  };
  expect(importPayloadSchema.parse(good).items[0].data.published).toBe(true);
  expect(
    importPayloadSchema.safeParse({ mode: "wipe", items: good.items }).success,
  ).toBe(false);
  expect(
    importPayloadSchema.safeParse({
      mode: "skip",
      items: [{ row: 2, data: { name: "" } }],
    }).success,
  ).toBe(false);
  expect(
    importPayloadSchema.safeParse({
      mode: "skip",
      items: [{ row: 2, data: { name: "x", imageUrl: "javascript:alert(1)" } }],
    }).success,
  ).toBe(false);
});
