"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import {
  saveContent,
  deleteContent,
  type SaveState,
} from "@/app/admin/actions";
import {
  type ContentKind,
  type ContentRecord,
  kindLabels,
} from "@/lib/content";
const initial: SaveState = { ok: false, message: "" };
export function ContentForm({
  kind,
  record,
  imageLibraryConfigured,
}: {
  kind: ContentKind;
  record?: ContentRecord;
  imageLibraryConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(
    async (previous: SaveState, form: FormData) => {
      const result = await saveContent(previous, form);
      return { ...result, id: result.id || previous.id };
    },
    initial,
  );
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(record || {}).map(([key, value]) => [key, String(value)]),
    ),
  );
  const [published, setPublished] = useState(record?.published ?? false);
  const field = (
    name: keyof ContentRecord,
    label: string,
    type = "text",
    required = false,
    help?: string,
  ) => (
    <div
      className={`field ${name === "title" || name === "description" || name === "imageUrl" || name === "imageAlt" || name === "location" ? "wide" : ""}`}
      key={name}
    >
      <label htmlFor={name}>{label}</label>
      {type === "textarea" ? (
        <textarea
          id={name}
          name={name}
          value={values[name] ?? ""}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              [name]: event.target.value,
            }))
          }
          required={required}
          maxLength={4000}
          aria-invalid={!!state.errors?.[name]}
          aria-describedby={`${name}-help`}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={values[name] ?? ""}
          onChange={(event) =>
            setValues((previous) => ({
              ...previous,
              [name]: event.target.value,
            }))
          }
          required={required}
          maxLength={name === "title" ? 120 : 2000}
          aria-invalid={!!state.errors?.[name]}
          aria-describedby={`${name}-help`}
        />
      )}
      <div id={`${name}-help`}>
        {help && <small>{help}</small>}
        {state.errors?.[name]?.map((error) => (
          <p className="field-error" key={error}>
            {error}
          </p>
        ))}
      </div>
    </div>
  );
  return (
    <form action={action} className="admin-card">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={record?.id || state.id || ""} />
      <div className="form-grid">
        {field("title", "Title", "text", true)}
        {field(
          "description",
          "Description",
          "textarea",
          true,
          "Share ordinary store news, people, community activities, or a moment from around the store.",
        )}
        {field(
          "startsOn",
          kind === "event" ? "First day" : "Start date",
          "date",
          true,
        )}
        {field(
          "endsOn",
          kind === "event" ? "Last day" : "End date",
          "date",
          true,
          "The final day is included. Dates use Eastern time.",
        )}
        {kind === "event" ? (
          <>
            {field("startTime", "Start time (Eastern)", "time", true)}
            {field("endTime", "End time (Eastern)", "time", true)}
            {field(
              "location",
              "Location",
              "text",
              false,
              "Leave blank to use the store address.",
            )}
          </>
        ) : (
          <>
            <input type="hidden" name="startTime" value="" />
            <input type="hidden" name="endTime" value="" />
            <input type="hidden" name="location" value="" />
          </>
        )}
        {field(
          "imageUrl",
          "Image link (optional)",
          "text",
          false,
          imageLibraryConfigured
            ? "Use a local image path under /client-assets/ or /derived/, or paste a link from your approved image library. Keep the subject near the center."
            : "Use an existing local image path, such as /client-assets/logo/Logo.jpg. Images are optional; an external image library can be connected later.",
        )}
        {field(
          "imageAlt",
          "Image description",
          "text",
          false,
          "Briefly describe what the image shows. Required only when adding an image.",
        )}
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          name="published"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
        />
        <span>
          Publish on website
          <br />
          <small>
            Uncheck to keep this as a draft.{" "}
            {kind === "event"
              ? "Upcoming events appear as soon as published."
              : "Scheduled content appears on its start date."}
          </small>
        </span>
      </label>
      {(kind === "weekly" || kind === "monthly") && (
        <p className="help">
          If dates overlap, the highlight with the latest start date is
          featured. Previous published highlights stay in the gallery.
        </p>
      )}
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
          {pending
            ? "Saving…"
            : `Save ${kind === "event" ? "event" : kind === "announcement" ? "announcement" : "highlight"}`}
        </button>
        <Link href={`/admin/content/${kind}`} className="text-link">
          Back to {kindLabels[kind]}
        </Link>
      </div>
    </form>
  );
}
export function DeleteForm({ id, kind }: { id: string; kind: ContentKind }) {
  const [state, action, pending] = useActionState(deleteContent, initial);
  if (state.ok)
    return (
      <div className="feedback" role="status">
        Deleted.{" "}
        <Link className="text-link" href={`/admin/content/${kind}`}>
          Return to list
        </Link>
      </div>
    );
  return (
    <details className="danger-zone">
      <summary>Delete this record</summary>
      <p>
        This permanently removes the record and its gallery entry. To keep it
        for later, unpublish it instead.
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
