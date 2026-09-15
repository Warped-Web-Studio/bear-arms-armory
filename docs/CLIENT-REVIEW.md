# Client review and setup

This implementation follows the revised neutral-business scope. It has no product inventory, weapon features, product pricing, purchasing, reservations, or customer accounts.

## Implemented

- One continuous public page with conditional section navigation, responsive mobile menu, weekly/monthly general business highlights, announcements, upcoming events, a paginated historical highlights gallery, about content, optional general store photograph, contact details, and map toggle.
- The map has no iframe until activated. A native button exposes `aria-expanded`; collapsing removes the iframe. Directions and the address work without opening the map.
- A small admin dashboard for highlights, events, announcements, and verified business details. Draft/published controls, server validation, inline errors, save feedback, and explicit delete confirmation.
- PostgreSQL through Neon HTTP and Drizzle. Generated migration in `drizzle/`; no migration was applied by Codex.
- Better Auth email/password sign-in. No public signup, no client-side-only authorization. Every protected page and mutation checks the server session and exact email allowlist. Database-backed rate limiting, eight-hour sessions, no cookie session cache. Removing an email from `ADMIN_EMAILS` removes access on the next protected request.
- Canonical metadata, Open Graph/Twitter metadata using the supplied logo derivative, sitemap, robots, and escaped `LocalBusiness` JSON-LD. Review builds default to noindex. Admin pages always use noindex.

## Content behavior

Weekly/monthly highlights have a title, description, optional image and accessible image description, start/end dates, publication status, and timestamps. Dates are inclusive and interpreted in `America/New_York`. The active entry with the latest start date wins; ties use creation time, then ID. An older published highlight that has started remains in the gallery when replaced or expired. Future and draft records stay out of the public gallery. Unpublishing also removes an entry from the gallery without deleting it. There is no automatic deletion or cron job.

The gallery displays 12 entries per page. Admin lists display 25. Public announcements are capped at 10 and upcoming events at 30, appropriate for this store; older records remain editable. Events appear when published and remain through the last scheduled minute of their end date/time in Eastern time. Multi-day events are supported. Ambiguous daylight-saving transition times (for example, 1:30 AM on the fall transition) cannot distinguish the first and second occurrence; use unambiguous store event times.

Empty optional sections and their links are omitted. An image-free highlight is a deliberate text layout. No sample events or business highlights are seeded. With no database configured, the neutral static business page renders, optional content is empty, and admin sign-in fails closed. An unavailable configured content database produces a public status note without internal errors; verified default business information is used as a fallback.

## Environment and external configuration

Copy `.env.example` to `.env.local` and supply secrets privately. Do not paste credentials into chat.

| Variable                   | Purpose                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`             | Neon PostgreSQL connection string. The implementation uses the Neon HTTP driver.                  |
| `BETTER_AUTH_SECRET`       | A cryptographically random secret of at least 32 characters.                                      |
| `BETTER_AUTH_URL`          | Exact application origin, HTTPS in production; localhost for development.                         |
| `ADMIN_EMAILS`             | Comma-separated exact email addresses allowed to administer this business.                        |
| `SITE_URL`                 | Approved canonical production origin; defaults to the confirmed existing website.                 |
| `SITE_INDEXABLE`           | Set to `true` only on approved production. Keep false on review deployments.                      |
| `IMAGE_HOST`               | Optional additional HTTPS image-library hostname, without scheme/path. Not required for Cloudinary uploads. Restart/rebuild after changing. |
| `CLOUDINARY_CLOUD_NAME`    | Cloudinary cloud name. Allows images only from this account. Keep it to render existing images after a future provider switch. |
| `CLOUDINARY_API_KEY`       | Server-only Cloudinary API key used for authenticated uploads. |
| `CLOUDINARY_API_SECRET`    | Server-only Cloudinary API secret. Never use a `NEXT_PUBLIC_` prefix. |
| `ADMIN_BOOTSTRAP_EMAIL`    | Temporary existing allowlisted email for local account maintenance.                               |
| `ADMIN_BOOTSTRAP_PASSWORD` | Temporary 14–128 character password for local account maintenance. Remove after use.              |

After creating a Neon database, review the SQL, then run `npm run db:migrate`. This runs committed migration files; do not use schema push against production. Run `npm run admin:create` once to provision an allowlisted administrator. No public sign-up route is enabled. For developer-assisted recovery, `npm run admin:reset-password` changes an existing account password with Better Auth's hashing function and revokes its sessions atomically. Neither command was run against a live database during implementation.

The application runs on a Node-compatible Next.js host. No hosting account, database, storage subscription, email service, or deployment was created. Configure backups and HTTPS on the chosen production services. Forward real client IPs only through the host's trusted proxy configuration for authentication rate limits.

## Dynamic images

Database rows store image URLs and alt descriptions, not binary files. Admins may use images from the configured Cloudinary account and one additional approved HTTPS host. Local raster image paths under `/client-assets/` and `/derived/` are also supported, including when `IMAGE_HOST` is unset. For example, use `/client-assets/logo/Logo.jpg` (omit the `public` prefix). Supported formats are JPEG, PNG, WebP, and AVIF; PDF files, traversal paths, and local query strings are rejected. Other hosts, credentials in URLs, data URLs, and arbitrary local paths are rejected server-side. Next.js optimizes these images.

### Local photo uploads (Cloudinary Free)

The content and business forms now accept local JPEG, PNG, and WebP files up to 4 MB. Selecting a file uploads it, shows a preview, and fills the existing image-link field. Add the image description and save the form to attach it to the record. Saving is blocked during upload. Failed uploads preserve the previous image; failed content saves retain the new URL so the client can retry without uploading again. Images remain optional. Remove photo clears the field; save to apply the removal.

Setup:

1. Create a [free Cloudinary Image & Video API account](https://cloudinary.com/users/register_free). The free plan supports production use within its [25-credit allowance](https://cloudinary.com/documentation/billing_and_plans), shared across storage, bandwidth, and transformations.
2. In Cloudinary Console Settings → API Keys, find the cloud name, API key, and API secret.
3. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` privately in `.env.local` and in the deployment's environment settings. Copy the variable names from `.env.example`. No unsigned upload preset is needed. No `IMAGE_HOST` change is required.
4. Restart the development server or rebuild/redeploy the hosted site so Next.js permits the account's image URLs.
5. Sign into the admin dashboard, choose a photo in a content form or Business information, add an image description, and save. Reopen the record and check the public image when published.

Without all three settings, upload controls are disabled with a setup message. Existing paths and approved image links continue to work. Credentials are never returned to the browser. Every upload checks `requireAdmin` server-side before reading the file or calling Cloudinary. The application checks size, MIME type, and raster file signatures; Cloudinary's image endpoint decodes the file and restricts accepted formats. Signed server-to-server requests use unique IDs, do not overwrite previous assets, omit the user's original filename, and time out after 30 seconds. Provider errors are not exposed to the client. The Server Action body limit is 4.2 MB, leaving space for multipart overhead above the 4 MB file limit.

Uploaded photos use public delivery URLs, including photos attached to drafts. Use this feature for photos intended for the website. Removing/replacing a photo or deleting a record does not delete the stored file, which may be referenced elsewhere. Abandoned uploads also remain in Cloudinary. Review unused assets in the Cloudinary console and verify they are unreferenced before deleting them; monitor the free allowance there.

`lib/image-storage.ts` is the provider boundary: `storeImage(file)` returns a URL. A future Vercel Blob integration can replace this function and its configuration without changing the database schema or client workflow. Existing Cloudinary URLs must remain hosted (retain the cloud name and account) or be migrated explicitly; switching upload providers does not move old files automatically.

## Verified business information and assets

The user confirmed `beararmsarmorypa.com` as the correct site. Sources inspected on September 12, 2026:

- [Existing home page](https://www.beararmsarmorypa.com/): father-and-son ownership, started in 2023, address, phone.
- [Existing contact page](https://www.beararmsarmorypa.com/contact): footer address and phone. Its main contact body contains obvious demo data and was deliberately excluded.

Address: 740 E. Columbus Ave., Corry, PA 16407. Phone: 814-964-3291. Hours and email were not verified. The page says “Call for current hours” and omits email. Replace these through Business information when the client confirms them.

All client originals remain unchanged. `Logo.jpg` is 292 × 292. `BearArms_Outline.pdf` is a 360-point square with vector paths plus one raster image; it supplied the separately cropped 900 × 916 WebP logo at `public/derived/bear-arms-logo.webp`. The source logo's existing colors and imagery were retained.

The 12 supplied inventory photographs are close-ups of product displays, not neutral exterior/team photographs. They were inspected only for visual suitability, never used to infer products, availability, or records, and are not included in this neutral build. Supply a general storefront/team/interior photograph for the optional store-photo area. There are no fabricated photographs or placeholder promotional slots.

## MANUAL CLIENT CONTENT INSERTION GUIDE

No source-code insertion is required for business content. Use the authenticated dashboard after configuration.

| Area                        | Source/component                                       | Where to populate                                                | Image presentation                                                                                                                             |
| --------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Featured This Week / Month  | `components/highlight.tsx`, `Highlight`                | Admin → Featured This Week / Month                               | Desktop 4:5; mobile 3:2; cover, centered. Prefer 1600 × 2000 or larger with generous space around the subject. Optional.                       |
| Store Highlights Gallery    | `app/page.tsx`, `Home`                                 | Derived automatically from previous published highlights         | 3:2 cover; center the subject. No separate manual archive records.                                                                             |
| Events                      | `app/page.tsx`, `Home`                                 | Admin → Events                                                   | 3:2 cover, centered; about 1600 × 1067 or larger. Optional.                                                                                    |
| Announcements               | `app/page.tsx`, `Home`                                 | Admin → Announcements                                            | 3:2 cover, centered. Optional.                                                                                                                 |
| Store photography           | `app/page.tsx`, `Home`; `components/content-image.tsx` | Admin → Business information → Upload photo / description | 21:9 desktop, 3:2 mobile, cover. General store photograph around 2000 pixels wide; important subjects near the center. Omitted until provided. |
| Hours, email, about/contact | `components/admin/business-form.tsx`, `BusinessForm`   | Admin → Business information                                     | Verified text only. Hours can use one line per day.                                                                                            |
| Logo                        | `app/page.tsx`, `Home`                                 | Existing `/derived/bear-arms-logo.webp`                          | Preserve ratio; contain. No replacement needed.                                                                                                |

## Manual acceptance checklist

- Configure a non-production Neon database, apply migrations, create an allowlisted admin, and verify login/logout and persistence across restarts.
- Confirm an unauthenticated request cannot read admin content or mutate records. Remove an email from the allowlist and verify its existing session loses access.
- Create, edit, unpublish, republish, and delete neutral highlights; test overlapping dates, expiration, archive pagination, and entries without images.
- Verify a same-day event disappears after its end time; test future, draft, and multi-day events.
- Configure Cloudinary and test a real local upload, replacement, removal, invalid/oversized file, image description, save/reopen persistence, and public image rendering on mobile and desktop. Confirm uploads fail after sign-out. Test allowed-host links, database-unavailable errors, and destructive confirmation.
- Verify logo, public/admin layout, keyboard focus, mobile menu, form validation, 200% text zoom, and gallery at narrow widths.
- Confirm map hidden initially, reveal/collapse and `aria-expanded`, and directions/call links on a phone.
- Obtain verified hours, optional email, and neutral store photography; review all public copy with the client.
- Before launch, set the production origin and indexing setting, check canonical/structured data, and submit the sitemap to Search Console.

## Verification results

- `npm run lint`: passed, no warnings.
- `npm run typecheck`: passed.
- `npm test`: 48 tests passed across eight files. Tests cover publication/history rules, Eastern-time event expiration, validation, optional images, server authorization, protected mutations, safe authentication errors, map/navigation behavior, and form values/record identity across failed saves, signed uploads with mocked Cloudinary, upload authorization and validation, provider failures, account-scoped URLs, and photo replacement/removal.
- `npm run build -- --webpack`: passed. The default Turbopack build was blocked by the environment when its CSS compiler tried to bind a local port, including on an escalated retry. The standard build script remains unchanged.
- The local homepage returned HTTP 200. Exhaustive visual/browser QA was deliberately left to the human developer.
- No live database migration, account creation, live sign-in, storage upload, or deployment was performed. External services are mocked in tests; tests do not contact production APIs.
- Dependency audit: four moderate advisories in Drizzle Kit's development-only esbuild dependency chain; zero production-dependency advisories. The suggested automatic resolution was a breaking Drizzle Kit downgrade and was not applied.
- No Git operations were performed. All client source assets remain untouched; the logo derivative and favicon are separate outputs.
