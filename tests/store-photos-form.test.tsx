// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
const mocks = vi.hoisted(() => ({ save: vi.fn(), upload: vi.fn() }));
vi.mock("@/app/admin/actions", () => ({ saveBusiness: mocks.save }));
vi.mock("@/app/admin/upload", () => ({
  uploadImage: mocks.upload,
  checkImageUploadSetup: vi.fn(),
}));
import { BusinessForm } from "@/components/admin/business-form";
import { defaultBusiness, getStorePhotos, type Business } from "@/lib/business";
import { businessSchema } from "@/lib/validation";
afterEach(cleanup);
const legacy = {
  ...defaultBusiness,
  storeImageUrl: "/derived/original.webp",
  storeImageAlt: "Store entrance",
};
function saveButton() {
  return screen.getByRole("button", {
    name: "Save business information",
  }) as HTMLButtonElement;
}
function gallery() {
  return JSON.parse(
    String(new FormData(saveButton().closest("form")!).get("storePhotos")),
  );
}
function upload(label: string) {
  fireEvent.change(screen.getByLabelText(label), {
    target: {
      files: [new File(["photo"], "photo.png", { type: "image/png" })],
    },
  });
}
it("allows no photos and shows no description, URL or technical setup controls", async () => {
  mocks.save.mockResolvedValueOnce({
    ok: true,
    message: "Saved empty gallery",
  });
  render(<BusinessForm business={defaultBusiness} />);
  expect(gallery()).toEqual([]);
  expect(
    within(
      screen.getByRole("group", { name: "Store photographs (optional)" }),
    ).queryByLabelText(/description/i),
  ).toBeNull();
  expect(screen.queryByText(/photograph link/i)).toBeNull();
  expect(screen.queryByRole("button", { name: /setup/i })).toBeNull();
  expect(
    (screen.getByLabelText("Add a store photograph") as HTMLInputElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(saveButton());
  await screen.findByText("Saved empty gallery");
  expect(mocks.save.mock.calls[0][1].get("storePhotos")).toBe("[]");
});
it("uploads first and additional photos, blocks saving during upload, requires descriptions and reloads saved order", async () => {
  let finish!: (result: { ok: true; url: string }) => void;
  mocks.upload.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(
    <BusinessForm business={defaultBusiness} uploadsConfigured />,
  );
  upload("Add a store photograph");
  expect(saveButton().disabled).toBe(true);
  expect(
    within(
      screen.getByRole("group", { name: "Store photographs (optional)" }),
    ).queryByLabelText(/description/i),
  ).toBeNull();
  await waitFor(() => expect(mocks.upload).toHaveBeenCalled());
  finish({ ok: true, url: "/derived/first.webp" });
  const first = await screen.findByLabelText("Photograph 1 description");
  expect((first as HTMLInputElement).required).toBe(true);
  fireEvent.click(saveButton());
  expect(mocks.save).not.toHaveBeenCalled();
  fireEvent.change(first, { target: { value: "First photo" } });
  mocks.upload.mockResolvedValueOnce({ ok: true, url: "/derived/second.webp" });
  upload("Add a store photograph");
  const second = await screen.findByLabelText("Photograph 2 description");
  fireEvent.change(second, { target: { value: "Second photo" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Move photograph 2 earlier" }),
  );
  expect(
    gallery().map((photo: { description: string }) => photo.description),
  ).toEqual(["Second photo", "First photo"]);
  mocks.save.mockResolvedValueOnce({ ok: false, message: "Try saving again" });
  fireEvent.click(saveButton());
  await screen.findByText("Try saving again");
  expect(gallery()).toHaveLength(2);
  mocks.save.mockResolvedValueOnce({ ok: true, message: "Gallery saved" });
  fireEvent.click(saveButton());
  await screen.findByText("Gallery saved");
  const submitted = mocks.save.mock.calls[1][1] as FormData;
  const saved = businessSchema.parse({
    ...Object.fromEntries(submitted),
    name: defaultBusiness.name,
    storePhotos: JSON.parse(String(submitted.get("storePhotos"))),
  });
  view.unmount();
  render(<BusinessForm business={saved as Business} uploadsConfigured />);
  expect(gallery()).toEqual(saved.storePhotos);
  expect(
    (screen.getByLabelText("Photograph 1 description") as HTMLInputElement)
      .value,
  ).toBe("Second photo");
});
it("preserves legacy photo and description on failure and replacement, then removes without resurrecting it", async () => {
  const view = render(<BusinessForm business={legacy} uploadsConfigured />);
  expect(gallery()).toEqual(getStorePhotos(legacy));
  mocks.upload.mockResolvedValueOnce({ ok: false, message: "Upload failed" });
  upload("Replace photograph 1");
  await screen.findByText("Upload failed");
  expect(gallery()).toEqual(getStorePhotos(legacy));
  mocks.upload.mockResolvedValueOnce({
    ok: true,
    url: "/derived/replacement.webp",
  });
  upload("Replace photograph 1");
  await screen.findByText(/Photo uploaded/);
  expect(gallery()).toEqual([
    { url: "/derived/replacement.webp", description: "Store entrance" },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
  expect(gallery()).toEqual([]);
  expect(
    within(
      screen.getByRole("group", { name: "Store photographs (optional)" }),
    ).queryByLabelText(/description/i),
  ).toBeNull();
  expect(saveButton().closest("form")!.checkValidity()).toBe(true);
  mocks.save.mockResolvedValueOnce({ ok: true, message: "Removal saved" });
  fireEvent.click(saveButton());
  await screen.findByText("Removal saved");
  const submitted = mocks.save.mock.calls[0][1] as FormData;
  // The old fields are preserved for compatibility; the explicit empty array wins.
  expect(submitted.get("storeImageUrl")).toBe(legacy.storeImageUrl);
  view.unmount();
  render(
    <BusinessForm
      business={{ ...legacy, storePhotos: [] }}
      uploadsConfigured
    />,
  );
  expect(gallery()).toEqual([]);
  expect(screen.queryByRole("img")).toBeNull();
});
it("removes only the selected photo and keeps remaining descriptions and order", () => {
  render(
    <BusinessForm
      business={{
        ...legacy,
        storePhotos: [
          { url: "/derived/a.webp", description: "A" },
          { url: "/derived/b.webp", description: "B" },
        ],
      }}
      uploadsConfigured
    />,
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: "Photograph 1" })).getByRole(
      "button",
      { name: "Remove photo" },
    ),
  );
  expect(gallery()).toEqual([{ url: "/derived/b.webp", description: "B" }]);
});

it("hides unavailable moves after reordering and keeps the opposite direction usable", async () => {
  render(
    <BusinessForm
      business={{
        ...legacy,
        storePhotos: [
          { url: "/derived/a.webp", description: "A" },
          { url: "/derived/b.webp", description: "B" },
        ],
      }}
      uploadsConfigured
    />,
  );
  const earlier = screen.getByRole("button", {
    name: "Move photograph 2 earlier",
  }) as HTMLButtonElement;
  earlier.focus();
  fireEvent.click(earlier);
  expect(
    gallery().map((photo: { description: string }) => photo.description),
  ).toEqual(["B", "A"]);
  expect(
    screen.queryByRole("button", { name: "Move photograph 1 earlier" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Move photograph 2 later" }),
  ).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Move photograph 1 later" }),
  );
  expect(
    gallery().map((photo: { description: string }) => photo.description),
  ).toEqual(["A", "B"]);
  expect(saveButton().disabled).toBe(false);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});

it("recovers from a rejected upload and still allows reorder, removal, and saving", async () => {
  mocks.upload.mockRejectedValueOnce(new Error("Network failure"));
  mocks.save.mockResolvedValueOnce({
    ok: true,
    message: "Saved after failure",
  });
  render(
    <BusinessForm
      business={{
        ...legacy,
        storePhotos: [
          { url: "/derived/a.webp", description: "A" },
          { url: "/derived/b.webp", description: "B" },
        ],
      }}
      uploadsConfigured
    />,
  );
  upload("Add a store photograph");
  await screen.findByText(/We couldn’t upload/);
  expect(saveButton().disabled).toBe(false);
  fireEvent.click(
    screen.getByRole("button", { name: "Move photograph 1 later" }),
  );
  expect(gallery()[0].description).toBe("B");
  fireEvent.click(
    within(screen.getByRole("group", { name: "Photograph 2" })).getByRole(
      "button",
      { name: "Remove photo" },
    ),
  );
  fireEvent.click(saveButton());
  await screen.findByText("Saved after failure");
});

vi.mock("@/lib/optimize-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/optimize-image")>()),
  optimizePhoto: vi.fn((file: File) => file),
}));
