"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { PhotoUpload } from "./photo-upload";
import {
  saveInventoryItem,
  deleteInventoryItem,
} from "@/app/admin/inventory-actions";
import type { SaveState } from "@/app/admin/actions";
import {
  inventoryStatuses,
  priceInput,
  statusLabels,
  type InventoryRecord,
} from "@/lib/inventory";
const initial: SaveState = { ok: false, message: "" };
export function InventoryForm({
  record,
  uploadsConfigured = false,
}: {
  record?: InventoryRecord;
  uploadsConfigured?: boolean;
}) {
  const [state, action, pending] = useActionState(
    async (previous: SaveState, form: FormData) => {
      const result = await saveInventoryItem(previous, form);
      return { ...result, id: result.id || previous.id };
    },
    initial,
  );
  const [values, setValues] = useState({
    name: record?.name ?? "",
    manufacturer: record?.manufacturer ?? "",
    category: record?.category ?? "",
    caliber: record?.caliber ?? "",
    price: priceInput(record?.priceCents ?? null),
    status: record?.status ?? "available",
    sku: record?.sku ?? "",
    description: record?.description ?? "",
    imageUrl: record?.imageUrl ?? "",
    imageAlt: record?.imageAlt ?? "",
  });
  const [published, setPublished] = useState(record?.published ?? true);
  const [uploading, setUploading] = useState(false);
  const set = (name: keyof typeof values) => (value: string) =>
    setValues((previous) => ({ ...previous, [name]: value }));
  const field = (
    name: keyof typeof values,
    label: string,
    options: { wide?: boolean; required?: boolean; help?: string } = {},
  ) => (
    <div className={`field ${options.wide ? "wide" : ""}`} key={name}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        value={values[name]}
        onChange={(event) => set(name)(event.target.value)}
        required={options.required}
        maxLength={name === "description" ? 4000 : 160}
        aria-invalid={!!state.errors?.[name]}
        aria-describedby={`${name}-help`}
      />
      <div id={`${name}-help`}>
        {options.help && <small>{options.help}</small>}
        {state.errors?.[name]?.map((error) => (
          <p className="field-error" key={error}>
            {error}
          </p>
        ))}
      </div>
    </div>
  );
  return (
    <form
      action={action}
      className="admin-card"
      onSubmit={(event) => {
        if (uploading) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={record?.id || state.id || ""} />
      <input type="hidden" name="imageUrl" value={values.imageUrl} />
      <div className="form-grid">
        {field("name", "Item name", { wide: true, required: true })}
        {field("manufacturer", "Manufacturer")}
        {field("category", "Category", {
          help: "For example: Rifles, Handguns, Optics.",
        })}
        {field("caliber", "Caliber or gauge")}
        {field("price", "Price", {
          help: "Leave blank to show “Call for price”.",
        })}
        <div className="field">
          <label htmlFor="status">Availability</label>
          <select
            id="status"
            name="status"
            value={values.status}
            onChange={(event) => set("status")(event.target.value)}
          >
            {inventoryStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <div id="status-help" />
        </div>
        {field("sku", "Stock number (optional)", {
          help: "Your own reference. Never enter a firearm serial number.",
        })}
        <div className="field wide">
          <label htmlFor="description">Description (optional)</label>
          <textarea
            id="description"
            name="description"
            value={values.description}
            maxLength={4000}
            onChange={(event) => set("description")(event.target.value)}
            aria-invalid={!!state.errors?.description}
            aria-describedby="description-help"
          />
          <div id="description-help">
            {state.errors?.description?.map((error) => (
              <p className="field-error" key={error}>
                {error}
              </p>
            ))}
          </div>
        </div>
        <PhotoUpload
          id="inventory-photo"
          label="Photo (optional)"
          value={values.imageUrl}
          configured={uploadsConfigured}
          disabled={pending}
          onChange={set("imageUrl")}
          onBusyChange={setUploading}
        />
        {values.imageUrl &&
          field("imageAlt", "Photo description", {
            wide: true,
            help: "Briefly describe the photo for visitors who cannot see it.",
          })}
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="published"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
        />
        <span>
          Show this item
          <br />
          <small>
            Unticked items stay saved but never appear on the website.
          </small>
        </span>
      </label>
      {state.message && (
        <p
          className={`feedback ${state.ok ? "" : "error"}`}
          role={state.ok ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <div className="form-actions">
        <button className="button button-dark" disabled={pending || uploading}>
          {pending ? "Saving…" : "Save item"}
        </button>
        <Link href="/admin/inventory" className="text-link">
          Back to Inventory
        </Link>
      </div>
    </form>
  );
}
export function DeleteInventoryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(deleteInventoryItem, initial);
  if (state.ok)
    return (
      <div className="feedback" role="status">
        Deleted.{" "}
        <Link className="text-link" href="/admin/inventory">
          Return to Inventory
        </Link>
      </div>
    );
  return (
    <details className="danger-zone">
      <summary>Delete this item</summary>
      <p>
        This permanently removes the item. To take it off the website but keep
        the details, untick “Show this item” above instead.
      </p>
      <form action={action}>
        <input name="id" type="hidden" value={id} />
        <label className="checkbox-label">
          <input type="checkbox" name="confirm" required />I understand this
          cannot be undone.
        </label>
        <button className="button" disabled={pending}>
          {pending ? "Deleting…" : "Permanently delete"}
        </button>
        {state.message && (
          <p className="feedback error" role="alert">
            {state.message}
          </p>
        )}
      </form>
    </details>
  );
}
