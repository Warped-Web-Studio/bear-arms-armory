import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { content } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { contentKinds, kindLabels, type ContentKind } from "@/lib/content";
import { ContentForm, DeleteForm } from "@/components/admin/content-form";
import { imageUploadsConfigured } from "@/lib/image-storage";
export default async function EditContent({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  await requireAdmin();
  const { kind: value, id } = await params;
  if (!contentKinds.includes(value as ContentKind)) notFound();
  const kind = value as ContentKind;
  if (id !== "new" && !z.uuid().safeParse(id).success) notFound();
  const record =
    id === "new"
      ? undefined
      : (
          await getDb()
            .select()
            .from(content)
            .where(and(eq(content.id, id), eq(content.kind, kind)))
            .limit(1)
        )[0];
  if (id !== "new" && !record) notFound();
  return (
    <>
      <p className="eyebrow">{kindLabels[kind]}</p>
      <h1>{record ? "Edit update" : "Create an update"}</h1>
      <p className="admin-intro">
        Use this space for general business news, community activities, and
        moments around the store.
      </p>
      <ContentForm
        kind={kind}
        record={record}
        imageLibraryConfigured={!!process.env.IMAGE_HOST}
        uploadsConfigured={imageUploadsConfigured()}
      />
      {record && <DeleteForm id={record.id} kind={kind} />}
    </>
  );
}
