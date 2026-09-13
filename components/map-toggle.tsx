"use client";
import { useState } from "react";
export function MapToggle({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="map-toggle">
      <button
        className="button button-dark"
        type="button"
        aria-expanded={open}
        aria-controls="store-map"
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide map −" : "Show map +"}
      </button>
      <div id="store-map">
        {open && (
          <iframe
            title="Bear Arms Armory location"
            src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
            referrerPolicy="no-referrer-when-downgrade"
            loading="lazy"
            allowFullScreen
          />
        )}
      </div>
    </div>
  );
}
