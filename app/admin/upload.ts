"use server";
import { requireAdmin } from "@/lib/admin";
import { imageFileError } from "@/lib/image-upload";
import {
  imageUploadsConfigured,
  imageUploadSetupIssues,
  storeImage,
} from "@/lib/image-storage";

export async function checkImageUploadSetup() {
  await requireAdmin();
  const issues = imageUploadSetupIssues();
  return { configured: issues.length === 0, issues };
}

export type UploadResult =
  { ok: true; url: string } | { ok: false; message: string };

export async function uploadImage(form: FormData): Promise<UploadResult> {
  await requireAdmin();
  if (!imageUploadsConfigured())
    return {
      ok: false,
      message:
        "Photo uploads are not set up yet. Contact your website developer.",
    };
  const file = form.get("file");
  if (!(file instanceof File))
    return { ok: false, message: "Choose a photo to upload." };
  const error = imageFileError(file);
  if (error) return { ok: false, message: error };
  try {
    // Check the bytes as well as the claimed MIME type. Cloudinary's image
    // endpoint then decodes the file and enforces the allowed raster formats.
    const bytes = Buffer.from(await file.slice(0, 12).arrayBuffer());
    const valid =
      file.type === "image/jpeg"
        ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
        : file.type === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid)
      return {
        ok: false,
        message:
          "This file is not a valid photo. Export it as JPEG, PNG, or WebP and try again.",
      };
    return { ok: true, url: await storeImage(file) };
  } catch {
    return {
      ok: false,
      message:
        "We couldn’t upload this photo. Please try again. If this continues, contact your website developer.",
    };
  }
}
