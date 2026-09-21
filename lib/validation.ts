import { z } from "zod";
import { contentKinds } from "./content";
import { isCloudinaryImage } from "./image-sources";
import { MAX_ACCESSORIES_PHOTOS, MAX_STORE_PHOTOS } from "./business";
import { inventoryStatuses, parsePriceCents } from "./inventory";

export function allowedImageUrl(value: string) {
  if (!value) return true;
  // Public image paths do not require an external image-library host.
  // Restrict every segment to prevent traversal, encoded paths, and query strings.
  if (
    /^\/(derived|client-assets)\//.test(value) &&
    /\.(webp|png|jpg|jpeg|avif)$/i.test(value) &&
    value
      .slice(1)
      .split("/")
      .every((segment) => /^[a-z0-9][a-z0-9._ -]*$/i.test(segment))
  )
    return true;
  try {
    const url = new URL(value);
    if (isCloudinaryImage(url)) return true;
    const host = process.env.IMAGE_HOST;
    return (
      !!host &&
      url.protocol === "https:" &&
      url.hostname === host &&
      !url.username &&
      !url.password &&
      !url.port
    );
  } catch {
    return false;
  }
}
const date = z.iso.date();
const time = z.union([
  z.literal(""),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time."),
]);
export const contentSchema = z
  .object({
    kind: z.enum(contentKinds),
    title: z.string().trim().min(1, "Enter a title.").max(120),
    description: z.string().trim().min(1, "Enter a description.").max(4000),
    imageUrl: z
      .string()
      .trim()
      .max(2000)
      .refine(
        allowedImageUrl,
        "Use a local image under /client-assets/ or /derived/, or an image from the configured image library.",
      ),
    imageAlt: z.string().trim().max(250),
    startsOn: date,
    endsOn: date,
    startTime: time,
    endTime: time,
    location: z.string().trim().max(250),
    published: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.endsOn < data.startsOn)
      ctx.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "End date must be on or after the start date.",
      });
    if (data.imageUrl && !data.imageAlt)
      ctx.addIssue({
        code: "custom",
        path: ["imageAlt"],
        message: "Describe the image for visitors who cannot see it.",
      });
    if (data.kind === "event") {
      if (!data.startTime)
        ctx.addIssue({
          code: "custom",
          path: ["startTime"],
          message: "Choose a start time.",
        });
      if (
        !data.endTime ||
        (data.startsOn === data.endsOn && data.endTime <= data.startTime)
      )
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "Choose an end time after the start.",
        });
    }
  });
// Shared by the admin form and the spreadsheet importer so both accept the
// same values and produce the same database row.
export const inventorySchema = z
  .object({
    name: z.string().trim().min(1, "Enter an item name.").max(160),
    manufacturer: z.string().trim().max(120).default(""),
    category: z.string().trim().max(120).default(""),
    caliber: z.string().trim().max(120).default(""),
    priceCents: z
      .union([z.number().int().min(0).max(99_999_999), z.null()])
      .default(null),
    status: z.enum(inventoryStatuses).default("available"),
    sku: z
      .union([z.string().trim().min(1).max(80), z.null()])
      .default(null)
      .transform((value) => value || null),
    description: z.string().trim().max(4000).default(""),
    imageUrl: z
      .string()
      .trim()
      .max(2000)
      .refine(allowedImageUrl, "Upload a valid photo.")
      .default(""),
    imageAlt: z.string().trim().max(250).default(""),
    published: z.boolean().default(true),
  })
  .refine((data) => !data.imageUrl || !!data.imageAlt, {
    path: ["imageAlt"],
    message: "Describe the photo for visitors who cannot see it.",
  });
export type InventoryInput = z.infer<typeof inventorySchema>;

// The admin form posts a typed price. Convert it before validation so the
// client can enter "$1,299", "1299" or "1,299.00" and still see one clear error.
export function inventoryPrice(value: unknown) {
  const cents = parsePriceCents(String(value ?? ""));
  return cents === undefined
    ? {
        ok: false as const,
        message: "Enter a price such as 1299 or 1299.99, or leave it blank.",
      }
    : { ok: true as const, priceCents: cents };
}

const photoSchema = (name: string) =>
  z.object({
    url: z
      .string()
      .trim()
      .min(1, "Upload a photograph.")
      .max(2000)
      .refine(allowedImageUrl, `Upload a valid ${name}.`),
    description: z.string().trim().min(1, `Describe each ${name}.`).max(250),
  });

export const businessSchema = z
  .object({
    name: z.literal("Bear Arms Armory"),
    address: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(100),
    region: z.string().trim().min(2).max(50),
    postalCode: z.string().trim().min(1).max(20),
    phone: z
      .string()
      .trim()
      .regex(/^[+\d ()-]{7,30}$/, "Enter a valid phone number."),
    email: z.union([z.literal(""), z.email()]),
    accessoriesImageUrl: z
      .string()
      .trim()
      .max(2000)
      .refine(allowedImageUrl, "Upload a valid photo.")
      .default(""),
    accessoriesDescription: z.string().trim().max(4000).default(""),
    showInventory: z
      .union([z.boolean(), z.literal("true"), z.literal("false")])
      .default(false)
      .transform((value) => value === true || value === "true"),
    hours: z.string().trim().min(1).max(1500),
    about: z.string().trim().min(1).max(2500),
    storeImageUrl: z
      .string()
      .trim()
      .max(2000)
      .refine(
        allowedImageUrl,
        "Use a local image under /client-assets/ or /derived/, or an image from the configured image library.",
      ),
    storeImageAlt: z.string().trim().max(250),
    storePhotos: z
      .array(photoSchema("store photograph"))
      .max(MAX_STORE_PHOTOS, `Use up to ${MAX_STORE_PHOTOS} store photographs.`)
      .optional(),
    accessoriesPhotos: z
      .array(photoSchema("photograph"))
      .max(
        MAX_ACCESSORIES_PHOTOS,
        `Use up to ${MAX_ACCESSORIES_PHOTOS} knives, lights and optics photographs.`,
      )
      .optional(),
  })
  .refine(
    (data) =>
      data.storePhotos !== undefined ||
      !data.storeImageUrl ||
      !!data.storeImageAlt,
    {
      path: ["storeImageAlt"],
      message: "Describe the store photograph.",
    },
  );
