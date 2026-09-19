// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  remove: vi.fn(),
  visible: vi.fn(),
  preview: vi.fn(),
  confirm: vi.fn(),
  upload: vi.fn(),
  setup: vi.fn(),
}));
vi.mock("@/app/admin/inventory-actions", () => ({
  saveInventoryItem: mock.save,
  deleteInventoryItem: mock.remove,
  setInventoryVisible: mock.visible,
  previewInventoryImport: mock.preview,
  confirmInventoryImport: mock.confirm,
}));
vi.mock("@/app/admin/upload", () => ({
  uploadImage: mock.upload,
  checkImageUploadSetup: mock.setup,
}));
import { InventoryForm } from "@/components/admin/inventory-form";
import { InventoryImport } from "@/components/admin/inventory-import";
import { InventoryVisibility } from "@/components/admin/inventory-visibility";
afterEach(cleanup);

it("saves a new item with only a name, and asks for a photo description once a photo exists", async () => {
  mock.save.mockResolvedValue({ ok: true, message: "Item saved." });
  render(<InventoryForm uploadsConfigured />);
  expect(screen.queryByLabelText("Photo description")).toBeNull();
  fireEvent.change(screen.getByLabelText("Item name"), {
    target: { value: "Model 70" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await screen.findByText("Item saved.");
  const posted = mock.save.mock.calls[0][1] as FormData;
  expect(posted.get("name")).toBe("Model 70");
  expect(posted.get("price")).toBe("");
  expect(posted.get("published")).toBe("on");
});

it("shows the field errors the server sends back", async () => {
  mock.save.mockResolvedValue({
    ok: false,
    message: "Check the highlighted fields.",
    errors: {
      price: ["Enter a price such as 1299 or 1299.99, or leave it blank."],
    },
  });
  render(<InventoryForm />);
  fireEvent.change(screen.getByLabelText("Item name"), {
    target: { value: "Model 70" },
  });
  fireEvent.change(screen.getByLabelText("Price"), {
    target: { value: "about nine hundred" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save item" }));
  await screen.findByText(/Enter a price such as 1299/);
  expect((screen.getByLabelText("Price") as HTMLInputElement).value).toBe(
    "about nine hundred",
  );
});

it("explains that hiding inventory keeps the records", () => {
  render(<InventoryVisibility show={false} itemCount={42} />);
  expect(
    (screen.getByLabelText("Show inventory on the website") as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(document.body.textContent).toContain("42 saved items stay exactly");
});

// jsdom keeps a file input's internal value empty when `files` is assigned
// programmatically, so `required` would block submission here even though a
// real browser allows it. The attribute itself is asserted separately.
function chooseFile() {
  const input = screen.getByLabelText(/Excel spreadsheet/) as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(["x"], "inventory.xlsx")] },
  });
  input.removeAttribute("required");
  return input;
}
const plan = {
  mapped: [
    { field: "name", header: "Name" },
    { field: "price", header: "Price" },
  ],
  ignoredColumns: ["Bin"],
  blockedColumns: ["Serial Number"],
  items: [
    {
      row: 2,
      key: "item:model 70|",
      data: {
        name: "Model 70",
        manufacturer: "Winchester",
        category: "Rifles",
        caliber: ".308 Win",
        priceCents: 129_900,
        status: "available" as const,
        sku: null,
        description: "",
        imageUrl: "",
        imageAlt: "",
        published: true,
      },
    },
  ],
  errors: [{ row: 5, message: "No item name, so this row was skipped." }],
  warnings: [],
  dataRows: 2,
  truncated: false,
};

it("previews a spreadsheet, then imports only after an explicit confirmation", async () => {
  mock.preview.mockResolvedValue({
    ok: true,
    message: "Check the preview below, then confirm the import.",
    plan,
    newCount: 1,
    matchCount: 0,
  });
  mock.confirm.mockResolvedValue({
    ok: true,
    message: "1 item added. Nothing else was changed.",
  });
  render(<InventoryImport />);
  expect(screen.queryByRole("button", { name: "Import items" })).toBeNull();
  expect(
    (screen.getByLabelText(/Excel spreadsheet/) as HTMLInputElement).required,
  ).toBe(true);

  chooseFile();
  fireEvent.click(screen.getByRole("button", { name: "Check spreadsheet" }));
  await screen.findByRole("button", { name: "Import items" });

  // The preview explains what will and will not happen.
  const report = document.querySelector(".import-report") as HTMLElement;
  expect(report.textContent).toContain("Serial numbers are never published");
  expect(report.textContent).toContain("Columns we don’t use: “Bin”");
  expect(report.textContent).toContain("Name → Item name");
  expect(within(report).getByText(/No item name, so this row/)).toBeTruthy();
  expect(within(report).getByRole("cell", { name: "Model 70" })).toBeTruthy();
  expect(within(report).getByRole("cell", { name: "$1,299" })).toBeTruthy();
  expect(mock.confirm).not.toHaveBeenCalled();

  const confirm = screen.getByRole("checkbox", { name: /Add 1 new item/ });
  expect(confirm.closest("form")!.checkValidity()).toBe(false);
  fireEvent.click(confirm);
  fireEvent.click(screen.getByRole("button", { name: "Import items" }));
  await screen.findByText("Import complete");
  const posted = JSON.parse(
    String((mock.confirm.mock.calls[0][1] as FormData).get("items")),
  );
  expect(posted.mode).toBe("skip");
  expect(posted.items).toEqual([{ row: 2, data: plan.items[0].data }]);
});

it("defaults to leaving existing items alone and can be switched to updating", async () => {
  mock.preview.mockResolvedValue({
    ok: true,
    message: "ready",
    plan,
    newCount: 1,
    matchCount: 3,
  });
  mock.confirm.mockResolvedValue({ ok: false, message: "" });
  render(<InventoryImport />);
  chooseFile();
  fireEvent.click(screen.getByRole("button", { name: "Check spreadsheet" }));
  await screen.findByRole("button", { name: "Import items" });
  expect(
    (
      screen.getByRole("radio", {
        name: /Leave my existing items alone/,
      }) as HTMLInputElement
    ).checked,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole("radio", { name: /Update them with the spreadsheet/ }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /Add 1 new item/ }));
  fireEvent.click(screen.getByRole("button", { name: "Import items" }));
  await waitFor(() => expect(mock.confirm).toHaveBeenCalled());
  expect(
    JSON.parse(String((mock.confirm.mock.calls[0][1] as FormData).get("items")))
      .mode,
  ).toBe("update");
});

it("offers a clean form for a second import after the first one finishes", async () => {
  mock.preview.mockResolvedValue({
    ok: true,
    message: "ready",
    plan,
    newCount: 1,
    matchCount: 0,
  });
  mock.confirm.mockResolvedValue({ ok: true, message: "1 item added." });
  render(<InventoryImport />);
  chooseFile();
  fireEvent.click(screen.getByRole("button", { name: "Check spreadsheet" }));
  await screen.findByRole("button", { name: "Import items" });
  fireEvent.click(screen.getByRole("checkbox", { name: /Add 1 new item/ }));
  fireEvent.click(screen.getByRole("button", { name: "Import items" }));
  await screen.findByText("Import complete");
  expect(screen.queryByLabelText(/Excel spreadsheet/)).toBeNull();

  fireEvent.click(
    screen.getByRole("button", { name: "Import another spreadsheet" }),
  );
  expect(screen.queryByText("Import complete")).toBeNull();
  expect(screen.queryByRole("button", { name: "Import items" })).toBeNull();
  expect(
    (screen.getByLabelText(/Excel spreadsheet/) as HTMLInputElement).value,
  ).toBe("");
});

it("shows a rejected spreadsheet as an error and offers nothing to import", async () => {
  mock.preview.mockResolvedValue({
    ok: false,
    message:
      "This looks like an older Excel file (.xls). Open it in Excel, choose File → Save As, pick “Excel Workbook (.xlsx)”, then upload the new file.",
  });
  render(<InventoryImport />);
  chooseFile();
  fireEvent.click(screen.getByRole("button", { name: "Check spreadsheet" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toContain("Save As");
  expect(screen.queryByRole("button", { name: "Import items" })).toBeNull();
});
