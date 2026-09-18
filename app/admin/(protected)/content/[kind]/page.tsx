import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { listContent } from "@/lib/data";
import {
  contentKinds,
  kindLabels,
  type ContentKind,
  displayDate,
} from "@/lib/content";
export default async function ContentList({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const { kind: value } = await params;
  if (!contentKinds.includes(value as ContentKind)) notFound();
  const kind = value as ContentKind;
  const query = await searchParams;
  const page = /^[1-9]\d{0,3}$/.test(query.page || "") ? Number(query.page) : 1;
  const rows = await listContent(kind, page);
  return (
    <>
      <p className="eyebrow">Store content</p>
      <h1>{kindLabels[kind]}</h1>
      <p className="admin-intro">
        Manage published updates, scheduled content, and drafts. All dates and
        times use Eastern time.
      </p>
      {(kind === "weekly" || kind === "monthly") && (
        <p className="admin-intro">
          Use Add highlight for each new feature to keep previous highlights in
          the archive. Use Edit to correct an existing entry.
        </p>
      )}
      <Link className="button button-dark" href={`/admin/content/${kind}/new`}>
        Add{" "}
        {kind === "event"
          ? "event"
          : kind === "announcement"
            ? "announcement"
            : "highlight"}{" "}
        +
      </Link>
      <div className="record-list" style={{ marginTop: "2rem" }}>
        {rows.slice(0, 25).map((record) => (
          <article className="record-row" key={record.id}>
            <div>
              <h2>{record.title}</h2>
              <p>
                <span className="badge">
                  {record.published ? "Published" : "Draft"}
                </span>
                {displayDate(record.startsOn)} – {displayDate(record.endsOn)}
              </p>
            </div>
            <Link
              className="text-link"
              href={`/admin/content/${kind}/${record.id}`}
            >
              Edit<span className="sr-only"> {record.title}</span>
            </Link>
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="admin-card">
          <h2>Nothing here yet.</h2>
          <p>
            Add an update when you have something to share. Empty sections are
            hidden on the website.
          </p>
        </div>
      )}
      <nav className="pagination" aria-label="Content pages">
        {page > 1 && (
          <Link className="button" href={`?page=${page - 1}`}>
            Previous
          </Link>
        )}
        {rows.length > 25 && (
          <Link className="button" href={`?page=${page + 1}`}>
            Next
          </Link>
        )}
      </nav>
    </>
  );
}
