import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));
import { checkImageUploadSetup, uploadImage } from "@/app/admin/upload";
import { allowedImageUrl } from "@/lib/validation";
import { MAX_IMAGE_BYTES } from "@/lib/image-upload";

const fetchMock = vi.fn();
const url =
  "https://res.cloudinary.com/store-test/image/upload/v1/bear-arms-armory/photo.png";
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const form = (
  file: File | string = new File([png], "personal-name.png", {
    type: "image/png",
  }),
) => {
  const data = new FormData();
  data.set("file", file);
  return data;
};
beforeEach(() => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "store-test");
  vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
  vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");
  vi.stubEnv("IMAGE_HOST", "");
  vi.stubGlobal("fetch", fetchMock);
  mocks.requireAdmin.mockResolvedValue({ id: "admin" });
  fetchMock.mockResolvedValue(
    Response.json({
      secure_url: url,
      resource_type: "image",
      format: "png",
      width: 10,
      height: 10,
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("authorizes before accepting or storing a file", async () => {
  mocks.requireAdmin.mockRejectedValue(new Error("Unauthorized"));
  await expect(uploadImage(form())).rejects.toThrow("Unauthorized");
  expect(fetchMock).not.toHaveBeenCalled();
});
it("reports missing setup without contacting storage", async () => {
  vi.stubEnv("CLOUDINARY_API_SECRET", "");
  expect(await uploadImage(form())).toMatchObject({
    ok: false,
    message: expect.stringContaining("not set up"),
  });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("rejects missing, empty, oversized, unsupported, and disguised files before storage", async () => {
  const inputs = [
    new FormData(),
    form("https://example.com/photo.png"),
    form(new File([], "empty.png", { type: "image/png" })),
    form(
      new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "big.png", {
        type: "image/png",
      }),
    ),
    form(new File(["<svg/>"], "photo.svg", { type: "image/svg+xml" })),
    form(new File(["<svg/>"], "photo.png", { type: "image/png" })),
  ];
  for (const input of inputs) expect((await uploadImage(input)).ok).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("uploads a signed raster file and returns only a persistent URL", async () => {
  expect(await uploadImage(form())).toEqual({ ok: true, url });
  const [endpoint, options] = fetchMock.mock.calls[0];
  expect(endpoint).toBe(
    "https://api.cloudinary.com/v1_1/store-test/image/upload",
  );
  const body = options.body as FormData;
  expect(body.get("allowed_formats")).toBe("jpg,png,webp");
  expect(body.get("overwrite")).toBe("false");
  expect((body.get("file") as File).name).toBe("photo.png");
  expect(body.get("public_id")).toMatch(/^bear-arms-armory\/[a-f0-9-]+$/);
  const expectedSignature = createHash("sha256")
    .update(
      `allowed_formats=jpg,png,webp&overwrite=false&public_id=${body.get("public_id")}&timestamp=${body.get("timestamp")}test-secret`,
    )
    .digest("hex");
  expect(body.get("signature")).toBe(expectedSignature);
  expect(body.has("api_secret")).toBe(false);
  expect(allowedImageUrl(url)).toBe(true);
});
it.each([
  new Uint8Array([255, 216, 255, 224]),
  new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]),
])("accepts JPEG and WebP headers for provider decoding", async (bytes) => {
  const type = bytes[0] === 255 ? "image/jpeg" : "image/webp";
  expect(
    (await uploadImage(form(new File([bytes], "photo", { type })))).ok,
  ).toBe(true);
});
it("returns safe failures for rejected, corrupt, or unavailable storage responses", async () => {
  for (const response of [
    Response.json({ error: "secret" }, { status: 400 }),
    Response.json({ secure_url: "https://evil.example/photo.png" }),
    Response.json({ secure_url: url, resource_type: "raw", format: "png" }),
    new Response("invalid JSON"),
  ]) {
    fetchMock.mockResolvedValueOnce(response);
    const result = await uploadImage(form());
    expect(result).toMatchObject({
      ok: false,
      message: expect.stringContaining("couldn’t upload"),
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  }
  fetchMock.mockRejectedValueOnce(new Error("private credentials"));
  expect((await uploadImage(form())).ok).toBe(false);
});
it("allows only this Cloudinary account and keeps URLs usable without upload credentials", () => {
  vi.stubEnv("CLOUDINARY_API_SECRET", "");
  expect(allowedImageUrl(url)).toBe(true);
  for (const bad of [
    url.replace("store-test/", "other-account/"),
    url.replace("image/upload", "raw/upload"),
    url.replace(".png", ".svg"),
    url.replace("https:", "http:"),
    `${url}?x=1`,
    `${url}#x`,
    url.replace("res.cloudinary.com", "res.cloudinary.com.evil.example"),
  ]) {
    expect(allowedImageUrl(bad)).toBe(false);
  }
});

it("requires authentication for setup diagnostics", async () => {
  mocks.requireAdmin.mockRejectedValueOnce(new Error("Unauthorized"));
  await expect(checkImageUploadSetup()).rejects.toThrow("Unauthorized");
});

it("identifies invalid and missing settings without returning values", async () => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "https://private-invalid.example");
  vi.stubEnv("CLOUDINARY_API_KEY", " ");
  const result = await checkImageUploadSetup();
  expect(result.configured).toBe(false);
  expect(result.issues).toEqual([
    expect.stringContaining("CLOUDINARY_CLOUD_NAME is invalid"),
    "CLOUDINARY_API_KEY is missing.",
  ]);
  expect(JSON.stringify(result)).not.toMatch(/private-invalid|test-secret/);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("accepts surrounding whitespace in the cloud name consistently for upload and delivery", async () => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", " store-test\n");
  expect(await checkImageUploadSetup()).toEqual({
    configured: true,
    issues: [],
  });
  expect(await uploadImage(form())).toEqual({ ok: true, url });
  expect(allowedImageUrl(url)).toBe(true);
});

it("reports missing cloud name and whitespace in credentials", async () => {
  vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
  vi.stubEnv("CLOUDINARY_API_SECRET", " test-secret ");
  expect(await checkImageUploadSetup()).toEqual({
    configured: false,
    issues: [
      "CLOUDINARY_CLOUD_NAME is missing.",
      "CLOUDINARY_API_SECRET contains leading or trailing whitespace.",
    ],
  });
});
