// Address, telephone and family ownership: https://www.beararmsarmorypa.com/
// Verified against the client-confirmed website on 2026-09-12. Hours are not verified.
export const defaultBusiness = {
  name: "Bear Arms Armory",
  address: "740 E. Columbus Ave.",
  city: "Corry",
  region: "PA",
  postalCode: "16407",
  phone: "814-964-3291",
  email: "",
  hours: "Call for current hours.",
  about:
    "Bear Arms Armory is a father-and-son business in Corry, Pennsylvania. Founded in 2023, the store is part of the local community on East Columbus Avenue.",
  storeImageUrl: "",
  storeImageAlt: "",
};
export type Business = typeof defaultBusiness;
export const siteOrigin =
  process.env.SITE_URL || "https://www.beararmsarmorypa.com";
export const storeTimeZone = "America/New_York";
