import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { countInventory, getBusiness, listInventory } from "@/lib/data";
import { displayPrice, statusLabels } from "@/lib/inventory";
import { InventoryVisibility } from "@/components/admin/inventory-visibility";
export default async function InventoryList({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  const page = /^[1-9]\d{0,3}$/.test(query.page || "") ? Number(query.page) : 1;
  const [rows, total, business] = await Promise.all([
    listInventory(page),
    countInventory(),
    getBusiness(),
  ]);
  return (
    <>
      <p className="eyebrow">Store content</p>
      <h1>Inventory</h1>
      <p className="admin-intro">
        List what you have in the store. Items are informational only —
        customers read them here and come in to buy.
      </p>
      <InventoryVisibility show={business.showInventory} itemCount={total} />
      <div className="form-actions" style={{ marginBlock: "2rem" }}>
        <Link className="button button-dark" href="/admin/inventory/new">
          Add item +
        </Link>
        <Link className="button" href="/admin/inventory/import">
          Import from a spreadsheet
        </Link>
      </div>
      <div className="record-list">
        {rows.slice(0, 50).map((record) => (
          <article className="record-row" key={record.id}>
            <div>
              <h2>{record.name}</h2>
              <p>
                <span className="badge">
                  {record.published ? statusLabels[record.status] : "Hidden"}
                </span>
                {[
                  record.manufacturer,
                  record.category,
                  record.caliber,
                  displayPrice(record.priceCents),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Link className="text-link" href={`/admin/inventory/${record.id}`}>
              Edit<span className="sr-only"> {record.name}</span>
            </Link>
          </article>
        ))}
      </div>
      {!rows.length && (
        <div className="admin-card">
          <h2>No items yet.</h2>
          <p>
            Add items one at a time, or import a spreadsheet to get started
            quickly. The inventory section stays off the website until you have
            items and switch it on.
          </p>
        </div>
      )}
      <nav className="pagination" aria-label="Inventory pages">
        {page > 1 && (
          <Link className="button" href={`?page=${page - 1}`}>
            Previous
          </Link>
        )}
        {rows.length > 50 && (
          <Link className="button" href={`?page=${page + 1}`}>
            Next
          </Link>
        )}
      </nav>
    </>
  );
}
