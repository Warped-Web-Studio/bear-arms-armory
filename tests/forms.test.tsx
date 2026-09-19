// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const mock = vi.hoisted(() => ({
  save: vi.fn(),
  business: vi.fn(),
  upload: vi.fn(),
  setup: vi.fn(),
}));
vi.mock("@/app/admin/upload", () => ({
  uploadImage: mock.upload,
  checkImageUploadSetup: mock.setup,
}));
vi.mock("@/app/admin/actions", () => ({
  saveContent: mock.save,
  saveBusiness: mock.business,
  deleteContent: vi.fn(),
}));
import { ContentForm } from "@/components/admin/content-form";
import { PhotoUpload } from "@/components/admin/photo-upload";
import { BusinessForm } from "@/components/admin/business-form";
import { defaultBusiness } from "@/lib/business";
afterEach(cleanup);
it("preserves entered values and the new record identity across successful and failed saves", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  mock.save
    .mockResolvedValueOnce({ ok: true, message: "Saved", id })
    .mockResolvedValueOnce({ ok: false, message: "Please try again" })
    .mockResolvedValueOnce({ ok: true, message: "Saved again", id });
  render(<ContentForm kind="weekly" imageLibraryConfigured={false} />);
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Community news" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "An ordinary store update." },
  });
  fireEvent.change(screen.getByLabelText("Start date"), {
    target: { value: "2026-09-01" },
  });
  fireEvent.change(screen.getByLabelText("End date"), {
    target: { value: "2026-09-30" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save highlight" }));
  await screen.findByText("Saved");
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "Community news",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save highlight" }));
  await screen.findByText("Please try again");
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
    "Community news",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save highlight" }));
  await screen.findByText("Saved again");
  expect(mock.save.mock.calls[1][1].get("id")).toBe(id);
  expect(mock.save.mock.calls[2][1].get("id")).toBe(id);
});
it("keeps business edits after a save error", async () => {
  mock.business.mockResolvedValue({ ok: false, message: "Try again" });
  render(<BusinessForm business={defaultBusiness} />);
  fireEvent.change(screen.getByLabelText("Store hours"), {
    target: { value: "Call ahead for holiday hours." },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Save business information" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("Try again"),
  );
  expect(
    (screen.getByLabelText("Store hours") as HTMLTextAreaElement).value,
  ).toBe("Call ahead for holiday hours.");
});

it("uploads from the content form, blocks saving during upload, and keeps the URL after a failed save", async () => {
  let finish!: (result: { ok: true; url: string }) => void;
  mock.upload.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  mock.save.mockResolvedValueOnce({ ok: false, message: "Save failed" });
  render(
    <ContentForm
      kind="weekly"
      imageLibraryConfigured={false}
      uploadsConfigured
    />,
  );
  const input = screen.getByLabelText("Upload photo (optional)");
  fireEvent.change(input, {
    target: {
      files: [new File(["photo"], "photo.png", { type: "image/png" })],
    },
  });
  expect(
    (
      screen.getByRole("button", {
        name: "Save highlight",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  const url = "https://res.cloudinary.com/demo/image/upload/v1/photo.png";
  await waitFor(() => expect(mock.upload).toHaveBeenCalled());
  finish({ ok: true, url });
  await screen.findByText(/Photo uploaded/);
  expect(
    (screen.getByLabelText("Image link (optional)") as HTMLInputElement).value,
  ).toBe(url);
  fireEvent.submit(
    screen.getByRole("button", { name: "Save highlight" }).closest("form")!,
  );
  await screen.findByText("Save failed");
  expect(mock.save.mock.calls[0][1].get("imageUrl")).toBe(url);
  expect(
    (screen.getByLabelText("Image link (optional)") as HTMLInputElement).value,
  ).toBe(url);
});

it("disables uploads without configuration and rejects unsupported client files", async () => {
  const view = render(
    <ContentForm kind="event" imageLibraryConfigured={false} />,
  );
  expect(
    (screen.getByLabelText("Upload photo (optional)") as HTMLInputElement)
      .disabled,
  ).toBe(true);
  view.rerender(
    <ContentForm
      kind="event"
      imageLibraryConfigured={false}
      uploadsConfigured
    />,
  );
  fireEvent.change(screen.getByLabelText("Upload photo (optional)"), {
    target: {
      files: [new File(["pdf"], "photo.pdf", { type: "application/pdf" })],
    },
  });
  expect(screen.getByRole("alert").textContent).toContain("JPEG, PNG, or WebP");
  expect(mock.upload).not.toHaveBeenCalled();
});

it("rechecks disabled uploads and enables file selection when server setup is ready", async () => {
  mock.setup.mockResolvedValueOnce({ configured: true, issues: [] });
  render(
    <PhotoUpload
      id="test-photo"
      value=""
      configured={false}
      disabled={false}
      onChange={() => {}}
      onBusyChange={() => {}}
    />,
  );
  const input = screen.getByLabelText(
    "Upload photo (optional)",
  ) as HTMLInputElement;
  expect(input.disabled).toBe(true);
  fireEvent.click(
    screen.getByRole("button", { name: "Check photo upload setup" }),
  );
  await screen.findByText("Photo uploads are available. Choose a photo above.");
  expect(input.disabled).toBe(false);
});

it("shows actionable setup details and keeps upload disabled when setup is missing", async () => {
  mock.setup.mockResolvedValueOnce({
    configured: false,
    issues: ["CLOUDINARY_API_SECRET is missing."],
  });
  render(
    <PhotoUpload
      id="test-photo"
      value=""
      configured={false}
      disabled={false}
      onChange={() => {}}
      onBusyChange={() => {}}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Check photo upload setup" }),
  );
  await screen.findByText(
    "Photo uploads are unavailable: CLOUDINARY_API_SECRET is missing.",
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "CLOUDINARY_API_SECRET is missing.",
  );
  expect(document.querySelector("details")).toBeNull();
  expect(
    (screen.getByLabelText("Upload photo (optional)") as HTMLInputElement)
      .disabled,
  ).toBe(true);
});

it("allows retry after a setup check fails", async () => {
  mock.setup.mockRejectedValueOnce(new Error("Network error"));
  render(
    <PhotoUpload
      id="test-photo"
      value=""
      configured={false}
      disabled={false}
      onChange={() => {}}
      onBusyChange={() => {}}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Check photo upload setup" }),
  );
  await screen.findByText(/Couldn’t check photo storage/);
  expect(
    (
      screen.getByRole("button", {
        name: "Check photo upload setup",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});

it("shows an explicit fallback when a failed setup check returns no useful details", async () => {
  mock.setup.mockResolvedValueOnce({ configured: false, issues: [" "] });
  render(
    <PhotoUpload
      id="test-photo"
      value=""
      configured={false}
      disabled={false}
      onChange={() => {}}
      onBusyChange={() => {}}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Check photo upload setup" }),
  );
  await screen.findByText(/The server returned no setup details/);
  expect(
    (screen.getByLabelText("Upload photo (optional)") as HTMLInputElement)
      .disabled,
  ).toBe(true);
});

vi.mock("@/lib/optimize-image", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/optimize-image")>()),
  optimizePhoto: vi.fn((file: File) => file),
}));

it("uploads, replaces, removes, and saves the managed block while retaining description", async () => {
  mock.business.mockResolvedValue({ ok: true, message: "Business saved" });
  mock.upload
    .mockResolvedValueOnce({ ok: true, url: "/derived/first.webp" })
    .mockResolvedValueOnce({ ok: true, url: "/derived/second.webp" });
  render(<BusinessForm business={defaultBusiness} uploadsConfigured />);
  const choose = (label: string) =>
    fireEvent.change(screen.getByLabelText(label), {
      target: {
        files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
  choose("Upload Photo");
  await screen.findByLabelText("Replace Photo");
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "Client description" },
  });
  choose("Replace Photo");
  await waitFor(() =>
    expect(
      (
        document.querySelector(
          '[name="accessoriesImageUrl"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("/derived/second.webp"),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save business information" }),
  );
  await screen.findByText("Business saved");
  expect(mock.business.mock.calls[0][1].get("accessoriesImageUrl")).toBe(
    "/derived/second.webp",
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Save business information" }),
  );
  await waitFor(() => expect(mock.business).toHaveBeenCalledTimes(2));
  expect(mock.business.mock.calls[1][1].get("accessoriesImageUrl")).toBe("");
  expect(mock.business.mock.calls[1][1].get("accessoriesDescription")).toBe(
    "Client description",
  );
});
