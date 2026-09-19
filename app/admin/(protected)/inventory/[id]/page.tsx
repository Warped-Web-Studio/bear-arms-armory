import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { inventory } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { imageUploadsConfigured } from "@/lib/image-storage";
import {
  InventoryForm,
  DeleteInventoryForm,
} from "@/components/admin/inventory-form";
export default async function EditInventoryItem({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (id !== "new" && !z.uuid().safeParse(id).success) notFound();
  const record =
    id === "new"
      ? undefined
      : (
          await getDb()
            .select()
            .from(inventory)
            .where(eq(inventory.id, id))
            .limit(1)
        )[0];
  if (id !== "new" && !record) notFound();
  return (
    <>
      <p className="eyebrow">Inventory</p>
      <h1>{record ? "Edit item" : "Add an item"}</h1>
      <p className="admin-intro">
        Only the item name is required. A photo is optional — items without one
        still look right on the website.
      </p>
      <InventoryForm
        record={record}
        uploadsConfigured={imageUploadsConfigured()}
      />
      {record && <DeleteInventoryForm id={record.id} />}
    </>
  );
}
