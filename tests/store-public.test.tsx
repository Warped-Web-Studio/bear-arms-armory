// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  business: vi.fn(),
  inventory: vi.fn(async () => ({ items: [], hasMore: false })),
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
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it.each([0, 1, 3])(
  "renders Our Store with %s photos and preserves copy",
  async (count) => {
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const storePhotos = Array.from({ length: count }, (_, index) => ({
      url: `/derived/photo-${index}.webp`,
      description: `Photo ${index + 1}`,
    }));
    mocks.business.mockResolvedValue({
      ...defaultBusiness,
      about: "Existing store copy.\nPurchase Information: Keep this text.",
      storePhotos,
    });
    render(await Home({ searchParams: Promise.resolve({}) }));
    const heading = screen.getByRole("heading", { name: /Our store/ });
    const section = heading.closest("section")!;
    expect(section.textContent).toContain("Existing store copy.");
    expect(section.textContent).toContain(
      "Purchase Information: Keep this text.",
    );
    expect(section.textContent).toContain("Find us on East Columbus Avenue.");
    expect(
      within(section)
        .getByRole("link", { name: defaultBusiness.phone })
        .getAttribute("href"),
    ).toContain("tel:");
    expect(section.querySelectorAll(".store-carousel").length).toBe(
      count ? 1 : 0,
    );
    if (count) {
      expect(section.firstElementChild?.className).toBe("about-heading");
      expect(
        section.querySelector(".about-content")?.firstElementChild?.className,
      ).toBe("store-carousel");
      expect(within(section).getByRole("img").getAttribute("alt")).toBe(
        "Photo 1",
      );
    }
    expect(within(section).queryAllByRole("button").length).toBe(
      count > 1 ? 2 : 0,
    );
    expect(document.querySelector(".store-photo")).toBeNull();
  },
);

it("provides the confirmed contact links and hides the empty section", async () => {
  mocks.business.mockResolvedValue({ ...defaultBusiness, email: "" });
  render(await Home({ searchParams: Promise.resolve({}) }));
  expect(
    screen.getByRole("link", { name: "Email Us" }).getAttribute("href"),
  ).toBe("mailto:sales@beararmsarmorypa.com");
  expect(
    screen
      .getByRole("link", { name: "Follow Us on Facebook" })
      .getAttribute("href"),
  ).toBe("https://www.facebook.com/p/Bear-Arms-Armory-61554325822692/");
  expect(
    screen.queryByRole("heading", { name: "Knives, Lights and Optics" }),
  ).toBeNull();
});
it.each([
  ["", "A description"],
  ["/derived/photo.webp", ""],
  ["/derived/photo.webp", "A description"],
])(
  "renders managed content with photo %s and description %s",
  async (accessoriesImageUrl, accessoriesDescription) => {
    mocks.business.mockResolvedValue({
      ...defaultBusiness,
      facebookUrl: "https://www.facebook.com/test-fixture",
      accessoriesImageUrl,
      accessoriesDescription,
    });
    render(await Home({ searchParams: Promise.resolve({}) }));
    const section = screen
      .getByRole("heading", { name: "Knives, Lights and Optics" })
      .closest("section")!;
    expect(section.querySelectorAll("img").length).toBe(
      accessoriesImageUrl ? 1 : 0,
    );
    if (accessoriesDescription)
      expect(section.textContent).toContain(accessoriesDescription);
    const facebook = screen.getByRole("link", {
      name: "Follow Us on Facebook",
    });
    expect(facebook.getAttribute("href")).toBe(
      "https://www.facebook.com/p/Bear-Arms-Armory-61554325822692/",
    );
    expect(facebook.getAttribute("rel")).toBe("noopener noreferrer");
  },
);
