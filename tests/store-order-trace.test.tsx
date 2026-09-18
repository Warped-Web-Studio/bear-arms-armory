// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
const actions = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/admin/actions", () => ({ saveBusiness: actions.save }));
vi.mock("@/app/admin/upload", () => ({
  uploadImage: vi.fn(),
  checkImageUploadSetup: vi.fn(),
}));
import { BusinessForm } from "@/components/admin/business-form";
import { defaultBusiness } from "@/lib/business";
afterEach(cleanup);
it.each([
  [1, "later", "BAC"],
  [2, "later", "ACB"],
  [3, "later", "ABC"],
  [3, "earlier", "ACB"],
  [2, "earlier", "BAC"],
  [1, "earlier", "ABC"],
])("traces photograph %i moving %s to %s", (position, direction, expected) => {
  render(
    <StrictMode>
      <BusinessForm
        business={{
          ...defaultBusiness,
          storePhotos: ["A", "B", "C"].map((description) => ({
            url: `/derived/${description}.webp`,
            description,
          })),
        }}
        uploadsConfigured
      />
    </StrictMode>,
  );
  const button = screen.queryByRole("button", {
    name: `Move photograph ${position} ${direction}`,
  });
  if (expected === "ABC") expect(button).toBeNull();
  else {
    expect(button).not.toBeNull();
    fireEvent.click(button!);
  }
  const order = screen
    .getAllByLabelText(/Photograph \d description/)
    .map((input) => (input as HTMLInputElement).value)
    .join("");
  expect(order).toBe(expected);
  expect(actions.save).not.toHaveBeenCalled();
});
