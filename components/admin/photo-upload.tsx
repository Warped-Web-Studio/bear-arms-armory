"use client";
import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { checkImageUploadSetup, uploadImage } from "@/app/admin/upload";
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
  label = "Upload photo (optional)",
  showSetupCheck = true,
}: {
  id: string;
  value: string;
  configured: boolean;
  disabled: boolean;
  onChange: (url: string) => void;
  onBusyChange: (busy: boolean) => void;
  label?: string;
  showSetupCheck?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [checkedConfigured, setCheckedConfigured] = useState<boolean>();
  const [checking, setChecking] = useState(false);
  const ready = checkedConfigured ?? configured;
  const busy = useRef(false);
  return (
    <div className="field wide" aria-busy={pending}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        disabled={!ready || disabled || pending || checking}
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
        {ready
          ? IMAGE_UPLOAD_HELP
          : "Photo uploads are not set up yet. Contact your website developer."}
      </small>
      {!ready && showSetupCheck && (
        <div>
          <button
            type="button"
            className="text-link"
            disabled={checking || disabled}
            onClick={async () => {
              setChecking(true);
              try {
                const result = await checkImageUploadSetup();
                setCheckedConfigured(result.configured);
                setFailed(!result.configured);
                setMessage(
                  result.configured
                    ? "Photo uploads are available. Choose a photo above."
                    : `Photo uploads are unavailable: ${result.issues.filter((issue) => issue.trim()).join(" ") || "The server returned no setup details. Reload the page and run this check again."}`,
                );
              } catch {
                setFailed(true);
                setMessage(
                  "Couldn’t check photo storage. Reload the page and sign in again, then retry.",
                );
              } finally {
                setChecking(false);
              }
            }}
          >
            {checking ? "Checking…" : "Check photo upload setup"}
          </button>
        </div>
      )}
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
