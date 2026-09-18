// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ business: vi.fn(), content: vi.fn() }));
vi.mock("@/lib/data", () => ({
  getBusiness: mocks.business,
  getPublicContent: mocks.content,
}));
import Home from "@/app/page";
import { defaultBusiness } from "@/lib/business";
import type { ContentKind } from "@/lib/content";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([true, false])(
  "renders every public photo location with images=%s without empty media wrappers",
  async (withImages) => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const record = (kind: ContentKind, id = kind) => ({
      id,
      kind,
      title: `Sample ${id}`,
      description: `Sample ${id} description`,
      imageUrl: withImages ? `/derived/${id}.webp` : "",
      imageAlt: `Sample ${id} photograph`,
      startsOn: "2026-09-01",
      endsOn: "2026-09-30",
      startTime: "10:00",
      endTime: "16:00",
      location: "",
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.business.mockResolvedValue({
      ...defaultBusiness,
      storePhotos: withImages
        ? [
            {
              url: "/derived/store.webp",
              description: "Sample store photograph",
            },
          ]
        : [],
    });
    mocks.content.mockResolvedValue({
      weekly: record("weekly"),
      monthly: record("monthly"),
      announcements: [record("announcement")],
      events: [record("event")],
      archive: [record("weekly", "monthly")],
      hasMore: false,
      unavailable: false,
    });
    const { container } = render(
      await Home({ searchParams: Promise.resolve({}) }),
    );
    // Check weekly and monthly independently, plus every other uploaded-photo path.
    for (const selector of [
      "#weekly",
      "#monthly",
      ".announcements",
      "#events",
      "#gallery",
    ]) {
      const section = container.querySelector(selector)!;
      expect(section).not.toBeNull();
      expect(within(section as HTMLElement).queryAllByRole("img")).toHaveLength(
        withImages ? 1 : 0,
      );
      expect(section.querySelectorAll(".content-image")).toHaveLength(
        withImages ? 1 : 0,
      );
      expect(section.textContent).toContain("Sample");
    }
    const store = container.querySelector("#about")!;
    expect(store.querySelectorAll(".store-carousel")).toHaveLength(
      withImages ? 1 : 0,
    );
    expect(within(store as HTMLElement).queryAllByRole("img")).toHaveLength(
      withImages ? 1 : 0,
    );
    if (!withImages) {
      expect(
        container.querySelector("#weekly")?.classList.contains("text-only"),
      ).toBe(true);
      expect(
        container.querySelector("#monthly")?.classList.contains("text-only"),
      ).toBe(true);
      expect(
        container
          .querySelector(".gallery-card")
          ?.classList.contains("no-image"),
      ).toBe(true);
    }
  },
);
