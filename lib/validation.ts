import { z } from "zod";
import { contentKinds } from "./content";

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
  })
  .refine((data) => !data.storeImageUrl || !!data.storeImageAlt, {
    path: ["storeImageAlt"],
    message: "Describe the store photograph.",
  });
