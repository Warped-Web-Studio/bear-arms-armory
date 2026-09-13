// @vitest-environment jsdom
import { afterEach, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
const mock = vi.hoisted(() => ({ save: vi.fn(), business: vi.fn() }));
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
