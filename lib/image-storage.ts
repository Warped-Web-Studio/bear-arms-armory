import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { cloudinaryName, isCloudinaryImage } from "./image-sources";

export function imageUploadsConfigured() {
  return imageUploadSetupIssues().length === 0;
}

// Return setting names only, never credential values or provider responses.
export function imageUploadSetupIssues(): string[] {
  const issues: string[] = [];
  if (!process.env.CLOUDINARY_CLOUD_NAME?.trim()) {
    issues.push("CLOUDINARY_CLOUD_NAME is missing.");
  } else if (!cloudinaryName()) {
    issues.push(
      "CLOUDINARY_CLOUD_NAME is invalid. Use only the cloud name, without a URL or quotation marks.",
    );
  }
  for (const name of ["CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
    if (!process.env[name]?.trim()) issues.push(`${name} is missing.`);
    else if (process.env[name] !== process.env[name]?.trim()) {
      issues.push(`${name} contains leading or trailing whitespace.`);
    }
  }
  return issues;
}

// The admin action only depends on this URL-returning boundary. A future storage
// provider can replace this function without changing forms or database columns.
export async function storeImage(file: File): Promise<string> {
  if (!imageUploadsConfigured())
    throw new Error("Image storage is not configured.");
  const params = {
    allowed_formats: "jpg,png,webp",
    overwrite: "false",
    public_id: `bear-arms-armory/${randomUUID()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  // Cloudinary's documented REST signing protocol, using Node's SHA-256.
  // https://cloudinary.com/documentation/authentication_signatures
  const signature = createHash("sha256")
    .update(
      Object.entries(params)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("&") + process.env.CLOUDINARY_API_SECRET,
    )
    .digest("hex");
  const body = new FormData();
  for (const [key, value] of Object.entries(params)) body.set(key, value);
  body.set("signature", signature);
  body.set("api_key", process.env.CLOUDINARY_API_KEY!);
  // Do not send the user's original filename or any client-supplied upload parameters.
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type];
  body.set("file", file, `photo.${extension}`);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudinaryName()}/image/upload`,
    {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok) throw new Error("Image storage rejected the upload.");
  const result = await response.json();
  if (
    typeof result.secure_url !== "string" ||
    !isCloudinaryImage(new URL(result.secure_url)) ||
    result.resource_type !== "image" ||
    !["jpg", "png", "webp"].includes(result.format) ||
    !(result.width > 0 && result.height > 0)
  ) {
    throw new Error("Image storage returned an invalid image.");
  }
  return result.secure_url;
}
