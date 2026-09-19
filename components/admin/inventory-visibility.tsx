"use client";
import { useActionState, useState } from "react";
import { setInventoryVisible } from "@/app/admin/inventory-actions";
import type { SaveState } from "@/app/admin/actions";
export function InventoryVisibility({
  show,
  itemCount,
}: {
  show: boolean;
  itemCount: number;
}) {
  const [state, action, pending] = useActionState(setInventoryVisible, {
    ok: false,
    message: "",
  } as SaveState);
  const [checked, setChecked] = useState(show);
  return (
    <form action={action} className="admin-card">
      <h2>Show inventory on website</h2>
      <p>
        Turning this off hides the inventory section from visitors. Your{" "}
        {itemCount.toLocaleString("en-US")} saved item
        {itemCount === 1 ? "" : "s"} stay exactly as{" "}
        {itemCount === 1 ? "it is" : "they are"}.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="showInventory"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>Show inventory on the website</span>
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
        <button className="button button-dark" disabled={pending}>
          {pending ? "Saving…" : "Save setting"}
        </button>
      </div>
    </form>
  );
}
