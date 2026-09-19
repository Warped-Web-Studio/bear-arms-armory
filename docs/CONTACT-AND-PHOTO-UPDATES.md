# Contact, managed section, and photo uploads

Business information (`/admin/business`) now includes a single “Knives, Lights and Optics” photo/description block. Upload, replace, or remove the photo and save business information. Either photo or description can stand alone; the public section is hidden when both are empty. Images use the existing responsive contain presentation without stretching or cropping.

“Email Us” appears under Get in touch, with the client-provided `sales@beararmsarmorypa.com` as the default and fallback for previously empty settings. The client-provided Facebook page is hard-coded in `lib/business.ts` and displayed with a Facebook logo under Get in touch. It is not editable in the admin dashboard.

These fields extend the existing validated business JSON settings. No database migration or production data mutation is required. Existing authentication and server-side save authorization remain in place.

## Photo preparation

All existing PhotoUpload fields now share `lib/optimize-image.ts`. JPEG, PNG, and WebP originals up to 40 MB are decoded with EXIF orientation, fitted within a 2400px long edge without upscaling, and encoded before the upload request. The pixel limit is 100 million, checked after browser decoding. Original metadata and filenames are not copied. JPEG remains JPEG; other formats use WebP (browser PNG fallback preserves transparency). Encoding tries quality levels 0.9, 0.82, and 0.74, refusing output still above the server cap rather than degrading indefinitely.

The original 4,000,000-byte server file limit and 4,200,000-byte Server Action request limit remain. The original selected file is not sent. Authentication, MIME/signature checks, and Cloudinary image decoding/format validation still protect the upload boundary. Preparation and upload failures retain the prior selected image and release the form's busy state.

## Remaining scope and manual QA

No inventory model, inventory CRUD, or inventory visibility toggle exists in this checkout. XLS/XLSX inventory import was not implemented; this change does not add an inventory system.

Automated tests cover contact rendering, URL validation, settings persistence/removal, photo-field interactions, existing gallery ordering, processing dimensions/limits, and mocked encoding/storage failures. Before client acceptance, verify real large phone JPEGs (including EXIF portrait orientation), PNG/WebP transparency and quality, uploads to live Cloudinary, and the public/admin layouts on mobile, tablet, and desktop. Browser encoder and live storage behavior are not proven by mocked tests. A browser lacking createImageBitmap receives the photo-processing error and cannot use this preparation pipeline.
