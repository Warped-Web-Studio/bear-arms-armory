// Shared limits keep the file picker and server validation in sync.
export const MAX_IMAGE_BYTES = 4_000_000;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_UPLOAD_HELP =
  "Choose a JPEG, PNG, or WebP photo. Large photos are prepared automatically.";

export function imageFileError(file: { size: number; type: string }) {
  if (!file.size) return "Choose a photo that is not empty.";
  if (file.size > MAX_IMAGE_BYTES)
    return "This photo could not be prepared for upload. Try a different photo.";
  if (!IMAGE_TYPES.includes(file.type)) return IMAGE_UPLOAD_HELP;
  return null;
}
