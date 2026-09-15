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
}));
vi.mock("@/app/admin/upload", () => ({ uploadImage: mock.upload }));
vi.mock("@/app/admin/actions", () => ({
  saveContent: mock.save,
  saveBusiness: mock.business,
  deleteContent: vi.fn(),
}));
import { ContentForm } from "@/components/admin/content-form";
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

it("keeps the existing photo on upload failure and supports replacement and removal in business settings", async () => {
  mock.upload
    .mockResolvedValueOnce({ ok: false, message: "Upload failed" })
    .mockResolvedValueOnce({ ok: true, url: "/derived/replacement.webp" });
  render(
    <BusinessForm
      business={{ ...defaultBusiness, storeImageUrl: "/derived/existing.webp" }}
      uploadsConfigured
    />,
  );
  const choose = () =>
    fireEvent.change(screen.getByLabelText("Upload photo (optional)"), {
      target: {
        files: [new File(["photo"], "photo.png", { type: "image/png" })],
      },
    });
  choose();
  await screen.findByText("Upload failed");
  expect(
    (
      screen.getByLabelText(
        "Store photograph link (optional)",
      ) as HTMLInputElement
    ).value,
  ).toBe("/derived/existing.webp");
  choose();
  await screen.findByText(/Photo uploaded/);
  expect(
    (
      screen.getByLabelText(
        "Store photograph link (optional)",
      ) as HTMLInputElement
    ).value,
  ).toBe("/derived/replacement.webp");
  fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
  expect(
    (
      screen.getByLabelText(
        "Store photograph link (optional)",
      ) as HTMLInputElement
    ).value,
  ).toBe("");
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
