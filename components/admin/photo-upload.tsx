"use client";
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { uploadImage } from "@/app/admin/upload";
import {
  imageFileError,
  IMAGE_TYPES,
  IMAGE_UPLOAD_HELP,
} from "@/lib/image-upload";

export function PhotoUpload({
  id,
  value,
  configured,
  disabled,
  onChange,
  onBusyChange,
}: {
  id: string;
  value: string;
  configured: boolean;
  disabled: boolean;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  return (
    <div className="field wide" aria-busy={pending}>
      <label htmlFor={id}>Upload photo (optional)</label>
      <input
        id={id}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        disabled={!configured || disabled || pending}
        aria-describedby={`${id}-help ${id}-status`}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || busy.current) return;
          const error = imageFileError(file);
          setFailed(!!error);
          setMessage(error || "Uploading photo…");
          if (error) return;
          busy.current = true;
          onBusyChange(true);
          startTransition(async () => {
            try {
              const form = new FormData();
              form.set("file", file);
              const result = await uploadImage(form);
              setFailed(!result.ok);
              if (result.ok) {
                onChange(result.url);
                setMessage(
                  "Photo uploaded. Add an image description and save your changes to use it on the website.",
                );
              } else setMessage(result.message);
            } catch {
              setFailed(true);
              setMessage(
                "We couldn’t upload this photo. Check your connection and sign-in, then try again.",
              );
            } finally {
              busy.current = false;
              onBusyChange(false);
            }
          });
        }}
      />
      <small id={`${id}-help`}>
        {configured
          ? IMAGE_UPLOAD_HELP
          : "Photo uploads are not set up yet. Contact your website developer."}
      </small>
      <p
        id={`${id}-status`}
        role={failed ? "alert" : "status"}
        className={failed ? "field-error" : "help"}
      >
        {message}
      </p>
      {/^(https:\/\/|\/(client-assets|derived)\/)/.test(value) && (
        <div className="upload-preview">
          <Image
            src={value}
            alt="Selected photo preview"
            width={320}
            height={240}
            unoptimized
          />
          <button
            type="button"
            className="text-link"
            disabled={disabled || pending}
            onClick={() => {
              onChange("");
              setMessage(
                "Photo removed from this form. Save your changes to apply.",
              );
              setFailed(false);
            }}
          >
            Remove photo
          </button>
        </div>
      )}
    </div>
  );
}
