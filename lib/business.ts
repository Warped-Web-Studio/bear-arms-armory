// Address, telephone and family ownership: https://www.beararmsarmorypa.com/
// Verified against the client-confirmed website on 2026-09-12. Hours are not verified.
export const defaultBusiness = {
  name: "Bear Arms Armory",
  address: "740 E. Columbus Ave.",
  city: "Corry",
  region: "PA",
  postalCode: "16407",
  phone: "814-964-3291",
  email: "sales@beararmsarmorypa.com",
  accessoriesImageUrl: "",
  accessoriesDescription: "",
  // Hiding inventory never deletes records; it only removes the public section.
  showInventory: false,
  hours: "Call for current hours.",
  about:
    "Bear Arms Armory is a father-and-son business in Corry, Pennsylvania. Founded in 2023, the store is part of the local community on East Columbus Avenue.",
  storeImageUrl: "",
  storeImageAlt: "",
};
export type StorePhoto = { url: string; description: string };
export type Business = typeof defaultBusiness & {
  storePhotos?: StorePhoto[];
  accessoriesPhotos?: StorePhoto[];
};

// An explicitly empty gallery must not resurrect the previous single photo.
export function getStorePhotos(business: Business): StorePhoto[] {
  return (
    business.storePhotos ??
    (business.storeImageUrl
      ? [{ url: business.storeImageUrl, description: business.storeImageAlt }]
      : [])
  );
}
export const MAX_STORE_PHOTOS = 20;

// Knives, lights and optics started with one photo. Keep showing it until the
// client saves the new photo list; an explicitly empty list stays empty.
export function getAccessoriesPhotos(business: Business): StorePhoto[] {
  return (
    business.accessoriesPhotos ??
    (business.accessoriesImageUrl
      ? [
          {
            url: business.accessoriesImageUrl,
            description: "Knives, lights and optics at Bear Arms Armory",
          },
        ]
      : [])
  );
}
export const MAX_ACCESSORIES_PHOTOS = 20;
export const siteOrigin =
  process.env.SITE_URL || "https://www.beararmsarmorypa.com";
export const storeTimeZone = "America/New_York";

// Client-provided business page; maintained with the website.
export const facebookUrl =
  "https://www.facebook.com/p/Bear-Arms-Armory-61554325822692/";
