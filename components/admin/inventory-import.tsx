"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  confirmInventoryImport,
  previewInventoryImport,
  type ImportPreview,
} from "@/app/admin/inventory-actions";
import type { SaveState } from "@/app/admin/actions";
import {
  fieldLabel,
  PREVIEW_ROWS,
  MAX_REPORTED_ISSUES,
} from "@/lib/inventory-import";
import { displayPrice, statusLabels } from "@/lib/inventory";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Remounting on a new key is what clears a finished import, so the next one
// starts from an empty form rather than the previous result.
export function InventoryImport() {
  const [round, setRound] = useState(0);
  return <ImportRound key={round} onRestart={() => setRound(round + 1)} />;
}

function ImportRound({ onRestart }: { onRestart: () => void }) {
  const [preview, checkFile, checking] = useActionState(
    previewInventoryImport,
    { ok: false, message: "" } as ImportPreview,
  );
  const [result, runImport, importing] = useActionState(
    confirmInventoryImport,
    { ok: false, message: "" } as SaveState,
  );
  const [mode, setMode] = useState<"skip" | "update">("skip");
  const plan = preview.plan;
  const ready = preview.ok && !!plan?.items.length && !result.ok;
  return (
    <>
      {!result.ok && (
        <form action={checkFile} className="admin-card">
          <div className="field wide">
            <label htmlFor="inventory-file">Excel spreadsheet (.xlsx)</label>
            <input
              id="inventory-file"
              name="file"
              type="file"
              accept={`${XLSX_TYPE},.xlsx`}
              required
              disabled={checking || importing}
              aria-describedby="inventory-file-help"
            />
            <small id="inventory-file-help">
              Put your column headings in the first row: Name, Manufacturer,
              Category, Caliber, Price, Availability. Nothing is saved until you
              confirm on the next step.
            </small>
          </div>
          <div className="form-actions">
            <button
              className="button button-dark"
              disabled={checking || importing}
            >
              {checking ? "Checking…" : "Check spreadsheet"}
            </button>
            <Link href="/admin/inventory" className="text-link">
              Back to Inventory
            </Link>
          </div>
          {preview.message && !result.ok && (
            <p
              className={`feedback ${preview.ok ? "" : "error"}`}
              role={preview.ok ? "status" : "alert"}
            >
              {preview.message}
            </p>
          )}
        </form>
      )}

      {plan && !result.ok && <PlanReport plan={plan} preview={preview} />}

      {ready && (
        <form action={runImport} className="admin-card">
          <h2>Confirm the import</h2>
          <fieldset className="field wide">
            <legend>Items already in your inventory</legend>
            {(
              [
                ["skip", "Leave my existing items alone (recommended)"],
                ["update", "Update them with the spreadsheet details"],
              ] as const
            ).map(([value, label]) => (
              <label className="checkbox-label" key={value}>
                <input
                  type="radio"
                  name="mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value)}
                />
                <span>{label}</span>
              </label>
            ))}
            <small>
              Photos, item descriptions you have written, and “Show this item”
              are never changed by an import. Nothing is ever deleted.
            </small>
          </fieldset>
          <input
            type="hidden"
            name="items"
            value={JSON.stringify({
              mode,
              items: plan.items.map(({ row, data }) => ({ row, data })),
            })}
          />
          <label className="checkbox-label">
            <input type="checkbox" name="confirm" required />
            <span>
              Add {(preview.newCount ?? 0).toLocaleString("en-US")} new item
              {preview.newCount === 1 ? "" : "s"} to my inventory.
            </span>
          </label>
          <div className="form-actions">
            <button className="button button-dark" disabled={importing}>
              {importing ? "Importing…" : "Import items"}
            </button>
          </div>
          {result.message && (
            <p className="feedback error" role="alert">
              {result.message}
            </p>
          )}
        </form>
      )}

      {result.ok && (
        <div className="admin-card">
          <h2>Import complete</h2>
          <p role="status">{result.message}</p>
          <p>
            Inventory is only visible to customers once “Show inventory on
            website” is switched on.
          </p>
          <div className="form-actions">
            <Link className="button button-dark" href="/admin/inventory">
              Back to Inventory
            </Link>
            <button type="button" className="text-link" onClick={onRestart}>
              Import another spreadsheet
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function PlanReport({
  plan,
  preview,
}: {
  plan: NonNullable<ImportPreview["plan"]>;
  preview: ImportPreview;
}) {
  const issues = [
    ...plan.errors.map((issue) => ({ ...issue, kind: "Skipped" })),
    ...plan.warnings.map((issue) => ({ ...issue, kind: "Note" })),
  ].sort((a, b) => a.row - b.row);
  return (
    <div className="admin-card import-report">
      <h2>What we found</h2>
      <ul className="import-summary">
        <li>
          <strong>{plan.items.length.toLocaleString("en-US")}</strong> item
          {plan.items.length === 1 ? "" : "s"} ready to import
        </li>
        {preview.ok && (
          <>
            <li>
              <strong>{(preview.newCount ?? 0).toLocaleString("en-US")}</strong>{" "}
              new
            </li>
            <li>
              <strong>
                {(preview.matchCount ?? 0).toLocaleString("en-US")}
              </strong>{" "}
              already in your inventory
            </li>
          </>
        )}
        {plan.errors.length > 0 && (
          <li>
            <strong>{plan.errors.length.toLocaleString("en-US")}</strong> row
            {plan.errors.length === 1 ? "" : "s"} skipped
          </li>
        )}
      </ul>
      {plan.truncated && (
        <p className="help">
          This spreadsheet is very long, so only the first rows were read.
        </p>
      )}
      <p className="help">
        Columns used:{" "}
        {plan.mapped
          .map((column) => `${column.header} → ${fieldLabel(column.field)}`)
          .join(", ")}
        .
      </p>
      {plan.blockedColumns.length > 0 && (
        <p className="help">
          Serial numbers are never published, so “
          {plan.blockedColumns.join("”, “")}” was not imported.
        </p>
      )}
      {plan.ignoredColumns.length > 0 && (
        <p className="help">
          Columns we don’t use: “{plan.ignoredColumns.join("”, “")}”.
        </p>
      )}
      {issues.length > 0 && (
        <div className="import-issues">
          <h3>Rows that need your attention</h3>
          <ul>
            {issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => (
              <li key={`${issue.kind}-${issue.row}-${issue.message}`}>
                <strong>
                  {issue.row ? `Row ${issue.row}` : issue.kind}
                  {": "}
                </strong>
                {issue.message}
              </li>
            ))}
          </ul>
          {issues.length > MAX_REPORTED_ISSUES && (
            <p className="help">
              …and {issues.length - MAX_REPORTED_ISSUES} more.
            </p>
          )}
        </div>
      )}
      {plan.items.length > 0 && (
        <>
          <h3>Preview</h3>
          <div className="table-scroll">
            <table className="import-table">
              <caption className="sr-only">
                First {Math.min(PREVIEW_ROWS, plan.items.length)} items from the
                spreadsheet
              </caption>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Manufacturer</th>
                  <th scope="col">Category</th>
                  <th scope="col">Caliber</th>
                  <th scope="col">Price</th>
                  <th scope="col">Availability</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.slice(0, PREVIEW_ROWS).map((item) => (
                  <tr key={item.row}>
                    <td>{item.data.name}</td>
                    <td>{item.data.manufacturer || "—"}</td>
                    <td>{item.data.category || "—"}</td>
                    <td>{item.data.caliber || "—"}</td>
                    <td>{displayPrice(item.data.priceCents)}</td>
                    <td>{statusLabels[item.data.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.items.length > PREVIEW_ROWS && (
            <p className="help">
              Showing the first {PREVIEW_ROWS} of{" "}
              {plan.items.length.toLocaleString("en-US")} items.
            </p>
          )}
        </>
      )}
    </div>
  );
}
