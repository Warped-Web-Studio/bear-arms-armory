// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  optimizePhoto,
  originalPhotoError,
  photoDimensions,
  MAX_ORIGINAL_BYTES,
} from "@/lib/optimize-image";

afterEach(() => vi.unstubAllGlobals());
it.each([
  [6000, 4000, 2400, 1600],
  [4000, 6000, 1600, 2400],
  [640, 480, 640, 480],
  [12000, 8000, 2400, 1600],
])("fits %s × %s without stretching or upscaling", (w, h, width, height) => {
  expect(photoDimensions(w, h)).toEqual({ width, height });
});
it("bounds originals, rejects unsupported files, and bounds decoded pixels", () => {
  expect(
    originalPhotoError({ size: 8_000_000, type: "image/jpeg" }),
  ).toBeNull();
  for (const file of [
    { size: MAX_ORIGINAL_BYTES + 1, type: "image/jpeg" },
    { size: 0, type: "image/png" },
    { size: 100, type: "image/svg+xml" },
  ])
    expect(originalPhotoError(file)).toBeTruthy();
  expect(() => photoDimensions(20000, 20000)).toThrow();
});
it.each(["image/jpeg", "image/png", "image/webp"])(
  "prepares a large %s with orientation and releases resources",
  async (type) => {
    const close = vi.fn();
    const decode = vi
      .fn()
      .mockResolvedValue({ width: 4000, height: 6000, close });
    vi.stubGlobal("createImageBitmap", decode);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (callback, outputType) {
        callback(new Blob(["encoded"], { type: outputType }));
      },
    );
    const original = new File(
      [new Uint8Array(5_000_000)],
      "private-location.jpg",
      { type },
    );
    const result = await optimizePhoto(original);
    expect(result.size).toBeLessThan(4_000_000);
    expect(result.name).not.toContain("private");
    expect(decode).toHaveBeenCalledWith(original, {
      imageOrientation: "from-image",
    });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 2400);
    expect(close).toHaveBeenCalledOnce();
  },
);
it("rejects decoding and encoding failures with a safe message", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockRejectedValue(new Error("internal")),
  );
  const file = new File(["bad"], "photo.jpg", { type: "image/jpeg" });
  await expect(optimizePhoto(file)).rejects.toThrow(
    "We couldn't process this photo",
  );
  const close = vi.fn();
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 10, height: 10, close }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(null),
  );
  await expect(optimizePhoto(file)).rejects.toThrow(
    "We couldn't process this photo",
  );
  expect(close).toHaveBeenCalledOnce();
});
it("tries bounded quality adjustments and rejects output still over the server limit", async () => {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 10, height: 10, close: vi.fn() }),
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  const encode = vi
    .spyOn(HTMLCanvasElement.prototype, "toBlob")
    .mockImplementation((callback) =>
      callback(new Blob([new Uint8Array(4_000_001)], { type: "image/jpeg" })),
    );
  await expect(
    optimizePhoto(new File(["photo"], "photo.jpg", { type: "image/jpeg" })),
  ).rejects.toThrow();
  expect(encode).toHaveBeenCalledTimes(3);
});
