// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  business: vi.fn(),
  inventory: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getBusiness: mocks.business,
  getPublicInventory: mocks.inventory,
  getPublicContent: async () => ({
    archive: [],
    events: [],
    announcements: [],
    hasMore: false,
    unavailable: false,
  }),
}));
import Home from "@/app/page";
import { defaultBusiness } from "@/lib/business";
import type { InventoryRecord } from "@/lib/inventory";

const item = (overrides: Partial<InventoryRecord> = {}): InventoryRecord => ({
  id: "1",
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
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function stubMatchMedia() {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}
const page = async (
  items: InventoryRecord[],
  showInventory = true,
  hasMore = false,
) => {
  stubMatchMedia();
  mocks.business.mockResolvedValue({ ...defaultBusiness, showInventory });
  mocks.inventory.mockImplementation(async (visible: boolean) => ({
    items: visible ? items : [],
    hasMore: visible && hasMore,
  }));
  render(await Home({ searchParams: Promise.resolve({}) }));
};

it("hides the section and its navigation link when the client turns inventory off", async () => {
  await page([item()], false);
  expect(mocks.inventory).toHaveBeenCalledWith(false);
  expect(document.querySelector("#inventory")).toBeNull();
  expect(
    screen.queryByRole("heading", { name: /Current inventory/ }),
  ).toBeNull();
  expect(screen.queryByRole("link", { name: "Inventory" })).toBeNull();
});

it("leaves no empty section when inventory is on but nothing is published", async () => {
  await page([]);
  expect(document.querySelector("#inventory")).toBeNull();
  expect(screen.queryByRole("link", { name: "Inventory" })).toBeNull();
});

it("shows items with and without a photo, and never offers to sell one", async () => {
  await page([
    item({ id: "1", imageUrl: "/derived/rifle.webp", imageAlt: "A rifle" }),
    item({ id: "2", name: "10/22", imageUrl: "", priceCents: null }),
  ]);
  const section = document.querySelector("#inventory")!;
  expect(
    within(section as HTMLElement)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(["Model 70", "10/22"]);
  expect(section.querySelectorAll("img")).toHaveLength(1);
  expect(section.querySelector(".inventory-card.no-image")).not.toBeNull();
  expect(section.textContent).toContain("$1,299");
  expect(section.textContent).toContain("Call for price");
  expect(
    within(section as HTMLElement).queryByRole("button", {
      name: /buy|cart|checkout|reserve|order/i,
    }),
  ).toBeNull();
  expect(section.textContent).toContain(
    "Nothing is sold or reserved through this website",
  );
  expect(screen.getByRole("link", { name: "Inventory" })).toBeTruthy();
});

it("marks items that are not available and groups by category", async () => {
  await page([
    item({ id: "1", category: "Rifles" }),
    item({ id: "2", name: "Shield", category: "Handguns", status: "sold" }),
  ]);
  const section = document.querySelector("#inventory") as HTMLElement;
  expect(
    within(section)
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(["Rifles", "Handguns"]);
  expect(
    within(section)
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent),
  ).toEqual(["Model 70", "Shield"]);
  expect(within(section).getByText("Sold")).toBeTruthy();
  expect(within(section).queryByText("Available")).toBeNull();
});

it("says the list is partial rather than cutting it off silently", async () => {
  await page([item()], true, true);
  const section = document.querySelector("#inventory")!;
  expect(section.textContent).toContain("call or stop in for the full list");
  cleanup();
  await page([item()]);
  expect(document.querySelector("#inventory")!.textContent).not.toContain(
    "full list",
  );
});

it("keeps the rest of the page intact when inventory appears", async () => {
  await page([item()]);
  expect(screen.getByRole("heading", { name: /Our store/ })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Email Us" })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Follow Us on Facebook" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: /Find us in Corry/ }),
  ).toBeTruthy();
});
