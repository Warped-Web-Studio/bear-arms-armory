"use client";
import { useActionState, useState } from "react";
import { saveBusiness } from "@/app/admin/actions";
import {
  getAccessoriesPhotos,
  getStorePhotos,
  MAX_ACCESSORIES_PHOTOS,
  type Business,
} from "@/lib/business";
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
  const [values, setValues] = useState({
    ...business,
    email: business.email || "sales@beararmsarmorypa.com",
  });
  const [uploading, setUploading] = useState(false);
  const fields: {
    name: Exclude<
      keyof Business,
      "storePhotos" | "accessoriesPhotos" | "showInventory"
    >;
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
      {/* Carried through so saving this form never changes the inventory
          visibility the client set on the inventory page. */}
      <input
        type="hidden"
        name="showInventory"
        value={values.showInventory ? "true" : "false"}
      />
      <div className="form-grid">
        <StorePhotosField
          photos={getStorePhotos(business)}
          configured={uploadsConfigured}
          pending={pending || uploading}
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
      <fieldset className="accessories-editor">
        <legend>Knives, Lights and Optics</legend>
        <p>
          Add photos, a description, or both. Photos appear as a slideshow. Save
          below to show this section on the website.
        </p>
        {/* The photo list below replaces the original single photo. */}
        <input type="hidden" name="accessoriesImageUrl" value="" />
        <StorePhotosField
          photos={getAccessoriesPhotos(business)}
          configured={uploadsConfigured}
          pending={pending || uploading}
          onBusyChange={setUploading}
          errors={state.errors?.accessoriesPhotos}
          name="accessoriesPhotos"
          idPrefix="accessories"
          legend="Photos (optional)"
          emptyText="No photos yet. The description will still appear."
          addLabel="Add a photo"
          max={MAX_ACCESSORIES_PHOTOS}
        />
        <div className="field wide">
          <label htmlFor="accessoriesDescription">Description</label>
          <textarea
            id="accessoriesDescription"
            name="accessoriesDescription"
            maxLength={4000}
            value={values.accessoriesDescription || ""}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                accessoriesDescription: event.target.value,
              }))
            }
            aria-invalid={!!state.errors?.accessoriesDescription}
            aria-describedby="accessories-errors"
          />
        </div>
        <div id="accessories-errors" role="status">
          {(state.errors?.accessoriesDescription || []).map((error) => (
            <p className="field-error" key={error}>
              {error}
            </p>
          ))}
        </div>
      </fieldset>
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
