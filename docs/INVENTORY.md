# Inventory and spreadsheet import

## What exists now

Inventory did not exist in the repository before this change. It was added to
match `AGENTS.md`: a straightforward relational table, admin CRUD, an explicit
visibility control, optional images, and no ecommerce of any kind.

- `inventory` table (migration `drizzle/0001_sharp_changeling.sql`) — purely
  additive: a new enum, a new table, a new index. No existing table, column or
  row is touched.
- `/admin/inventory` — list, add, edit, delete, and the **Show inventory on
  website** control.
- `/admin/inventory/import` — the spreadsheet workflow described below.
- Public section on the home page between Featured This Month and Events,
  rendered only when the setting is on **and** published items exist.

Visibility lives in the existing business-settings JSON (`showInventory`), so
it needs no migration. The business information form carries it in a hidden
field, which means saving that form never changes it by accident.

## Fields

`name` (the only required field), `manufacturer`, `category`, `caliber`,
`priceCents`, `status` (Available / On hold / Sold), `sku`, `description`,
`imageUrl`, `imageAlt`, `published`, timestamps.

Prices are whole cents, so nothing drifts between edits. A blank price shows
as "Call for price". `sku` is nullable and uniquely indexed, so items without
a stock number never collide.

## The import workflow

Upload → parse → validate → preview → explicit confirmation → write.

Nothing is written until the client ticks the confirmation box. The preview
reports, in plain language: how many items are ready, how many are new, how
many are already in the inventory, which columns were used, which were
ignored, and every row that was skipped with its spreadsheet row number.

Duplicates are matched on stock number when there is one, otherwise on item
name plus manufacturer. The default is to leave existing items alone. The
client can explicitly choose to update matches instead, and even then photos,
`published`, `imageAlt` and `id` are never overwritten — only the columns the
spreadsheet actually supplies. **No import path deletes anything.**

Writes go through `db.batch`, which the neon-http driver sends as a single
transaction (that driver has no interactive `db.transaction`). Rows are
inserted 200 per statement; updates use one `UPDATE … FROM (VALUES …)` per
200 rows.

After the import, the website database is the source of truth. The client adds,
edits and deletes normally in `/admin/inventory`.

## Reading the spreadsheet

`lib/xlsx.ts` reads .xlsx directly with Node's `zlib` — no new dependency. It
is deliberately strict:

- 3 MB upload cap (the Server Action body limit is 4.2 MB), 512 zip entries,
  40 MB per entry, 80 MB total inflated, 5,000 rows, 64 columns, 2,000
  imported items per run.
- Declared and actual inflated sizes are both capped, so a zip bomb fails
  instead of expanding.
- XML containing `<!DOCTYPE` or `<!ENTITY` is refused outright, so there is no
  entity expansion and no external reference.
- **Formulas are never evaluated.** Only the value Excel already cached in the
  cell is read.
- Hidden sheets are skipped; the first visible sheet is used.

### .xls

Old OLE2 `.xls` workbooks are detected by their signature and refused with
instructions to re-save as `.xlsx`. Parsing BIFF8 inside a compound-file
container would mean either a large parser or a dependency, and `AGENTS.md`
asks for neither. If the client turns out to have `.xls` files they genuinely
cannot re-save, that decision is worth revisiting.

### Column headings

Matching ignores case, spaces and punctuation, so `Item #`, `item#` and
`ITEM NO.` all agree. Recognised: name/item/model/title/product,
manufacturer/make/brand/mfg, category/type/department, caliber/gauge/
chambering, price/retail/MSRP, SKU/stock number/item number/UPC,
status/availability/in stock, quantity/qty/on hand, description/notes/details.

Anything else is listed in the preview as an ignored column. **Serial-number
columns are blocked**, never stored and never shown — a firearm serial number
has no business in a public website database.

## Verification

`npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass.
Tests cover the zip/XML reader against real generated .xlsx files (including
zip bombs, DOCTYPE, `.xls`, and formula cells), column mapping, row
validation, authorization on every action, the preview-writes-nothing
guarantee, duplicate handling in both modes, and the public section's
visibility behaviour.

## Before deployment

1. Run `npm run db:migrate` to apply `0001_sharp_changeling.sql`.
2. Inventory ships **hidden**. Import or add items, then turn on "Show
   inventory on website".

Worth checking by hand: a real client spreadsheet end to end, and the
inventory grid at mobile, tablet and desktop widths.
