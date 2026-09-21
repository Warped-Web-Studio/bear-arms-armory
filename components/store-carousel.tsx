"use client";
import Image from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";

const CROSSFADE_MS = 900;
import type { StorePhoto } from "@/lib/business";

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}
const isHidden = () => document.hidden;
const initiallyPaused = () => true;

export function StoreCarousel({
  photos,
  label = "Store photographs",
  itemName = "store photograph",
}: {
  photos: StorePhoto[];
  label?: string;
  itemName?: string;
}) {
  const [index, setIndex] = useState(0);
  const [incoming, setIncoming] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const activeRequest = useRef<number | null>(null);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduce = useSyncExternalStore(
    subscribeMotion,
    reducedMotion,
    initiallyPaused,
  );
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    isHidden,
    initiallyPaused,
  );
  const slideId = useId();
  const multiple = photos.length > 1;
  const rotating =
    multiple && incoming === null && !hovered && !focused && !reduce && !hidden;
  const current = index % (photos.length || 1);
  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => {
      if (activeRequest.current !== null) return;
      const target = (index + 1) % photos.length;
      activeRequest.current = target;
      setIncoming(target);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [rotating, photos.length, index]);
  useEffect(() => {
    if (incoming === null || !ready) return;
    // Let the decoded incoming image paint at opacity zero, even from cache.
    // Both layers then start the same opacity transition on the same frame.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setFading(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [incoming, ready]);
  useEffect(() => {
    if (incoming === null || !ready || (!fading && !reduce)) return;
    const timer = window.setTimeout(
      () => {
        setIndex(incoming);
        setIncoming(null);
        setReady(false);
        setFading(false);
        activeRequest.current = null;
      },
      reduce ? 0 : CROSSFADE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [incoming, ready, fading, reduce]);
  if (!photos.length) return null;
  function move(direction: number) {
    if (activeRequest.current !== null) return;
    setError("");
    setReady(false);
    const target = (current + direction + photos.length) % photos.length;
    activeRequest.current = target;
    setIncoming(target);
  }
  return (
    <div
      className="store-carousel"
      role="region"
      aria-label={label}
      aria-roledescription={multiple ? "carousel" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocused(false);
      }}
    >
      <div
        id={slideId}
        className={`store-carousel-image ${fading ? "is-changing" : ""}`}
        style={
          { "--store-crossfade-duration": `${CROSSFADE_MS}ms` } as CSSProperties
        }
        role="group"
        aria-roledescription={multiple ? "slide" : undefined}
        aria-label={`Photograph ${current + 1} of ${photos.length}`}
      >
        {[current, ...(incoming !== null ? [incoming] : [])].map(
          (photoIndex) => {
            const entering = photoIndex === incoming;
            const photo = photos[photoIndex];
            return (
              <Image
                key={photoIndex}
                className={`store-slide ${entering ? "incoming-slide" : "current-slide"}`}
                src={photo.url}
                alt={photo.description}
                aria-hidden={entering ? !fading : fading}
                fill
                loading={entering ? "eager" : "lazy"}
                sizes="(max-width: 720px) calc(100vw - 48px), (max-width: 1200px) 45vw, 560px"
                onLoad={() => {
                  if (entering && activeRequest.current === photoIndex)
                    setReady(true);
                }}
                onError={() => {
                  if (!entering || activeRequest.current !== photoIndex) return;
                  activeRequest.current = null;
                  setIncoming(null);
                  setReady(false);
                  setFading(false);
                  setError(
                    "This photograph could not be loaded. Please try again.",
                  );
                }}
              />
            );
          },
        )}
        {multiple && (
          <>
            <button
              type="button"
              className="store-carousel-arrow previous"
              aria-label={`Previous ${itemName}`}
              aria-controls={slideId}
              aria-disabled={incoming !== null}
              onClick={() => move(-1)}
            >
              ←
            </button>
            <button
              type="button"
              className="store-carousel-arrow next"
              aria-label={`Next ${itemName}`}
              aria-controls={slideId}
              aria-disabled={incoming !== null}
              onClick={() => move(1)}
            >
              →
            </button>
          </>
        )}
      </div>
      {multiple && (
        <p
          className="store-carousel-position"
          aria-live={rotating ? "off" : "polite"}
          aria-atomic="true"
        >
          {(fading && incoming !== null ? incoming : current) + 1} /{" "}
          {photos.length}
        </p>
      )}
      {error && <p role="status">{error}</p>}
    </div>
  );
}
