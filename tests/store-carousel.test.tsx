// @vitest-environment jsdom
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StoreCarousel } from "@/components/store-carousel";
const photos = [
  { url: "/derived/landscape.webp", description: "Wide store photograph" },
  { url: "/derived/portrait.webp", description: "Tall store photograph" },
  { url: "/derived/square.webp", description: "Square store photograph" },
];
let reduce = false;
let motionChange: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  reduce = false;
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduce,
      addEventListener: (_event: string, listener: () => void) => {
        motionChange = listener;
      },
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function advance(ms = 6000) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
function image() {
  return screen.getByRole("img").getAttribute("alt");
}
async function finishImage() {
  const incoming = document.querySelector(".incoming-slide")!;
  await act(async () => {
    fireEvent.load(incoming);
  });
  if (!reduce) advance(32);
  advance(reduce ? 0 : 900);
}
const next = () =>
  screen.getByRole("button", { name: "Next store photograph" });
it("renders nothing for zero photos", () => {
  const { container } = render(<StoreCarousel photos={[]} />);
  expect(container.innerHTML).toBe("");
});
it("shows one photo without controls or automatic advancement", () => {
  render(<StoreCarousel photos={photos.slice(0, 1)} />);
  expect(image()).toBe(photos[0].description);
  expect(screen.queryByRole("button")).toBeNull();
  advance(18000);
  expect(image()).toBe(photos[0].description);
});
it("loads only the incoming image, retains the current image until ready, then crossfades and wraps", async () => {
  render(<StoreCarousel photos={photos} />);
  expect(screen.queryByRole("button", { name: /slideshow/i })).toBeNull();
  expect(document.querySelectorAll("img")).toHaveLength(1);
  advance(5999);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  advance(1);
  expect(document.querySelectorAll("img")).toHaveLength(2);
  advance(20000);
  expect(image()).toBe(photos[0].description);
  expect(document.querySelector(".is-changing")).toBeNull();
  await finishImage();
  expect(image()).toBe(photos[1].description);
  expect(document.querySelectorAll("img")).toHaveLength(1);
  advance();
  await finishImage();
  advance();
  await finishImage();
  expect(image()).toBe(photos[0].description);
});
it("previous and next wrap, ignore duplicate clicks while loading, and reset the timer", async () => {
  render(<StoreCarousel photos={photos} />);
  advance(5000);
  fireEvent.click(
    screen.getByRole("button", { name: "Previous store photograph" }),
  );
  fireEvent.click(next());
  await finishImage();
  expect(image()).toBe(photos[2].description);
  advance(1000);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  fireEvent.click(next());
  await finishImage();
  expect(image()).toBe(photos[0].description);
  advance(5999);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  advance(1);
  await finishImage();
  expect(image()).toBe(photos[1].description);
});
it("pauses on hover and focus and waits a full interval after leaving", async () => {
  render(<StoreCarousel photos={photos} />);
  const region = screen.getByRole("region");
  fireEvent.mouseEnter(region);
  advance(18000);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  fireEvent.mouseLeave(region);
  advance();
  await finishImage();
  expect(image()).toBe(photos[1].description);
  const button = next();
  act(() => button.focus());
  advance(18000);
  expect(document.activeElement).toBe(button);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  fireEvent.click(button);
  await finishImage();
  expect(document.activeElement).toBe(button);
  expect(image()).toBe(photos[2].description);
  act(() => button.blur());
  advance(5999);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  advance(1);
  await finishImage();
  expect(image()).toBe(photos[0].description);
});
it("disables autoplay for reduced motion and switches images without a fade delay", async () => {
  reduce = true;
  render(<StoreCarousel photos={photos} />);
  advance(18000);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  fireEvent.click(next());
  await finishImage();
  expect(image()).toBe(photos[1].description);
  act(() => {
    reduce = false;
    motionChange();
  });
  advance();
  await finishImage();
  expect(image()).toBe(photos[2].description);
  act(() => {
    reduce = true;
    motionChange();
  });
  advance(18000);
  expect(document.querySelector(".incoming-slide")).toBeNull();
});
it("keeps the current photograph on load failure and allows a retry", async () => {
  render(<StoreCarousel photos={photos} />);
  fireEvent.click(next());
  fireEvent.error(document.querySelector(".incoming-slide")!);
  expect(screen.getByRole("status").textContent).toContain(
    "could not be loaded",
  );
  expect(image()).toBe(photos[0].description);
  expect(next().getAttribute("aria-disabled")).toBe("false");
  fireEvent.click(next());
  await finishImage();
  expect(image()).toBe(photos[1].description);
});
it("pauses in a hidden browser tab", async () => {
  render(<StoreCarousel photos={photos} />);
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  fireEvent(document, new Event("visibilitychange"));
  advance(18000);
  expect(document.querySelector(".incoming-slide")).toBeNull();
  hidden.mockReturnValue(false);
  fireEvent(document, new Event("visibilitychange"));
  advance();
  await finishImage();
  expect(image()).toBe(photos[1].description);
});

it("keeps the same two image elements throughout the overlapping fade and retains the loaded incoming node afterward", async () => {
  render(<StoreCarousel photos={photos} />);
  const outgoing = screen.getByRole("img");
  fireEvent.click(next());
  const incoming = document.querySelector(".incoming-slide")!;
  await act(async () => {
    fireEvent.load(incoming);
  });
  expect(document.querySelector(".is-changing")).toBeNull();
  advance(32);
  expect(document.querySelector(".is-changing")).not.toBeNull();
  advance(450);
  expect(document.querySelector(".current-slide")).toBe(outgoing);
  expect(document.querySelector(".incoming-slide")).toBe(incoming);
  expect(document.querySelectorAll("img")).toHaveLength(2);
  // Burst clicks cannot replace either layer during the transition.
  act(() => {
    for (let i = 0; i < 10; i++) next().click();
  });
  expect(document.querySelector(".incoming-slide")).toBe(incoming);
  advance(449);
  expect(document.querySelectorAll("img")).toHaveLength(2);
  advance(1);
  expect(screen.getByRole("img")).toBe(incoming);
  expect(outgoing.isConnected).toBe(false);
  expect(document.querySelectorAll("img")).toHaveLength(1);
});

it("locks navigation synchronously against opposite-direction clicks in the same event batch", async () => {
  render(<StoreCarousel photos={photos} />);
  act(() => {
    next().click();
    screen.getByRole("button", { name: "Previous store photograph" }).click();
  });
  await finishImage();
  expect(image()).toBe(photos[1].description);
});

it("finishes safely when reduced motion is enabled during a crossfade", async () => {
  render(<StoreCarousel photos={photos} />);
  fireEvent.click(next());
  const incoming = document.querySelector(".incoming-slide")!;
  await act(async () => {
    fireEvent.load(incoming);
  });
  advance(32);
  advance(200);
  act(() => {
    reduce = true;
    motionChange();
  });
  advance(0);
  expect(screen.getByRole("img")).toBe(incoming);
  expect(document.querySelectorAll("img")).toHaveLength(1);
  advance(18000);
  expect(document.querySelectorAll("img")).toHaveLength(1);
});
