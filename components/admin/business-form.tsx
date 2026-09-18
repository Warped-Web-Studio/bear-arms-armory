"use client";
import { useActionState, useState } from "react";
import { saveBusiness } from "@/app/admin/actions";
import { getStorePhotos, type Business } from "@/lib/business";
import { StorePhotosField } from "./store-photos-field";
export function BusinessForm({
  business,
  uploadsConfigured = false,
}: {
  business: Business;
  uploadsConfigured?: boolean;
}) {
  const [state, action, pending] = useActionState(saveBusiness, {
    ok: false,
    message: "",
  });
  const [values, setValues] = useState(business);
  const [uploading, setUploading] = useState(false);
  const fields: {
    name: Exclude<keyof Business, "storePhotos">;
    label: string;
    long?: boolean;
  }[] = [
    { name: "address", label: "Street address" },
    { name: "city", label: "City" },
    { name: "region", label: "State" },
    { name: "postalCode", label: "ZIP code" },
    { name: "phone", label: "Phone number" },
    { name: "email", label: "Email (optional)" },
    { name: "hours", label: "Store hours", long: true },
    { name: "about", label: "About the store", long: true },
  ];
  return (
    <form
      action={action}
      className="admin-card"
      onSubmit={(event) => {
        if (uploading) event.preventDefault();
      }}
    >
      <input type="hidden" name="storeImageUrl" value={values.storeImageUrl} />
      <input type="hidden" name="storeImageAlt" value={values.storeImageAlt} />
      <div className="form-grid">
        <StorePhotosField
          photos={getStorePhotos(business)}
          configured={uploadsConfigured}
          pending={pending}
          onBusyChange={setUploading}
          errors={state.errors?.storePhotos}
        />
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
                required={name !== "email"}
                type={name === "email" ? "email" : "text"}
                maxLength={250}
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
        <button className="button button-dark" disabled={pending || uploading}>
          {pending ? "Saving…" : "Save business information"}
        </button>
      </div>
    </form>
  );
}
