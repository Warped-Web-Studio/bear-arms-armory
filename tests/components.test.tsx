// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MapToggle } from "@/components/map-toggle";
import { Navigation } from "@/components/navigation";
afterEach(cleanup);
describe("map toggle", () => {
  it("does not mount or load an iframe until requested, and collapses again", () => {
    render(<MapToggle address="740 E. Columbus Ave., Corry, PA 16407" />);
    const button = screen.getByRole("button", { name: "Show map +" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByTitle("Bear Arms Armory location").getAttribute("src"),
    ).toContain("740%20E.");
    fireEvent.click(button);
    expect(document.querySelector("iframe")).toBeNull();
  });
});
it("closes mobile navigation after choosing a section or pressing Escape", () => {
  render(<Navigation links={[{ href: "#visit", label: "Location" }]} />);
  const toggle = screen.getByRole("button");
  fireEvent.click(toggle);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(screen.getByRole("link"));
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  fireEvent.keyDown(toggle, { key: "Escape" });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
});
