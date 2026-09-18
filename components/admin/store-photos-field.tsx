"use client";
import { useRef, useState } from "react";
import { MAX_STORE_PHOTOS, type StorePhoto } from "@/lib/business";
import { PhotoUpload } from "./photo-upload";

export function StorePhotosField({
  photos,
  configured,
  pending,
  onBusyChange,
  errors,
}: {
  photos: StorePhoto[];
  configured: boolean;
  pending: boolean;
  onBusyChange: (busy: boolean) => void;
  errors?: string[];
}) {
  const [rows, setRows] = useState(() =>
    photos.map((photo, key) => ({ ...photo, key })),
  );
  const nextKey = useRef(photos.length);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const disabled = pending || busy;
  function move(key: number, direction: number) {
    if (disabled) return;
    const index = rows.findIndex((photo) => photo.key === key);
    const destination = index + direction;
    if (index < 0 || destination < 0 || destination >= rows.length) return;
    setRows((previous) => {
      const from = previous.findIndex((photo) => photo.key === key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= previous.length) return previous;
      const reordered = [...previous];
      [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
      return reordered;
    });
    setNotice(
      `Photograph moved to position ${destination + 1}. Save to apply.`,
    );
  }
  function setUploading(value: boolean) {
    setBusy(value);
    onBusyChange(value);
  }
  return (
    <fieldset
      className="store-photos-editor field wide"
      aria-describedby="store-photos-help store-photos-errors"
    >
      <legend>Store photographs (optional)</legend>
      <p id="store-photos-help">
        Add up to {MAX_STORE_PHOTOS} photographs. Describe each one, then save
        your changes. The website fits each photo automatically.
      </p>
      <input
        type="hidden"
        name="storePhotos"
        value={JSON.stringify(
          rows.map(({ url, description }) => ({ url, description })),
        )}
      />
      {!rows.length && (
        <p>
          No store photographs yet. Your store information will still appear.
        </p>
      )}
      {rows.map((photo, index) => (
        <fieldset className="store-photo-editor" key={photo.key}>
          <legend>Photograph {index + 1}</legend>
          <PhotoUpload
            id={`store-photo-${photo.key}`}
            value={photo.url}
            configured={configured}
            disabled={disabled}
            showSetupCheck={false}
            label={`Replace photograph ${index + 1}`}
            onBusyChange={setUploading}
            onChange={(url) => {
              setRows((previous) =>
                url
                  ? previous.map((item) =>
                      item.key === photo.key ? { ...item, url } : item,
                    )
                  : previous.filter((item) => item.key !== photo.key),
              );
              if (!url)
                setNotice(
                  "Photograph removed from this form. Save to apply, or reload to discard unsaved changes.",
                );
            }}
          />
          <div className="field">
            <label htmlFor={`store-description-${photo.key}`}>
              Photograph {index + 1} description
            </label>
            <input
              id={`store-description-${photo.key}`}
              required
              maxLength={250}
              value={photo.description}
              readOnly={pending}
              aria-describedby="store-photos-errors"
              onChange={(event) =>
                setRows((previous) =>
                  previous.map((item) =>
                    item.key === photo.key
                      ? { ...item, description: event.target.value }
                      : item,
                  ),
                )
              }
            />
          </div>
          {rows.length > 1 && (
            <div className="form-actions">
              {index > 0 && (
                <button
                  type="button"
                  className="text-link"
                  disabled={disabled}
                  aria-label={`Move photograph ${index + 1} earlier`}
                  onClick={() => move(photo.key, -1)}
                >
                  Move earlier
                </button>
              )}
              {index < rows.length - 1 && (
                <button
                  type="button"
                  className="text-link"
                  disabled={disabled}
                  aria-label={`Move photograph ${index + 1} later`}
                  onClick={() => move(photo.key, 1)}
                >
                  Move later
                </button>
              )}
            </div>
          )}
        </fieldset>
      ))}
      {rows.length < MAX_STORE_PHOTOS && (
        <PhotoUpload
          id="add-store-photo"
          value=""
          configured={configured}
          disabled={disabled}
          showSetupCheck={false}
          label="Add a store photograph"
          onBusyChange={setUploading}
          onChange={(url) => {
            if (!url) return;
            const key = nextKey.current++;
            setRows((previous) => [...previous, { key, url, description: "" }]);
          }}
        />
      )}
      <p role="status">{notice}</p>
      <div id="store-photos-errors">
        {errors?.map((error) => (
          <p className="field-error" key={error}>
            {error}
          </p>
        ))}
      </div>
    </fieldset>
  );
}
