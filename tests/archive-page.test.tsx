// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ archive: vi.fn() }));
vi.mock("@/lib/archive-data", () => ({ getArchive: mocks.archive }));
import Gallery, { metadata } from "@/app/gallery/page";
import { archiveOptions } from "@/lib/archive";
afterEach(cleanup);
const empty = {
  ...archiveOptions({}, "2026-09-18"),
  monthly: [],
  weekly: [],
  moreMonthly: false,
  moreWeekly: false,
  olderMonth: null,
  unavailable: false,
};
it("handles empty categories without meaningless month headings or View More", async () => {
  mocks.archive.mockResolvedValue(empty);
  render(await Gallery({ searchParams: Promise.resolve({}) }));
  expect(
    screen.getByRole("heading", { name: "Featured This Month" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: "Featured This Week" }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  expect(
    screen.getByText("No archived weekly highlights for September 2026."),
  ).toBeTruthy();
  expect(screen.queryByRole("link", { name: /View More/ })).toBeNull();
  expect(
    screen
      .getByRole("link", { name: /Back to the main site/ })
      .getAttribute("href"),
  ).toBe("/#gallery");
});
it("View More navigates to one older month and preserves monthly pagination", async () => {
  mocks.archive.mockResolvedValue({
    ...empty,
    olderMonth: "2026-07",
    monthlyPage: 2,
  });
  render(await Gallery({ searchParams: Promise.resolve({}) }));
  const href = screen
    .getByRole("link", { name: /View More/ })
    .getAttribute("href")!;
  expect(href).toContain("weekly=2026-07");
  expect(href).toContain("weeklyPage=1");
  expect(href).toContain("monthlyPage=2");
  expect(href).toContain("#weekly-archive");
  expect(screen.queryByRole("heading", { name: "July 2026" })).toBeNull();
});
it("renders grouped entries with exact date ranges, photos optional, and a return to current month", async () => {
  mocks.archive.mockResolvedValue({
    ...empty,
    month: "2025-12",
    weekly: [
      {
        id: "internal",
        title: "Sample weekly highlight",
        description: "Existing description",
        startsOn: "2025-12-28",
        endsOn: "2026-01-03",
        imageUrl: "",
        imageAlt: "",
        createdAt: new Date(),
      },
    ],
  });
  const { container } = render(
    await Gallery({ searchParams: Promise.resolve({ weekly: "2025-12" }) }),
  );
  expect(screen.getByRole("heading", { name: "December 2025" })).toBeTruthy();
  expect(screen.getByText("December 28, 2025 – January 3, 2026")).toBeTruthy();
  expect(screen.getByText("Existing description")).toBeTruthy();
  expect(container.querySelector(".content-image")).toBeNull();
  expect(container.textContent).not.toContain("internal");
  expect(
    screen
      .getByRole("link", { name: "Back to current month" })
      .getAttribute("href"),
  ).toContain("weekly=2026-09");
});
it("provides archive-specific metadata without overriding the site's indexing policy", () => {
  expect(metadata.alternates?.canonical).toBe("/gallery");
  expect(metadata.title).toContain("Gallery");
  expect(metadata.robots).toBeUndefined();
});
it("shows a recoverable service error rather than misleading empty history", async () => {
  mocks.archive.mockResolvedValue({ ...empty, unavailable: true });
  render(await Gallery({ searchParams: Promise.resolve({}) }));
  expect(screen.getByRole("status").textContent).toContain(
    "temporarily unavailable",
  );
  expect(screen.queryByText(/No archived weekly/)).toBeNull();
});
