import { requireAdmin } from "@/lib/admin";
import { InventoryImport } from "@/components/admin/inventory-import";
export default async function ImportInventory() {
  await requireAdmin();
  return (
    <>
      <p className="eyebrow">Inventory</p>
      <h1>Import from a spreadsheet</h1>
      <p className="admin-intro">
        A quick way to get your list online the first time. Upload your
        spreadsheet, check what we found, then confirm. After that, add and edit
        items here — the website becomes the list you keep up to date.
      </p>
      <InventoryImport />
    </>
  );
}
