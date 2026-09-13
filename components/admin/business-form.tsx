"use client";
import { useActionState, useState } from "react";
import { saveBusiness } from "@/app/admin/actions";
import type { Business } from "@/lib/business";
export function BusinessForm({ business }: { business: Business }) {
  const [state, action, pending] = useActionState(saveBusiness, {
    ok: false,
    message: "",
  });
  const [values, setValues] = useState(business);
  const fields: { name: keyof Business; label: string; long?: boolean }[] = [
    { name: "address", label: "Street address" },
    { name: "city", label: "City" },
    { name: "region", label: "State" },
    { name: "postalCode", label: "ZIP code" },
    { name: "phone", label: "Phone number" },
    { name: "email", label: "Email (optional)" },
    { name: "hours", label: "Store hours", long: true },
    { name: "about", label: "About the store", long: true },
    { name: "storeImageUrl", label: "Store photograph link (optional)" },
    { name: "storeImageAlt", label: "Store photograph description" },
  ];
  return (
    <form action={action} className="admin-card">
      <div className="form-grid">
        {fields.map(({ name, label, long }) => (
          <div className={`field ${long ? "wide" : ""}`} key={name}>
            <label htmlFor={name}>{label}</label>
            {long ? (
              <textarea
                name={name}
                id={name}
                value={values[name]}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [name]: event.target.value,
                  }))
                }
                required
                maxLength={2500}
                aria-invalid={!!state.errors?.[name]}
                aria-describedby={`${name}-error`}
              />
            ) : (
              <input
                name={name}
                id={name}
                value={values[name]}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [name]: event.target.value,
                  }))
                }
                required={
                  !["email", "storeImageUrl", "storeImageAlt"].includes(name)
                }
                type={name === "email" ? "email" : "text"}
                maxLength={name === "storeImageUrl" ? 2000 : 250}
                aria-invalid={!!state.errors?.[name]}
                aria-describedby={`${name}-error`}
              />
            )}
            <div id={`${name}-error`}>
              {state.errors?.[name]?.map((error) => (
                <p className="field-error" key={error}>
                  {error}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
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
          {pending ? "Saving…" : "Save business information"}
        </button>
      </div>
    </form>
  );
}
