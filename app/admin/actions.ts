"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { content, settings } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { businessSchema, contentSchema } from "@/lib/validation";
import { z } from "zod";
export type SaveState = {
  message: string;
  ok: boolean;
  errors?: Record<string, string[]>;
  id?: string;
};
export async function saveContent(
  _previous: SaveState,
  form: FormData,
): Promise<SaveState> {
  await requireAdmin();
  const parsed = contentSchema.safeParse({
    ...Object.fromEntries(form),
    published: form.get("published") === "on",
  });
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  const existing = form.get("id");
  if (existing && !z.uuid().safeParse(existing).success)
    return { ok: false, message: "This record could not be found." };
  const id = existing ? String(existing) : crypto.randomUUID();
  try {
    if (existing) {
      const updated = await getDb()
        .update(content)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(content.id, id))
        .returning({ id: content.id });
      if (!updated.length)
        return {
          ok: false,
          message: "This record no longer exists. Return to the list.",
        };
    } else
      await getDb()
        .insert(content)
        .values({ ...parsed.data, id });
    revalidatePath("/");
    revalidatePath("/gallery");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Saved successfully.", id };
  } catch {
    return {
      ok: false,
      message: "We couldn’t save your changes. Please try again.",
    };
  }
}
export async function deleteContent(
  _previous: SaveState,
  form: FormData,
): Promise<SaveState> {
  await requireAdmin();
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success || form.get("confirm") !== "on")
    return { ok: false, message: "Confirm deletion to continue." };
  try {
    await getDb().delete(content).where(eq(content.id, id.data));
    revalidatePath("/");
    revalidatePath("/gallery");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Deleted successfully." };
  } catch {
    return {
      ok: false,
      message: "We couldn’t delete this record. Please try again.",
    };
  }
}
export async function saveBusiness(
  _previous: SaveState,
  form: FormData,
): Promise<SaveState> {
  await requireAdmin();
  let storePhotos: unknown;
  if (form.has("storePhotos")) {
    try {
      storePhotos = JSON.parse(String(form.get("storePhotos")));
    } catch {
      return {
        ok: false,
        message:
          "We couldn’t read the photographs. Reload the page and try again.",
        errors: { storePhotos: ["The photograph list could not be saved."] },
      };
    }
  }
  const parsed = businessSchema.safeParse({
    ...Object.fromEntries(form),
    ...(form.has("storePhotos") ? { storePhotos } : {}),
    name: "Bear Arms Armory",
  });
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  try {
    await getDb()
      .insert(settings)
      .values({ id: 1, business: parsed.data })
      .onConflictDoUpdate({
        target: settings.id,
        set: { business: parsed.data, updatedAt: new Date() },
      });
    revalidatePath("/");
    revalidatePath("/admin", "layout");
    return { ok: true, message: "Business information saved." };
  } catch {
    return {
      ok: false,
      message: "We couldn’t save these details. Please try again.",
    };
  }
}
