import { IMAGE_TYPES, MAX_IMAGE_BYTES } from "./image-upload";

export const MAX_ORIGINAL_BYTES = 40_000_000;
export const PHOTO_PROCESSING_ERROR =
  "We couldn't process this photo. Try a different image or a smaller original.";

export function originalPhotoError(file: { size: number; type: string }) {
  if (!file.size) return "Choose a photo that is not empty.";
  if (!IMAGE_TYPES.includes(file.type))
    return "Choose a JPEG, PNG, or WebP photo.";
  if (file.size > MAX_ORIGINAL_BYTES) return PHOTO_PROCESSING_ERROR;
  return null;
}

export function photoDimensions(width: number, height: number, edge = 2400) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 100_000_000
  )
    throw new Error(PHOTO_PROCESSING_ERROR);
  const scale = Math.min(1, edge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

// Decode EXIF orientation once, then encode the rendered pixels without original metadata.
// https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap
export async function optimizePhoto(file: File): Promise<File> {
  const error = originalPhotoError(file);
  if (error) throw new Error(error);
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const dimensions = photoDimensions(bitmap.width, bitmap.height);
    canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error(PHOTO_PROCESSING_ERROR);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // WebP preserves transparency. Browsers without a WebP encoder fall back to PNG.
    for (const quality of [0.9, 0.82, 0.74]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas!.toBlob(
          resolve,
          file.type === "image/jpeg" ? "image/jpeg" : "image/webp",
          quality,
        ),
      );
      if (!blob) throw new Error(PHOTO_PROCESSING_ERROR);
      if (
        blob.size > 0 &&
        blob.size <= MAX_IMAGE_BYTES &&
        IMAGE_TYPES.includes(blob.type)
      ) {
        const extension =
          blob.type === "image/jpeg"
            ? "jpg"
            : blob.type === "image/png"
              ? "png"
              : "webp";
        return new File([blob], `photo.${extension}`, { type: blob.type });
      }
    }
    throw new Error(PHOTO_PROCESSING_ERROR);
  } catch {
    throw new Error(PHOTO_PROCESSING_ERROR);
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
